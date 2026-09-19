/**
 * The end-of-phase check, run against whatever the phase produced.
 *
 *   node ../pipeline/selfcheck.mjs --phase=1
 *   node ../pipeline/selfcheck.mjs --phase=3
 *
 * Four things:
 *
 *  1. Every output is the size and rate the config says, the length the
 *     timeline says, and has audio where the phase should have audio and none
 *     where it should not.
 *  2. Frames from every beat are written to `out/selfcheck/`, with the safe box
 *     drawn on them, to be looked at — not merely counted. Three per beat, not
 *     one: the style sheet's tiles animate a line with pauses in it, and a
 *     single midpoint frame once landed in a pause and read as "the tiles
 *     render nothing".
 *  3. **No captions are generated anywhere near the footage.** Grepped, not
 *     remembered. Every word over the app's playback comes out of Wordburn's
 *     own export; a pipeline that could draw its own would be advertising a
 *     transcription this app did not do.
 *  4. A short report.
 *
 * For a hooks-and-body project (video 02) there are two more:
 *
 *  5. The body is **the same bytes in every output**. The join is `-c copy`,
 *     so it should be, and "should be" is checked by hashing every decoded
 *     frame from the hook's end onward in each file and comparing the lists.
 *  6. Each hook's text is on screen by one second — asserted on the config,
 *     because the frame at 1.0 s is also written out for the eye.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { HERE, OUT, PROJECT, REMOTION, arg, config, probe, safeLabel, timings } from './lib.mjs';
import { beatMidpoints, buildBeats, totalFrames } from './beats.js';

/**
 * The safe boxes, written down here as well as in each `config.json`. On
 * purpose: a check that imported the value it is checking would pass for any
 * value at all. `config.safeBox.kind` picks one and the config's own numbers
 * must agree with it.
 */
const SAFE_BOXES = {
  paid: { x0: 60, y0: 211, x1: 960, y1: 1128 },
  organic: { x0: 60, y0: 211, x1: 960, y1: 1498 },
};

const phase = Number(arg('phase', '1'));
const cfg = config();
const t = timings();
const beats = buildBeats(cfg, t);
const fps = cfg.format.fps;
const bodySec = totalFrames(beats) / fps;
const hookSec = cfg.hooks ? cfg.hookSec : 0;

const problems = [];
const notes = [];
const fail = (s) => problems.push(s);

const kind = cfg.safeBox.kind ?? 'paid';
const SAFE = SAFE_BOXES[kind];
if (!SAFE) fail(`safeBox.kind '${kind}' is not one this check knows`);
else {
  for (const k of ['x0', 'y0', 'x1', 'y1']) {
    if (cfg.safeBox[k] !== SAFE[k]) fail(`safeBox.${k} is ${cfg.safeBox[k]}; the ${kind} box says ${SAFE[k]}`);
  }
}

/** What this phase should have produced, and whether it should speak. */
const wantAudio = cfg.checks?.[String(phase)]?.audio;
if (wantAudio === undefined) {
  console.error(`config.json has no checks["${phase}"]. Use 1 (silent cut) or 3 (with voice).`);
  process.exit(1);
}
const EXPECTED = cfg.hooks
  ? cfg.hooks.map((h) => ({ file: `out/tutorial_${h.id}.mp4`, audio: wantAudio, sec: hookSec + bodySec, hook: h }))
  : (phase === 1 ? [cfg.defaultVariant] : Object.keys(cfg.variants)).map((v) => ({
      file: `out/film_${v}.mp4`,
      audio: wantAudio,
      sec: bodySec,
    }));

console.log(`\n═══ Phase ${phase} self-check · ${cfg.id} ═══\n`);

