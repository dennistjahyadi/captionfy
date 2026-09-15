/**
 * The one caption layout.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Invariant 2: the Skia preview and the burn-in both draw this function's output
 * and nothing else. Wrapping, position, colour, fill progress, opacity and the
 * emphasis rise are all decided here, because every one of them is somewhere the
 * preview and the export could otherwise drift apart. If the native burn-in
 * cannot consume a draw list directly it renders overlay frames from this, but
 * it never lays text out itself.
 *
 * Nothing here reads confidence. Low confidence is a transcript mark and never
 * appears on the video (invariant 6).
 */
import { emphasisedWordIds } from './emphasis';
import { activeWordInLines, type CaptionLine } from './lines';
import { projectUnits } from './project';
import {
  CAPTION_INSET,
  EDITORIAL_MAX_ROWS,
  insetsFor,
  isPaintable,
  LINE_HEIGHT_RATIO,
  OWN_COLOR,
  TEXT_SIZE_RATIO,
  type CaptionPosition,
  type FontWeight,
  type ShadowStyle,
  type StyleProps,
} from './style';
import type { Ms, Project, Word } from './types';

export type Canvas = { width: number; height: number };

/** Which face to draw with. The renderer maps this onto a loaded typeface. */
export type FaceSpec = { family: string; weight: FontWeight; italic: boolean };

/**
 * What the renderer knows about a font that this module cannot work out.
 *
 * Injected rather than approximated because the preview and the export have to
 * agree to the pixel, and the only way to guarantee that is for both to hand in
 * the same measurer over the same faces.
 */
export type TextMetrics = { width: number; ascent: number; descent: number };
export type MeasureText = (text: string, fontSize: number, face: FaceSpec) => TextMetrics;

export type WordState = 'past' | 'active' | 'future';

/**
 * Reserved for text behind the speaker, which is a v1.5 renderer change.
 *
 * It is in the draw list now so that adding it later is a change to how an
 * element is composited and not a change to the shape of this API. Everything
 * is `front` today and nothing reads it yet.
 */
export type Layer = 'front' | 'behind';

/**
 * A drop shadow in pixels, ready to draw.
 *
 * `blur` is a Gaussian sigma, which is what Skia's blur mask filter takes. The
 * burn-in converts it to the blur radius `android.graphics` asks for, because
 * the two APIs name the same thing differently and a shadow twice as soft in the
 * exported file would be invariant 2 broken quietly.
 *
 * `OWN_COLOR` is resolved before this is built, so nothing downstream ever has
 * to know what casts the shadow.
 */
export interface ShadowDraw {
  color: string;
  blur: number;
  dx: number;
  dy: number;
}

export interface CaptionBoxDraw {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  shadow?: ShadowDraw;
  layer: Layer;
}

export interface CaptionWordDraw {
  wordId: string;
  /** Exactly the glyphs to draw, uppercasing already applied. */
  text: string;
  /** Left edge of the word box, in canvas pixels. */
  x: number;
  /** Top edge of the row this word sits on. */
  y: number;
  width: number;
  height: number;
  /** Baseline to draw the text on, shared with every word on the same row. */
  baseline: number;
  fontSize: number;
  face: FaceSpec;
  state: WordState;
  /** True when the emphasis rule or the user made this the big word of its line. */
  emphasised: boolean;
  /** 0..1 of the word's width that has been spoken. Karaoke fill clips to this. */
  fill: number;
  /** Draw colour of the unfilled part of the word. */
  color: string;
  /** Draw colour of the filled part. Equal to `color` outside karaoke mode. */
  fillColor: string;
  /** 1 for a word already spoken, lower for one still coming. */
  opacity: number;
  /** Uniform scale about the centre of the word box. 1 unless the word is rising. */
  scale: number;
  outline: { color: string; width: number };
  /** Soft shadow or glow behind the glyphs. Absent when the style asks for none. */
  shadow?: ShadowDraw;
  box?: CaptionBoxDraw;
  layer: Layer;
}

