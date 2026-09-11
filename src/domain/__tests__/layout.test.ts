import { measureMono, project, word } from '../__fixtures__/project';
import { layoutCaptionFrame, POP_RISE_MS, type Canvas } from '../layout';
import { CAPTION_INSET, resolveStyle, TEXT_SIZE_RATIO, type StyleProps } from '../style';

const canvas: Canvas = { width: 1080, height: 1920 };

const words = [
  word({ id: 'w1', text: 'so', start: 0, end: 400, conf: 0.1 }),
  word({ id: 'w2', text: 'today', start: 400, end: 1000 }),
  word({ id: 'w3', text: 'I', start: 1000, end: 1200 }),
];

const style = (overrides: Partial<StyleProps> = {}) => resolveStyle('box', overrides);

const frameAt = (tMs: number, overrides: Partial<StyleProps> = {}, p = project({ words })) =>
  layoutCaptionFrame(p, style(overrides), tMs, canvas, measureMono);

describe('invariant 2: one deterministic layout', () => {
  it('gives the identical draw list for the identical input', () => {
    expect(frameAt(500)).toEqual(frameAt(500));
  });

  it('scales with the canvas rather than assuming one', () => {
    const big = layoutCaptionFrame(project({ words }), style(), 500, canvas, measureMono);
    const small = layoutCaptionFrame(
      project({ words }),
      style(),
      500,
      { width: 270, height: 480 },
      measureMono
    );
    expect(big.fontSize / small.fontSize).toBeCloseTo(4);
    expect(big.words[0].x / small.words[0].x).toBeCloseTo(4);
  });

  it('sizes the type from the canvas height', () => {
    expect(frameAt(500).fontSize).toBe(1920 * TEXT_SIZE_RATIO.M);
  });
});

describe('invariant 6: confidence never reaches the video', () => {
  it('says nothing about a low-confidence word', () => {
    const drawn = frameAt(200).words[0];
    expect(drawn.wordId).toBe('w1');
    expect(JSON.stringify(drawn)).not.toMatch(/conf|lowConfidence|flag/i);
  });
});

describe('what is on screen', () => {
  it('draws the whole line, not just the active word', () => {
    expect(frameAt(500).words.map((w) => w.text)).toEqual(['so', 'today', 'I']);
  });

  it('marks past, active and future', () => {
    expect(frameAt(500).words.map((w) => w.state)).toEqual(['past', 'active', 'future']);
  });

  it('draws nothing before the first word', () => {
    expect(frameAt(-1).words).toEqual([]);
  });

  it('applies the global offset', () => {
    const shifted = project({ words, globalOffsetMs: 300 });
    expect(frameAt(500, {}, shifted).words.map((w) => w.state)).toEqual([
      'active',
      'future',
      'future',
    ]);
  });

  it('uppercases when the preset asks for it', () => {
    expect(frameAt(500, { uppercase: true }).words[0].text).toBe('SO');
  });
});

describe('placement', () => {
  it('centres each row horizontally', () => {
    const frame = frameAt(500);
    const first = frame.words[0];
    const last = frame.words[frame.words.length - 1];
    expect(first.x + last.x + last.width).toBeCloseTo(canvas.width);
  });

  it('sits above the platform chrome in the lower third', () => {
    const frame = frameAt(500);
    const bottom = frame.words[0].y + frame.words[0].height;
    expect(bottom).toBeCloseTo(canvas.height * (1 - CAPTION_INSET.bottom));
  });

  it('sits under the top inset at the top', () => {
    expect(frameAt(500, { position: 'top' }).words[0].y).toBeCloseTo(
      canvas.height * CAPTION_INSET.top
    );
  });

  it('centres the block vertically in the middle', () => {
    const frame = frameAt(500, { position: 'middle' });
    const drawn = frame.words[0];
    expect(drawn.y + drawn.height / 2).toBeCloseTo(canvas.height / 2);
  });

  it('puts the baseline inside the row', () => {
    const drawn = frameAt(500).words[0];
    expect(drawn.baseline).toBeGreaterThan(drawn.y);
    expect(drawn.baseline).toBeLessThan(drawn.y + drawn.height);
  });
});

