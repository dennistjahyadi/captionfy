/**
 * The draw list for a whole video, in the shape the burn-in module reads.
 *
 * This is the bridge invariant 2 crosses. The captions in the exported file are
 * laid out here, in JavaScript, by the same `layoutCaptionFrame` and the same
 * Skia measurer the preview uses — only at the export's own pixel size. The
 * native side receives positions, sizes, colours and a baseline per word and
 * decides nothing at all; it rasterises with `android.graphics`, which is the
 * same Skia underneath, and muxes the result.
 *
 * A word names a face by key; the burn-in module carries those same five font
 * files in its own assets, taken by the build from the app's `assets/fonts`
 * directory, so there is one copy of each face in the repository and no way for
 * the two sides to disagree about what a word is set in.
 *
 * Entries are emitted only where the draw list changes. A box-highlight caption
 * holds still for a whole word, so a thirty second clip that would be nine
 * hundred identical frames becomes a few dozen entries, and the encoder can
 * reuse the overlay it already uploaded. Karaoke fills change every frame and
 * get an entry every frame, which is the honest cost of that preset.
 */
import {
  type CaptionBoxDraw,
  type CaptionWordDraw,
  type Canvas,
  type MeasureText,
  type Ms,
  type Project,
  type ShadowDraw,
} from '../domain';
import { faceKey } from './faces';
import { createFrameSource } from './frame';

/** Rounded to a hundredth of a pixel: below that nothing is visible and JSON grows. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A drop shadow. `blur` is a Gaussian sigma; the module converts it to a radius. */
export interface BurnShadow {
  color: string;
  blur: number;
  dx: number;
  dy: number;
}

export interface BurnBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
  shadow?: BurnShadow;
}

/** One word, ready to draw. Every number is in export pixels. */
export interface BurnWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  size: number;
  /** A key from `FACE_KEYS`, which the plan's `faces` map resolves to a file. */
  face: string;
  color: string;
  fillColor: string;
  /** 0..1 of the word's width already spoken. Karaoke clips to this. */
  fill: number;
  opacity: number;
  /** Uniform scale about the centre of the word's box. */
  scale: number;
  outlineColor: string;
  outlineWidth: number;
  shadow?: BurnShadow;
  box?: BurnBox;
}

/** A draw list, and the time from which it applies. */
export interface BurnEntry {
  tMs: Ms;
  /** The card under the whole block, where the style asked for one. */
  plate?: BurnBox;
  words: BurnWord[];
}

export interface BurnPlan {
  width: number;
  height: number;
  fps: number;
  durationMs: Ms;
  entries: BurnEntry[];
}

export interface BurnPlanOptions {
  width: number;
  height: number;
  fps: number;
  durationMs: Ms;
  /** The export must pass what the preview used, or the rise animates twice. */
  reducedMotion: boolean;
}

export function buildBurnPlan(
  project: Project,
  opts: BurnPlanOptions,
  measure: MeasureText
): BurnPlan {
  const source = createFrameSource(project);
  const canvas: Canvas = { width: opts.width, height: opts.height };
  const frames = Math.max(1, Math.ceil((opts.durationMs * opts.fps) / 1000));

  const entries: BurnEntry[] = [];
  let previous: string | null = null;

  for (let index = 0; index < frames; index += 1) {
    const tMs = Math.round((index * 1000) / opts.fps);
    const frame = source.frameAt(tMs, canvas, measure, { reducedMotion: opts.reducedMotion });
    const entry: Omit<BurnEntry, 'tMs'> = {
      ...(frame.plate ? { plate: toBurnBox(frame.plate) } : {}),
      words: frame.words.map(toBurnWord),
    };

    // Compared as text because that is exactly the question: would the native
    // side draw anything different from what it is already showing?
    const shape = JSON.stringify(entry);
    if (shape === previous) continue;

    previous = shape;
    entries.push({ tMs, ...entry });
  }

  return {
    width: opts.width,
    height: opts.height,
    fps: opts.fps,
    durationMs: opts.durationMs,
    entries,
  };
}

function toBurnWord(word: CaptionWordDraw): BurnWord {
  return {
    text: word.text,
    x: round2(word.x),
    y: round2(word.y),
    width: round2(word.width),
    height: round2(word.height),
    baseline: round2(word.baseline),
    size: round2(word.fontSize),
    face: faceKey(word.face),
    color: word.color,
    fillColor: word.fillColor,
    fill: Math.round(word.fill * 10_000) / 10_000,
    opacity: Math.round(word.opacity * 1000) / 1000,
    scale: Math.round(word.scale * 1000) / 1000,
    outlineColor: word.outline.color,
    outlineWidth: round2(word.outline.width),
    ...(word.shadow ? { shadow: toBurnShadow(word.shadow) } : {}),
    ...(word.box ? { box: toBurnBox(word.box) } : {}),
  };
}

function toBurnBox(box: CaptionBoxDraw): BurnBox {
  return {
    x: round2(box.x),
    y: round2(box.y),
    width: round2(box.width),
    height: round2(box.height),
    radius: round2(box.radius),
    color: box.color,
    ...(box.shadow ? { shadow: toBurnShadow(box.shadow) } : {}),
  };
}

function toBurnShadow(shadow: ShadowDraw): BurnShadow {
  return {
    color: shadow.color,
    blur: round2(shadow.blur),
    dx: round2(shadow.dx),
    dy: round2(shadow.dy),
  };
}

/**
 * The export's pixel size: the source, upright, capped on its short edge.
 *
 * The short edge, because "1080p" on a vertical video means 1080 across and
 * 1920 down, which is what the Export screen is about to print. The layout is a
 * set of fractions of the canvas, so a caption is the same fraction of the frame
 * at any size; capping changes the file, never the design. Even numbers because
 * every H.264 encoder wants them and some refuse outright.
 */
export function exportSize(
  sourceWidth: number,
  sourceHeight: number,
  cap: number
): { width: number; height: number } {
  const shortest = Math.min(sourceWidth, sourceHeight);
  const scale = shortest > cap ? cap / shortest : 1;

  return {
    width: even(sourceWidth * scale),
    height: even(sourceHeight * scale),
  };
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
