/**
 * Per-word audio features.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * These are read off the envelope rather than the PCM, so a nudge, a split or a
 * merge can recompute them without the audio being anywhere near. That is the
 * whole reason the envelope is kept with the project.
 */
import { meanEnergy, speechMedian, toDb } from './envelope';
import type { Ms, Word } from './types';

export interface WordFeatures {
  /** Mean energy over the word, in dB relative to the clip's speech median. */
  loudnessDb: number;
  /** Duration per letter. A word held out for emphasis scores high. */
  msPerChar: number;
  /** Gap to the previous word, or to the start of the clip. */
  pauseBeforeMs: Ms;
  /** Gap to the next word. Zero for the last word, which has no next gap to measure. */
  pauseAfterMs: Ms;
}

export interface FeatureSet {
  byId: Map<string, WordFeatures>;
  /** The reference the dB figures are relative to. Kept for debugging a bad pick. */
  speechMedian: number;
  /** Median `msPerChar` across the clip, the reference for "held". */
  medianMsPerChar: number;
}

/** Letters only. Digits and punctuation are not held out the way a syllable is. */
export function letterCount(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

export function wordFeatures(envelope: Float32Array, words: Word[]): FeatureSet {
  const median = speechMedian(
    envelope,
    words.map((word) => ({ start: word.start, end: word.end }))
  );

  const byId = new Map<string, WordFeatures>();
  const rates: number[] = [];

  words.forEach((word, index) => {
    const previous = words[index - 1];
    const next = words[index + 1];
    const msPerChar = (word.end - word.start) / Math.max(1, letterCount(word.text));
    rates.push(msPerChar);

    byId.set(word.id, {
      loudnessDb: toDb(meanEnergy(envelope, word.start, word.end), median),
      msPerChar,
      pauseBeforeMs: Math.max(0, word.start - (previous?.end ?? 0)),
      pauseAfterMs: next ? Math.max(0, next.start - word.end) : 0,
    });
  });

  return { byId, speechMedian: median, medianMsPerChar: medianOf(rates) };
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
