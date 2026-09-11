import { measureMono, project, word } from '../__fixtures__/project';
import { layoutCaptionFrame, type Canvas, type CaptionFrame } from '../layout';
import { CAPTION_INSET, EDITORIAL_MAX_ROWS, resolveStyle, type StyleProps } from '../style';
import type { Project } from '../types';

const canvas: Canvas = { width: 1080, height: 1920 };
const style = (overrides: Partial<StyleProps> = {}) => resolveStyle('editorial', overrides);

const line = ['It', 'was', 'completely', 'free', 'forever'];

function clip(texts = line, emphasised = 'w4'): Project {
  return project({
    words: texts.map((text, index) =>
      word({ id: `w${index + 1}`, text, start: index * 400, end: index * 400 + 400 })
    ),
    autoEmphasis: [emphasised],
    styleId: 'editorial',
  });
}

const frameAt = (
  tMs: number,
  overrides: Partial<StyleProps> = {},
  p = clip(),
  reducedMotion = false
): CaptionFrame => layoutCaptionFrame(p, style(overrides), tMs, canvas, measureMono, { reducedMotion });

const rowTops = (frame: CaptionFrame) => [...new Set(frame.words.map((w) => w.y))];
const rowOf = (frame: CaptionFrame, y: number) => frame.words.filter((w) => w.y === y);

describe('the pull-quote shape', () => {
  const frame = frameAt(1500);

  it('stacks what came before, the big word, and what comes after', () => {
    const tops = rowTops(frame);
    expect(tops).toHaveLength(3);
    expect(rowOf(frame, tops[0]).map((w) => w.text)).toEqual(['It', 'was', 'completely']);
    expect(rowOf(frame, tops[1]).map((w) => w.text)).toEqual(['free']);
    expect(rowOf(frame, tops[2]).map((w) => w.text)).toEqual(['forever']);
  });

  it('gives the big word the display face and the accent colour', () => {
    const big = frame.words.find((w) => w.emphasised)!;
    expect(big.face).toEqual({ family: 'Spectral', weight: 'extrabold', italic: true });
    expect(big.color).toBe(style().emphasis.color);
    expect(big.fontSize).toBeCloseTo(frame.fontSize * style().emphasis.scale);
  });

  it('leaves the words around it at base size in the sans', () => {
    frame.words
      .filter((w) => !w.emphasised)
      .forEach((w) => {
        expect(w.fontSize).toBe(frame.fontSize);
        expect(w.face).toEqual({ family: 'Be Vietnam Pro', weight: 'medium', italic: false });
      });
  });

  it('skips a row that has no words in it', () => {
    expect(rowTops(frameAt(200, {}, clip(['free', 'forever'], 'w1')))).toHaveLength(2);
    expect(rowTops(frameAt(200, {}, clip(['free'], 'w1')))).toHaveLength(1);
  });

  it('renders base rows when the unit has no emphasised word', () => {
    const plain = frameAt(1500, {}, project({ words: clip().words, styleId: 'editorial' }));
    expect(plain.words.every((w) => w.fontSize === plain.fontSize)).toBe(true);
    expect(plain.words.every((w) => !w.emphasised)).toBe(true);
  });

  it('never draws a fourth row, whatever the max-rows property says', () => {
    const wide = clip(['extraordinarily', 'complicated', 'free', 'everywhere', 'always']);
    expect(rowTops(frameAt(1500, { maxRows: 6 }, clip(line, 'w4')))).toHaveLength(EDITORIAL_MAX_ROWS);
    expect(rowTops(frameAt(1000, { maxRows: 6 }, wide)).length).toBeLessThanOrEqual(
      EDITORIAL_MAX_ROWS
    );
  });
});

