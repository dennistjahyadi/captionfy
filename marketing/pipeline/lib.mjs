/**
 * Shared plumbing for every video project's phase scripts. No dependencies —
 * node and ffmpeg only.
 *
 * One copy, used by `video-01-film` and `video-02-tutorial` alike. It used to
 * live inside video 01's own `scripts/`, and the second video would have meant a
 * second copy — which is the two-copies problem this repository keeps refusing
 * (fonts, `beats.js`, the version number in `build.gradle`). The project a
 * script is working on is the directory it is run from: `cd` into the video's
 * folder and `node ../pipeline/render.mjs`. `WB_PROJECT` overrides that.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
/** The shared Remotion install and the compositions. */
export const REMOTION = resolve(HERE, '../remotion');
export const REPO = resolve(HERE, '../..');

/** The video being worked on: the folder with the `config.json` in it. */
export const PROJECT = resolve(process.env.WB_PROJECT ?? process.cwd());
if (!existsSync(resolve(PROJECT, 'config.json'))) {
  console.error(
    `${PROJECT} has no config.json.\n` +
      'Run the pipeline from inside a video folder (marketing/video-0N-*/), or set WB_PROJECT.'
  );
  process.exit(1);
}
export const OUT = resolve(PROJECT, 'out');

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const config = () => readJson(resolve(PROJECT, 'config.json'));
export const timings = () => readJson(resolve(PROJECT, 'timings.json'));

/**
 * Where this project's media is staged for Remotion: `public/<publicDir>/`.
 * Each video gets its own subfolder so a render of one cannot pick up a
 * recording that belongs to the other.
 */
export const publicDir = (cfg = config()) => cfg.publicDir ?? 'film';

export const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', ...opts });

/** One ffprobe call, returned as the parsed JSON it was asked for. */
export const probe = (file) =>
  JSON.parse(
    run('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      file,
    ])
  );

/** Seconds of a media file, from the format header. */
export const durationSec = (file) => Number(probe(file).format.duration);

/**
 * Text that `drawtext` will not choke on.
 *
 * ffmpeg's filtergraph parser takes `:`, `'`, `\` and `%` as its own, and a
 * label that breaks the graph fails the storyboard rather than the video — the
 * worst kind of failure, because the video is fine and the reviewer sees an
 * error.
 */
export const safeLabel = (s) =>
  s
    .replace(/[·—–]/g, '-')
    .replace(/[^A-Za-z0-9 .,\-()/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const FONT = resolve(REPO, 'assets/fonts/BeVietnamPro-SemiBold.ttf');

/** `--name=value` off argv, or the fallback. */
export const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
