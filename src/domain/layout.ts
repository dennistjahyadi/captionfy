/**
 * The one caption layout.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Invariant 2: the Skia preview and the burn-in both draw this function's output
 * and nothing else. Wrapping, position, colour, fill progress and the pop ease
 * are all decided here, because every one of them is somewhere the preview and
 * the export could otherwise drift apart. If the native burn-in cannot consume a
 * draw list directly it renders overlay frames from this, but it never lays text
 * out itself.
 *
 * Nothing here reads confidence. Low confidence is a transcript mark and never
 * appears on the video (invariant 6).
 */
import { activeWordInLines, segmentLines, type CaptionLine } from './lines';
import { CAPTION_INSET, LINE_HEIGHT_RATIO, TEXT_SIZE_RATIO, type StyleProps } from './style';
import type { Ms, Project, Word } from './types';

export type Canvas = { width: number; height: number };

/**
 * What the renderer knows about a font that this module cannot work out.
 *
 * Injected rather than approximated because the preview and the export have to
 * agree to the pixel, and the only way to guarantee that is for both to hand in
 * the same measurer over the same font.
 */
export type TextMetrics = { width: number; ascent: number; descent: number };
export type MeasureText = (text: string, fontSize: number, fontFamily: string) => TextMetrics;

export type WordState = 'past' | 'active' | 'future';

export interface CaptionWordDraw {
  wordId: string;
  /** Exactly the glyphs to draw, uppercasing already applied. */
  text: string;
  /** Left edge of the word box, in canvas pixels. */
  x: number;
  /** Top edge of the word box. */
  y: number;
  width: number;
  height: number;
  /** Baseline to draw the text on, in canvas pixels. */
  baseline: number;
  state: WordState;
  /** 0..1 of the word's width that has been spoken. Karaoke fill clips to this. */
  fill: number;
  /** Draw colour of the unfilled part of the word. */
  color: string;
  /** Draw colour of the filled part. Equal to `color` outside karaoke mode. */
  fillColor: string;
  /** Uniform scale about the centre of the word box. 1 unless the word is popping. */
  scale: number;
  box?: { x: number; y: number; width: number; height: number; radius: number; color: string };
}

export interface CaptionFrame {
  tMs: Ms;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  outline: { color: string; width: number };
  words: CaptionWordDraw[];
}

/** How long the pop preset takes to reach full size. */
export const POP_RISE_MS = 120;
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
  measure: MeasureText
): CaptionFrame {
  const lines = segmentLines(project.words, { maxWordsPerLine: style.maxWordsPerLine });
  return layoutCaptionFrameFromLines(lines, project.globalOffsetMs, style, tMs, canvas, measure);
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
  measure: MeasureText
): CaptionFrame {
  const { line, word: activeWord } = activeWordInLines(lines, tMs, globalOffsetMs);
  const baseFontSize = canvas.height * TEXT_SIZE_RATIO[style.textSize];

  if (!line) {
    return {
      tMs,
      fontSize: baseFontSize,
      fontFamily: style.fontFamily,
      lineHeight: baseFontSize * LINE_HEIGHT_RATIO,
      outline: { color: style.outlineColor, width: baseFontSize * style.outlineRatio },
      words: EMPTY_WORDS,
    };
  }

  const texts = line.words.map((word) => (style.uppercase ? word.text.toUpperCase() : word.text));
  const available = canvas.width * (1 - 2 * CAPTION_INSET.x);
  const minFontSize = canvas.height * MIN_FONT_RATIO;

  // Shrink until the line fits the allowed number of rows. Deterministic, so the
  // preview and the export shrink by the same amount on the same line.
  let fontSize = baseFontSize;
  let plan = wrap(texts, fontSize, style.fontFamily, available, measure);
  for (let pass = 0; plan.rows.length > style.maxRows && fontSize > minFontSize && pass < MAX_SHRINK_PASSES; pass += 1) {
    fontSize = Math.max(minFontSize, fontSize * SHRINK_STEP);
    plan = wrap(texts, fontSize, style.fontFamily, available, measure);
  }

  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const blockHeight = plan.rows.length * lineHeight;
  const blockTop = blockTopFor(style, canvas, blockHeight);
  const captionTime = tMs - globalOffsetMs;

  const words: CaptionWordDraw[] = [];

  plan.rows.forEach((row, rowIndex) => {
    const rowTop = blockTop + rowIndex * lineHeight;
    // The row is centred in the canvas, not in the inset box, so a caption sits
    // under the middle of the frame whichever inset is in force.
    let x = (canvas.width - row.width) / 2;

    for (const item of row.items) {
      const word = line.words[item.index];
      const state = stateOf(word, activeWord, captionTime);
      const box =
        style.highlightMode === 'box' && state === 'active'
          ? boxFor(x, rowTop, item.width, lineHeight, fontSize, style.boxColor)
          : undefined;

      words.push({
        wordId: word.id,
        text: item.text,
        x,
        y: rowTop,
        width: item.width,
        height: lineHeight,
        // Centring the text box on the row leaves the same slack above the
        // ascent as below the descent, which is what keeps a one-word line and a
        // wrapped line sitting on the same optical centre.
        baseline: rowTop + (lineHeight - (plan.ascent + plan.descent)) / 2 + plan.ascent,
        state,
        fill: fillOf(word, state, captionTime, style),
        color: colorOf(state, style),
        fillColor: style.highlightMode === 'karaoke' ? style.spokenColor : colorOf(state, style),
        scale: scaleOf(state, captionTime, word, style),
        box,
      });

      x += item.width + plan.spaceWidth;
    }
  });

  return {
    tMs,
    fontSize,
    fontFamily: style.fontFamily,
    lineHeight,
    outline: { color: style.outlineColor, width: fontSize * style.outlineRatio },
    words,
  };
}