export interface CaptionFrame {
  tMs: Ms;
  /** Base size after any shrink to fit. The emphasised word may differ. */
  fontSize: number;
  lineHeight: number;
  /**
   * One card behind the whole block, drawn under every word.
   *
   * Not the per-word box: that is `CaptionWordDraw.box` and it marks the word
   * being spoken. This is the sheet of paper the line is printed on.
   */
  plate?: CaptionBoxDraw;
  words: CaptionWordDraw[];
}

export interface LayoutOptions {
  /**
   * Words to render big. Defaults to the project's own picks and overrides;
   * passed explicitly by `layoutCaptionFrameFromLines`, which has no project.
   */
  emphasisIds?: ReadonlySet<string>;
  /** Honours the system setting. The export must pass the same value the preview used. */
  reducedMotion?: boolean;
}

/** Padding around the active word's box, as fractions of the font size. */
export const BOX_PAD = { x: 0.22, y: 0.12 };
export const BOX_RADIUS_RATIO = 0.18;
/** Type never shrinks below this fraction of the canvas height to make a line fit. */
const MIN_FONT_RATIO = 0.022;
/** Each pass at fitting a line takes this much off the font size. */
const SHRINK_STEP = 0.94;
const MAX_SHRINK_PASSES = 12;

const EMPTY_WORDS: CaptionWordDraw[] = [];

/**
 * The draw list for one instant.
 *
 * `tMs` is player time. `globalOffsetMs` is applied here, so the caller passes
 * the video's own clock and never pre-shifts it.
 */
export function layoutCaptionFrame(
  project: Project,
  style: StyleProps,
  tMs: Ms,
  canvas: Canvas,
  measure: MeasureText,
  opts: LayoutOptions = {}
): CaptionFrame {
  const units = projectUnits(project, style);
  return layoutCaptionFrameFromLines(units, project.globalOffsetMs, style, tMs, canvas, measure, {
    emphasisIds: opts.emphasisIds ?? emphasisedWordIds(project),
    reducedMotion: opts.reducedMotion,
  });
}

/**
 * The same layout against lines the caller already segmented.
 *
 * The preview runs this sixty times a second and an export runs it once per
 * frame, so both segment the project once and reuse it.
 */
