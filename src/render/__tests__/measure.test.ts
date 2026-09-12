import { SANS_FAMILY, SERIF_FAMILY, type FaceSpec } from '../../domain';
import { faceKey } from '../faces';
import { createMeasureText, type FontLike } from '../measure';

/** A stand-in for a Skia font: width by character count, Skia's sign on ascent. */
function fakeFont(key: string, size: number): FontLike {
  return {
    getTextWidth: (text) => text.length * size * (key.includes('Spectral') ? 0.6 : 0.5),
    getMetrics: () => ({ ascent: -size * 0.8, descent: size * 0.2 }),
  };
}

function face(partial: Partial<FaceSpec> = {}): FaceSpec {
  return { family: SANS_FAMILY, weight: 'extrabold', italic: false, ...partial };
}

describe('faceKey', () => {
  it('maps every sans weight onto a bundled file', () => {
    expect(faceKey(face({ weight: 'regular' }))).toBe('BeVietnamPro-Medium');
    expect(faceKey(face({ weight: 'medium' }))).toBe('BeVietnamPro-Medium');
    expect(faceKey(face({ weight: 'semibold' }))).toBe('BeVietnamPro-SemiBold');
    expect(faceKey(face({ weight: 'bold' }))).toBe('BeVietnamPro-ExtraBold');
    expect(faceKey(face({ weight: 'extrabold' }))).toBe('BeVietnamPro-ExtraBold');
  });

  it('picks the serif by slant, since only one weight of it is bundled', () => {
    expect(faceKey(face({ family: SERIF_FAMILY, italic: true }))).toBe('Spectral-ExtraBoldItalic');
    expect(faceKey(face({ family: SERIF_FAMILY, weight: 'regular', italic: false }))).toBe(
      'Spectral-ExtraBold'
    );
  });

  it('falls back to a real face for a family that is not bundled', () => {
    expect(faceKey(face({ family: 'Helvetica' }))).toBe('BeVietnamPro-Medium');
  });
});

describe('createMeasureText', () => {
  it('reports the advance width and flips Skia’s negative ascent', () => {
    const measure = createMeasureText(fakeFont);
    expect(measure('hello', 40, face())).toEqual({ width: 100, ascent: 32, descent: 8 });
  });

  it('measures a space, which is what rows are spaced by', () => {
    const measure = createMeasureText(fakeFont);
    expect(measure(' ', 40, face()).width).toBeGreaterThan(0);
  });

  it('keys the cache on text, size and face', () => {
    const lookup = jest.fn(fakeFont);
    const measure = createMeasureText(lookup);

    measure('now', 40, face());
    measure('now', 40, face());
    expect(lookup).toHaveBeenCalledTimes(1);

    measure('now', 41, face());
    measure('now', 40, face({ family: SERIF_FAMILY, italic: true }));
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('gives a cached measurement and a cold one the same answer', () => {
    const warm = createMeasureText(fakeFont);
    const cold = createMeasureText(fakeFont);

    warm('the same word', 37.5, face());
    // The export measures cold and must land on the preview's numbers.
    expect(warm('the same word', 37.5, face())).toEqual(cold('the same word', 37.5, face()));
  });

  it('collapses two weights that share a file onto one cache entry', () => {
    const lookup = jest.fn(fakeFont);
    const measure = createMeasureText(lookup);

    measure('word', 40, face({ weight: 'bold' }));
    measure('word', 40, face({ weight: 'extrabold' }));
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
