/**
 * Find where one recorded body divides into its beats, and write the timing.
 *
 *   node ../pipeline/split-voice.mjs              # → timings.json, and the cuts printed
 *   node ../pipeline/split-voice.mjs --write      # also write body_1..N.mp3
 *   node ../pipeline/split-voice.mjs --noise=-30 --gap=0.22
 *
 * **Why one recording and not N.** A text-to-speech model is steadier over a
 * hundred and fifty words than over twelve, and N separate generations drift in
 * energy against each other — which matters more than usual here, because the
 * body is the control half of a six-way test of the hook.
 *
 * **The beats are cut to the audio, not the audio to the beats.** The finished
 * video plays this file whole, from frame zero, so every beat boundary has to
 * land exactly on a boundary in the recording or the picture walks away from
 * the voice. That is why `timings.json` gets `pad: 0` from here: the measured
 * lengths already tile the whole file, and the 0.8 s of room `beats.js` adds to
 * a *planned* length would be 0.8 s of drift per beat.
 *
 * **Cuts are found by counting sentences, not by guessing at times.** A beat may
 * hold more than one sentence — the close holds two — so the number of sentence
 * breaks in the recording is the sum over the beats, and the longest that many
 * pauses are those breaks. A beat then ends at the break after its last
 * sentence. Two earlier versions got this wrong in opposite directions: taking
 * the N−1 longest pauses put a cut inside the close, and taking the pause
 * nearest each expected time let a 0.26 s comma outrank a 0.46 s full stop
 * two seconds away. The word count survives only as the cross-check that says
 * when a cut has landed somewhere the script cannot explain.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROJECT, arg, config, durationSec, readJson } from './lib.mjs';
import { resolveVoice } from './beats.js';

// `--voice=<id>` measures that voice's own recordings and writes them into its
// own slot in timings.json, leaving the default voice's numbers alone. Two
// cuts of one script therefore never overwrite each other's measurements.
const voiceId = arg('voice', null);
const { cfg } = resolveVoice(config(), {}, voiceId);
const lines = cfg.beats.filter((b) => b.vo).map((b) => ({ id: b.id, vo: b.vo }));

const DIR = resolve(PROJECT, 'input/voice');
const SRC = resolve(DIR, arg('in', cfg.voiceFile ?? 'body.mp3'));
const noise = Number(arg('noise', '-34'));
const gap = Number(arg('gap', '0.24'));
const write = process.argv.includes('--write');

if (!existsSync(SRC)) {
  console.error(
    [
      `No ${SRC}.`,
      '',
      'Record the whole body as one generation and put it there.',
      'out/voiceover_script.md has the text.',
    ].join('\n')
  );
  process.exit(1);
}

const total = durationSec(SRC);

/**
 * Every silence in the file.
 *
 * `silencedetect` reports on stderr and ffmpeg exits 0 either way, so this is
 * `spawnSync` with stderr read by name. `execFileSync` hands back stdout, which
 * is empty here and fails a line later with a type error naming nothing.
 */
const detect = () => {
  const r = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-i', SRC, '-af', `silencedetect=noise=${noise}dB:d=${gap}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  const found = [];
  let open = null;
  for (const line of (r.stderr ?? '').split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) open = Number(s[1]);
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && open !== null) {
      found.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  // Silence at the very head or tail is not a boundary between two lines.
  return found.filter((g) => g.end < total - 0.05 && g.start > 0.05);
};

const gaps = detect();

console.log(`\n${SRC}`);
console.log(`  ${total.toFixed(2)} s · ${lines.length} beats · ${gaps.length} pauses at ${noise} dB / ${gap} s\n`);

// How many sentences each beat holds. The close holds two, and that single
// fact is what the first version of this got wrong: it chose the N−1 longest
// pauses, which put a cut inside the close and left a comma doing a sentence's
// job eight beats earlier.
const sentences = (text) => text.split(/[.?!]+(?:\s+|$)/).filter((x) => x.trim()).length;
const perBeat = lines.map((l) => sentences(l.vo));
const totalSentences = perBeat.reduce((a, b) => a + b, 0);
const wantBoundaries = totalSentences - 1;

if (gaps.length < wantBoundaries) {
  console.error(
    `Only ${gaps.length} pauses, and ${totalSentences} sentences need ${wantBoundaries}. Try --noise=-30 or --gap=0.18.`
  );
  process.exit(1);
}

