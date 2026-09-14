import { DEFAULT_STYLE_ID, STYLE_PRESETS, type Canvas } from '../../domain';
import { measureMono } from '../../domain/__fixtures__/project';
import { createFrameSource } from '../frame';
import { SAMPLE_LOOP_MS, sampleProject } from '../sample';

const CANVAS: Canvas = { width: 1080, height: 1920 };

describe('the default-style sample', () => {
  it('has a caption on screen at every millisecond of its loop', () => {
    const source = createFrameSource(sampleProject(DEFAULT_STYLE_ID, {}));

    // The screen plays it on a clock that wraps at SAMPLE_LOOP_MS, so a single
    // frame with nothing in it is a blink every time round.
    for (let tMs = 0; tMs < SAMPLE_LOOP_MS; tMs += 1) {
      expect(source.frameAt(tMs, CANVAS, measureMono).words.length).toBeGreaterThan(0);
    }
  });

  it('draws under every preset, with a word raised for the ones that raise words', () => {
    for (const preset of STYLE_PRESETS) {
      const project = sampleProject(preset.id, {});
      const source = createFrameSource(project);

      expect(source.units.length).toBeGreaterThan(0);
      expect(project.words.map((word) => word.id)).toEqual(
        expect.arrayContaining(project.autoEmphasis)
      );
      expect(source.frameAt(SAMPLE_LOOP_MS - 1, CANVAS, measureMono).words.length).toBeGreaterThan(0);
    }
  });
});