type RowItem = { index: number; text: string; width: number };
type Row = { items: RowItem[]; width: number };
type WrapPlan = { rows: Row[]; spaceWidth: number; ascent: number; descent: number };

/** Greedy wrap. One word never splits across rows; a word wider than the box gets its own row. */
function wrap(
  texts: string[],
  fontSize: number,
  fontFamily: string,
  available: number,
  measure: MeasureText
): WrapPlan {
  const space = measure(' ', fontSize, fontFamily);
  const rows: Row[] = [];
  let current: Row = { items: [], width: 0 };

  texts.forEach((text, index) => {
    const width = measure(text, fontSize, fontFamily).width;
    const added = current.items.length === 0 ? width : current.width + space.width + width;

    if (current.items.length > 0 && added > available) {
      rows.push(current);
      current = { items: [{ index, text, width }], width };
      return;
    }

    current.items.push({ index, text, width });
    current.width = added;
  });

  if (current.items.length > 0) rows.push(current);

  return { rows, spaceWidth: space.width, ascent: space.ascent, descent: space.descent };
}

function blockTopFor(style: StyleProps, canvas: Canvas, blockHeight: number): number {
  if (style.position === 'top') return canvas.height * CAPTION_INSET.top;
  if (style.position === 'middle') return (canvas.height - blockHeight) / 2;
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

function colorOf(state: WordState, style: StyleProps): string {
  if (state !== 'active') return style.textColor;
  return style.highlightMode === 'pop' || style.highlightMode === 'box'
    ? style.highlightColor
    : style.textColor;
}

/**
 * The pop ease, computed here rather than left to an animation driver.
 *
 * A spring in the preview that the exporter does not run is exactly how an app
 * ends up with a preview that does not match the file.
 */
function scaleOf(state: WordState, captionTime: Ms, word: Word, style: StyleProps): number {
  if (style.highlightMode !== 'pop' || state !== 'active' || style.popScale === 1) return 1;
  const progress = clamp01((captionTime - word.start) / POP_RISE_MS);
  return 1 + (style.popScale - 1) * easeOutCubic(progress);
}

function boxFor(
  x: number,
  rowTop: number,
  width: number,
  lineHeight: number,
  fontSize: number,
  color: string
): CaptionWordDraw['box'] {
  const padX = fontSize * BOX_PAD.x;
  const padY = fontSize * BOX_PAD.y;
  return {
    x: x - padX,
    y: rowTop - padY,
    width: width + padX * 2,
    height: lineHeight + padY * 2,
    radius: fontSize * BOX_RADIUS_RATIO,
    color,
  };
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
