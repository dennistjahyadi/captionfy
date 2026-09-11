/**
 * The boundary between engine output and the editable transcript.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */
import { MIN_WORD_MS } from './timing';
import type { IdFactory, Ms, Word } from './types';
import type { AsrWord } from './words';

/**
 * Turns engine words into domain words.
 *
 * `asrText` starts equal to `text` and never changes again, which is what lets a
 * correction seed the dictionary and lets "fix the others like this" find every
 * other place the same mishearing landed.
 */
export function toWords(asrWords: AsrWord[], newId: IdFactory): Word[] {
  return asrWords.map((word) => ({
    id: newId(),
    text: word.text,
    asrText: word.text,
    start: Math.round(word.t0Ms),
    end: Math.round(Math.max(word.t1Ms, word.t0Ms)),
    conf: word.conf,
    origin: 'asr' as const,
  }));
}

/**
 * Appends a finished chunk's words to the ones already checkpointed.
 *
 * Chunks are transcribed in order but their spans are padded, so the first word
 * of a chunk can land a few milliseconds before the last word of the one before
 * it. Two highlights on screen at once is the visible symptom, so the overlap is
 * closed here, at the seam, rather than left for the editor to explain.
 */
export function appendWords(existing: Word[], incoming: Word[]): Word[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming;

  const previous = existing[existing.length - 1];
  const first = incoming[0];
  if (first.start >= previous.end) return [...existing, ...incoming];

  // Give the seam to the incoming word and pull the previous one back, but never
  // past the floor a nudge would respect either.
  const end: Ms = Math.max(previous.start + Math.min(MIN_WORD_MS, previous.end - previous.start), Math.min(previous.end, first.start));
  return [...existing.slice(0, -1), { ...previous, end }, ...incoming];
}
