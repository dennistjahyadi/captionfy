import { packSpansIntoChunks, splitSpan, totalSpanMs, type Span } from '../spans';

const span = (t0Ms: number, t1Ms: number): Span => ({ t0Ms, t1Ms });

const MAX = 28_000;

describe('packSpansIntoChunks', () => {
  it('returns nothing for no spans', () => {
    expect(packSpansIntoChunks([], MAX)).toEqual([]);
  });

  it('keeps a single short span as it is', () => {
    expect(packSpansIntoChunks([span(1_000, 4_000)], MAX)).toEqual([span(1_000, 4_000)]);
  });

  it('merges neighbouring spans into one chunk', () => {
    const chunks = packSpansIntoChunks([span(0, 5_000), span(5_400, 9_000)], MAX);

    expect(chunks).toEqual([span(0, 9_000)]);
  });

  it('widens a chunk over a silent gap, because the encoder window is padded anyway', () => {
    const chunks = packSpansIntoChunks([span(0, 1_000), span(26_000, 27_500)], MAX);

    expect(chunks).toEqual([span(0, 27_500)]);
  });

  it('opens a new chunk rather than exceed the window, skipping the gap between', () => {
    const chunks = packSpansIntoChunks([span(0, 2_000), span(50_000, 53_000)], MAX);

    expect(chunks).toEqual([span(0, 2_000), span(50_000, 53_000)]);
  });

  it('packs a run of spans into the fewest chunks that fit', () => {
    const spans = Array.from({ length: 7 }, (_, i) => span(i * 6_000, i * 6_000 + 5_500));
    const chunks = packSpansIntoChunks(spans, MAX);

    // 41.5 s of span coverage becomes two encoder passes rather than seven.
    expect(chunks).toEqual([span(0, 23_500), span(24_000, 41_500)]);
  });

  it('splits a span that is longer than the window on its own', () => {
    const chunks = packSpansIntoChunks([span(0, 60_000)], MAX);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].t0Ms).toBe(0);
    expect(chunks[chunks.length - 1].t1Ms).toBe(60_000);
    for (const chunk of chunks) {
      expect(chunk.t1Ms - chunk.t0Ms).toBeLessThanOrEqual(MAX);
    }
  });

  it('never emits a chunk wider than the window', () => {
    const spans = Array.from({ length: 40 }, (_, i) => span(i * 1_500, i * 1_500 + 1_200));

    for (const chunk of packSpansIntoChunks(spans, MAX)) {
      expect(chunk.t1Ms - chunk.t0Ms).toBeLessThanOrEqual(MAX);
    }
  });

  it('covers every span it was given', () => {
    const spans = [span(0, 3_000), span(10_000, 12_000), span(45_000, 47_000)];
    const chunks = packSpansIntoChunks(spans, MAX);

    for (const original of spans) {
      expect(
        chunks.some((chunk) => chunk.t0Ms <= original.t0Ms && chunk.t1Ms >= original.t1Ms)
      ).toBe(true);
    }
  });

  it('sorts spans that arrive out of order', () => {
    const chunks = packSpansIntoChunks([span(9_000, 11_000), span(0, 2_000)], MAX);

    expect(chunks).toEqual([span(0, 11_000)]);
  });

  it('does not mutate the spans it was given', () => {
    const spans = [span(0, 5_000), span(6_000, 9_000)];
    packSpansIntoChunks(spans, MAX);

    expect(spans).toEqual([span(0, 5_000), span(6_000, 9_000)]);
  });

  it('rejects a window of zero', () => {
    expect(() => packSpansIntoChunks([span(0, 1_000)], 0)).toThrow();
  });
});

describe('splitSpan', () => {
  it('leaves a span inside the window alone', () => {
    expect(splitSpan(span(0, 5_000), MAX)).toEqual([span(0, 5_000)]);
  });

  it('divides a long span into equal pieces that meet end to end', () => {
    const pieces = splitSpan(span(0, 60_000), MAX);

    expect(pieces).toHaveLength(3);
    for (let i = 1; i < pieces.length; i += 1) {
      expect(pieces[i].t0Ms).toBe(pieces[i - 1].t1Ms);
    }
  });

  it('never lets a piece end before it starts', () => {
    expect(splitSpan(span(900, 850), MAX)).toEqual([span(900, 900)]);
  });
});

describe('totalSpanMs', () => {
  it('adds up the time the spans cover', () => {
    expect(totalSpanMs([span(0, 1_500), span(4_000, 4_500)])).toBe(2_000);
  });

  it('ignores a span that ends before it starts', () => {
    expect(totalSpanMs([span(1_000, 900)])).toBe(0);
  });
});
