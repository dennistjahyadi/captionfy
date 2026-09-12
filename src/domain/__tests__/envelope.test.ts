import {
  computeEnvelope,
  computeEnvelopeFromPcm16,
  ENVELOPE_FRAME_MS,
  envelopeDurationMs,
  meanEnergy,
  spanLevel,
  peaksForRange,
  SILENCE_FLOOR_DB,
  speechMedian,
  toDb,
} from '../envelope';

const RATE = 16_000;

/** A sine burst of `amplitude` for `ms`, then silence for `gapMs`. */
function burst(amplitude: number, ms: number, gapMs = 0): number[] {
  const samples: number[] = [];
  const count = Math.round((RATE * ms) / 1000);
  for (let index = 0; index < count; index += 1) {
    samples.push(amplitude * Math.sin((2 * Math.PI * 440 * index) / RATE));
  }
  for (let index = 0; index < Math.round((RATE * gapMs) / 1000); index += 1) samples.push(0);
  return samples;
}

/** The RMS of a sine wave is its amplitude over root two. */
const rmsOf = (amplitude: number) => amplitude / Math.SQRT2;

describe('computeEnvelope', () => {
  const pcm = new Float32Array([...burst(0.1, 200), ...burst(0.5, 200), ...burst(0.25, 200)]);
  const envelope = computeEnvelope(pcm, RATE);

  it('produces one frame every 10 ms', () => {
    expect(ENVELOPE_FRAME_MS).toBe(10);
    expect(envelope.length).toBe(60);
    expect(envelopeDurationMs(envelope)).toBe(600);
  });

  it('gives three plateaus at the three amplitudes, in order', () => {
    const plateaus = [
      meanEnergy(envelope, 20, 180),
      meanEnergy(envelope, 220, 380),
      meanEnergy(envelope, 420, 580),
    ];
    expect(plateaus[0]).toBeCloseTo(rmsOf(0.1), 2);
    expect(plateaus[1]).toBeCloseTo(rmsOf(0.5), 2);
    expect(plateaus[2]).toBeCloseTo(rmsOf(0.25), 2);
    expect(plateaus[1]).toBeGreaterThan(plateaus[2]);
    expect(plateaus[2]).toBeGreaterThan(plateaus[0]);
  });

  it('holds each plateau flat rather than smearing across the burst', () => {
    const inside = Array.from(envelope.slice(22, 38));
    expect(Math.max(...inside) - Math.min(...inside)).toBeLessThan(0.01);
  });

  it('covers a tail shorter than a whole frame', () => {
    expect(computeEnvelope(new Float32Array(RATE / 100 + 5), RATE).length).toBe(2);
  });

  it('refuses a sample rate it cannot frame', () => {
    expect(() => computeEnvelope(new Float32Array(10), 0)).toThrow();
  });

  it('reads signed 16-bit PCM to the same levels', () => {
    const pcm16 = Int16Array.from(pcm, (sample) => Math.round(sample * 32_767));
    const fromPcm16 = computeEnvelopeFromPcm16(pcm16, RATE);
    expect(fromPcm16.length).toBe(envelope.length);
    fromPcm16.forEach((level, index) => expect(level).toBeCloseTo(envelope[index], 3));
  });
});

describe('spanLevel', () => {
  it('ignores the quiet edges a loose word boundary drags in', () => {
    // 100 ms of silence, 300 ms of speech, 100 ms of silence: a word span as
    // whisper tends to report one.
    const envelope = computeEnvelope(
      new Float32Array([...burst(0, 100), ...burst(0.4, 300), ...burst(0, 100)]),
      RATE
    );
    expect(meanEnergy(envelope, 0, 500)).toBeLessThan(rmsOf(0.4) * 0.7);
    expect(spanLevel(envelope, 0, 500)).toBeCloseTo(rmsOf(0.4), 2);
  });

  it('still reads the sound when silence is the majority of the span', () => {
    // What a slow speaker's word spans look like: 200 ms of sound in 700 ms.
    const envelope = computeEnvelope(
      new Float32Array([...burst(0, 250), ...burst(0.4, 200), ...burst(0, 250)]),
      RATE
    );
    expect(spanLevel(envelope, 0, 700)).toBeCloseTo(rmsOf(0.4), 2);
  });

  it('is not swayed by one loud frame', () => {
    const envelope = computeEnvelope(
      new Float32Array([...burst(0.2, 390), ...burst(1, 10)]),
      RATE
    );
    expect(spanLevel(envelope, 0, 400)).toBeCloseTo(rmsOf(0.2), 2);
  });
});

describe('speechMedian', () => {
  it('weighs a long word the same as a short one', () => {
    const envelope = computeEnvelope(
      new Float32Array([...burst(0.1, 2000), ...burst(0.5, 100), ...burst(0.9, 100)]),
      RATE
    );
    const spans = [
      { start: 20, end: 1980 },
      { start: 2020, end: 2080 },
      { start: 2120, end: 2180 },
    ];
    // Pooling frames would hand the answer to the two-second word. Reducing each
    // span first puts the reference on the middle word, where it belongs.
    expect(speechMedian(envelope, spans)).toBeCloseTo(rmsOf(0.5), 2);
  });
});

describe('speechMedian, spans and silence', () => {
  it('ignores everything outside the spans, so a silent intro cannot skew it', () => {
    // A long music-free intro and one spoken phrase.
    const pcm = new Float32Array([...burst(0, 1200), ...burst(0.4, 400)]);
    const envelope = computeEnvelope(pcm, RATE);
    expect(speechMedian(envelope, [{ start: 1220, end: 1580 }])).toBeCloseTo(rmsOf(0.4), 2);
    // Handed the whole clip as one span, it reads the silence the intro is made of.
    expect(speechMedian(envelope, [{ start: 0, end: 1600 }])).toBe(0);
  });

  it('is zero when no span holds a frame', () => {
    expect(speechMedian(new Float32Array(10), [])).toBe(0);
  });
});

describe('toDb', () => {
  it('is zero at the reference', () => {
    expect(toDb(0.2, 0.2)).toBe(0);
  });

  it('is six decibels for twice the level', () => {
    expect(toDb(0.4, 0.2)).toBeCloseTo(6.02, 1);
  });

  it('floors silence instead of returning negative infinity', () => {
    expect(toDb(0, 0.2)).toBe(SILENCE_FLOOR_DB);
  });
});

describe('peaksForRange', () => {
  const envelope = computeEnvelope(new Float32Array([...burst(0.1, 100), ...burst(0.6, 100)]), RATE);

  it('returns exactly the buckets asked for', () => {
    expect(peaksForRange(envelope, 0, 200, 40).length).toBe(40);
  });

  it('takes the peak of each bucket, so an attack survives being drawn small', () => {
    const peaks = peaksForRange(envelope, 0, 200, 2);
    expect(peaks[1]).toBeGreaterThan(peaks[0] * 4);
  });

  it('reads zero outside the envelope rather than failing', () => {
    expect(Array.from(peaksForRange(envelope, 10_000, 11_000, 4))).toEqual([0, 0, 0, 0]);
  });

  it('returns nothing for an empty range', () => {
    expect(peaksForRange(envelope, 100, 100, 8).length).toBe(8);
    expect(peaksForRange(envelope, 100, 50, 8).every((peak) => peak === 0)).toBe(true);
  });
});
