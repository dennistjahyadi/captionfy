/**
 * Id generation.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */
import type { IdFactory } from './types';

/**
 * A counter-backed id factory.
 *
 * Every function that has to invent a word takes one of these rather than
 * reaching for a module-level counter, because a shared counter would make the
 * same call produce different output on a second run and `layoutCaptionFrame`
 * has to be reproducible frame for frame.
 */
export function createIdFactory(prefix: string, start = 1): IdFactory {
  let next = start;
  return () => `${prefix}${next++}`;
}
