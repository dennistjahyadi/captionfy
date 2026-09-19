/**
 * What the tutorial compositions need to know about video 02.
 *
 * The body's arithmetic is `../../../pipeline/beats.js`, the same file the
 * render, the storyboard and the self-check use, so none of the four can
 * disagree about where a cut lands. The data is imported across the folder
 * boundary rather than copied, for the reason `film/timeline.ts` gives.
 */
import { buildBeats, beatMidpoints, timingSource, totalFrames } from '../../../pipeline/beats.js';
import config from '../../../video-02-tutorial/config.json';
import timings from '../../../video-02-tutorial/timings.json';

export const CONFIG = config;
export const FPS = config.format.fps;
export const DIR = config.publicDir;

/** The body: nine beats, shared by all six videos. */
export const BEATS = buildBeats(config, timings);
export const BODY_FRAMES = totalFrames(BEATS);
export const TIMING_SOURCE = timingSource(timings);
export const MIDPOINTS = beatMidpoints(BEATS, FPS);

/**
 * The hook: three seconds, whatever is said over it.
 *
 * Not re-timed by the voice the way the body is. The algorithm decides at
 * 1.5 s and the hook has resolved by 3 or it has not; a line that needs longer
 * than that is the wrong line, not a reason to stretch the picture.
 */
export const HOOK_FRAMES = Math.round(config.hookSec * FPS);

export type Beat = (typeof BEATS)[number];

export type Segment = {
  file: string;
  startSec: number;
  durationSec: number;
  crop: { y: number; h: number };
  scale?: number;
  top?: number;
  pointer?: string;
};

export type Hook = {
  id: string;
  type: string;
  kind: 'export' | 'screens' | 'pay-once' | 'emphasis';
  title: string;
  titleAt: number;
  titlePos?: string;
  vo: string;
  startSec?: number;
  hitsSec?: number[];
  segments?: Segment[];
};

export const HOOKS = config.hooks as Hook[];

export const hookById = (id: string): Hook => {
  const hit = HOOKS.find((h) => h.id === id);
  if (!hit) throw new Error(`no hook '${id}' in config.json — have ${HOOKS.map((h) => h.id).join(', ')}`);
  return hit;
};

export const SAFE = config.safeBox;

/** Where in `export.mp4` a body beat that plays the export starts. */
export const exportStartFrame = (beatId: string): number => {
  const table = config.sources.export.startSec as Record<string, number>;
  return Math.round((table[beatId] ?? 0) * FPS);
};

export const clipStart = (sec: number | undefined): number => Math.round((sec ?? 0) * FPS);

export const POINTERS = config.pointers as Record<string, { deviceX: number; deviceY: number; r: number }>;
