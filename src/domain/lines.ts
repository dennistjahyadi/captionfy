/**
 * Grouping words into caption lines, and finding what is on screen at a time.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */
import { endsSentence } from './text';
import type { StyleProps } from './style';
import type { Ms, Project, Word } from './types';

/**
 * Defaults for line segmentation. Every one of these is a constant so it can be
 * tuned in one place after watching real clips.
 */
export const MAX_WORDS_PER_LINE = 4;
/**
 * How many caption lines are on screen at once.
 *
 * One, and structurally so: `segmentLines` returns the units the viewer sees one
 * at a time, and `activeWordAt` returns exactly one of them. A line too wide for
 * the frame wraps onto extra rows, which is a different thing and is capped by
 * the style's `maxRows`. Showing two lines at once would be a change to this
 * file, not a change to this number.
 */
export const MAX_LINES_ON_SCREEN = 1;
/** A pause at least this long reads as a new thought and starts a new line. */
export const LINE_BREAK_GAP_MS = 350;
/**
 * How long the last line of a run stays up after its final word.
 *
 * A line otherwise holds until the next one starts, which keeps the screen from
 * flickering empty between words. Without a cap, the closing line of a clip
 * would sit there for the rest of the video.
 */
export const LINE_HOLD_MS = 600;

export type SegmentLineOptions = {
  maxWordsPerLine: number;
  breakGapMs: Ms;
  breakOnSentenceEnd: boolean;
  holdMs: Ms;
};

export const DEFAULT_SEGMENT_OPTIONS: SegmentLineOptions = {
  maxWordsPerLine: MAX_WORDS_PER_LINE,
  breakGapMs: LINE_BREAK_GAP_MS,
  breakOnSentenceEnd: true,
  holdMs: LINE_HOLD_MS,
};

export interface CaptionLine {
  index: number;
  words: Word[];
  /** First word's start. Untouched by `globalOffsetMs`, which is applied at render time. */
  startMs: Ms;
  /** Last word's end. */
  endMs: Ms;
  /**
   * When the line leaves the screen: the next line's start, or `holdMs` after the
   * last word, whichever comes first.
   */
  visibleUntilMs: Ms;
}

/**
 * Groups words into the lines the viewer sees one at a time.
 *
 * A line ends when the word cap is reached, when the gap to the next word is long
 * enough to read as a pause, or when the word closes a sentence. `breakAfter`
 * overrides all three: `line` forces a break, `none` suppresses the automatic
 * ones. The word cap still applies under `none`, because a line that grows
 * without limit has nowhere to render.
 */
export function segmentLines(words: Word[], opts: Partial<SegmentLineOptions> = {}): CaptionLine[] {
  const { maxWordsPerLine, breakGapMs, breakOnSentenceEnd, holdMs } = {
    ...DEFAULT_SEGMENT_OPTIONS,
    ...opts,
  };
  const cap = Math.max(1, Math.round(maxWordsPerLine));

  const groups: Word[][] = [];
  let current: Word[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    current.push(word);

    const next = words[index + 1];
    if (!next) break;

    const full = current.length >= cap;
    const forced = word.breakAfter === 'line';
    const held = word.breakAfter === 'none';
    const gap = next.start - word.end >= breakGapMs;
    const sentence = breakOnSentenceEnd && endsSentence(word.text);

    if (forced || full || (!held && (gap || sentence))) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, index) => {
    const startMs = group[0].start;
    const endMs = group[group.length - 1].end;
    const nextStart = groups[index + 1]?.[0].start ?? Number.POSITIVE_INFINITY;
    return {
      index,
      words: group,
      startMs,
      endMs,
      visibleUntilMs: Math.min(nextStart, endMs + holdMs),
    };
  });
}

/**
 * The units the viewer sees one at a time, as the style groups them.
 *
 * The layout, the emphasis picker and the transcript all have to agree on where
 * the lines fall. A word emphasised against one grouping and drawn against
 * another would land in the wrong line, so everything goes through here.
 */
export function displayUnits(
  words: Word[],
  style: Pick<StyleProps, 'maxWordsPerLine'>
): CaptionLine[] {
  return segmentLines(words, { maxWordsPerLine: style.maxWordsPerLine });
}

export type ActiveCaption = {
  line: CaptionLine | null;
  /** Index into `line.words`, or -1 in a gap between the line's own words. */
  wordIndex: number;
  word: Word | null;
};

const NOTHING: ActiveCaption = { line: null, wordIndex: -1, word: null };

/**
 * What is on screen at player time `tMs`, with `globalOffsetMs` applied.
 *
 * The offset moves the captions, not the video, so the lookup runs against
 * `tMs - globalOffsetMs` and every time in the returned line stays in the word's
 * own clock. Callers that draw handles or seek the player add the offset back.
 */
export function activeWordAt(project: Project, tMs: Ms, opts?: Partial<SegmentLineOptions>): ActiveCaption {
  return activeWordInLines(segmentLines(project.words, opts), tMs, project.globalOffsetMs);
}

/**
 * The same lookup against lines the caller already has.
 *
 * The render loop and the export both run this once per frame, so they segment
 * once and reuse the result rather than regrouping every word sixty times a
 * second.
 */
export function activeWordInLines(lines: CaptionLine[], tMs: Ms, globalOffsetMs: Ms = 0): ActiveCaption {
  if (lines.length === 0) return NOTHING;

  const t = tMs - globalOffsetMs;
  const line = lineAt(lines, t);
  if (!line) return NOTHING;

  // A linear scan over at most `maxWordsPerLine` words.
  const wordIndex = line.words.findIndex((word) => t >= word.start && t < word.end);
  return { line, wordIndex, word: wordIndex === -1 ? null : line.words[wordIndex] };
}

/** Binary search for the line covering `t`, in the words' own clock. */
function lineAt(lines: CaptionLine[], t: Ms): CaptionLine | null {
  let low = 0;
  let high = lines.length - 1;
  let found: CaptionLine | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];
    if (t < line.startMs) {
      high = mid - 1;
    } else {
      found = line;
      low = mid + 1;
    }
  }

  if (!found) return null;
  return t < found.visibleUntilMs ? found : null;
}
