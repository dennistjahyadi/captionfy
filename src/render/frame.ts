/**
 * One project, segmented once, laid out per frame.
 *
 * `layoutCaptionFrame` re-segments the whole transcript on every call, which is
 * the right shape for a one-off but the wrong one for a preview running sixty
 * times a second over a thousand words. This does the grouping once and hands
 * the rest straight to the same layout, so there is still exactly one of them
 * (invariant 2).
 */
import {
  activeWordInLines,
  emphasisedWordIds,
  layoutCaptionFrameFromLines,
  projectStyle,
  projectUnits,
  type CaptionFrame,
  type CaptionLine,
  type Canvas,
  type LayoutOptions,
  type MeasureText,
  type Ms,
  type Project,
  type StyleProps,
  type Word,
} from '../domain';

export interface FrameSource {
  style: StyleProps;
  /** The units the viewer sees one at a time, in the words' own clock. */
  units: CaptionLine[];
  /** Frozen auto picks plus the user's overrides, as the layout wants them. */
  emphasisIds: ReadonlySet<string>;
  /** The draw list at player time `tMs`. */
  frameAt(tMs: Ms, canvas: Canvas, measure: MeasureText, opts?: LayoutOptions): CaptionFrame;
  /** The word under the playhead, for the transcript's highlight. */
  wordAt(tMs: Ms): Word | null;
  /** The unit on screen at `tMs`, which is what shift-all loops. */
  lineAt(tMs: Ms): CaptionLine | null;
  /** Player time to seek to so `word` is the one being spoken. */
  seekTimeFor(word: Word): Ms;
}

export function createFrameSource(project: Project): FrameSource {
  const style = projectStyle(project);
  const units = projectUnits(project, style);
  const emphasisIds = emphasisedWordIds(project);
  const offset = project.globalOffsetMs;

  return {
    style,
    units,
    emphasisIds,

    frameAt(tMs, canvas, measure, opts = {}) {
      return layoutCaptionFrameFromLines(units, offset, style, tMs, canvas, measure, {
        emphasisIds,
        ...opts,
      });
    },

    wordAt(tMs) {
      return activeWordInLines(units, tMs, offset).word;
    },

    lineAt(tMs) {
      return activeWordInLines(units, tMs, offset).line;
    },

    // Captions move with the offset, the video does not, so seeking to a word
    // means seeking to where that word is heard.
    seekTimeFor(word) {
      return word.start + offset;
    },
  };
}
