import { measureMono } from '../__fixtures__/project';
import type { Canvas } from '../layout';
import {
  CAPTION_BAND,
  EDITORIAL_MAX_ROWS,
  LINE_HEIGHT_RATIO,
  safeZoneUnion,
  TEXT_SIZE_RATIO,
} from '../style';
import {
  layoutWatermark,
  watermarkBounds,
  WATERMARK_BRAND,
  WATERMARK_CREDIT,
} from '../watermark';

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
    big.lines.forEach((line, index) => {
      const same = small.lines[index];
      expect(line.fontSize / same.fontSize).toBeCloseTo(4);
      expect(line.x / same.x).toBeCloseTo(4);
      expect(line.baseline / same.baseline).toBeCloseTo(4);
      expect(line.shadow.blur / same.shadow.blur).toBeCloseTo(4);
    });

    big.pills.forEach((pill, index) => {
      const same = small.pills[index];
      expect(pill.x / same.x).toBeCloseTo(4);
      expect(pill.y / same.y).toBeCloseTo(4);
      expect(pill.width / same.width).toBeCloseTo(4);
      expect(pill.height / same.height).toBeCloseTo(4);
    });
  });

  it('carries a shadow on every piece, because it has to read on a white wall too', () => {
    const mark = layoutWatermark(exported, measureMono);

    for (const line of mark.lines) expect(line.shadow.blur).toBeGreaterThan(0);
    for (const pill of mark.pills) expect(pill.shadow?.blur ?? 0).toBeGreaterThan(0);
  });
});

describe('what it says', () => {
  const mark = layoutWatermark(exported, measureMono);

  it('credits the job above the brand, in that order', () => {
    expect(mark.lines.map((line) => line.text)).toEqual([WATERMARK_CREDIT, WATERMARK_BRAND]);
    expect(mark.lines[0].baseline).toBeLessThan(mark.lines[1].baseline);
  });

  it('stacks the two lines on one left edge', () => {
    expect(mark.lines[0].x).toBe(mark.lines[1].x);
  });

  it('makes the brand the louder half', () => {
    expect(mark.lines[1].fontSize).toBeGreaterThan(mark.lines[0].fontSize);
  });

  it('draws the icon above the words and on their left edge', () => {
    const capLine = mark.lines[0].baseline - measureMono(
      mark.lines[0].text,
      mark.lines[0].fontSize,
      mark.lines[0].face
    ).ascent;

    for (const pill of mark.pills) {
      // Clear of the type, not merely ordered before it: a pill overlapping the
      // credit's cap line is a logo sitting on the words.
      expect(pill.y + pill.height).toBeLessThan(capLine);
      expect(pill.x).toBeGreaterThanOrEqual(mark.lines[0].x);
    }
    // The widest pill starts where the words start. Three tiers, one edge.
    expect(Math.min(...mark.pills.map((pill) => pill.x))).toBe(mark.lines[0].x);
  });

  it('picks one pill out in the accent, as the icon does', () => {
    const accented = mark.pills.filter((pill) => pill.color !== mark.pills[0].color);
    expect(accented).toHaveLength(1);
    // And it is the middle one: the icon is a caption line with the word the
    // speaker leaned on picked out, not a bar chart.
    expect(accented[0].width).toBe(Math.max(...mark.pills.map((pill) => pill.width)));
  });
});

describe('where it sits', () => {
  const mark = layoutWatermark(exported, measureMono);
  const box = watermarkBounds(mark, measureMono);
  const safe = safeZoneUnion();

  const top = box.y / exported.height;
  const bottom = (box.y + box.height) / exported.height;
  const left = box.x / exported.width;
  const right = (box.x + box.width) / exported.width;

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

  it('clears the highest caption a tap can produce', () => {
    // `StylePicker` offers Upper, Middle and Lower as chips, and Upper is the
    // topmost of them. A mark that reached into that band would be sitting on
    // the captions in every preset written to sit there. Stacking cost the badge height,
    // so this is the assertion that keeps the stack from growing into them.
    //
    // The band is a centre, so the block reaches up from it by half its own
    // height, and the tallest one any preset can make is Editorial's three rows
    // at size L. The slider and the drag go higher still — deliberately, and
    // the mark is drawn on the preview so that putting a caption under it is a
    // thing the user can see themselves doing.
    const tallestBlock = TEXT_SIZE_RATIO.L * LINE_HEIGHT_RATIO * EDITORIAL_MAX_ROWS;
    expect(bottom).toBeLessThan(CAPTION_BAND.upper - tallestBlock / 2);
  });

  it('is a credit and not a caption', () => {
    // An icon and two lines is more mark than one line was, so what keeps it
    // quiet is the type size and the footprint together. A third of the frame is
    // the ceiling; well under the smallest caption is the point. With the icon
    // over the words rather than beside them the badge is as wide as its longest
    // line, which is 0.143 — this number is the ceiling, not the target.
    expect(right - left).toBeLessThan(0.33);
    for (const line of mark.lines) {
      // Half, where the single line was held to 0.4. Stacking spends width on
      // height, and the brand carries the badge on its own now rather than
      // sharing a line with the credit — it lands at 0.43 of the smallest
      // caption the style sheet can set, which is subordinate by a wide margin
      // and still legible at 1:1. Anything approaching that caption is a second
      // caption, which is what this number exists to refuse.
      expect(line.fontSize).toBeLessThan(exported.height * TEXT_SIZE_RATIO.S * 0.5);
    }
  });
});
