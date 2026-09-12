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