// A sentence break is reliably longer than a comma, and that — not where the
// word count says it should be — is what identifies it. Position is kept only
// as a check afterwards, because a pause chosen by length can still be the
// wrong one if the read does not match the script at all.
const boundaries = gaps
  .slice()
  .sort((a, b) => b.end - b.start - (a.end - a.start))
  .slice(0, wantBoundaries)
  .sort((a, b) => a.start - b.start)
  .map((g) => (g.start + g.end) / 2);

// Beat i ends at the boundary after its last sentence. The final beat runs to
// the end of the file, so the last boundary inside it is never a cut.
let seen = 0;
const cutIndex = perBeat.slice(0, -1).map((n) => {
  seen += n;
  return seen - 1;
});
const cuts = cutIndex.map((bi) => ({ at: boundaries[bi] }));

// The word count is the cross-check, not the chooser: it says roughly where a
// boundary belongs, and a cut far from that means the recording and the script
// have drifted apart.
const words = lines.map((l) => l.vo.trim().split(/\s+/).length);
const allWords = words.reduce((a, b) => a + b, 0);
let run = 0;
const expected = words.slice(0, -1).map((w) => {
  run += w;
  return (run / allWords) * total;
});
cuts.forEach((c, i) => {
  c.drift = Math.abs(c.at - expected[i]);
});

for (let i = 1; i < cuts.length; i += 1) {
  if (cuts[i].at <= cuts[i - 1].at) {
    console.error(`Cut ${i + 1} is not after cut ${i}. The read does not divide the way config.json says.`);
    process.exit(1);
  }
}

const bounds = [0, ...cuts.map((c) => c.at), total];
const measured = lines.map((l, i) => ({ id: l.id, sec: Number((bounds[i + 1] - bounds[i]).toFixed(3)) }));

console.log('');
measured.forEach((m, i) => {
  const drift = i < cuts.length ? ` · ${cuts[i].drift.toFixed(2)} s from expected` : '';
  console.log(`  ${String(i + 1).padStart(2)}. ${m.id.padEnd(11)} ${bounds[i].toFixed(2)} → ${bounds[i + 1].toFixed(2)}  (${m.sec.toFixed(2)} s)${drift}`);
  console.log(`      ${lines[i].vo}`);
});

const worst = Math.max(...cuts.map((c) => c.drift));
if (worst > 1.8) {
  console.log(
    `\n  ! The worst cut is ${worst.toFixed(2)} s from where the word count put it.` +
      '\n    That is usually a line in config.json that does not match what was said. Listen before rendering.'
  );
}

// The hooks are separate recordings, one per file, so they are measured rather
// than split. Each beat of picture is its own audio plus a short tail, which is
// why the six finished videos are not the same length as each other.
const hooks = (cfg.hooks ?? []).map((h) => {
  const file = resolve(DIR, h.audio ?? `hook_${h.id}.mp3`);
  if (!existsSync(file)) {
    console.error(`\nNo ${file}. Every hook needs its own recording before the voiced cut can render.`);
    process.exit(1);
  }
  const sec = durationSec(file);
  const tail = h.tailSec ?? 0.45;
  console.log(`  hook ${h.id.padEnd(11)} ${sec.toFixed(2)} s + ${tail.toFixed(2)} tail = ${(sec + tail).toFixed(2)} s`);
  return { id: h.id, sec: Number(sec.toFixed(3)), tailSec: tail };
});

const tPath = resolve(PROJECT, 'timings.json');
const timings = readJson(tPath);
const slot = {
  source: 'measured',
  lines: measured,
  // The pieces tile the whole recording, so there is no room to add around them.
  pad: 0,
  voice: { file: arg('in', cfg.voiceFile ?? 'body.mp3'), totalSec: Number(total.toFixed(3)) },
  hooks,
};
if (voiceId && voiceId !== 'default') {
  timings.voices = { ...(timings.voices ?? {}), [voiceId]: slot };
} else {
  Object.assign(timings, slot);
}
writeFileSync(tPath, JSON.stringify(timings, null, 2) + '\n');
console.log(
  `\ntimings.json written — ${measured.length} measured beats (${total.toFixed(2)} s, pad 0) and ${hooks.length} measured hooks` +
    `${voiceId && voiceId !== 'default' ? `, under voices.${voiceId}` : ''}.`
);

if (write) {
  mkdirSync(DIR, { recursive: true });
  lines.forEach((line, i) => {
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-y', '-ss', bounds[i].toFixed(3), '-to', bounds[i + 1].toFixed(3), '-i', SRC,
       '-c:a', 'libmp3lame', '-b:a', '128k', resolve(DIR, `body_${i + 1}.mp3`)],
      { stdio: 'inherit' }
    );
  });
  console.log(`${lines.length} pieces written. The render does not use them — it plays the whole file — but they are the quick way to hear a cut.`);
}
