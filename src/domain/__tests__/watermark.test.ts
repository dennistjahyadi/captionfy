import { measureMono } from '../__fixtures__/project';
import type { Canvas } from '../layout';
import { CAPTION_INSET, safeZoneUnion, TEXT_SIZE_RATIO } from '../style';
import { layoutWatermark, WATERMARK_TEXT } from '../watermark';

const preview: Canvas = { width: 270, height: 480 };
const exported: Canvas = { width: 1080, height: 1920 };

describe('invariant 2: the mark is the same picture at both sizes', () => {
  it('is one pure function of the canvas, so it repeats exactly', () => {
    expect(layoutWatermark(exported, measureMono)).toEqual(
      layoutWatermark(exported, measureMono)
    );
  });

  it('scales with the canvas rather than assuming one', () => {
    const big = layoutWatermark(exported, measureMono);
    const small = layoutWatermark(preview, measureMono);

    // Four times the canvas, four times every number. This is the whole of why
    // the preview and the burn-in agree without either knowing about the other.
    expect(big.fontSize / small.fontSize).toBeCloseTo(4);
    expect(big.x / small.x).toBeCloseTo(4);
    expect(big.baseline / small.baseline).toBeCloseTo(4);
    expect(big.shadow.blur / small.shadow.blur).toBeCloseTo(4);
  });

  it('carries a shadow, because it has to read on a white wall too', () => {
    expect(layoutWatermark(exported, measureMono).shadow.blur).toBeGreaterThan(0);
  });
});

describe('where it sits', () => {
  const mark = layoutWatermark(exported, measureMono);
  const metrics = measureMono(WATERMARK_TEXT, mark.fontSize, mark.face);
  const safe = safeZoneUnion();

  const top = (mark.baseline - metrics.ascent) / exported.height;
  const bottom = (mark.baseline + metrics.descent) / exported.height;
  const left = mark.x / exported.width;
  const right = (mark.x + metrics.width) / exported.width;

  it('is inside the zone every platform leaves uncovered', () => {
    expect(top).toBeGreaterThanOrEqual(safe.top);
    expect(bottom).toBeLessThanOrEqual(1 - safe.bottom);
    expect(left).toBeGreaterThanOrEqual(safe.left);
    expect(right).toBeLessThanOrEqual(1 - safe.right);
  });

  it('is pinned to the safe zone corner, not floating inside it', () => {
    // The first version sat 0.025 of the height and 0.02 of the width in from
    // the safe zone, which is near enough the corner to be reaching for it and
    // far enough to miss — it read as a label dropped into the frame rather
    // than a mark on it. A corner bug clears its margin by a hair and no more.
    expect(top - safe.top).toBeLessThanOrEqual(0.02);
    expect(left - safe.left).toBeLessThanOrEqual(0.02);
    // And a hair is not nothing: a platform a point more aggressive than the
    // union still has to miss it.
    expect(top - safe.top).toBeGreaterThan(0);
    expect(left - safe.left).toBeGreaterThan(0);
  });

  it('clears the highest caption the style sheet can produce', () => {
    // `StylePicker` offers upperMiddle, middle and lowerThird; upperMiddle is the
    // topmost of them. A mark that reached into that band would be sitting on the
    // captions in four of the nine presets.
    expect(bottom).toBeLessThan(CAPTION_INSET.upperMiddle);
  });

  it('is a credit and not a caption', () => {
    // Naming the job costs width — it is a line rather than a word now — so what
    // keeps it quiet is the type size, not the footprint. A third of the frame
    // is the ceiling; below the smallest caption is the point.
    expect(right - left).toBeLessThan(0.33);
    expect(mark.fontSize).toBeLessThan(exported.height * TEXT_SIZE_RATIO.S * 0.4);
  });
});
