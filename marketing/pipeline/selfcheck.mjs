/**
 * The end-of-phase check, run against whatever the phase produced.
 *
 *   node scripts/selfcheck.mjs --phase=1
 *   node scripts/selfcheck.mjs --phase=3
 *   node scripts/selfcheck.mjs --phase=5
 *
 * Four things, which are the brief's four:
 *
 *  1. Every output is 1080 x 1920 at 30 fps, the length the timeline says, and
 *     has audio where the phase should have audio and none where it should not.
 *  2. A frame from the middle of every beat is written to `out/selfcheck/`, to
 *     be looked at — not merely counted. The check the eye does here is that
 *     the text is readable and inside the safe box, that placeholders are
 *     labelled as placeholders, and from Phase 5 that the aeroplane is visible
 *     in the first six seconds.
 *  3. **No captions are generated anywhere near the demo clip.** Grepped, not
 *     remembered. In the finished video every word over the playback comes out
 *     of Wordburn's own export; a pipeline that could draw its own would be
 *     advertising a transcription this app did not do, which is the one failure
 *     that would make the whole video a lie.
 *  4. A short report.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { OUT, PROJECT, REMOTION, config, probe, safeLabel, timings } from './lib.mjs';
import { beatMidpoints, buildBeats, totalFrames } from '../beats.js';

/**
 * The overlay-text box, in pixels, and the one number in this project that is
 * written down twice — here and in `../../remotion/src/airplane/timeline.ts`.
 * On purpose: a check that imported the value it is checking would pass for any
 * value at all.
 */
const SAFE = { x0: 60, y0: 211, x1: 960, y1: 1128 };

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const phase = Number(arg('phase', '1'));
const cfg = config();
const beats = buildBeats(cfg, timings());
const expectedSec = totalFrames(beats) / cfg.format.fps;

const problems = [];
const notes = [];
const fail = (s) => problems.push(s);

/** What each phase is supposed to have produced, and whether it should speak. */
const EXPECTED = {
  1: [{ file: 'out/film_a.mp4', audio: false, sec: expectedSec }],
  3: [
    { file: 'out/film_a.mp4', audio: true, sec: expectedSec },
    { file: 'out/film_b.mp4', audio: true, sec: expectedSec },
    { file: 'out/film_c.mp4', audio: true, sec: expectedSec },
  ],
}[phase];

if (!EXPECTED) {
  console.error(`No check defined for phase ${phase}. Use 1 (silent cut) or 3 (with voice).`);
  process.exit(1);
}

console.log(`\n═══ Phase ${phase} self-check ═══\n`);

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
  const fps = den ? num / den : 0;

  if (v?.width !== cfg.format.width || v?.height !== cfg.format.height) {
    fail(`${want.file} — ${v?.width}x${v?.height}, expected ${cfg.format.width}x${cfg.format.height}`);
  }
  if (Math.abs(fps - cfg.format.fps) > 0.01) fail(`${want.file} — ${fps} fps, expected ${cfg.format.fps}`);
  if (want.sec !== null && Math.abs(sec - want.sec) > 0.08) {
    fail(`${want.file} — ${sec.toFixed(2)} s, the timeline says ${want.sec.toFixed(2)} s`);
  }
  if (want.audio && !a) fail(`${want.file} — no audio stream, and phase ${phase} needs one`);
  if (!want.audio && a) fail(`${want.file} — has an audio stream, and phase ${phase} must be silent`);
  if (phase === 5 && mb > 50) fail(`${want.file} — ${mb.toFixed(1)} MB, over the 50 MB ceiling`);

  rows.push(
    `  ${want.file.padEnd(28)} ${v?.width}x${v?.height}  ${fps} fps  ` +
      `${sec.toFixed(2)} s  ${mb.toFixed(1)} MB  audio ${a ? a.codec_name : 'none'}`
  );
}
console.log('FILES');
console.log(rows.join('\n') || '  (none)');

