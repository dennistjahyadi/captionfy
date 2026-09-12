/**
 * What span of the clip the timing sheet shows, and where in it things sit.
 *
 * Pure, and separate from the sheet, because the handles, the waveform, the
 * dimmed neighbours and the playhead all have to agree on where a millisecond
 * lands. One mapping used four times is a thing that can be wrong once; four
 * mappings written inline are four chances for the handle to stop somewhere the
 * waveform says nothing is happening.
 */
import type { Ms, Word } from '../domain';

/** How much of the clip the sheet shows either side of the word. */
export const TIMING_WINDOW_PAD_MS = 1000;

export interface TimingWindow {
  fromMs: Ms;
  toMs: Ms;
}

/**
 * A second either side of the word, fixed at the moment the sheet opens.
 *
 * Fixed rather than recomputed as the handles move: a window that followed the
 * word would slide the waveform under the finger, and the user would be dragging
 * an edge against a background that moves with it.
 */
export function timingWindow(anchor: { start: Ms; end: Ms }): TimingWindow {
  return {
    fromMs: Math.max(0, anchor.start - TIMING_WINDOW_PAD_MS),
    toMs: anchor.end + TIMING_WINDOW_PAD_MS,
  };
}

/** Milliseconds per pixel, which is what turns a drag into a nudge. */
export function msPerPixel(window: TimingWindow, width: number): number {
  if (width <= 0) return 0;
  return (window.toMs - window.fromMs) / width;
}

/** Where `tMs` falls across a strip `width` wide. Outside the window it clamps. */
export function xForMs(tMs: Ms, window: TimingWindow, width: number): number {
  const span = window.toMs - window.fromMs;
  if (span <= 0 || width <= 0) return 0;
  const fraction = (tMs - window.fromMs) / span;
  return Math.min(width, Math.max(0, fraction * width));
}

/**
 * The words with any part of themselves inside the window.
 *
 * The neighbours are drawn so the user can see what the handle is about to run
 * into. A word that merely touches the edge of the window is still a wall.
 */
export function wordsInWindow(words: Word[], window: TimingWindow): Word[] {
  return words.filter((word) => word.end > window.fromMs && word.start < window.toMs);
}
