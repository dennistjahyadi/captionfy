/**
 * Invariants checked at runtime, on the user's own project.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Unit tests prove these rules against fixtures. This file proves them against
 * whatever the engine produced on a real clip, on the phone, every time an edit
 * happens. Invariant 1 is the one worth the cycles: a text edit that quietly
 * moves a word by forty milliseconds is invisible in the transcript, obvious in
 * the exported video, and would be found by a user rather than by us.
 */
import type { Word } from './types';

/**
 * Describes how a text edit moved timing, or null when it did not.
 *
 * Two rules, because the word count says which applies. With the count
 * unchanged, nothing may move at all: that is invariant 1 exactly. With the
 * count changed a split, a merge or a delete has happened, and those do
 * redistribute time by design, so what is checked instead is that they only ever
 * divide up time that was already there and never invent any.
 */
export function timingDrift(before: Word[], after: Word[]): string | null {
  if (before.length === 0 || after.length === 0) return null;

  if (before.length === after.length) {
    const was = new Map(before.map((word) => [word.id, word]));

    for (const word of after) {
      const previous = was.get(word.id);
      if (!previous) continue;
      if (previous.start !== word.start || previous.end !== word.end) {
        return `"${word.text}" moved from ${previous.start}–${previous.end} to ${word.start}–${word.end}`;
      }
    }

    return null;
  }

  const wasFrom = Math.min(...before.map((word) => word.start));
  const wasTo = Math.max(...before.map((word) => word.end));
  const from = Math.min(...after.map((word) => word.start));
  const to = Math.max(...after.map((word) => word.end));

  if (from < wasFrom) return `the first word now starts at ${from}, before ${wasFrom}`;
  if (to > wasTo) return `the last word now ends at ${to}, after ${wasTo}`;
  return null;
}

/**
 * Describes how a timing action reached past the words it named, or null.
 *
 * The mirror of `timingDrift`, for the one kind of action that is allowed to move
 * time. What has to be proved here is not that nothing moved but that only what
 * was asked for moved: the same words in the same order, none of their text
 * touched, no word the action was not aimed at shifted, and no caption left
 * running into its neighbour. A handle that quietly pushed the next word along is
 * a mistake the user finds three lines later, by which time they have no idea
 * what caused it.
 */
export function timingSpill(before: Word[], after: Word[], moving: string[]): string | null {
  if (before === after) return null;
  if (before.length !== after.length) {
    return `the word count changed from ${before.length} to ${after.length}`;
  }

  const allowed = new Set(moving);

  for (let index = 0; index < after.length; index += 1) {
    const was = before[index];
    const now = after[index];

    if (was.id !== now.id) return `word ${index + 1} is a different word`;
    if (was.text !== now.text) return `"${was.text}" became "${now.text}"`;

    if (!allowed.has(now.id)) {
      if (was.start !== now.start || was.end !== now.end) {
        return `"${now.text}" moved from ${was.start}–${was.end} to ${now.start}–${now.end}`;
      }
      continue;
    }

    if (now.end <= now.start) return `"${now.text}" has no length left`;

    const collision = introducedOverlap(before, after, index, index - 1)
      ?? introducedOverlap(before, after, index, index + 1);
    if (collision) return collision;
  }

  return null;
}

/**
 * An overlap this action created, as opposed to one it inherited.
 *
 * The engine's own word boundaries occasionally touch or cross, and refusing a
 * nudge because of something that was already in the transcript would leave the
 * user unable to fix the very thing they opened the sheet for.
 */
function introducedOverlap(
  before: Word[],
  after: Word[],
  index: number,
  otherIndex: number
): string | null {
  if (otherIndex < 0 || otherIndex >= after.length) return null;

  const [left, right] = index < otherIndex ? [index, otherIndex] : [otherIndex, index];
  if (after[left].end <= after[right].start) return null;
  if (before[left].end > before[right].start) return null;

  return `"${after[left].text}" now runs into "${after[right].text}"`;
}
