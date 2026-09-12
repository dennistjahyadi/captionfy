/**
 * The one text measurer.
 *
 * `layoutCaptionFrame` takes a measurer rather than owning one, because two
 * measurers would be two layouts (invariant 2). This builds the measurer the
 * preview uses, and the burn-in will build its own over the same typefaces at
 * export resolution.
 *
 * Nothing here imports Skia. It takes a lookup returning anything font-shaped,
 * so the measuring rules are unit tested without a GPU.
 */
import type { FaceSpec, MeasureText, TextMetrics } from '../domain';
import { faceKey } from './faces';

/** The part of a Skia font this file uses. */
export interface FontLike {
  getTextWidth(text: string): number;
  getMetrics(): { ascent: number; descent: number };
}

export type FontLookup = (key: string, size: number) => FontLike;

/**
 * How many measurements to keep before starting again.
 *
 * The preview measures the same handful of words at the same handful of sizes
 * sixty times a second, so the cache turns almost every frame after the first
 * into arithmetic. It is cleared rather than evicted one by one: an exact
 * replacement policy would cost more than the measurements it saves.
 */
const CACHE_LIMIT = 4096;

/**
 * A measurer over `lookup`, memoised by face, size and text.
 *
 * The cache changes performance and nothing else. Every entry is a pure function
 * of its key, so a cached frame and a freshly measured one are identical, and
 * the export can measure cold and still match the preview to the pixel.
 */
export function createMeasureText(lookup: FontLookup): MeasureText {
  const cache = new Map<string, TextMetrics>();

  return (text: string, fontSize: number, face: FaceSpec): TextMetrics => {
    const key = `${faceKey(face)}|${fontSize}|${text}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const font = lookup(faceKey(face), fontSize);
    const metrics = font.getMetrics();
    const measured: TextMetrics = {
      // Advance width, not the tight bounding box: a space has no ink and every
      // row in the layout is spaced by one.
      width: font.getTextWidth(text),
      // Skia reports ascent as a negative offset from the baseline. The domain
      // works in distances, so it is flipped once, here.
      ascent: Math.abs(metrics.ascent),
      descent: Math.abs(metrics.descent),
    };

    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, measured);
    return measured;
  };
}