describe('auto-fitting the big word', () => {
  const available = canvas.width * (1 - CAPTION_INSET.x - CAPTION_INSET.railRight);
  const big = (frame: CaptionFrame) => frame.words.find((w) => w.emphasised)!;

  it('renders at full size when it fits', () => {
    const frame = frameAt(1500);
    expect(big(frame).fontSize).toBeCloseTo(frame.fontSize * 2.6);
    expect(big(frame).width).toBeLessThanOrEqual(available);
  });

  it('shrinks a long word to the width it has', () => {
    const frame = frameAt(400, {}, clip(['Our', 'unbelievable', 'offer'], 'w2'));
    const drawn = big(frame);
    expect(drawn.width).toBeLessThanOrEqual(available);
    expect(drawn.fontSize).toBeLessThan(frame.fontSize * 2.6);
    expect(drawn.fontSize).toBeGreaterThanOrEqual(frame.fontSize * style().emphasis.minScale);
  });

  it('gives up the size and keeps the colour when a word will not fit at the floor', () => {
    const frame = frameAt(400, {}, clip(['Our', 'internationally', 'known'], 'w2'));
    const drawn = big(frame);
    expect(drawn.fontSize).toBeCloseTo(frame.fontSize * style().emphasis.fallbackScale);
    expect(drawn.fontSize).toBeLessThan(frame.fontSize * style().emphasis.minScale);
    expect(drawn.color).toBe(style().emphasis.color);
    expect(drawn.emphasised).toBe(true);
  });
});

describe('placement', () => {
  it('starts every row at the left margin', () => {
    const frame = frameAt(1500);
    rowTops(frame).forEach((top) => {
      expect(rowOf(frame, top)[0].x).toBeCloseTo(canvas.width * CAPTION_INSET.x);
    });
  });

  it('keeps the block clear of the action rail', () => {
    const frame = frameAt(1500);
    frame.words.forEach((w) => {
      expect(w.x + w.width).toBeLessThanOrEqual(canvas.width * (1 - CAPTION_INSET.railRight) + 0.5);
    });
  });

  it('sits in the upper middle, below the top chrome', () => {
    const frame = frameAt(1500);
    expect(rowTops(frame)[0]).toBeCloseTo(canvas.height * CAPTION_INSET.upperMiddle);
    expect(rowTops(frame)[0]).toBeGreaterThan(canvas.height * CAPTION_INSET.top);
  });

  it('centres instead when the style asks for it', () => {
    const frame = frameAt(1500, { align: 'center' });
    const row = rowOf(frame, rowTops(frame)[1]);
    const last = row[row.length - 1];
    expect(row[0].x + last.x + last.width).toBeCloseTo(canvas.width);
  });
});

describe('karaoke behaviour', () => {
  it('dims what is still to come and leaves what has been said solid', () => {
    const frame = frameAt(900);
    expect(frame.words.map((w) => w.opacity)).toEqual([1, 1, 1, 0.45, 0.45]);
  });

  it('does not colour-fill, which would fight the display word', () => {
    expect(frameAt(900).words.every((w) => w.fill === 0 || w.fill === 1)).toBe(true);
  });

  it('rises the big word from 0.85 over 120 ms from its own start', () => {
    const before = frameAt(1000);
    const half = frameAt(1200 + 60);
    const risen = frameAt(1200 + 120);
    const emphasised = (frame: CaptionFrame) => frame.words.find((w) => w.emphasised)!.scale;

    expect(emphasised(before)).toBeCloseTo(0.85);
    expect(emphasised(half)).toBeGreaterThan(0.85);
    expect(emphasised(half)).toBeLessThan(1);
    expect(emphasised(risen)).toBeCloseTo(1);
  });

  it('skips the rise under reduced motion', () => {
    const frame = frameAt(1000, {}, clip(), true);
    expect(frame.words.every((w) => w.scale === 1)).toBe(true);
  });

  it('leaves the words around it unscaled', () => {
    expect(frameAt(1000).words.filter((w) => !w.emphasised).every((w) => w.scale === 1)).toBe(true);
  });
});

describe('the draw list', () => {
  it('marks every element for the front layer', () => {
    const frame = frameAt(1500);
    expect(frame.words.every((w) => w.layer === 'front')).toBe(true);
    frame.words.forEach((w) => {
      if (w.box) expect(w.box.layer).toBe('front');
    });
  });

  it('is identical for identical input', () => {
    expect(frameAt(1500)).toEqual(frameAt(1500));
  });
});
