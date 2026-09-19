/**
 * A contact sheet: one frame from the middle of every beat, three columns.
 *
 *   node scripts/storyboard.mjs [--in=out/concept_preview.mp4] [--out=out/storyboard.png]
 *
 * The point is a review on a phone. A 24-second video is a 24-second review, and
 * the thing being judged in Phase 1 is a sequence — which a sequence of stills
 * shows better than the video does, because the whole shape is there at once and
 * you can see whether beat four is doing anything beat three did not.
 *
 * Drawn by Remotion rather than by `ffmpeg -vf tile,drawtext`: the ffmpeg on
 * this machine is built without libfreetype and has no `drawtext` filter, and an
 * unlabelled contact sheet is a puzzle rather than a review. The sample points
 * come from `beats.js`, the same arithmetic the composition laid out with, so a
 * tile is the middle of the beat it is labelled with.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { OUT, PROJECT, REMOTION, config, timings } from './lib.mjs';
import { beatMidpoints, buildBeats } from '../beats.js';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const cfg = config();
const source = resolve(PROJECT, arg('in', 'out/film_a.mp4'));
const dest = resolve(PROJECT, arg('out', 'out/storyboard.png'));

if (!existsSync(source)) {
  console.error(`No ${source}. Run: node scripts/render.mjs`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

// Remotion serves `staticFile()` out of its own public/, so the render has to be
// staged there like every other asset. A fixed name rather than the source's,
// because the composition should not have to be told which video it is sheeting.
const staged = resolve(REMOTION, 'public/film/preview.mp4');
mkdirSync(resolve(REMOTION, 'public/film'), { recursive: true });
copyFileSync(source, staged);

const marks = beatMidpoints(buildBeats(cfg, timings()), cfg.format.fps);

execFileSync('npx', ['remotion', 'still', 'src/index.ts', 'film-storyboard', dest, '--log=error'], {
  cwd: REMOTION,
  stdio: 'inherit',
});

console.log(`${dest}  ${marks.length} beats, 3 columns, ${(statSync(dest).size / 1e6).toFixed(2)} MB`);
console.log(
  marks
    .map((m, i) => `  ${String(i + 1).padStart(2)}. ${m.name.padEnd(46)} @ ${m.sec.toFixed(2)} s`)
    .join('\n')
);