export function layoutCaptionFrameFromLines(
  lines: CaptionLine[],
  globalOffsetMs: Ms,
  style: StyleProps,
  tMs: Ms,
  canvas: Canvas,
  measure: MeasureText,
  opts: LayoutOptions = {}
): CaptionFrame {
  const { line, word: activeWord } = activeWordInLines(lines, tMs, globalOffsetMs);
  const baseFontSize = canvas.height * TEXT_SIZE_RATIO[style.textSize];

  if (!line) {
    return {
      tMs,
      fontSize: baseFontSize,
      lineHeight: baseFontSize * LINE_HEIGHT_RATIO,
      words: EMPTY_WORDS,
    };
  }

  const emphasisIds = opts.emphasisIds ?? new Set<string>();
  const insets = insetsFor(style);
  const available = canvas.width * (1 - insets.left - insets.right);
  const minFontSize = canvas.height * MIN_FONT_RATIO;
  const captionTime = tMs - globalOffsetMs;
  const visible = visibleCount(line.words, style, captionTime);

  const baseFace: FaceSpec = { family: style.fontFamily, weight: style.weight, italic: false };
  const emphasisFace: FaceSpec = {
    family: style.emphasis.fontFamily,
    weight: style.emphasis.weight,
    italic: style.emphasis.italic,
  };

  // At most one word per display unit is emphasised. Taking the first defends
  // against a stale pick surviving an edit that put two in the same line.
  const emphasisIndex = line.words.findIndex((word) => emphasisIds.has(word.id));

  const plan =
    style.emphasis.ownRow && emphasisIndex >= 0
      ? stackedPlan(line.words, emphasisIndex, visible, style, baseFontSize, minFontSize, available, measure, baseFace, emphasisFace)
      : flowPlan(line.words, emphasisIndex, visible, style, baseFontSize, minFontSize, available, measure, baseFace, emphasisFace);

  // A row pinned to a band of its own is not part of the block, so it does not
  // count towards where the block sits or how tall it is.
  const blockHeight = plan.rows.reduce((total, row) => total + (row.band ? 0 : row.height), 0);
  const blockTop = blockTopFor(style.position, canvas, blockHeight);
  const reducedMotion = opts.reducedMotion === true;

  const words: CaptionWordDraw[] = [];
  const bounds = new Bounds();
  let rowTop = blockTop;

  for (const row of plan.rows) {
    const top = row.band ? blockTopFor(row.band, canvas, row.height) : rowTop;
    // Left-aligned rows start at the margin; centred rows centre in the canvas,
    // not in the inset box, so a caption sits under the middle of the frame.
    let x = style.align === 'left' ? canvas.width * insets.left : (canvas.width - row.width) / 2;
    const baseline = top + (row.height - (row.ascent + row.descent)) / 2 + row.ascent;

    for (const item of row.items) {
      const word = line.words[item.index];
      const state = stateOf(word, activeWord, captionTime);
      const boxed = style.highlightMode === 'box' && state === 'active';
      const color = colorOf(style, item.emphasised, boxed);
      const arrival = entranceOf(word, item, captionTime, style, reducedMotion);
      const box = boxed
        ? boxFor(x, top + arrival.dy, item.width, row.height, item.fontSize, style)
        : undefined;

      words.push({
        wordId: word.id,
        text: item.text,
        x,
        // The entrance slide is folded into the coordinates rather than carried
        // as a separate offset, so every renderer that can draw a word at a
        // place can draw a word arriving without learning a new field.
        y: top + arrival.dy,
        width: item.width,
        height: row.height,
        baseline: baseline + arrival.dy,
        fontSize: item.fontSize,
        face: item.face,
        state,
        emphasised: item.emphasised,
        fill: fillOf(word, state, captionTime, style),
        color,
        fillColor: fillColorOf(style, item.emphasised, boxed),
        opacity: (state === 'future' ? style.upcomingOpacity : 1) * arrival.opacity,
        scale: arrival.scale,
        outline: { color: style.outlineColor, width: item.fontSize * style.outlineRatio },
        // A glow resolves against the colour the word ends up, not the one it
        // starts in: a karaoke word is white until it fills and the accent
        // after, and a halo that waited for the fill to catch up would read as
        // the glow lagging the voice.
        shadow: shadowOf(
          shadowSpecFor(style, item.emphasised),
          item.fontSize,
          fillColorOf(style, item.emphasised, boxed)
        ),
        box,
        layer: 'front',
      });

      // The card is measured off where the words settle, not off where they are
      // mid-entrance, and against the box every word could wear rather than the
      // one wearing it now. Either would make the card the only thing on screen
      // that moves: it would breathe under an arriving word, and it would step
      // in and out as the highlight reached the ends of the line.
      if (!row.band) {
        const inBox = style.highlightMode === 'box';
        const padX = inBox ? item.fontSize * BOX_PAD.x : 0;
        const padY = inBox ? item.fontSize * BOX_PAD.y : 0;
        bounds.add(x - padX, top - padY, item.width + padX * 2, row.height + padY * 2);
      }

      x += item.width + row.spaceWidth;
    }

    if (!row.band) rowTop += row.height;
  }

  return {
    tMs,
    fontSize: plan.baseFontSize,
    lineHeight: plan.baseFontSize * LINE_HEIGHT_RATIO,
    plate: plateFor(style, plan.baseFontSize, bounds),
    words,
  };
}

/**
 * How many of a line's words are on screen.
 *
 * Under `reveal: 'word'` a line builds as it is spoken, so a word the viewer has
 * not heard yet is not drawn at all — which is what every app this one competes
 * with does, and what a static block of subtitle text does not.
 *
 * Never zero. A line becomes visible when its first word starts, so the count is
 * already at least one in every ordinary case; the floor is here for the moment
 * after an edit when a line's own start and its first word's start disagree, and
 * a caption blinking out is worse than a caption a few milliseconds early.
 */
function visibleCount(words: Word[], style: StyleProps, captionTime: Ms): number {
  if (style.reveal !== 'word') return words.length;

  let count = 0;
  while (count < words.length && words[count].start <= captionTime) count += 1;
  return Math.max(1, count);
}

/** The rectangle the drawn rows cover, for the plate to sit under. */
class Bounds {
  left = Infinity;
  top = Infinity;
  right = -Infinity;
  bottom = -Infinity;

