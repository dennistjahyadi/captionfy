/**
 * Record the app on a booted emulator, one shot at a time.
 *
 *   node scripts/capture.mjs                 # every shot in shots.json
 *   node scripts/capture.mjs style editor    # only these
 *   node scripts/capture.mjs --probe         # screenshot now, to find coordinates
 *   node scripts/capture.mjs --list
 *
 * This is the step the original brief said a machine could not do. It can: the
 * emulator is an Android device with an adb socket, `screenrecord` is on it, and
 * the app is the release build. What a machine still cannot do is *judge* the
 * result, so every shot is written next to a first and last frame and the rule
 * is that somebody looks at them.
 *
 * Two things about `screenrecord` that are not optional knowledge:
 *
 *  - **Its output is variable frame rate.** It emits a frame when the screen
 *    changes and not otherwise, so a shot of a paused editor reports something
 *    like 0.47 fps and a shot of playback reports something near 60. Composited
 *    straight into a 30 fps timeline that is a video that stutters or runs at
 *    the wrong speed. Every capture is normalised to CFR 30 here, once, at the
 *    edge — the same rule the app itself follows for milliseconds.
 *  - **It overshoots `--time-limit`.** A three second limit produced 4.2 s. The
 *    shot is trimmed to its asked-for length after normalising, so the timeline
 *    can trust `durationSec`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROJECT, readJson } from './lib.mjs';

const PKG = 'com.wordburn.app';
const ACTIVITY = `${PKG}/.MainActivity`;
const RAW = '/sdcard/wb-capture.mp4';
const DIR = resolve(PROJECT, 'input/app');
const SHOTS = resolve(PROJECT, 'shots.json');

const adb = (args, opts = {}) =>
  execFileSync('adb', args, { encoding: 'utf8', ...opts });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fail loudly and early rather than producing a folder of black rectangles. */
const requireDevice = () => {
  const out = adb(['devices']);
  const lines = out.split('\n').slice(1).filter((l) => l.trim().endsWith('device'));
  if (!lines.length) {
    console.error('No device. Boot one:  ./run.sh --emulator');
    process.exit(1);
  }
  const installed = adb(['shell', 'pm', 'list', 'packages', PKG]).trim();
  if (!installed) {
    console.error(`${PKG} is not installed. Install it:  ./run.sh --emulator`);
    process.exit(1);
  }
  return lines[0].split(/\s+/)[0];
};

const screenshot = (path) => {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'buffer',
  });
  writeFileSync(path, png);
};

/**
 * Airplane mode, which is a claim this app makes and therefore a thing the
 * footage has to actually show rather than imply.
 */
const airplane = (on) => {
  adb(['shell', 'cmd', 'connectivity', 'airplane-mode', on ? 'enable' : 'disable']);
};

const runStep = async (step) => {
  if (step.wait) return sleep(step.wait);
  if (step.tap) {
    adb(['shell', 'input', 'tap', String(step.tap[0]), String(step.tap[1])]);
    return sleep(step.after ?? 600);
  }
  if (step.swipe) {
    const [x1, y1, x2, y2, ms] = step.swipe;
    adb(['shell', 'input', 'swipe', `${x1}`, `${y1}`, `${x2}`, `${y2}`, `${ms ?? 300}`]);
    return sleep(step.after ?? 600);
  }
  if (step.key) {
    adb(['shell', 'input', 'keyevent', step.key]);
    return sleep(step.after ?? 600);
  }
  if (step.airplane !== undefined) {
    airplane(step.airplane);
    return sleep(step.after ?? 1500);
  }
  if (step.launch) {
    adb(['shell', 'am', 'force-stop', PKG]);
    // `am start` on the resolved component, not `monkey`. Monkey exits non-zero
    // on a perfectly successful launch — it reports "SYS_KEYS has no physical
    // keys" and returns 251 — so a launch that worked killed the run.
    adb(['shell', 'am', 'start', '-n', ACTIVITY]);
    return sleep(step.after ?? 4000);
  }
  throw new Error(`unknown step: ${JSON.stringify(step)}`);
};

/**
 * Did the screen move at all?
 *
 * `screenrecord` emits a frame only when something changes, so a shot of a
 * screen that sits still — Home, a paused editor — comes back as **one frame
 * with a duration of zero**. That file cannot be stretched: the lone frame
 * carries no usable timestamp, `fps=30` drops it with "No filtered frames for
 * output stream", and the encode writes a valid 261-byte mp4 containing no
 * video. A capture that ran perfectly and output nothing.
 *
 * Forcing `-r 30` on the input rescues it, but at a price that is only
 * invisible here: it throws away the real timing and re-stamps every recorded
 * frame as one frame of 30 fps, so any shot that *did* move would play at the
 * wrong speed. So the still case is detected and built from the screenshot
 * instead, which is the honest description of what was recorded anyway.
 */
const stillCapture = (raw) => {
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v', '-count_frames',
       '-show_entries', 'stream=nb_read_frames', '-show_entries', 'format=duration',
       '-print_format', 'json', raw],
      { encoding: 'utf8' }
    )
  );
  const frames = Number(probe.streams?.[0]?.nb_read_frames ?? 0);
  const seconds = Number(probe.format?.duration ?? 0);
  return frames < 2 || !Number.isFinite(seconds) || seconds < 0.2;
};