// ── 1. the files themselves ────────────────────────────────────────────────
const rows = [];
for (const want of EXPECTED) {
  const path = resolve(PROJECT, want.file);
  if (!existsSync(path)) {
    fail(`${want.file} — missing`);
    continue;
  }

  const info = probe(path);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const sec = Number(info.format.duration);
  const mb = statSync(path).size / 1e6;

  const [num, den] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  const got = den ? num / den : 0;

  if (v?.width !== cfg.format.width || v?.height !== cfg.format.height) {
    fail(`${want.file} — ${v?.width}x${v?.height}, expected ${cfg.format.width}x${cfg.format.height}`);
  }
  if (Math.abs(got - fps) > 0.01) fail(`${want.file} — ${got} fps, expected ${fps}`);
  if (Math.abs(sec - want.sec) > 0.08) {
    fail(`${want.file} — ${sec.toFixed(2)} s, the timeline says ${want.sec.toFixed(2)} s`);
  }
  if (want.audio && !a) fail(`${want.file} — no audio stream, and phase ${phase} needs one`);
  if (!want.audio && a) fail(`${want.file} — has an audio stream, and phase ${phase} must be silent`);

  rows.push(
    `  ${want.file.padEnd(30)} ${v?.width}x${v?.height}  ${got} fps  ` +
      `${sec.toFixed(2)} s  ${mb.toFixed(1)} MB  audio ${a ? a.codec_name : 'none'}`
  );
}
console.log('FILES');
console.log(rows.join('\n') || '  (none)');

// ── 2. frames to look at ───────────────────────────────────────────────────
const dir = resolve(OUT, 'selfcheck');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const box = `drawbox=x=${SAFE.x0}:y=${SAFE.y0}:w=${SAFE.x1 - SAFE.x0}:h=${SAFE.y1 - SAFE.y0}:color=0x00FF88@0.6:t=3`;
const grab = (file, sec, name) =>
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-ss', sec.toFixed(3), '-i', file, '-frames:v', '1', '-vf', box, resolve(dir, name)],
    { stdio: 'inherit' }
  );
const stem = (s) => safeLabel(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 40);

let written = 0;
const primary = resolve(PROJECT, EXPECTED[0].file);
if (existsSync(primary)) {
  // Each hook at 1.0 s — the text must be up — and at 2.5 s, nearly resolved.
  if (cfg.hooks) {
    EXPECTED.forEach((want, i) => {
      const path = resolve(PROJECT, want.file);
      if (!existsSync(path)) return;
      for (const [j, sec] of [1.0, 2.5].entries()) {
        grab(path, sec, `h${i + 1}${'ab'[j]}-${stem(want.hook.id)}-${stem(want.hook.title)}.png`);
        written += 1;
      }
      if (want.hook.titleAt > 1.0) fail(`hook ${want.hook.id} — title arrives at ${want.hook.titleAt} s; it must be up by 1.0`);
    });
  }

  // Three frames per beat of the body, offset past the hook.
  const AT = [0.25, 0.5, 0.75];
  beatMidpoints(beats, fps).forEach((m, i) => {
    AT.forEach((frac, j) => {
      const sec = hookSec + m.fromSec + m.durSec * frac;
      grab(primary, sec, `${String(i + 1).padStart(2, '0')}${'abc'[j]}-${stem(m.name)}.png`);
      written += 1;
    });
  });

  notes.push(
    `${written} frames in out/selfcheck/ — ${cfg.hooks ? 'two per hook, ' : ''}three per beat, named by beat; ` +
      `the green box is the ${kind} safe zone. Look at them.`
  );
}

// ── 3. nothing in here generates a caption ─────────────────────────────────
const BANNED = [
  { re: /\bwhisper\b/i, why: 'transcription' },
  { re: /\.srt\b/i, why: 'subtitle file' },
  { re: /subtitles\s*=/i, why: 'ffmpeg subtitle filter' },
  { re: /\bCaptionTrack\b/, why: "the ad project's own caption renderer" },
  { re: /layoutCaptionFrame/, why: "the app's caption layout" },
];

