/**
 * A contact sheet of the render, to review on a phone.
 *
 *   node ../pipeline/storyboard.mjs [--out=out/storyboard.png]
 *
 * A 30-second video is a 30-second review, and the thing being judged in
 * phase 1 is a sequence — which a sequence of stills shows better than the
 * video does, because the whole shape is there at once and you can see whether
 * beat four is doing anything beat three did not.
 *
 * The sheet is drawn by Remotion (`parts/Sheet`) rather than by ffmpeg's
 * `tile,drawtext`: the ffmpeg on this machine has no `drawtext`, and an
 * unlabelled sheet is a puzzle. The sample points come from `beats.js`, the
 * arithmetic the composition laid out with, so a tile is the middle of the
 * beat it is labelled with.
 *
 * Remotion serves `staticFile()` out of its own `public/`, so the renders are
 * staged there under fixed names — `preview.mp4` for a one-file project,
 * `preview-body.mp4` and `preview-hook-<id>.mp4` for hooks and a body — and
 * the composition never has to be told which video it is sheeting.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { OUT, PROJECT, REMOTION, arg, config, publicDir, timings } from './lib.mjs';
import { beatMidpoints, buildBeats, resolveVoice } from './beats.js';

const { cfg, t: tv } = resolveVoice(config(), timings(), arg('voice', null));
const srcDir = arg('outdir', cfg.outDir ?? 'out');
const dest = resolve(PROJECT, arg('out', `${srcDir}/storyboard.png`));
const staging = resolve(REMOTION, 'public', publicDir(cfg));
mkdirSync(staging, { recursive: true });
mkdirSync(OUT, { recursive: true });

const stage = (from, name) => {
  const src = resolve(PROJECT, from);
  if (!existsSync(src)) {
    console.error(`No ${from}. Run: node ../pipeline/render.mjs`);
    process.exit(1);
  }
  copyFileSync(src, resolve(staging, name));
};

let composition;
if (cfg.hooks) {
  stage(`${srcDir}/body.mp4`, 'preview-body.mp4');
  for (const h of cfg.hooks) stage(`${srcDir}/hook_${h.id}.mp4`, `preview-hook-${h.id}.mp4`);
  composition = cfg.composition.storyboard;
} else {
  stage(arg('in', `out/film_${cfg.defaultVariant}.mp4`), 'preview.mp4');
  composition = `${cfg.composition ?? 'film'}-storyboard`;
}

const marks = beatMidpoints(buildBeats(cfg, tv), cfg.format.fps);

execFileSync('npx', ['remotion', 'still', 'src/index.ts', composition, dest, '--log=error'], {
  cwd: REMOTION,
  stdio: 'inherit',
});

console.log(`${dest}  ${(statSync(dest).size / 1e6).toFixed(2)} MB`);
if (cfg.hooks) {
  console.log(cfg.hooks.map((h, i) => `  hook ${i + 1}. ${h.id.padEnd(12)} ${h.title}`).join('\n'));
}
console.log(
  marks
    .map((m, i) => `  ${String(i + 1).padStart(2)}. ${m.name.padEnd(46)} @ ${m.sec.toFixed(2)} s`)
    .join('\n')
);
