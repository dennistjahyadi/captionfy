/**
 * Which words the engine was unsure about.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Invariant 6: none of this reaches the video. Low confidence is a transcript
 * mark and an editing aid. It is never drawn over the preview and never burned
 * into an export, so `layoutCaptionFrame` does not import this file.
 */
import { segmentLines, type CaptionLine, type SegmentLineOptions } from './lines';
import type { LineFlag, Project, Word } from './types';

/**
 * Token probability below which a word is worth a second look.
 *
 * whisper.cpp returns a per-token probability, which the local patch surfaces as
 * `p` (see patches/). Correct tokens on clean speech sit well above this; the
 * number is a starting point to tune against real clips, not a measurement.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * True when a word should carry the dotted underline.
 *
 * Only untouched engine output can be flagged. Editing a word answers the
 * question the flag was asking, a dictionary replacement is the user's own
 * spelling, and "Looks right" sets `confirmed`.
 */
export function isLowConfidence(word: Word, threshold = LOW_CONFIDENCE_THRESHOLD): boolean {
  if (word.origin !== 'asr' || word.confirmed) return false;
  return word.conf !== undefined && word.conf < threshold;
}

export function lowConfidenceWords(project: Project, threshold = LOW_CONFIDENCE_THRESHOLD): Word[] {
  return project.words.filter((word) => isLowConfidence(word, threshold));
}

/**
 * Lines worth a marker down their left edge.
 *
 * Two sources. A word below the threshold flags the line it sits in, and the
 * project's own `lineFlags` carry whatever the transcription pass recorded about
 * a whole line, which is the only signal available if a model ever comes back
 * without per-token probabilities.
 */
export function lowConfidenceLines(
  project: Project,
  threshold = LOW_CONFIDENCE_THRESHOLD,
  opts?: Partial<SegmentLineOptions>
): CaptionLine[] {
  const flagged = new Set(
    project.lineFlags.filter((flag) => flag.lowConfidence).map((flag) => flag.lineStartWordId)
  );

  return segmentLines(project.words, opts).filter(
    (line) =>
      flagged.has(line.words[0].id) || line.words.some((word) => isLowConfidence(word, threshold))
  );
}

/** How many words the "N to check" chip counts. */
export function lowConfidenceCount(project: Project, threshold = LOW_CONFIDENCE_THRESHOLD): number {
  return lowConfidenceWords(project, threshold).length;
}

/**
 * The next word to check after `afterWordId`, wrapping to the start.
 *
 * The chip walks the list rather than jumping to the worst word, so repeated
 * taps move forward through the transcript instead of bouncing around it.
 */
export function nextLowConfidenceWordId(
  project: Project,
  afterWordId?: string,
  threshold = LOW_CONFIDENCE_THRESHOLD
): string | null {
  const flagged = lowConfidenceWords(project, threshold);
  if (flagged.length === 0) return null;
  if (!afterWordId) return flagged[0].id;

  const from = project.words.findIndex((word) => word.id === afterWordId);
  const next = flagged.find((word) => project.words.indexOf(word) > from);
  return (next ?? flagged[0]).id;
}

/**
 * Recomputes the persisted line flags from the words.
 *
 * Called once when a transcription finishes. After that the flags are stable
 * data the user can clear, and word-level confidence carries the rest.
 */
export function lineFlagsFor(
  words: Word[],
  threshold = LOW_CONFIDENCE_THRESHOLD,
  opts?: Partial<SegmentLineOptions>
): LineFlag[] {
  return segmentLines(words, opts)
    .filter((line) => line.words.some((word) => isLowConfidence(word, threshold)))
    .map((line) => ({ lineStartWordId: line.words[0].id, lowConfidence: true }));
}

export function clearLineFlag(flags: LineFlag[], lineStartWordId: string): LineFlag[] {
  return flags.filter((flag) => flag.lineStartWordId !== lineStartWordId);
}