// ── 2. a frame from the middle of every beat ───────────────────────────────
const primary = resolve(PROJECT, EXPECTED[0].file);
if (existsSync(primary)) {
  const dir = resolve(OUT, 'selfcheck');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const marks = beatMidpoints(beats, cfg.format.fps);

  // Three frames per beat, not one.
  //
  // One frame is a sample, and a sample is exactly how a blank got through: the
  // style sheet's tiles animate the user's own line, that line has pauses in
  // it, and the single midpoint frame landed in one. It read as "the tiles
  // render nothing" when the truth was "the tiles render nothing for half a
  // second, twice". Anything that varies within a beat needs more than its
  // middle looked at.
  const AT = [0.25, 0.5, 0.75];
  let written = 0;
  marks.forEach((m, i) => {
    AT.forEach((frac, j) => {
      const sec = m.fromSec + m.durSec * frac;
      const stem = safeLabel(m.name).replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 40);
      const name = `${String(i + 1).padStart(2, '0')}${'abc'[j]}-${stem}.png`;

      // The safe box drawn on top, so "inside the safe zone" is something the
      // eye checks rather than something the eye estimates. `drawbox` is in
      // every ffmpeg build; it is `drawtext` that is missing from this one.
      const box = `drawbox=x=${SAFE.x0}:y=${SAFE.y0}:w=${SAFE.x1 - SAFE.x0}:h=${SAFE.y1 - SAFE.y0}:color=0x00FF88@0.6:t=3`;

      execFileSync(
        'ffmpeg',
        ['-v', 'error', '-y', '-ss', sec.toFixed(3), '-i', primary, '-frames:v', '1', '-vf', box, resolve(dir, name)],
        { stdio: 'inherit' }
      );
      written += 1;
    });
  });

  notes.push(
    `${written} frames in out/selfcheck/ — three per beat, named by beat, ` +
      'green box is the paid safe zone. Look at them.'
  );
}

// ── 3. nothing in here generates a caption ─────────────────────────────────
//
// Scoped to the files that can reach the finished video: this project's own
// scripts and the airplane compositions. The other ads in `src/ads/` draw the
// app's captions on purpose and are not part of this pipeline.
const BANNED = [
  { re: /\bwhisper\b/i, why: 'transcription' },
  { re: /\.srt\b/i, why: 'subtitle file' },
  { re: /subtitles\s*=/i, why: 'ffmpeg subtitle filter' },
  { re: /\bCaptionTrack\b/, why: "the ad project's own caption renderer" },
  { re: /layoutCaptionFrame/, why: "the app's caption layout" },
];

const scanDirs = [resolve(PROJECT, 'scripts'), resolve(REMOTION, 'src/film')];
const offences = [];
for (const dir of scanDirs) {
  for (const name of readdirSync(dir)) {
    if (!/\.(mjs|js|ts|tsx|sh)$/.test(name)) continue;
    // The rule's own statement of itself is not a breach of it.
    if (name === 'selfcheck.mjs') continue;
    const path = resolve(dir, name);
    const text = readFileSync(path, 'utf8');
    for (const { re, why } of BANNED) {
      // Its own rule, quoted in a comment, is not a violation of it.
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
    : '  ✓ nothing in scripts/ or src/film/ transcribes, burns or draws a caption.\n' +
      "    Every caption in this film came out of the app's own export."
);

// ── 4. the report ──────────────────────────────────────────────────────────
console.log('\nTIMELINE');
console.log(
  beatMidpoints(beats, cfg.format.fps)
    .map(
      (m, i) =>
        `  ${String(i + 1).padStart(2)}. ${m.name.padEnd(46)} ` +
        `${m.fromSec.toFixed(2).padStart(6)} → ${(m.fromSec + m.durSec).toFixed(2).padStart(6)} s  (${m.durSec.toFixed(2)} s)`
    )
    .join('\n')
);
console.log(`  total ${expectedSec.toFixed(2)} s, from the ${timings().lines ? 'measured' : 'planned'} line lengths`);

if (expectedSec > 30) {
  notes.push(`${expectedSec.toFixed(2)} s is over the 15–30 s band a paid 9:16 unit wants`);
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
