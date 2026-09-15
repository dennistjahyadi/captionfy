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

describe('the new presets across the bridge', () => {
  const canvas: Canvas = { width: options.width, height: options.height };

  it.each(['spotlight', 'stack', 'headline', 'newsprint'])(
    '%s: the plan draws what the preview draws',
    (styleId) => {
      const projected = ready(styleId);
      const plan = buildBurnPlan(projected, options, measureMono);
      const style = projectStyle(projected);

      let entry = 0;
      for (let index = 0; index < 96; index += 1) {
        const tMs = Math.round((index * 1000) / options.fps);
        while (entry + 1 < plan.entries.length && plan.entries[entry + 1].tMs <= tMs) entry += 1;

        const expected = layoutCaptionFrame(projected, style, tMs, canvas, measureMono);
        const showing = plan.entries[entry];

        expect(showing.words).toHaveLength(expected.words.length);
        showing.words.forEach((word, at) => {
          expect(word.text).toBe(expected.words[at].text);
          expect(word.x).toBeCloseTo(expected.words[at].x, 1);
          expect(word.baseline).toBeCloseTo(expected.words[at].baseline, 1);
          expect(word.opacity).toBeCloseTo(expected.words[at].opacity, 2);
          expect(word.shadow?.color).toBe(expected.words[at].shadow?.color);
        });
        expect(showing.plate?.color).toBe(expected.plate?.color);
      }
    }
  );

  it('carries the card, because a new entry is a whole new drawing', () => {
    // The comparison that skips unchanged frames is over the entry, not the
    // words: a plate that changed while the words did not would be dropped.
    const plan = buildBurnPlan(ready('newsprint'), options, measureMono);

    expect(plan.entries.every((entry) => entry.plate !== undefined)).toBe(true);
    expect(plan.entries[0].plate!.shadow).toBeDefined();
  });

  it('carries a resolved colour for a glow, never the sentinel', () => {
    const plan = buildBurnPlan(ready('stack'), options, measureMono);
    const glows = plan.entries.flatMap((entry) => entry.words).filter((word) => word.shadow);

    expect(glows.length).toBeGreaterThan(0);
    for (const word of glows) expect(word.shadow!.color).toMatch(/^#[0-9A-Fa-f]{6,8}$/);
  });

  it('costs a reveal what it costs, and no more', () => {
    // A word arriving changes the drawing every frame while it arrives and not
    // once it has landed, so a built line is cheaper than a karaoke fill.
    const frames = Math.ceil((options.durationMs * options.fps) / 1000);
    const spotlight = buildBurnPlan(ready('spotlight'), options, measureMono);
    const karaoke = buildBurnPlan(ready('karaoke'), options, measureMono);

    expect(spotlight.entries.length).toBeLessThan(karaoke.entries.length);
    expect(spotlight.entries.length).toBeLessThan(frames);
  });
});
