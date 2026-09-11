import { word } from '../__fixtures__/project';
import { computeEnvelope } from '../envelope';
import { letterCount, wordFeatures } from '../features';

const RATE = 16_000;

function tone(amplitude: number, ms: number): number[] {
  const count = Math.round((RATE * ms) / 1000);
  return Array.from({ length: count }, (_, index) =>
    amplitude === 0 ? 0 : amplitude * Math.sin((2 * Math.PI * 440 * index) / RATE)
  );
}

/**
 * A quiet word, a loud word, 400 ms of silence, then one more word.
 * 0-300 quiet, 300-600 loud, 600-1000 silent, 1000-1300 quiet.
 */
const pcm = new Float32Array([
  ...tone(0.2, 300),
  ...tone(0.8, 300),
  ...tone(0, 400),
  ...tone(0.2, 300),
]);

const words = [
  word({ id: 'w1', text: 'normal', start: 0, end: 300 }),
  word({ id: 'w2', text: 'loud', start: 300, end: 600 }),
  word({ id: 'w3', text: 'after', start: 1000, end: 1300 }),
];

const features = wordFeatures(computeEnvelope(pcm, RATE), words);
const at = (id: string) => features.byId.get(id)!;

describe('wordFeatures', () => {
  it('gives the loud word the highest loudness', () => {
    expect(at('w2').loudnessDb).toBeGreaterThan(at('w1').loudnessDb);
    expect(at('w2').loudnessDb).toBeGreaterThan(at('w3').loudnessDb);
  });

  it('measures loudness against the speech median, not an absolute level', () => {
    // Two of the three words sit at 0.2, so the median is theirs and they read as zero.
    expect(Math.abs(at('w1').loudnessDb)).toBeLessThan(0.2);
    // 0.8 over 0.2 is four times the amplitude, which is about twelve decibels.
    expect(at('w2').loudnessDb).toBeCloseTo(12, 0);
  });

  it('sees the silence before a word', () => {
    expect(at('w3').pauseBeforeMs).toBeGreaterThanOrEqual(400);
    expect(at('w2').pauseBeforeMs).toBe(0);
  });

  it('sees the silence after a word', () => {
    expect(at('w2').pauseAfterMs).toBe(400);
  });

  it('has no pause after the last word, having nothing to measure to', () => {
    expect(at('w3').pauseAfterMs).toBe(0);
  });

  it('counts the lead-in as a pause before the first word', () => {
    const late = [word({ id: 'x', text: 'late', start: 900, end: 1200 })];
    expect(wordFeatures(computeEnvelope(pcm, RATE), late).byId.get('x')!.pauseBeforeMs).toBe(900);
  });

  it('scores a held word by time per letter', () => {
    expect(at('w1').msPerChar).toBeCloseTo(50);
    expect(at('w2').msPerChar).toBeCloseTo(75);
  });

  it('reports the clip median, which is what "held" is relative to', () => {
    expect(features.medianMsPerChar).toBeCloseTo(60);
  });
});

describe('letterCount', () => {
  it('counts letters, not characters', () => {
    expect(letterCount('$1,200')).toBe(0);
    expect(letterCount("don't,")).toBe(4);
    expect(letterCount('Nguyễn')).toBe(6);
  });
});