  add(x: number, y: number, width: number, height: number): void {
    this.left = Math.min(this.left, x);
    this.top = Math.min(this.top, y);
    this.right = Math.max(this.right, x + width);
    this.bottom = Math.max(this.bottom, y + height);
  }

  get empty(): boolean {
    return this.right <= this.left;
  }
}

function plateFor(
  style: StyleProps,
  baseFontSize: number,
  bounds: Bounds
): CaptionBoxDraw | undefined {
  const { plate } = style;
  if (!isPaintable(plate.color) || bounds.empty) return undefined;

  const padX = baseFontSize * plate.padXRatio;
  const padY = baseFontSize * plate.padYRatio;

  return {
    x: bounds.left - padX,
    y: bounds.top - padY,
    width: bounds.right - bounds.left + padX * 2,
    height: bounds.bottom - bounds.top + padY * 2,
    radius: baseFontSize * plate.radiusRatio,
    color: plate.color,
    shadow: shadowOf(plate.shadow, baseFontSize, plate.color),
    layer: 'front',
  };
}

type RowItem = {
  index: number;
  text: string;
  width: number;
  fontSize: number;
  face: FaceSpec;
  emphasised: boolean;
};

type Row = {
  items: RowItem[];
  width: number;
  height: number;
  ascent: number;
  descent: number;
  spaceWidth: number;
  /** Set only on an emphasis row the style pinned away from the block. */
  band?: CaptionPosition;
};

type Plan = { rows: Row[]; baseFontSize: number };

/**
 * Words in a line, wrapping when they run out of width.
 *
 * The emphasised word, if there is one, simply sits inline at its own size. This
 * is what every preset but Editorial does.
 *
 * The fit is decided against the whole line and only then are the first
 * `visible` words laid out, so a line revealing a word at a time keeps one type
 * size from its first word to its last. Fitting the prefix instead would shrink
 * the type under the reader as the line filled up.
 */
function flowPlan(
  words: Word[],
  emphasisIndex: number,
  visible: number,
  style: StyleProps,
  baseFontSize: number,
  minFontSize: number,
  available: number,
  measure: MeasureText,
  baseFace: FaceSpec,
  emphasisFace: FaceSpec
): Plan {
  let fontSize = baseFontSize;
  let rows = wrapRows(words, emphasisIndex, style, fontSize, available, measure, baseFace, emphasisFace);

  // Shrink until the line fits the allowed number of rows. Deterministic, so the
  // preview and the export shrink by the same amount on the same line.
  for (
    let pass = 0;
    rows.length > style.maxRows && fontSize > minFontSize && pass < MAX_SHRINK_PASSES;
    pass += 1
  ) {
    fontSize = Math.max(minFontSize, fontSize * SHRINK_STEP);
    rows = wrapRows(words, emphasisIndex, style, fontSize, available, measure, baseFace, emphasisFace);
  }

  if (visible < words.length) {
    rows = wrapRows(
      words.slice(0, visible),
      emphasisIndex,
      style,
      fontSize,
      available,
      measure,
      baseFace,
      emphasisFace
    );
  }

  return { rows, baseFontSize: fontSize };
}

/**
 * The pull-quote shape: what came before, the big word, what comes after.
 *
 * The big word is auto-fitted down to the width it has, with a floor. A word too
 * long to fit even at the floor keeps the emphasis colour and gives up the size,
 * because a "big" word rendered smaller than the line around it reads as a bug.
 */