describe('wrapping', () => {
  const long = [
    word({ id: 'w1', text: 'extraordinarily', start: 0, end: 400 }),
    word({ id: 'w2', text: 'complicated', start: 400, end: 800 }),
    word({ id: 'w3', text: 'sentences', start: 800, end: 1200 }),
    word({ id: 'w4', text: 'everywhere', start: 1200, end: 1600 }),
  ];

  it('wraps onto a second row rather than running off the frame', () => {
    const frame = frameAt(500, { maxRows: 2 }, project({ words: long }));
    const rows = new Set(frame.words.map((w) => w.y));
    expect(rows.size).toBe(2);
  });

  it('keeps every word inside the horizontal inset', () => {
    const frame = frameAt(500, { maxRows: 2 }, project({ words: long }));
    const left = canvas.width * CAPTION_INSET.x;
    frame.words.forEach((w) => {
      expect(w.x).toBeGreaterThanOrEqual(left - 0.5);
      expect(w.x + w.width).toBeLessThanOrEqual(canvas.width - left + 0.5);
    });
  });

  const pair = project({ words: long.slice(0, 2) });

  it('shrinks the type to hold a line to one row', () => {
    const wrapped = frameAt(500, { maxRows: 2 }, pair);
    expect(new Set(wrapped.words.map((w) => w.y)).size).toBe(2);

    const frame = frameAt(500, { maxRows: 1 }, pair);
    expect(new Set(frame.words.map((w) => w.y)).size).toBe(1);
    expect(frame.fontSize).toBeLessThan(1920 * TEXT_SIZE_RATIO.M);
  });

  it('scales the outline with the type it shrank', () => {
    const frame = frameAt(500, { maxRows: 1 }, pair);
    expect(frame.outline.width).toBeCloseTo(frame.fontSize * style().outlineRatio);
  });

  it('stops shrinking at the readable floor rather than vanishing', () => {
    const frame = frameAt(500, { maxRows: 1 }, project({ words: long }));
    expect(frame.fontSize).toBeGreaterThan(1920 * 0.02);
  });
});

describe('highlight modes', () => {
  it('box: fills a rounded box behind the active word only', () => {
    const frame = frameAt(500, { highlightMode: 'box' });
    expect(frame.words.map((w) => w.box !== undefined)).toEqual([false, true, false]);
    const box = frame.words[1].box!;
    expect(box.x).toBeLessThan(frame.words[1].x);
    expect(box.width).toBeGreaterThan(frame.words[1].width);
  });

  it('karaoke: fills the active word as it is spoken', () => {
    const frame = frameAt(700, { highlightMode: 'karaoke' });
    expect(frame.words.map((w) => w.fill)).toEqual([1, 0.5, 0]);
  });

  it('karaoke: a word is fully filled the moment it ends', () => {
    expect(frameAt(1000, { highlightMode: 'karaoke' }).words[1].fill).toBe(1);
  });

  it('pop: eases the active word up to full size', () => {
    const rising = frameAt(400 + POP_RISE_MS / 2, { highlightMode: 'pop', popScale: 1.2 });
    const risen = frameAt(400 + POP_RISE_MS, { highlightMode: 'pop', popScale: 1.2 });
    expect(rising.words[1].scale).toBeGreaterThan(1);
    expect(rising.words[1].scale).toBeLessThan(1.2);
    expect(risen.words[1].scale).toBeCloseTo(1.2);
    expect(risen.words[0].scale).toBe(1);
  });

  it('clean: marks nothing', () => {
    const frame = frameAt(500, { highlightMode: 'none' });
    expect(frame.words.every((w) => w.scale === 1 && w.box === undefined)).toBe(true);
    expect(new Set(frame.words.map((w) => w.color)).size).toBe(1);
  });
});
