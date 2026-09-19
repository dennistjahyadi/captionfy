/**
 * Render the film.
 *
 *   node scripts/render.mjs                    # the default variant
 *   node scripts/render.mjs --variant=b
 *   node scripts/render.mjs --out=out/film-b.mp4
 *
 * Stages `public/` first, so a render can never be of a recording that was
 * deleted three commits ago and is still sitting in Remotion's asset directory.
 *
 * One file per command on purpose. A 24-second 1080 × 1920 render outlasts a
 * shell timeout often enough that a loop over three variants is a loop that
 * dies halfway with one file written and no way to tell which.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { OUT, PROJECT, REMOTION, config, timings } from './lib.mjs';
import { buildBeats, timingSource, totalFrames } from '../beats.js';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const cfg = config();
const t = timings();
const variant = arg('variant', cfg.defaultVariant);
const composition = arg('comp', 'film');
const outPath = resolve(PROJECT, arg('out', `out/film_${variant}.mp4`));

const beats = buildBeats(cfg, t);
const frames = totalFrames(beats);

/**
 * Silent until there is a voice.
 *
 * Without `--muted` Remotion writes a silent AAC track anyway, and a film that
 * carries an audio stream has, as far as anything downstream can tell, been
 * through the voice pipeline. The self-check fails it for exactly that reason.
 */
const muted = t.lines === null;

mkdirSync(OUT, { recursive: true });
execFileSync(resolve(PROJECT, 'scripts/sync-public.sh'), [], { stdio: 'inherit' });

const props = resolve(tmpdir(), `film-props-${process.pid}.json`);
writeFileSync(props, JSON.stringify({ variant }));

console.log(
  `\n── ${composition} · variant ${variant} · ${frames} frames ` +
    `(${(frames / cfg.format.fps).toFixed(2)} s, ${timingSource(t)} lengths` +
    `${muted ? ', silent' : ''})`
);

try {
  execFileSync(
    'npx',
    [
      'remotion', 'render', 'src/index.ts', composition, outPath,
      `--props=${props}`,
      ...(muted ? ['--muted'] : []),
      '--log=info',
    ],
    { cwd: REMOTION, stdio: 'inherit' }
  );
} finally {
  rmSync(props, { force: true });
}

console.log(`\n${outPath}  ${(statSync(outPath).size / 1e6).toFixed(1)} MB`);