function stackedPlan(
  words: Word[],
  emphasisIndex: number,
  visible: number,
  style: StyleProps,
  baseFontSize: number,
  minFontSize: number,
  available: number,
  measure: MeasureText,
  baseFace: FaceSpec,
  emphasisFace: FaceSpec
): Plan {
  const before = words.slice(0, emphasisIndex);
  const after = words.slice(emphasisIndex + 1);
  const emphasisText = display(words[emphasisIndex], style);

  let base = baseFontSize;

  // The surrounding rows are single rows by definition of the shape, so if they
  // overrun the width the base type shrinks rather than the shape changing.
  for (let pass = 0; pass < MAX_SHRINK_PASSES; pass += 1) {
    const widest = Math.max(
      rowWidth(before, style, base, measure, baseFace),
      rowWidth(after, style, base, measure, baseFace)
    );
    if (widest <= available || base <= minFontSize) break;
    base = Math.max(minFontSize, base * SHRINK_STEP);
  }

  const emphasisSize = fitEmphasis(emphasisText, base, style, available, measure, emphasisFace);

  // Only the words already spoken take a place in the shape; the rows that have
  // not arrived are simply absent, so the stack builds downward. The sizes above
  // were decided against the whole line, so nothing resizes as it fills.
  const shownBefore = before.slice(0, visible);
  const shownAfter = after.slice(0, Math.max(0, visible - emphasisIndex - 1));

  const rows: Row[] = [];
  if (shownBefore.length > 0) {
    rows.push(buildRow(shownBefore, 0, style, base, measure, baseFace, emphasisFace, -1));
  }
  if (emphasisIndex < visible) {
    const row = buildRow([words[emphasisIndex]], emphasisIndex, style, base, measure, baseFace, emphasisFace, emphasisIndex, emphasisSize);
    rows.push(style.emphasis.band ? { ...row, band: style.emphasis.band } : row);
  }
  if (shownAfter.length > 0) {
    rows.push(
      buildRow(shownAfter, emphasisIndex + 1, style, base, measure, baseFace, emphasisFace, -1)
    );
  }

  // Three rows is the shape. The cap is here so a style override cannot ask for
  // a fourth and get one.
  return { rows: rows.slice(0, EDITORIAL_MAX_ROWS), baseFontSize: base };
}

/**
 * The size the big word actually renders at.
 *
 * Stepped down by the same factor the rest of the layout uses, so the choice is
 * reproducible rather than solved analytically and rounded differently on two
 * platforms.
 */
function fitEmphasis(
  text: string,
  base: number,
  style: StyleProps,
  available: number,
  measure: MeasureText,
  face: FaceSpec
): number {
  const floor = base * style.emphasis.minScale;
  let size = base * style.emphasis.scale;

  for (let pass = 0; pass < MAX_SHRINK_PASSES * 2; pass += 1) {
    if (measure(text, size, face).width <= available) return size;
    if (size <= floor) break;
    size = Math.max(floor, size * SHRINK_STEP);
  }

  if (measure(text, size, face).width <= available) return size;
  return base * style.emphasis.fallbackScale;
}

function wrapRows(
  words: Word[],
  emphasisIndex: number,
  style: StyleProps,
  base: number,
  available: number,
  measure: MeasureText,
  baseFace: FaceSpec,
  emphasisFace: FaceSpec
): Row[] {
  const items = words.map((word, index) =>
    makeItem(word, index, index === emphasisIndex, style, base, measure, baseFace, emphasisFace)
  );
  const gap = boxGapFor(style, items);

  const rows: RowItem[][] = [];
  let current: RowItem[] = [];
  let width = 0;

  for (const item of items) {
    const space = measure(' ', item.fontSize, item.face).width + gap;
    const added = current.length === 0 ? item.width : width + space + item.width;

    if (current.length > 0 && added > available) {
      rows.push(current);
      current = [item];
      width = item.width;
      continue;
    }

    current.push(item);
    width = added;
  }
  if (current.length > 0) rows.push(current);

  return rows.map((row) => finishRow(row, measure, gap));
}

function buildRow(
  words: Word[],
  offset: number,
  style: StyleProps,
  base: number,
  measure: MeasureText,
  baseFace: FaceSpec,
  emphasisFace: FaceSpec,
  emphasisIndex: number,
  emphasisSize?: number
): Row {
  const items = words.map((word, index) => {
    const absolute = offset + index;
    const emphasised = absolute === emphasisIndex;
    const forced = emphasised ? emphasisSize : undefined;
    return makeItem(word, absolute, emphasised, style, base, measure, baseFace, emphasisFace, forced);
  });

  return finishRow(items, measure, boxGapFor(style, items));
}

/**
 * Extra space between every word in box mode, so the box behind the word being
 * spoken cannot reach its neighbour's first letter.
 *
 * The box is padded past its own word, and a space is narrower than that
 * padding, so without this the highlight sits on the letter next to it. The gap
 * goes between every pair of words rather than around the active one, because a
 * gap that appeared only where the highlight is would shove the rest of the line
 * sideways on every word. Uniform and slightly airy beats correct and jumping.
 *
 * Sized from the largest word on the line, since that is the largest box.
 */
