import {
  contrastRatio,
  hexToHue,
  hslToHex,
  hueToHex,
  HUE_STOPS,
  readableOn,
  relativeLuminance,
} from '../color';
import {
  accentColor,
  DEFAULT_STYLE_ID,
  HIGHLIGHT_SWATCHES,
  presetById,
  STYLE_PRESETS,
} from '../../domain';
import { color, ON_ACCENT } from '../theme';

describe('hslToHex', () => {
  it('makes the corners of the colour wheel', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#FF0000');
    expect(hslToHex(120, 1, 0.5)).toBe('#00FF00');
    expect(hslToHex(240, 1, 0.5)).toBe('#0000FF');
  });

  it('has no hue left at the ends of the lightness range', () => {
    expect(hslToHex(200, 1, 0)).toBe('#000000');
    expect(hslToHex(200, 1, 1)).toBe('#FFFFFF');
    expect(hslToHex(200, 0, 0.5)).toBe('#808080');
  });

  it('wraps rather than running off either end of the wheel', () => {
    expect(hslToHex(360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
    expect(hslToHex(-120, 1, 0.5)).toBe(hslToHex(240, 1, 0.5));
  });
});

describe('hexToHue', () => {
  it('reads back a hue the strip made', () => {
    for (const hue of [0, 45, 137, 210, 300, 359]) {
      expect(hexToHue(hueToHex(hue))).toBeCloseTo(hue, 0);
    }
  });

  it('says nothing about a colour with no hue in it', () => {
    // The thumb has nowhere to stand on white, and standing at red would be
    // claiming the user picked red.
    expect(hexToHue('#FFFFFF')).toBeNull();
    expect(hexToHue('#000000')).toBeNull();
    expect(hexToHue('#7F7F7F')).toBeNull();
  });

  it('takes a colour with or without its hash, and rejects nonsense', () => {
    expect(hexToHue('FF0000')).toBeCloseTo(0, 0);
    expect(hexToHue('#FF0000FF')).toBeCloseTo(0, 0);
    expect(hexToHue('rebeccapurple')).toBeNull();
    expect(hexToHue('')).toBeNull();
  });
});

describe('contrast', () => {
  it('agrees with the published ratios at both ends', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // The default's blue, and the reason it is not the one in the reference
    // shot: white on `#4F6BFF` is 4.30:1 and misses the 4.5:1 line.
    expect(contrastRatio('#FFFFFF', '#2F5FEA')).toBeCloseTo(5.32, 1);
    expect(contrastRatio('#FFFFFF', '#4F6BFF')).toBeCloseTo(4.3, 1);
  });

  it('does not care which way round it is asked', () => {
    expect(contrastRatio('#2F5FEA', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#2F5FEA'),
      6
    );
  });

  it('reads a colour it cannot parse as black rather than throwing', () => {
    expect(relativeLuminance('rebeccapurple')).toBe(0);
  });
});

describe('readableOn', () => {
  const pick = (accent: string) => readableOn(accent, ON_ACCENT, color.paper);

  it('reaches 4.5:1 on every accent the app ships', () => {
    // The six swatches and every preset's own colour. The button is the one
    // filled thing wearing the caption's colour, and a label nobody can read on
    // it is not a style choice.
    const accents = [...HIGHLIGHT_SWATCHES, ...STYLE_PRESETS.map((preset) => accentColor(preset.props))];

    for (const accent of accents) {
      expect(contrastRatio(accent, pick(accent))).toBeGreaterThanOrEqual(4.5);
    }

    expect(accents).toContain(accentColor(presetById(DEFAULT_STYLE_ID)));
  });

  it('holds above 4:1 across the whole hue strip, which is its floor', () => {
    // Ink and paper leave a gap between them: an accent whose luminance is
    // around 0.19 is too dark for one and too light for the other, and 18 of
    // the strip's 360 hues — a band of violets around 280° — land in it at
    // 4.09:1 rather than 4.5:1. That still clears the 3:1 WCAG allows for the
    // 19px semibold this label is set in, and closing it properly would mean
    // painting the button's label in pure black and white instead of the app's
    // own two, which is a worse trade for six degrees of purple.
    for (let hue = 0; hue < 360; hue += 1) {
      const accent = hueToHex(hue);
      expect(contrastRatio(accent, pick(accent))).toBeGreaterThan(4);
    }
  });

  it('keeps ink on the pale accents and turns to paper on the dark ones', () => {
    expect(pick('#FFE03D')).toBe(ON_ACCENT);
    expect(pick('#FFFFFF')).toBe(ON_ACCENT);
    expect(pick('#2F5FEA')).toBe(color.paper);
    expect(pick('#000000')).toBe(color.paper);
  });
});

describe('HUE_STOPS', () => {
  it('runs a full turn, ending where it started', () => {
    expect(HUE_STOPS).toHaveLength(7);
    expect(HUE_STOPS[0]).toBe(HUE_STOPS[HUE_STOPS.length - 1]);
  });

  it('is made of colours the picker can actually produce', () => {
    expect(HUE_STOPS.every((stop) => /^#[0-9A-F]{6}$/.test(stop))).toBe(true);
  });
});