/** Put the app where the shot starts, before the recorder is running. */
const setup = async (shot) => {
  for (const step of shot.setup ?? []) await runStep(step);
};

const captureOne = async (shot) => {
  process.stdout.write(`\n── ${shot.id} — ${shot.what}\n`);

  await setup(shot);
  screenshot(resolve(DIR, `${shot.id}.start.png`));

  const limit = Math.ceil(shot.durationSec) + 3;
  const rec = spawn('adb', [
    'shell', 'screenrecord',
    '--time-limit', String(limit),
    '--bit-rate', '16000000',
    RAW,
  ]);

  // screenrecord takes a beat to open the encoder; steps fired before that are
  // steps that happen off camera.
  await sleep(1200);

  for (const step of shot.steps ?? []) await runStep(step);
  await sleep((shot.tailMs ?? 800));

  screenshot(resolve(DIR, `${shot.id}.end.png`));

  // SIGINT makes screenrecord finalise the container. Killing it harder leaves
  // an mp4 with no moov atom, which ffprobe reports as "Invalid data" and which
  // looks exactly like a capture that never started.
  adb(['shell', 'pkill', '-INT', 'screenrecord']);
  await new Promise((r) => rec.on('exit', r));
  await sleep(1500);

  const raw = resolve(DIR, `${shot.id}.raw.mp4`);
  adb(['pull', RAW, raw], { stdio: 'ignore' });
  adb(['shell', 'rm', '-f', RAW]);

  const out = resolve(DIR, `${shot.id}.mp4`);
  const still = stillCapture(raw);

  execFileSync(
    'ffmpeg',
    still
      ? [
          // The screen never moved. Build the clip from the frame rather than
          // from the recording — see `stillCapture` for why the recording is
          // not usable.
          '-v', 'error', '-y',
          '-loop', '1', '-framerate', '30', '-i', resolve(DIR, `${shot.id}.start.png`),
          '-t', String(shot.durationSec),
          '-an',
          '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          out,
        ]
      : [
          '-v', 'error', '-y',
          '-i', raw,
          // VFR in, CFR 30 out, trimmed to what the timeline was promised.
          // `tpad` clones the last frame forward so a shot that went still at
          // the end still fills its slot; `-t` trims, so a moving shot pays
          // nothing for it.
          '-vf', `fps=30,tpad=stop_mode=clone:stop_duration=${shot.durationSec}`,
          '-t', String(shot.durationSec),
          '-r', '30',
          '-an',
          '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          out,
        ],
    { stdio: 'inherit' }
  );

  if (still) console.log(`   ${shot.id}: the screen never moved — built from the still`);

  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', out], {
      encoding: 'utf8',
    })
  );
  const v = probe.streams.find((s) => s.codec_type === 'video');
  console.log(
    `   ${shot.id}.mp4  ${v.width}x${v.height}  ${v.r_frame_rate}  ` +
      `${Number(probe.format.duration).toFixed(2)} s  ` +
      `${(Number(probe.format.size) / 1e6).toFixed(1)} MB`
  );

  return {
    id: shot.id,
    what: shot.what,
    file: `${shot.id}.mp4`,
    width: v.width,
    height: v.height,
    durationSec: Number(probe.format.duration),
  };
};

// ───────────────────────────────────────────────────────────────────────────

mkdirSync(DIR, { recursive: true });

if (process.argv.includes('--probe')) {
  requireDevice();
  const path = resolve(PROJECT, 'out/probe.png');
  mkdirSync(resolve(PROJECT, 'out'), { recursive: true });
  screenshot(path);
  console.log(`${path} — open it and read the coordinates off it.`);
  console.log('The emulator is 1080 x 2400; a screenshot is 1:1 with input taps.');
  process.exit(0);
}

if (!existsSync(SHOTS)) {
  console.error(`No shots.json at ${SHOTS}`);
  process.exit(1);
}

const shots = readJson(SHOTS).shots;

if (process.argv.includes('--list')) {
  shots.forEach((s) => console.log(`${s.id.padEnd(14)} ${s.durationSec}s  ${s.what}`));
  process.exit(0);
}

requireDevice();

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const todo = only.length ? shots.filter((s) => only.includes(s.id)) : shots;
if (!todo.length) {
  console.error(`No shot matched ${only.join(', ')}. --list shows them.`);
  process.exit(1);
}

const manifest = existsSync(resolve(PROJECT, 'app-shots.json'))
  ? readJson(resolve(PROJECT, 'app-shots.json'))
  : { note: 'Written by scripts/capture.mjs. Emulator recordings of the real app.', shots: {} };

for (const shot of todo) {
  manifest.shots[shot.id] = await captureOne(shot);
}

// Airplane mode is global state on the device, not state of a shot. Leaving it
// on would silently poison the next capture run and every manual check after it.
airplane(false);

writeFileSync(resolve(PROJECT, 'app-shots.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\napp-shots.json written. Look at input/app/*.start.png and *.end.png before trusting any of it.`);
