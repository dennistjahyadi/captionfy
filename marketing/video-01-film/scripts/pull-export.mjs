/**
 * Pull the newest Wordburn export off the device.
 *
 *   node scripts/pull-export.mjs
 *
 * This file is the hero of the whole video, and it is the one asset that must
 * not be recreated by anything in this folder: the captions in it were laid out
 * by `layoutCaptionFrame` and rasterised by `CaptionPainter`, in the app, on the
 * device. Re-drawing them here — even perfectly — would be advertising a
 * rendering the product does not do, which is the same rule the first cut of
 * this project was built around and the only one worth keeping from it.
 *
 * It is also, unlike anything from a stock library, footage this repository
 * owns outright: `scripts/make-demo-clip.py` generates the plates and the voice,
 * for the two reasons STORE-ASSETS.md sets out — free libraries publish video
 * without audio, and nobody collects a model release. A paid advertisement is
 * the exact use a release exists to cover.
 *
 * To make a new one: export from the app with the preset you want, then run this.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROJECT, readJson } from './lib.mjs';

const DIR = resolve(PROJECT, 'input/app');
const DEST = resolve(DIR, 'export.mp4');

const adb = (args) => execFileSync('adb', args, { encoding: 'utf8' });

mkdirSync(DIR, { recursive: true });

/**
 * MediaStore, not a path.
 *
 * The app publishes through `expo-media-library` into a Wordburn album, and
 * where that album physically lands is the platform's business — on this
 * emulator it is `Pictures/Wordburn/`, which is not where anybody would look
 * for a video. Asking the media database is the only way that does not depend
 * on guessing a directory.
 */
const rows = adb([
  'shell', 'content', 'query',
  '--uri', 'content://media/external/video/media',
  '--projection', '_display_name:relative_path:_size:date_added',
])
  .split('\n')
  .map((line) => {
    const get = (k) => line.match(new RegExp(`${k}=([^,]*)`))?.[1]?.trim();
    return {
      name: get('_display_name'),
      path: get('relative_path'),
      size: Number(get('_size') ?? 0),
      added: Number(get('date_added') ?? 0),
    };
  })
  .filter((r) => r.name?.startsWith('Wordburn') && r.name.endsWith('.mp4'));

if (!rows.length) {
  console.error(
    [
      'No Wordburn export on the device.',
      '',
      'Make one: open the app, open a project, Export, Save to gallery.',
      'Then run this again.',
    ].join('\n')
  );
  process.exit(1);
}

rows.sort((a, b) => b.added - a.added);
const newest = rows[0];
const remote = `/sdcard/${newest.path}${newest.name}`;

console.log(`${newest.name}  ${(newest.size / 1e6).toFixed(1)} MB  from ${newest.path}`);
adb(['pull', remote, DEST]);

const probe = JSON.parse(
  execFileSync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', DEST],
    { encoding: 'utf8' }
  )
);
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');

console.log(
  `export.mp4  ${v.width}x${v.height}  ${v.r_frame_rate}  ` +
    `${Number(probe.format.duration).toFixed(2)} s  audio ${a ? a.codec_name : 'none'}`
);

if (v.width !== 1080 || v.height !== 1920) {
  console.error(`\n! Expected 1080x1920, got ${v.width}x${v.height}. The film composits it 1:1.`);
  process.exitCode = 1;
}

const manifestPath = resolve(PROJECT, 'app-shots.json');
const manifest = existsSync(manifestPath)
  ? readJson(manifestPath)
  : { note: 'Written by scripts/capture.mjs and scripts/pull-export.mjs.', shots: {} };

manifest.export = {
  file: 'export.mp4',
  what: "A real Wordburn export. Captions burned in by the app's own module, not redrawn here.",
  sourceName: newest.name,
  width: v.width,
  height: v.height,
  durationSec: Number(probe.format.duration),
  hasAudio: Boolean(a),
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('app-shots.json updated.');
