import { NativeModule, requireNativeModule } from 'expo';

import type { ExtractedAudio } from './AudioExtract.types';

declare class AudioExtractModule extends NativeModule {
  /**
   * Decodes the first audio track of `sourceUri` and writes 16 kHz mono signed
   * 16-bit little-endian PCM to `destinationPath`.
   */
  extractPcm16(sourceUri: string, destinationPath: string): Promise<ExtractedAudio>;
}

export default requireNativeModule<AudioExtractModule>('AudioExtract');
