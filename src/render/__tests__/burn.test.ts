import {
  computeAutoEmphasis,
  layoutCaptionFrame,
  projectStyle,
  wordFeatures,
  type Canvas,
} from '../../domain';
import { evenWords, flatEnvelope, measureMono, project } from '../../domain/__fixtures__/project';
import { buildBurnPlan, exportSize } from '../burn';
import { faceKey } from '../faces';

function ready(styleId = 'box') {
  const base = project({
    words: evenWords(['So', 'today', 'I', 'tried', 'the', 'ninety', 'dollar', 'app']),
    styleId,
  });
  return computeAutoEmphasis(base, {
    features: wordFeatures(flatEnvelope(base.durationMs), base.words),
    dictionary: [],
  });
}

const options = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationMs: 3200,
  reducedMotion: false,
};

describe('buildBurnPlan', () => {
  it('draws what the preview draws, at every frame it covers', () => {
    // Invariant 2 across the bridge: whatever the plan says to draw at a moment
    // has to be what `layoutCaptionFrame` produced for that moment.
    const projected = ready();
    const plan = buildBurnPlan(projected, options, measureMono);
    const style = projectStyle(projected);
    const canvas: Canvas = { width: options.width, height: options.height };

    let entry = 0;
    for (let index = 0; index < 96; index += 1) {
      const tMs = Math.round((index * 1000) / options.fps);
      while (entry + 1 < plan.entries.length && plan.entries[entry + 1].tMs <= tMs) entry += 1;

      const expected = layoutCaptionFrame(projected, style, tMs, canvas, measureMono).words;
      const showing = plan.entries[entry].words;

      expect(showing).toHaveLength(expected.length);
      showing.forEach((word, at) => {
        expect(word.text).toBe(expected[at].text);
        expect(word.x).toBeCloseTo(expected[at].x, 1);
        expect(word.baseline).toBeCloseTo(expected[at].baseline, 1);
        expect(word.size).toBeCloseTo(expected[at].fontSize, 1);
        expect(word.color).toBe(expected[at].color);
        expect(word.face).toBe(faceKey(expected[at].face));
      });
    }
  });

  it('starts at zero, so the first frame knows what to draw', () => {
    expect(buildBurnPlan(ready(), options, measureMono).entries[0].tMs).toBe(0);
  });

  it('emits an entry only where the drawing changes', () => {
    const frames = Math.ceil((options.durationMs * options.fps) / 1000);
    const boxed = buildBurnPlan(ready('box'), options, measureMono);

    // A box highlight holds still for a whole word; one entry per frame would
    // mean the comparison that skips them is broken.
    expect(boxed.entries.length).toBeGreaterThan(1);
    expect(boxed.entries.length).toBeLessThan(frames / 2);
  });

  it('spends the frames it has to on a karaoke fill', () => {
    const karaoke = buildBurnPlan(ready('karaoke'), options, measureMono);
    const boxed = buildBurnPlan(ready('box'), options, measureMono);

    expect(karaoke.entries.length).toBeGreaterThan(boxed.entries.length);
  });

  it('names a face the renderer can look up, and nothing else', () => {
    const plan = buildBurnPlan(ready('editorial'), options, measureMono);

    for (const entry of plan.entries) {
      for (const word of entry.words) {
        expect(word.face).toMatch(/^(BeVietnamPro|Spectral)-/);
      }
    }
  });

  it('carries the whole clip, not just the words', () => {
    const plan = buildBurnPlan(ready(), options, measureMono);

    expect(plan).toMatchObject({ width: 1080, height: 1920, fps: 30, durationMs: 3200 });
  });

  it('survives a project with no words at all', () => {
    const plan = buildBurnPlan(project({ words: [] }), options, measureMono);

    expect(plan.entries).toEqual([{ tMs: 0, words: [] }]);
  });
});

describe('exportSize', () => {
  it('leaves a clip already inside the cap alone', () => {
    expect(exportSize(1080, 1920, 1080)).toEqual({ width: 1080, height: 1920 });
  });

  it('caps the short edge and keeps the shape', () => {
    expect(exportSize(1080, 1920, 720)).toEqual({ width: 720, height: 1280 });
    expect(exportSize(3840, 2160, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('never hands an encoder an odd number', () => {
    for (const cap of [720, 1080]) {
      const size = exportSize(1079, 1921, cap);
      expect(size.width % 2).toBe(0);
      expect(size.height % 2).toBe(0);
    }
  });

  it('never collapses a tiny clip to nothing', () => {
    expect(exportSize(1, 1, 1080)).toEqual({ width: 2, height: 2 });
  });
});
