/** Shared plumbing for the phase scripts. No dependencies — node and ffmpeg only. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
/** `marketing/video-01-airplane` */
export const PROJECT = resolve(HERE, '..');
/** The shared Remotion install and the compositions. */
export const REMOTION = resolve(PROJECT, '../remotion');
export const REPO = resolve(PROJECT, '../..');
export const OUT = resolve(PROJECT, 'out');

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const config = () => readJson(resolve(PROJECT, 'config.json'));
export const timings = () => readJson(resolve(PROJECT, 'timings.json'));
export const broll = () => readJson(resolve(PROJECT, 'broll.json'));

/**
 * A key out of the repo root's env files, parsed by hand.
 *
 * No dotenv: this is one key. Nothing here ever prints a value — rule 4 of the
 * brief — so the only thing a caller gets back is the string it asked for.
 *
 * It looks in every local env file rather than only in `.env`, because the
 * repo already had `.env.signing.local` for the keystore passwords and that is
 * a perfectly reasonable place for a second local secret to land. Searching one
 * hard-coded filename meant a key that was genuinely on the machine reported as
 * missing, which sends somebody to fetch a second one.
 */
const envFiles = () => {
  const named = ['.env', '.env.local'];
  const locals = existsSync(REPO)
    ? readdirSync(REPO).filter((f) => /^\.env\..+\.local$/.test(f))
    : [];
  return [...named, ...locals.sort()].map((f) => resolve(REPO, f)).filter(existsSync);
};

export const env = (name) => {
  if (process.env[name]) return process.env[name];

  for (const file of envFiles()) {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      if (line.slice(0, eq).trim() !== name) continue;
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  }
  return undefined;
};

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