const compDir = typeof cfg.composition === 'object' ? cfg.composition.dir : (cfg.composition ?? 'film');
const scanDirs = [HERE, resolve(REMOTION, 'src', compDir), resolve(REMOTION, 'src/parts')];
const offences = [];
for (const d of scanDirs) {
  if (!existsSync(d)) continue;
  for (const name of readdirSync(d)) {
    if (!/\.(mjs|js|ts|tsx|sh)$/.test(name)) continue;
    // The rule's own statement of itself is not a breach of it.
    if (name === 'selfcheck.mjs') continue;
    const text = readFileSync(resolve(d, name), 'utf8');
    for (const { re, why } of BANNED) {
      const hits = text
        .split('\n')
        .map((l, n) => ({ l, n: n + 1 }))
        .filter(({ l }) => re.test(l) && !/^\s*(\*|\/\/|#)/.test(l));
      for (const hit of hits) offences.push(`${name}:${hit.n} — ${why}: ${hit.l.trim().slice(0, 80)}`);
    }
  }
}
if (offences.length) offences.forEach((o) => fail(`caption generation — ${o}`));

console.log('\nCAPTIONS');
console.log(
  offences.length
    ? offences.map((o) => `  ✗ ${o}`).join('\n')
    : `  ✓ nothing in pipeline/, src/${compDir}/ or src/parts/ transcribes, burns or draws a caption.\n` +
      "    Every caption in this video came out of the app's own export."
);

// ── 5. the body is the same bytes in every output ──────────────────────────
if (cfg.hooks) {
  const hashes = [];
  for (const want of EXPECTED) {
    const path = resolve(PROJECT, want.file);
    if (!existsSync(path)) continue;
    // Every decoded frame from the hook's end, as MD5s, one per line. Same
    // packets decode to the same pixels, so six identical lists mean six
    // identical bodies — and a re-encode anywhere would show as six different
    // ones on the first frame.
    const md5 = execFileSync(
      'ffmpeg',
      ['-v', 'error', '-ss', String(hookSec), '-i', path, '-an', '-f', 'framemd5', '-'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.trim().split(/,\s*/).pop());
    hashes.push({ file: want.file, md5 });
  }
  console.log('\nBODY');
  if (hashes.length > 1) {
    const ref = hashes[0];
    let same = true;
    for (const h of hashes.slice(1)) {
      if (h.md5.length !== ref.md5.length) {
        fail(`${h.file} — body is ${h.md5.length} frames against ${ref.md5.length} in ${ref.file}`);
        same = false;
        continue;
      }
      const first = h.md5.findIndex((x, i) => x !== ref.md5[i]);
      if (first >= 0) {
        fail(`${h.file} — body differs from ${ref.file} from frame ${first} (${(first / fps).toFixed(2)} s in)`);
        same = false;
      }
    }
    console.log(
      same
        ? `  ✓ ${hashes.length} files, ${ref.md5.length} body frames each, identical frame for frame from ${hookSec} s.`
        : '  ✗ the body is not the same in every file — see RESULT.'
    );
  } else {
    console.log('  (fewer than two files, nothing to compare)');
  }
}

// ── 4. the report ──────────────────────────────────────────────────────────
console.log('\nTIMELINE');
if (cfg.hooks) {
  console.log(`  hook · ${hookSec.toFixed(2)} s, then:`);
}
console.log(
  beatMidpoints(beats, fps)
    .map(
      (m, i) =>
        `  ${String(i + 1).padStart(2)}. ${m.name.padEnd(46)} ` +
        `${(hookSec + m.fromSec).toFixed(2).padStart(6)} → ${(hookSec + m.fromSec + m.durSec).toFixed(2).padStart(6)} s  (${m.durSec.toFixed(2)} s)`
    )
    .join('\n')
);
const total = hookSec + bodySec;
console.log(`  total ${total.toFixed(2)} s, from the ${t.lines ? 'measured' : 'planned'} line lengths`);

if (!cfg.hooks && total > 30) notes.push(`${total.toFixed(2)} s is over the 15–30 s band a paid 9:16 unit wants`);
if (cfg.hooks && total > 30) {
  notes.push(
    `${total.toFixed(2)} s is past the 11–18 s completion band and just over 30 — the accepted cost of a tutorial that shows every feature; ` +
      'the README names the beats to drop for a 15 s cut if completion is under 50%.'
  );
}

console.log('\nNOTES');
console.log(notes.length ? notes.map((n) => `  · ${n}`).join('\n') : '  none');

console.log('\nRESULT');
if (problems.length) {
  console.log(problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('  ✓ everything checked passed.');
}
console.log('');
