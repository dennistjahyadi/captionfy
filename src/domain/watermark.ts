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
import type { BoxDraw, Canvas, FaceSpec, MeasureText, ShadowDraw } from './layout';
import { SANS_FAMILY } from './style';

/** One line of the mark. Every number is in canvas pixels. */
export interface WatermarkTextDraw {
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
 * One mark, ready to draw: the icon above, then the credit.
 *
 * Two lists rather than one shape, because that is what the two renderers
 * already know how to draw — a `BoxDraw` is the same rounded rectangle a box
 * highlight is, and a line is the same two draws a word is. Nothing downstream
 * learns what a logo is.
 */
export interface WatermarkDraw {
  /** The app icon's three pills, drawn under nothing and over nothing. */
  pills: BoxDraw[];
  /** The credit and the brand, in draw order. */
  lines: WatermarkTextDraw[];
}

/**
 * What it says, why it is a sentence rather than the brand, and why it stacks.
 *
 * `Wordburn` alone was the first version and it fails the only test that
 * matters: somebody who watches the video has no idea what made it. A coined
 * word in a corner explains nothing, and this one has a specific way of being
 * misread — `Word-` is game-coded on app stores, which is the same constraint
 * the icon was designed against, so "Wordburn" over a video can read as a word
 * game somebody was playing rather than the thing that put the captions there.
 *
 * Naming the job fixes that and carries the term a viewer would search. Set as
 * one long line it read as a sentence dropped into the frame; stacked, the
 * quiet half is a label and the brand underneath is the name — which is the
 * shape every platform's own mark uses, and the shape a viewer reads in one
 * glance rather than one sentence.
 */
export const WATERMARK_CREDIT = 'Captions by';
export const WATERMARK_BRAND = 'Wordburn';

/**
 * Where the mark sits, as fractions of the canvas.
 *
 * The band between the platform safe zone's top edge and the highest caption is
 * the only place on a vertical video that is both visible on TikTok, Reels and
 * Shorts and not already spoken for:
 *
 *   0.110  `safeZoneUnion().top` — above this the platform draws its own chrome
 *   0.118  the mark
 *   0.170  the mark's foot at the sizes below
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
 * clears it by a hair. What is left here is 0.008 of the height under the safe
 * line and 0.010 of the width inside it, which on a 1080 × 1920 frame is 15 px
 * and 11 px — enough that a platform a point more aggressive than the union
 * still misses it, and not enough to look like a choice.
 *
 * `TOP` was 0.125 and came down when the icon moved above the words: a stack is
 * taller than a row, so the same inset that read as pinned under a two-line
 * badge read as hanging under a three-tier one, and the extra height grows
 * downward into the band rather than up into the chrome. 0.110 is the floor and
 * not a suggestion — the union is where the platforms start drawing.
 */
const TOP = 0.118;
const LEFT = 0.05;

/**
 * Small enough to read as a mark rather than a caption, large enough to survive
 * a feed. Measured against the real faces rather than guessed: the whole badge
 * at these ratios is 154 px across on a 1080 frame — 0.143 of the width, ending
 * at 0.193 against the safe zone's 0.760 limit — and its foot lands at 0.170 of
 * the height against `CAPTION_INSET.upperMiddle`'s 0.280.
 *
 * The brand line is 29.8 px there and the credit 19.1 px. Short-form plays
 * full-screen, so a 1080-wide frame is about 1:1 on the phone and those are
 * comfortably legible — which is why the mock-ups this was chosen from were
 * compared at 1:1 rather than shrunk to a feed that does not exist.
 *
 * The badge is as wide as its longest line and no wider, now that the icon sits
 * over the words instead of beside them: 0.143 of the frame against the 0.226
 * the row took and the 0.247 the single line took before that. It spends that on
 * height — 0.052 against 0.023 — which is the cheaper of the two, because the
 * band it lives in is 0.170 deep and the margin it was crowding is the right
 * one, where TikTok's rail starts at 0.760.
 */
const BRAND_RATIO = 0.0155;
/** Of the brand's size. Quiet enough to be a label, big enough to be read. */
const CREDIT_RATIO = 0.64;
/** Of the credit's size: the advance from the credit's cap line to the brand's. */
const LINE_RATIO = 1.02;

/**
 * The icon, above the words.
 *
 * `store/wordburn-mark-bare.svg` is three pills — a caption line with the word
 * the speaker leaned on picked out in the accent — and these are its own
 * rectangles normalised to their bounding box, x as fractions of the logo's
 * width and everything else as fractions of its height. One drawing, described
 * twice, would be two drawings.
 *
 * Beside the words the logo had to be measured against the height of both of
 * them or it would have looked dropped in; over them it takes its size from the
 * brand alone, which is the line it sits on top of and the line it shares a left
 * edge with. At 1.15 the widest pill lands about where "Captions by" ends, so
 * the three tiers read as one block with one edge rather than as a picture and
 * some type. Bigger than that and the logo is the loudest thing in the badge,
 * which is backwards for a credit.
 */
const LOGO_ASPECT = 593.92 / 317.44;
const LOGO_HEIGHT_RATIO = 1.15;
/** Of the brand's size: the drop from the logo's foot to the credit's cap line. */
const LOGO_GAP_RATIO = 0.3;

interface Pill {
  /** Of the logo's width. */
  x: number;
  width: number;
  /** Of the logo's height. */
  y: number;
  height: number;
  accent: boolean;
}

const PILLS: Pill[] = [
  { x: 0, width: 0.5759, y: 0, height: 0.2, accent: false },
  { x: 0, width: 1, y: 0.329, height: 0.3419, accent: true },
  { x: 0, width: 0.4724, y: 0.8, height: 0.2, accent: false },
];

/**
 * White over a soft dark shadow, and the icon's own yellow.
 *
 * The shadow is what makes "subtle" survivable — the captions hold themselves
 * off the frame the same way. It is heavier here than a caption's because the
 * mark is a third of a caption's size and the hard case is a white kitchen wall,
 * where the halo is the only thing separating a white mark from the frame: on
 * the near-white still this was designed over, a lighter shadow lost the credit
 * line entirely.
 */
const BRAND_COLOR = '#FFFFFF';
const CREDIT_COLOR = '#FFFFFFE0';
const PILL_COLOR = '#FFFFFFB8';
const PILL_ACCENT = '#FFE03D';
const SHADOW_COLOR = '#0000009E';
/** Of the element's size. `blur` is a Gaussian sigma, as everywhere in a draw list. */
const SHADOW_BLUR_RATIO = 0.2;
const SHADOW_DY_RATIO = 0.05;

const BRAND_FACE: FaceSpec = { family: SANS_FAMILY, weight: 'extrabold', italic: false };
const CREDIT_FACE: FaceSpec = { family: SANS_FAMILY, weight: 'semibold', italic: false };

export function layoutWatermark(canvas: Canvas, measure: MeasureText): WatermarkDraw {
  const brandSize = canvas.height * BRAND_RATIO;
  const creditSize = brandSize * CREDIT_RATIO;

  // Ascent rather than the font size: the domain's measurer reports it as a
  // positive distance above the baseline, so the gap below the logo is a real
  // gap to the credit's cap line rather than a baseline dropped an arbitrary way.
  const credit = measure(WATERMARK_CREDIT, creditSize, CREDIT_FACE);
  const brand = measure(WATERMARK_BRAND, brandSize, BRAND_FACE);

  const top = canvas.height * TOP;
  const left = canvas.width * LEFT;

  // The logo first, then the words under it, all on one left edge. `TOP` is the
  // top of the logo rather than of the type, because the pills are what the eye
  // finds first and the mark is pinned by what it is, not by what it says.
  const logoHeight = brandSize * LOGO_HEIGHT_RATIO;
  const logoWidth = logoHeight * LOGO_ASPECT;
  const logoTop = top;

  const textTop = logoTop + logoHeight + brandSize * LOGO_GAP_RATIO;
  const creditBaseline = textTop + credit.ascent;
  const brandBaseline = textTop + creditSize * LINE_RATIO + brand.ascent;
  const textX = left;

  return {
    pills: PILLS.map((pill) => ({
      x: left + logoWidth * pill.x,
      y: logoTop + logoHeight * pill.y,
      width: logoWidth * pill.width,
      height: logoHeight * pill.height,
      // A pill is a capsule: the radius is half its own height at every size.
      radius: (logoHeight * pill.height) / 2,
      color: pill.accent ? PILL_ACCENT : PILL_COLOR,
      shadow: shadowFor(brandSize),
    })),
    lines: [
      {
        text: WATERMARK_CREDIT,
        x: textX,
        baseline: creditBaseline,
        fontSize: creditSize,
        face: CREDIT_FACE,
        color: CREDIT_COLOR,
        shadow: shadowFor(creditSize),
      },
      {
        text: WATERMARK_BRAND,
        x: textX,
        baseline: brandBaseline,
        fontSize: brandSize,
        face: BRAND_FACE,
        color: BRAND_COLOR,
        shadow: shadowFor(brandSize),
      },
    ],
  };
}

function shadowFor(size: number): ShadowDraw {
  return {
    color: SHADOW_COLOR,
    blur: size * SHADOW_BLUR_RATIO,
    dx: 0,
    dy: size * SHADOW_DY_RATIO,
  };
}

/**
 * The rectangle the whole badge occupies, for anything that has to reason about
 * where it is rather than draw it — which in practice is the test that keeps it
 * inside the safe zone and out of the captions.
 */
export function watermarkBounds(
  mark: WatermarkDraw,
  measure: MeasureText
): { x: number; y: number; width: number; height: number } {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  const consider = (x: number, y: number, width: number, height: number) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  };

  for (const pill of mark.pills) consider(pill.x, pill.y, pill.width, pill.height);
  for (const line of mark.lines) {
    const metrics = measure(line.text, line.fontSize, line.face);
    consider(
      line.x,
      line.baseline - metrics.ascent,
      metrics.width,
      metrics.ascent + metrics.descent
    );
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