function boxGapFor(style: StyleProps, items: RowItem[]): number {
  if (style.highlightMode !== 'box' || items.length === 0) return 0;
  const largest = items.reduce((most, item) => Math.max(most, item.fontSize), 0);
  return largest * BOX_PAD.x * 2;
}

function makeItem(
  word: Word,
  index: number,
  emphasised: boolean,
  style: StyleProps,
  base: number,
  measure: MeasureText,
  baseFace: FaceSpec,
  emphasisFace: FaceSpec,
  forcedSize?: number
): RowItem {
  const face = emphasised ? emphasisFace : baseFace;
  const fontSize = forcedSize ?? (emphasised ? base * style.emphasis.scale : base);
  const text = display(word, style);
  return { index, text, width: measure(text, fontSize, face).width, fontSize, face, emphasised };
}

/** A row's height, baseline and gaps come from the largest thing on it. */
function finishRow(items: RowItem[], measure: MeasureText, gap = 0): Row {
  const tallest = items.reduce(
    (largest, item) => (item.fontSize > largest.fontSize ? item : largest),
    items[0]
  );
  const metrics = measure(' ', tallest.fontSize, tallest.face);
  const spaceWidth = measure(' ', items[0].fontSize, items[0].face).width + gap;
  const width =
    items.reduce((total, item) => total + item.width, 0) + spaceWidth * (items.length - 1);

  return {
    items,
    width,
    height: tallest.fontSize * LINE_HEIGHT_RATIO,
    ascent: metrics.ascent,
    descent: metrics.descent,
    spaceWidth,
  };
}

function rowWidth(
  words: Word[],
  style: StyleProps,
  base: number,
  measure: MeasureText,
  face: FaceSpec
): number {
  if (words.length === 0) return 0;
  // The same gap the rows will be built with, or the shrink decision would be
  // made against a narrower line than the one that gets drawn.
  const space =
    measure(' ', base, face).width + (style.highlightMode === 'box' ? base * BOX_PAD.x * 2 : 0);
  return (
    words.reduce((total, word) => total + measure(display(word, style), base, face).width, 0) +
    space * (words.length - 1)
  );
}

function display(word: Word, style: StyleProps): string {
  return style.uppercase ? word.text.toUpperCase() : word.text;
}

function blockTopFor(position: CaptionPosition, canvas: Canvas, blockHeight: number): number {
  if (position === 'top') return canvas.height * CAPTION_INSET.top;
  if (position === 'upperMiddle') return canvas.height * CAPTION_INSET.upperMiddle;
  if (position === 'middle') return (canvas.height - blockHeight) / 2;
  return canvas.height * (1 - CAPTION_INSET.bottom) - blockHeight;
}

function stateOf(word: Word, activeWord: Word | null, captionTime: Ms): WordState {
  if (activeWord && word.id === activeWord.id) return 'active';
  return captionTime >= word.end ? 'past' : 'future';
}

function fillOf(word: Word, state: WordState, captionTime: Ms, style: StyleProps): number {
  if (style.highlightMode !== 'karaoke') return state === 'past' ? 1 : 0;
  if (state === 'past') return 1;
  if (state === 'future') return 0;
  const duration = Math.max(1, word.end - word.start);
  return clamp01((captionTime - word.start) / duration);
}

function colorOf(style: StyleProps, emphasised: boolean, boxed: boolean): string {
  // Sitting on the box, the word takes the box's own text colour whatever else
  // it is, because an accent word on an accent box would be unreadable.
  if (boxed) return style.highlightColor;
  if (emphasised) return style.emphasis.color;
  return style.textColor;
}

function fillColorOf(style: StyleProps, emphasised: boolean, boxed: boolean): string {
  if (style.highlightMode !== 'karaoke') return colorOf(style, emphasised, boxed);
  return emphasised ? style.emphasis.color : style.spokenColor;
}

