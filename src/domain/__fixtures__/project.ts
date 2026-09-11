/**
 * Test fixtures. Not a test file and not shipped in a screen.
 */
import { DEFAULT_STYLE_ID } from '../style';
import type { MeasureText } from '../layout';
import type { IdFactory, Project, Word } from '../types';

/** A word with everything defaulted, so a test only states what it is about. */
export function word(partial: Partial<Word> & Pick<Word, 'id' | 'text' | 'start' | 'end'>): Word {
  return {
    asrText: partial.text,
    origin: 'asr',
    ...partial,
  };
}

/** Evenly spaced words, one every `step` ms, for tests about grouping rather than timing. */
export function evenWords(texts: string[], step = 400, gap = 0): Word[] {
  return texts.map((text, index) =>
    word({
      id: `w${index + 1}`,
      text,
      start: index * (step + gap),
      end: index * (step + gap) + step,
    })
  );
}

export function project(partial: Partial<Project> = {}): Project {
  const words = partial.words ?? evenWords(['So', 'today', 'I', 'tried', 'the', 'new', 'app']);
  return {
    id: 'p1',
    sourceUri: 'file:///clip.mp4',
    durationMs: 48_000,
    createdAt: '2026-09-12T00:00:00.000Z',
    status: 'ready',
    progress: { processedMs: 48_000, totalMs: 48_000 },
    lineFlags: [],
    autoEmphasis: [],
    globalOffsetMs: 0,
    styleId: DEFAULT_STYLE_ID,
    styleOverrides: {},
    ...partial,
    words,
  };
}

/** A deterministic id factory. */
export function ids(prefix = 'n'): IdFactory {
  let next = 1;
  return () => `${prefix}${next++}`;
}

/**
 * A monospace stand-in for a real font.
 *
 * Layout tests are about wrapping, position and state, none of which should
 * depend on the shape of a glyph. The real measurer comes from Skia. Italics are
 * given a little extra width so a test can tell the two faces apart.
 */
export const measureMono: MeasureText = (text, fontSize, face) => ({
  width: text.length * fontSize * (face.italic ? 0.55 : 0.5),
  ascent: fontSize * 0.8,
  descent: fontSize * 0.2,
});

/**
 * A flat envelope at a chosen level, long enough to cover a fixture project.
 *
 * Tests about scoring rules rather than about loudness use this so every word
 * sits exactly on the speech median and contributes zero loudness points.
 */
export function flatEnvelope(durationMs = 60_000, level = 0.1): Float32Array {
  return new Float32Array(Math.ceil(durationMs / 10)).fill(level);
}
