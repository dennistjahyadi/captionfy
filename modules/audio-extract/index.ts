import AudioExtractModule from './src/AudioExtractModule';
import type { ExtractedAudio } from './src/AudioExtract.types';

export type { ExtractedAudio };

/**
 * Decodes the first audio track of a video or audio file to 16 kHz mono signed
 * 16-bit little-endian PCM and writes it to `destinationPath`.
 *
 * This is the only audio path in the app. Every engine, in the spike and in the
 * shipped product, receives the bytes this produces.
 */
export function extractPcm16(
  sourceUri: string,
  destinationPath: string
): Promise<ExtractedAudio> {
  return AudioExtractModule.extractPcm16(sourceUri, destinationPath);
}
