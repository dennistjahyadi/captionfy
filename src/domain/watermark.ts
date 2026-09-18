/**
 * The free tier's mark, laid out.
 *
 * Pure TypeScript. No platform imports, and no knowledge of what a receipt says:
 * this file answers "where does the mark go on a canvas this size", and the
 * caller decides whether to ask.
 *
 * **It is deliberately not part of `layoutCaptionFrame`.** A watermark is not a
 * caption — it takes no part in fitting, shrinking, revealing or emphasis, and
 * threading an entitlement flag through the caption layout would put billing
 * inside the one module that is allowed to know nothing but words and time. What
 * it does share with the captions is the thing that matters: it is a pure
 * function of the canvas and the same injected measurer, so the preview at
 * 360 points and the export at 1080 pixels produce the same mark in the same
 * place for the same reason `layoutCaptionFrame` does (invariant 2).
 *
 * Invariant 5 is the other half. The mark is drawn on the editor's preview as
 * well as into the file, because a watermark that appeared only at export would
 * be exactly the surprise that invariant exists to forbid.
 */
import type { Canvas, FaceSpec, MeasureText, ShadowDraw } from './layout';
import { SANS_FAMILY } from './style';

/** One mark, ready to draw. Every number is in canvas pixels. */
export interface WatermarkDraw {
  text: string;
  /** Left edge. */
  x: number;
  /** Baseline to draw the text on. */
  baseline: number;
  fontSize: number;
  face: FaceSpec;
  color: string;
  /** Always present: the mark has to survive light footage as well as dark. */
  shadow: ShadowDraw;
}

/**
 * What it says, and why it is a sentence rather than the brand.
 *
 * `Wordburn` alone was the first version and it fails the only test that
 * matters: somebody who watches the video has no idea what made it. A coined
 * word in a corner explains nothing, and this one has a specific way of being
 * misread — `Word-` is game-coded on app stores, which is the same constraint
 * the icon was designed against, so "Wordburn" over a video can read as a word
 * game somebody was playing rather than the thing that put the captions there.
 *
 * Naming the job fixes that and carries the term a viewer would search. It also
 * reads as a credit rather than a stamp, which is the tone to want on somebody
 * else's video when the whole offer is that they may keep using it.
 */
export const WATERMARK_TEXT = 'Captions by Wordburn';

/**
 * Where the mark sits, as fractions of the canvas.
 *
 * The band between the platform safe zone's top edge and the highest caption is
 * the only place on a vertical video that is both visible on TikTok, Reels and
 * Shorts and not already spoken for:
 *
 *   0.110  `safeZoneUnion().top` — above this the platform draws its own chrome
 *   0.125  the mark
 *   0.141  the mark's foot at the size below
 *   0.280  `CAPTION_INSET.upperMiddle`, the top of the highest caption the style
 *          sheet can produce. `top` (0.12) exists in the domain and would clash,
 *          but `StylePicker` does not offer it, for its own safety reasons.
 *
 * Bottom-left and bottom-right were the obvious corners and both are wrong: the
 * union's bottom inset is 0.22 and its right inset 0.24, so a mark down there is
 * under TikTok's action rail and the caption tray — invisible where it is meant
 * to be seen, and in the way while the user is reviewing. Bottom-left is also
 * where the captions are: `lowerThird` sits directly on top of that same 0.22.
 *
 * **Both numbers are an inset from the safe zone, not a position of their own.**
 * They were 0.135 and 0.06, which is a sixth of the band down and half a point
 * in from the margin — near enough the corner to be reaching for it and far
 * enough to miss, so the mark read as floating in the frame rather than pinned
 * to it. A corner bug is a corner bug: it takes the margin it is given and
 * clears it by a hair. What is left here is 0.015 of the height under the safe
 * line and 0.010 of the width inside it, which on a 1080 × 1920 frame is 29 px
 * and 11 px — enough that a platform a point more aggressive than the union
 * still misses it, and not enough to look like a choice.
 */
const TOP = 0.125;
const LEFT = 0.05;

/**
 * Small enough to read as a mark rather than a caption, large enough to survive
 * a feed. Measured against the real face rather than guessed: the line above in
 * Be Vietnam Pro ExtraBold at this ratio is 264 px on a 1080 frame, ending at
 * 0.294 of the width against the safe zone's 0.760 limit, and 0.141 of the
 * height against `CAPTION_INSET.upperMiddle`'s 0.280.
 *
 * It is **smaller** than the 0.018 the bare wordmark used. A longer line at the
 * old size was a third of the frame and shouted; at this one it takes a quarter
 * and reads as fine print that happens to be legible. Short-form plays
 * full-screen, so a 1080-wide frame is about 1:1 on the phone and a 17 px cap
 * height is comfortably readable — the mock-ups this was chosen from were
 * compared at 1:1 for that reason.
 */
const SIZE_RATIO = 0.012;

/**
 * White, a little under full strength, over a soft dark shadow.
 *
 * The shadow is what makes "subtle" survivable — the captions hold themselves
 * off the frame the same way, and at 82% over a blur the mark reads on a white
 * kitchen wall and on a night shot without being the brightest thing on either.
 */
const COLOR = '#FFFFFFD1';
const SHADOW_COLOR = '#00000099';
/** Of the font size. `blur` is a Gaussian sigma, as everywhere in the draw list. */
const SHADOW_BLUR_RATIO = 0.12;
const SHADOW_DY_RATIO = 0.05;

const FACE: FaceSpec = { family: SANS_FAMILY, weight: 'extrabold', italic: false };

export function layoutWatermark(canvas: Canvas, measure: MeasureText): WatermarkDraw {
  const fontSize = canvas.height * SIZE_RATIO;
  // Ascent rather than the font size: the domain's measurer reports it as a
  // positive distance above the baseline, so this puts the cap-height top of the
  // mark on TOP rather than putting its baseline there and hanging it higher.
  const { ascent } = measure(WATERMARK_TEXT, fontSize, FACE);

  return {
    text: WATERMARK_TEXT,
    x: canvas.width * LEFT,
    baseline: canvas.height * TOP + ascent,
    fontSize,
    face: FACE,
    color: COLOR,
    shadow: {
      color: SHADOW_COLOR,
      blur: fontSize * SHADOW_BLUR_RATIO,
      dx: 0,
      dy: fontSize * SHADOW_DY_RATIO,
    },
  };
}
