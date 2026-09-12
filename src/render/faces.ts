/**
 * Which bundled file draws a `FaceSpec`.
 *
 * The domain asks for a family, a weight and an italic flag. Five files are
 * bundled, so this table collapses the request onto one of them. It is a pure
 * function on purpose: the preview and the burn-in both resolve a face through
 * here, and a face resolved differently in two places is two layouts wearing one
 * function's name (invariant 2).
 *
 * The faces are registered under these keys as their Skia family names rather
 * than under "Be Vietnam Pro" with weights, so a match is an exact lookup and
 * never depends on what weight metadata a foundry happened to embed.
 */
import { SANS_FAMILY, SERIF_FAMILY, type FaceSpec, type FontWeight } from '../domain';

export const FACE_KEYS = [
  'BeVietnamPro-Medium',
  'BeVietnamPro-SemiBold',
  'BeVietnamPro-ExtraBold',
  'Spectral-ExtraBold',
  'Spectral-ExtraBoldItalic',
] as const;

export type FaceKey = (typeof FACE_KEYS)[number];

/**
 * Spectral is bundled in one weight, because it exists for the Editorial pull
 * quote and a pull quote is never set light. A style asking for anything else
 * gets the weight that is there, in the slant it asked for.
 */
function serifKey(face: FaceSpec): FaceKey {
  return face.italic ? 'Spectral-ExtraBoldItalic' : 'Spectral-ExtraBold';
}

const SANS_BY_WEIGHT: Record<FontWeight, FaceKey> = {
  regular: 'BeVietnamPro-Medium',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-ExtraBold',
  extrabold: 'BeVietnamPro-ExtraBold',
};

export function faceKey(face: FaceSpec): FaceKey {
  if (face.family === SERIF_FAMILY) return serifKey(face);
  // An unknown family lands on the interface sans rather than on nothing. A
  // missing typeface draws no glyphs at all, which looks like lost captions.
  if (face.family !== SANS_FAMILY) return SANS_BY_WEIGHT.medium;
  return SANS_BY_WEIGHT[face.weight] ?? SANS_BY_WEIGHT.medium;
}
