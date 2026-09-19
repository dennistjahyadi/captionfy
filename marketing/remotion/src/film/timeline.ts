/**
 * What the composition needs to know about the film it is rendering.
 *
 * The arithmetic is `../../../video-01-film/beats.js`, shared with the
 * storyboard and the self-check so all three agree about where a cut lands.
 * This file is the bridge: it imports the video's own data across the folder
 * boundary rather than keeping a copy, because a copy of a version number
 * sitting in `android/app/build.gradle` is how this project learned that lesson.
 */
import { buildBeats, beatMidpoints, timingSource, totalFrames } from '../../../video-01-film/beats.js';
import shots from '../../../video-01-film/app-shots.json';
import config from '../../../video-01-film/config.json';
import timings from '../../../video-01-film/timings.json';

export const CONFIG = config;
export const FPS = config.format.fps;
export const SHOTS = shots;

export const BEATS = buildBeats(config, timings);
export const TOTAL_FRAMES = totalFrames(BEATS);
export const TIMING_SOURCE = timingSource(timings);
export const MIDPOINTS = beatMidpoints(BEATS, FPS);

export type Beat = (typeof BEATS)[number];

/**
 * The safe box, in pixels, for a **paid** in-feed unit.
 *
 * Not the organic one. An ad adds a CTA button and a Sponsored label, and
 * `marketing/README.md` puts that at roughly 370 px on top of the organic
 * bottom allowance of 422 — so the floor for anything that has to be read is
 * 1128, not the 1498 an organic post gets. It is the single biggest constraint
 * on this film and the reason every line of type sits in the upper third.
 *
 * Pictures may cross it. Words may not.
 */
export const SAFE = config.safeBox;
export const SAFE_CENTRE = (SAFE.x0 + SAFE.x1) / 2;
export const SAFE_WIDTH = SAFE.x1 - SAFE.x0;

/** How long one beat dissolves into the next. */
export const DISSOLVE = 12;

/** Where in `export.mp4` a beat that plays the export starts. */
export const exportStartFrame = (beatId: string): number => {
  const table = config.sources.export.startSec as Record<string, number>;
  return Math.round((table[beatId] ?? 0) * FPS);
};

/** Where in an app recording a beat starts, in frames. */
export const clipStart = (beat: { startSec?: number }): number =>
  Math.round((beat.startSec ?? 0) * FPS);

/**
 * A pointer's position in the finished frame, mapped from where the thing it
 * points at actually sits in the recording.
 *
 * The aeroplane's coordinates were measured off `input/app/offline.start.png`
 * in the recording's own 1080 × 2400 space and live in `config.json`. Mapping
 * them through the card's crop and scale here is what keeps the ring on the
 * glyph when the framing changes — and the framing has already changed once,
 * which is how a hand-typed frame coordinate came to be pointing at nothing.
 */
export const pointerFor = (
  beat: { id: string; crop?: { y: number; h: number } },
  scale: number,
  top: number
): { x: number; y: number; r: number } => {
  const table = (config as { pointers?: Record<string, { deviceX: number; deviceY: number; r: number }> })
    .pointers;
  const p = table?.[beat.id];
  if (!p) return { x: -1000, y: -1000, r: 0 };

  const cardWidth = 1080 * scale;
  return {
    x: 540 - cardWidth / 2 + p.deviceX * scale,
    y: top + (p.deviceY - (beat.crop?.y ?? 0)) * scale,
    r: p.r,
  };
};