/**
 * How a word arrives: where it is, how big and how solid, at this instant.
 *
 * Every channel is computed here rather than left to an animation driver, for
 * the same reason the rise always was: a spring running in the preview that the
 * exporter does not run is exactly how an app ends up with a preview that does
 * not match the file (invariant 2).
 *
 * Scale has two owners and they do not mix. An emphasised word uses the
 * preset's own `riseFrom` over `riseMs`, because how a big word arrives is part
 * of what a preset says about big words; everything else uses the line's
 * `entrance`. Slide and fade come from `entrance` for every word including the
 * emphasised one, so a line and its big word land together.
 */
function entranceOf(
  word: Word,
  item: RowItem,
  captionTime: Ms,
  style: StyleProps,
  reducedMotion: boolean
): { scale: number; dy: number; opacity: number } {
  const scale = item.emphasised
    ? riseOf(word, true, captionTime, style, reducedMotion)
    : scaleIn(word, captionTime, style, reducedMotion);

  const { dyRatio, opacityFrom, ms } = style.entrance;
  if (reducedMotion || ms <= 0 || (dyRatio === 0 && opacityFrom === 1)) {
    return { scale, dy: 0, opacity: 1 };
  }

  const remaining = 1 - easeOutCubic(clamp01((captionTime - word.start) / ms));
  return {
    scale,
    dy: item.fontSize * dyRatio * remaining,
    opacity: 1 - (1 - opacityFrom) * remaining,
  };
}

function scaleIn(word: Word, captionTime: Ms, style: StyleProps, reducedMotion: boolean): number {
  const { scaleFrom, ms } = style.entrance;
  if (scaleFrom === 1 || ms <= 0 || reducedMotion) return 1;
  const progress = clamp01((captionTime - word.start) / ms);
  return scaleFrom + (1 - scaleFrom) * easeOutCubic(progress);
}

/**
 * Which shadow a word casts: the big word's own, where the preset gave it one,
 * and otherwise the line's.
 *
 * A glow belongs to the word it picks out. Under the rest of the sentence the
 * same glow is a smear.
 */
function shadowSpecFor(style: StyleProps, emphasised: boolean): ShadowStyle {
  return (emphasised && style.emphasis.shadow) || style.shadow;
}

/**
 * A shadow in pixels, or nothing at all.
 *
 * Nothing when it would put no pixels down — a transparent colour, or no blur
 * and no offset — so a preset that does not want one costs the renderers no
 * branch and the export's plan no bytes.
 */
function shadowOf(spec: ShadowStyle, fontSize: number, ownColor: string): ShadowDraw | undefined {
  const color = spec.color === OWN_COLOR ? ownColor : spec.color;
  if (!isPaintable(color)) return undefined;
  if (spec.blurRatio === 0 && spec.dxRatio === 0 && spec.dyRatio === 0) return undefined;

  return {
    color,
    blur: fontSize * spec.blurRatio,
    dx: fontSize * spec.dxRatio,
    dy: fontSize * spec.dyRatio,
  };
}

/**
 * The emphasised word's rise.
 *
 * Kept separate from the line's entrance because it predates it and because the
 * two say different things: this one is the preset's opinion about big words.
 */
function riseOf(
  word: Word,
  emphasised: boolean,
  captionTime: Ms,
  style: StyleProps,
  reducedMotion: boolean
): number {
  const { riseFrom, riseMs } = style.emphasis;
  if (!emphasised || riseFrom === 1 || riseMs <= 0 || reducedMotion) return 1;
  const progress = clamp01((captionTime - word.start) / riseMs);
  return riseFrom + (1 - riseFrom) * easeOutCubic(progress);
}

function boxFor(
  x: number,
  rowTop: number,
  width: number,
  rowHeight: number,
  fontSize: number,
  style: StyleProps
): CaptionBoxDraw {
  const padX = fontSize * BOX_PAD.x;
  const padY = fontSize * BOX_PAD.y;
  return {
    x: x - padX,
    y: rowTop - padY,
    width: width + padX * 2,
    height: rowHeight + padY * 2,
    radius: fontSize * BOX_RADIUS_RATIO,
    color: style.boxColor,
    shadow: shadowOf(style.boxShadow, fontSize, style.boxColor),
    layer: 'front',
  };
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
