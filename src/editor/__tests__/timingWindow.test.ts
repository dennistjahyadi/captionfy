import { word } from '../../domain/__fixtures__/project';
import {
  msPerPixel,
  TIMING_WINDOW_PAD_MS,
  timingWindow,
  wordsInWindow,
  xForMs,
} from '../timingWindow';

const anchor = { start: 12_400, end: 13_050 };
const window = timingWindow(anchor);
const WIDTH = 360;

describe('timingWindow', () => {
  it('shows a second either side of the word', () => {
    expect(window).toEqual({
      fromMs: anchor.start - TIMING_WINDOW_PAD_MS,
      toMs: anchor.end + TIMING_WINDOW_PAD_MS,
    });
  });

  it('never starts before the clip does', () => {
    expect(timingWindow({ start: 120, end: 600 }).fromMs).toBe(0);
  });
});

describe('xForMs', () => {
  it('puts the window edges on the strip edges', () => {
    expect(xForMs(window.fromMs, window, WIDTH)).toBe(0);
    expect(xForMs(window.toMs, window, WIDTH)).toBe(WIDTH);
  });

  it('puts the word where the readout says it is', () => {
    expect(xForMs(anchor.start, window, WIDTH)).toBeCloseTo((1000 / 2650) * WIDTH, 6);
  });

  it('clamps outside the window rather than running off the strip', () => {
    expect(xForMs(0, window, WIDTH)).toBe(0);
    expect(xForMs(60_000, window, WIDTH)).toBe(WIDTH);
  });

  it('says nothing at all about a strip that has not been laid out yet', () => {
    expect(xForMs(anchor.start, window, 0)).toBe(0);
    expect(msPerPixel(window, 0)).toBe(0);
  });
});

describe('msPerPixel', () => {
  it('is what turns a drag into a nudge', () => {
    expect(msPerPixel(window, WIDTH)).toBeCloseTo(2650 / 360, 6);
    expect(Math.round(40 * msPerPixel(window, WIDTH))).toBe(294);
  });
});

describe('wordsInWindow', () => {
  const words = [
    word({ id: 'w1', text: 'before', start: 10_000, end: 11_000 }),
    word({ id: 'w2', text: 'edge', start: 11_000, end: 11_500 }),
    word({ id: 'w3', text: 'the', start: 12_000, end: 12_400 }),
    word({ id: 'w4', text: 'word', start: 12_400, end: 13_050 }),
    word({ id: 'w5', text: 'after', start: 13_100, end: 13_600 }),
    word({ id: 'w6', text: 'away', start: 20_000, end: 20_500 }),
  ];

  it('keeps everything the handles could run into', () => {
    expect(wordsInWindow(words, window).map((entry) => entry.id)).toEqual([
      'w2',
      'w3',
      'w4',
      'w5',
    ]);
  });

  it('keeps a word that only overlaps the window by a hair', () => {
    const grazing = [word({ id: 'g', text: 'graze', start: 11_000, end: 11_401 })];
    expect(wordsInWindow(grazing, window)).toHaveLength(1);
  });
});
