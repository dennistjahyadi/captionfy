/**
 * Render a video.
 *
 *   node ../pipeline/render.mjs                    # from inside a video folder
 *   node ../pipeline/render.mjs --variant=b        # video 01: which claim line
 *   node ../pipeline/render.mjs --hook=airplane    # video 02: one hook only
 *   node ../pipeline/render.mjs --only=body        # video 02: body only, or `hooks`
 *
 * Stages `public/` first, so a render can never be of a recording that was
 * deleted three commits ago and is still sitting in Remotion's asset directory.
 *
 * Two shapes of project, told apart by `config.hooks`:
 *
 *  - **One composition, one file** (video 01). Renders `config.composition`
 *    with `{ variant }` to `out/film_<variant>.mp4`.
 *  - **Hooks and a body** (video 02). Renders the body once and every hook on
 *    its own, then joins each hook to the body with ffmpeg's concat demuxer and
 *    `-c copy` — no second encode, so the body in every output is the same
 *    bytes. Rendering the full 30 s six times would also work and is the
 *    fallback if a join ever shows a seam; it has not.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { OUT, PROJECT, REMOTION, arg, config, publicDir, timings } from './lib.mjs';
import { buildBeats, timingSource, totalFrames } from './beats.js';

const cfg = config();
const t = timings();

/**
 * Silent until there is a voice.
 *
 * Without `--muted` Remotion writes a silent AAC track anyway, and a file that
 * carries an audio stream has, as far as anything downstream can tell, been
 * through the voice pipeline. The self-check fails it for exactly that reason.
 */
const muted = t.lines === null;

mkdirSync(OUT, { recursive: true });
execFileSync(resolve(PROJECT, '../pipeline/sync-public.sh'), [publicDir(cfg)], {
  stdio: 'inherit',
  env: { ...process.env, WB_PROJECT: PROJECT },
});

const remotionRender = (composition, props, outPath, frames) => {
  const propsFile = resolve(tmpdir(), `wb-props-${process.pid}-${composition}.json`);
  writeFileSync(propsFile, JSON.stringify(props));
  console.log(
    `\n── ${composition} · ${JSON.stringify(props)} · ${frames} frames ` +
      `(${(frames / cfg.format.fps).toFixed(2)} s${muted ? ', silent' : ''})`
  );
  try {
    execFileSync(
      'npx',
      [
        'remotion', 'render', 'src/index.ts', composition, outPath,
        `--props=${propsFile}`,
        ...(muted ? ['--muted'] : []),
        '--log=info',
      ],
      { cwd: REMOTION, stdio: 'inherit' }
    );
  } finally {
    rmSync(propsFile, { force: true });
  }
  console.log(`${outPath}  ${(statSync(outPath).size / 1e6).toFixed(1)} MB`);
};

/** `a.mp4` then `b.mp4`, packets copied, into `dest`. */
const join = (parts, dest) => {
  const list = resolve(tmpdir(), `wb-concat-${process.pid}.txt`);
  writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  try {
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest],
      { stdio: 'inherit' }
    );
  } finally {
    rmSync(list, { force: true });
  }
  console.log(`${dest}  ${(statSync(dest).size / 1e6).toFixed(1)} MB  (joined, no re-encode)`);
};

if (cfg.hooks) {
  const beats = buildBeats(cfg, t);
  const bodyFrames = totalFrames(beats);
  const hookFrames = Math.round(cfg.hookSec * cfg.format.fps);
  const only = arg('only', 'all');
  const one = arg('hook', null);
  const hooks = one ? cfg.hooks.filter((h) => h.id === one) : cfg.hooks;
  if (!hooks.length) {
    console.error(`No hook '${one}'. Have: ${cfg.hooks.map((h) => h.id).join(', ')}`);
    process.exit(1);
  }

  const body = resolve(OUT, 'body.mp4');
  console.log(`\nbody: ${bodyFrames} frames, ${timingSource(t)} lengths; hook: ${hookFrames} frames`);

  if (only === 'all' || only === 'body') {
    remotionRender(cfg.composition.body, {}, body, bodyFrames);
  }
  if (only === 'all' || only === 'hooks') {
    for (const h of hooks) {
      const hookOut = resolve(OUT, `hook_${h.id}.mp4`);
      remotionRender(cfg.composition.hook, { hook: h.id }, hookOut, hookFrames);
    }
  }
  for (const h of hooks) {
    join([resolve(OUT, `hook_${h.id}.mp4`), body], resolve(OUT, `tutorial_${h.id}.mp4`));
  }
} else {
  const variant = arg('variant', cfg.defaultVariant);
  const composition = arg('comp', cfg.composition ?? 'film');
  const outPath = resolve(PROJECT, arg('out', `out/film_${variant}.mp4`));
  const frames = totalFrames(buildBeats(cfg, t));
  remotionRender(composition, { variant }, outPath, frames);
}
