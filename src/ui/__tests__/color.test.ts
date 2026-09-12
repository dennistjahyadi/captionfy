import { hexToHue, hslToHex, hueToHex, HUE_STOPS } from '../color';

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

describe('HUE_STOPS', () => {
  it('runs a full turn, ending where it started', () => {
    expect(HUE_STOPS).toHaveLength(7);
    expect(HUE_STOPS[0]).toBe(HUE_STOPS[HUE_STOPS.length - 1]);
  });

  it('is made of colours the picker can actually produce', () => {
    expect(HUE_STOPS.every((stop) => /^#[0-9A-F]{6}$/.test(stop))).toBe(true);
  });
});
