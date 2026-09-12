import {
  computeAutoEmphasis,
  layoutCaptionFrame,
  projectStyle,
  STYLE_PRESETS,
  wordFeatures,
  type Canvas,
} from '../../domain';
import { evenWords, flatEnvelope, measureMono, project } from '../../domain/__fixtures__/project';
import { createFrameSource } from '../frame';

const CANVAS: Canvas = { width: 1080, height: 1920 };

function ready() {
  const base = project({
    words: evenWords(['So', 'today', 'I', 'tried', 'the', 'ninety', 'dollar', 'app']),
  });
  return computeAutoEmphasis(base, {
    features: wordFeatures(flatEnvelope(base.durationMs), base.words),
    dictionary: [],
  });
}

describe('createFrameSource', () => {
  it('draws what layoutCaptionFrame draws, at every time in the clip', () => {
    const source = createFrameSource(ready());
    const projected = ready();
    const style = projectStyle(projected);

    for (let tMs = 0; tMs <= 3600; tMs += 120) {
      expect(source.frameAt(tMs, CANVAS, measureMono)).toEqual(
        layoutCaptionFrame(projected, style, tMs, CANVAS, measureMono)
      );
    }
  });

  it('agrees with the one layout under every preset', () => {
    for (const preset of STYLE_PRESETS) {
      const projected = { ...ready(), styleId: preset.id };
      const source = createFrameSource(projected);

      expect(source.frameAt(1500, CANVAS, measureMono)).toEqual(
        layoutCaptionFrame(projected, preset.props, 1500, CANVAS, measureMono)
      );
    }
  });

  it('segments the transcript once and reuses it', () => {
    const source = createFrameSource(ready());
    const first = source.units;
    source.frameAt(0, CANVAS, measureMono);
    source.frameAt(2000, CANVAS, measureMono);
    expect(source.units).toBe(first);
  });

  it('carries the project’s emphasis picks into the layout', () => {
    const projected = ready();
    const source = createFrameSource(projected);
    expect([...source.emphasisIds]).toEqual(projected.autoEmphasis);
  });

  it('finds the word under the playhead', () => {
    const source = createFrameSource(ready());
    expect(source.wordAt(100)?.text).toBe('So');
    expect(source.wordAt(1300)?.text).toBe('tried');
  });

  it('seeks to where a word is heard, not to where it is written', () => {
    const shifted = { ...ready(), globalOffsetMs: 250 };
    const source = createFrameSource(shifted);
    const word = shifted.words[3];

    expect(source.seekTimeFor(word)).toBe(word.start + 250);
    // Seeking there puts that word on screen, which is the whole point.
    expect(source.wordAt(source.seekTimeFor(word))?.id).toBe(word.id);
  });

  it('draws nothing in the tail after the last line has gone', () => {
    const source = createFrameSource(ready());
    expect(source.frameAt(40_000, CANVAS, measureMono).words).toHaveLength(0);
  });
});
