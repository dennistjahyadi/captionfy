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

/**
 * How far one tap of a stepper moves an edge.
 *
 * Fifty milliseconds is about the smallest shift that is audible against a
 * loop and about the largest that cannot ruin a word in one tap, so the same
 * number serves the timing sheet's steppers and shift-all's.
 */
export const NUDGE_STEP_MS = 50;

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

/** The shortest a word may be made: never under the floor, never over its length. */
function shortest(word: Word): Ms {
  return Math.min(MIN_WORD_MS, word.end - word.start);
}

/**
 * Moves one edge of a word, or the whole word, by `deltaMs`.
 *
 * An edge the word shares with its neighbour is a boundary, not a wall, and
 * moving it moves the neighbour with it. Nearly every edge is one: whisper hands
 * back a single boundary between one word and the next, so a handle that refused
 * to move a neighbour would refuse to move at all, which is exactly what the
 * first build of the timing sheet did on a real transcript. What a shared edge
 * cannot do is shorten the neighbour past `MIN_WORD_MS` or push it out of
 * existence.
 *
 * Where there is a gap, nothing is shared and nothing is pushed: the handle stops
 * dead in the silence, because the silence is not the neighbour's to give away.
 * Clamping stays silent but visible either way — the caller gets back a word that
 * stopped where it collided, and the handle in the sheet stops with it.
 */
export function nudgeWord(words: Word[], id: string, edge: NudgeEdge, deltaMs: Ms): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;

  const word = words[index];
  const delta = Math.round(deltaMs);
  const previous = words[index - 1];
  const next = words[index + 1];

  const sharesStart = previous !== undefined && previous.end === word.start;
  const sharesEnd = next !== undefined && next.start === word.end;

  // How far the edges may travel: into the neighbour when the edge is shared,
  // only as far as the neighbour when it is not.
  const floor = sharesStart ? previous.start + shortest(previous) : (previous?.end ?? 0);
  const ceiling = sharesEnd ? next.end - shortest(next) : (next?.start ?? Number.POSITIVE_INFINITY);
  const minimum = Math.min(MIN_WORD_MS, Math.max(ceiling - floor, 0));

  let start = word.start;
  let end = word.end;

  if (edge === 'start') {
    start = clamp(word.start + delta, floor, Math.max(floor, end - minimum));
  } else if (edge === 'end') {
    end = clamp(word.end + delta, start + minimum, Math.max(start + minimum, ceiling));
  } else {
    // Moving the whole word keeps its duration, so it slides until one side runs
    // out of room rather than being squeezed against it.
    const duration = end - start;
    start = clamp(word.start + delta, floor, Math.max(floor, ceiling - duration));
    end = start + duration;
  }

  if (start === word.start && end === word.end) return words;

  const moved = words.slice();
  moved[index] = { ...word, start, end };
  if (sharesStart && start !== word.start) moved[index - 1] = { ...previous, end: start };
  if (sharesEnd && end !== word.end) moved[index + 1] = { ...next, start: end };
  return moved;
}

/**
 * Sets both edges at once, without moving anything else.
 *
 * The unlinked primitive: unlike `nudgeWord` this never touches a neighbour, so a
 * shared edge stops against it. When the requested span is shorter than the
 * minimum the start holds and the end is pushed out.
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
