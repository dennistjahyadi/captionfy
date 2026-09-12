/**
 * The bundled faces, loaded into Skia.
 *
 * Each file is registered under its own family name rather than under one family
 * with weights, so looking a face up is an exact match and never depends on the
 * weight metadata inside the file. `faces.ts` decides which key a `FaceSpec`
 * wants; this hands back the font to measure and draw with.
 *
 * Fonts are cached per size because the layout asks for the same few sizes on
 * every frame and building one is a native allocation.
 */
import { Skia, useFonts, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { FaceKey } from './faces';

type FontProvider = { matchFamilyStyle(name: string, style: Record<string, never>): SkTypeface | null };

/** A face key and a size in, a font out. Satisfies `FontLookup` in `measure.ts`. */
export type FontLookup = (key: string, size: number) => SkFont;

const FACE_SOURCES: Record<FaceKey, number[]> = {
  'BeVietnamPro-Medium': [require('../../assets/fonts/BeVietnamPro-Medium.ttf')],
  'BeVietnamPro-SemiBold': [require('../../assets/fonts/BeVietnamPro-SemiBold.ttf')],
  'BeVietnamPro-ExtraBold': [require('../../assets/fonts/BeVietnamPro-ExtraBold.ttf')],
  'Spectral-ExtraBold': [require('../../assets/fonts/Spectral-ExtraBold.ttf')],
  'Spectral-ExtraBoldItalic': [require('../../assets/fonts/Spectral-ExtraBoldItalic.ttf')],
};

/** Sizes cached before the table is dropped and rebuilt. Shrink passes make a few. */
const FONT_CACHE_LIMIT = 256;

/** Null until the files are read. Callers draw nothing rather than draw wrong. */
export function useCaptionFonts(): FontLookup | null {
  const provider = useFonts(FACE_SOURCES);
  return useMemo(() => (provider ? createFontLookup(provider) : null), [provider]);
}

export function createFontLookup(provider: FontProvider): FontLookup {
  const typefaces = new Map<string, SkTypeface | null>();
  const fonts = new Map<string, SkFont>();

  return (key, size) => {
    const id = `${key}|${size}`;
    const cached = fonts.get(id);
    if (cached) return cached;

    if (!typefaces.has(key)) typefaces.set(key, provider.matchFamilyStyle(key, {}));
    // A face that failed to register falls back to the platform font. Captions in
    // the wrong face are recoverable; captions drawn with no glyphs are not.
    const font = Skia.Font(typefaces.get(key) ?? undefined, size);

    if (fonts.size >= FONT_CACHE_LIMIT) fonts.clear();
    fonts.set(id, font);
    return font;
  };
}
