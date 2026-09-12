/**
 * The colours the custom picker can make, and how to read one back.
 *
 * A caption colour is a hue. Nobody choosing a highlight for a talking-head clip
 * wants a saturation slider as well, and a washed-out one is a caption you cannot
 * read, so the strip offers one dimension at a fixed saturation and lightness and
 * the swatches cover the rest, white included.
 */

/** Where the strip sits in HSL: vivid enough to read on video, not fluorescent. */
export const PICKER_SATURATION = 0.9;
export const PICKER_LIGHTNESS = 0.56;

/** `#RRGGBB` for a hue in degrees, at the strip's own saturation and lightness. */
export function hueToHex(hue: number): string {
  return hslToHex(hue, PICKER_SATURATION, PICKER_LIGHTNESS);
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(saturation);
  const l = clamp01(lightness);

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const base = l - chroma / 2;

  const [r, g, b] = rgbTriple(h, chroma, second).map((channel) => channel + base);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * The hue a colour sits at, or null for one the strip cannot make.
 *
 * White and black have no hue, and putting the thumb at red for a white caption
 * would say the user had chosen red.
 */
export function hexToHue(color: string): number | null {
  const parsed = parseHex(color);
  if (!parsed) return null;

  const [r, g, b] = parsed;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < 0.06) return null;

  const hue =
    max === r
      ? ((g - b) / chroma) % 6
      : max === g
        ? (b - r) / chroma + 2
        : (r - g) / chroma + 4;

  return ((hue * 60) % 360 + 360) % 360;
}

/** The stops a hue strip is drawn from, every 60 degrees and back to red. */
export const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map(hueToHex);

function rgbTriple(h: number, chroma: number, second: number): [number, number, number] {
  if (h < 60) return [chroma, second, 0];
  if (h < 120) return [second, chroma, 0];
  if (h < 180) return [0, chroma, second];
  if (h < 240) return [0, second, chroma];
  if (h < 300) return [second, 0, chroma];
  return [chroma, 0, second];
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function hex(channel: number): string {
  return Math.round(clamp01(channel) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
