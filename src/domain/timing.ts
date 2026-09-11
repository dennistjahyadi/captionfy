/**
 * Word timing: the only place word start and end times change.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Editing a word's text never reaches this file. Timing moves through these
 * functions and through split and merge, and nowhere else.
 */
import type { Ms, Project, Word } from './types';

/**
 * The shortest a word may be made.
 *
 * Below roughly this a karaoke highlight reads as a flicker rather than a word,
 * and the drag handles in the timing sheet have nothing left to grab. Words that
 * arrive from the engine shorter than this are left alone; the floor only binds
 * on an edit, so a nudge can never shrink a word past it.
 */
export const MIN_WORD_MS = 80;

export type NudgeEdge = 'start' | 'end' | 'both';

type Bounds = {
  /** Earliest time this word may occupy: the previous word's end, or zero. */
  lower: Ms;
  /** Latest time this word may occupy: the next word's start, or unbounded. */
  upper: Ms;
  /** MIN_WORD_MS, or the whole gap when the gap is narrower than that. */
  minimum: Ms;
};

function boundsFor(words: Word[], index: number): Bounds {
  const lower = words[index - 1]?.end ?? 0;
  const upper = words[index + 1]?.start ?? Number.POSITIVE_INFINITY;
  // A word wedged into a gap narrower than MIN_WORD_MS stays inside the gap.
  // Overlapping its neighbour would put two highlights on screen at once, which
  // is worse than a word being brief.
  const minimum = Math.min(MIN_WORD_MS, Math.max(upper - lower, 0));
  return { lower, upper, minimum };
}

/**
 * Moves one edge of a word, or the whole word, by `deltaMs`.
 *
 * Clamping is silent but visible: the caller gets back a word that stopped where
 * it collided, which is what makes a handle in the timing sheet stick against the
 * neighbour instead of the neighbour quietly giving way. Dragging one edge never
 * pushes the other, so the handle stops at the minimum duration too.
 */
export function nudgeWord(words: Word[], id: string, edge: NudgeEdge, deltaMs: Ms): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;

  const word = words[index];
  const delta = Math.round(deltaMs);
  const { lower, upper, minimum } = boundsFor(words, index);

  if (edge === 'start') {
    return setWordTiming(words, id, Math.min(word.start + delta, word.end - minimum), word.end);
  }

  if (edge === 'end') {
    return setWordTiming(words, id, word.start, Math.max(word.end + delta, word.start + minimum));
  }

  // Moving the whole word keeps its duration, so it slides until one side hits a
  // neighbour rather than being squeezed against it.
  const duration = word.end - word.start;
  // A word already wider than the gap it sits in cannot move; pinning the start
  // is the one answer that never produces a negative duration.
  const start = clamp(word.start + delta, lower, Math.max(lower, upper - duration));

  return replaceAt(words, index, { ...word, start, end: start + duration });
}

/**
 * Sets both edges at once, under the same clamping as `nudgeWord`.
 *
 * When the requested span is shorter than the minimum, the start holds and the
 * end is pushed out. The timing sheet's Apply is the only caller that sets both
 * edges from arbitrary values, and there the user is dragging the start.
 */
export function setWordTiming(words: Word[], id: string, start: Ms, end: Ms): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;

  const word = words[index];
  const { lower, upper, minimum } = boundsFor(words, index);

  const nextStart = clamp(Math.round(start), lower, Math.max(lower, upper - minimum));
  const nextEnd = clamp(Math.round(end), nextStart + minimum, Math.max(upper, nextStart + minimum));

  if (nextStart === word.start && nextEnd === word.end) return words;
  return replaceAt(words, index, { ...word, start: nextStart, end: nextEnd });
}

/**
 * Shifts every caption by `deltaMs` without touching a single word time.
 *
 * The offset is clamped so the first word never starts before zero, because a
 * caption scheduled before the video begins simply never shows.
 */
export function shiftAll(project: Project, deltaMs: Ms): Project {
  const firstStart = project.words[0]?.start ?? 0;
  const globalOffsetMs = Math.max(-firstStart, Math.round(project.globalOffsetMs + deltaMs));
  if (globalOffsetMs === project.globalOffsetMs) return project;
  return { ...project, globalOffsetMs };
}

/**
 * Cuts `[start, end]` into pieces sized by `weights`, on integer boundaries.
 *
 * Used wherever one word becomes several. The last piece always ends exactly on
 * `end`, so splitting a word never changes the span that word occupied, which is
 * invariant 1 as far as a text edit is concerned.
 */
export function divideInterval(start: Ms, end: Ms, weights: number[]): { start: Ms; end: Ms }[] {
  if (weights.length === 0) return [];
  if (weights.length === 1) return [{ start, end }];

  const positive = weights.map((weight) => Math.max(weight, 0));
  const total = positive.reduce((sum, weight) => sum + weight, 0);
  const span = end - start;
  const pieces: { start: Ms; end: Ms }[] = [];

  let cursor = start;
  let consumed = 0;
  for (let index = 0; index < positive.length; index += 1) {
    consumed += positive[index];
    const isLast = index === positive.length - 1;
    // Accumulating from the original start rather than from the previous piece
    // holds the rounding error at half a millisecond instead of letting it build
    // up across a long split.
    const boundary = isLast
      ? end
      : total === 0
        ? start + Math.round((span * (index + 1)) / positive.length)
        : start + Math.round((span * consumed) / total);
    // Pieces stay in order even when the span is shorter than the piece count.
    const pieceEnd = Math.max(cursor, Math.min(boundary, end));
    pieces.push({ start: cursor, end: pieceEnd });
    cursor = pieceEnd;
  }

  return pieces;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function replaceAt(words: Word[], index: number, word: Word): Word[] {
  const next = words.slice();
  next[index] = word;
  return next;
}
