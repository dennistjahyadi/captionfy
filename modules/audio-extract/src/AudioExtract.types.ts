/** Result of decoding a media file down to the one PCM format every engine consumes. */
export type ExtractedAudio = {
  /** Absolute path to the raw 16 kHz mono signed 16-bit little-endian PCM file. */
  path: string;
  /** Always 16000. Present so callers never hard-code it. */
  sampleRate: number;
  /** Always 1. */
  channelCount: number;
  /** Number of 16-bit samples written. */
  sampleCount: number;
  durationMs: number;
  /** Sample rate of the source audio track, for diagnostics. */
  sourceSampleRate: number;
  /** Channel count of the source audio track, for diagnostics. */
  sourceChannelCount: number;
  byteLength: number;
};
