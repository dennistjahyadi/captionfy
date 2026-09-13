/**
 * The only place whisper.rn is called.
 *
 * Every screen and every pipeline step goes through here, so the awkward parts
 * of the binding are stated once: centiseconds at the boundary, signed 16-bit
 * PCM rather than the float32 the README claims, one segment per token, and the
 * local patch that turns on DTW timestamps and per-token probabilities.
 */
import { Platform } from 'react-native';
import {
  initWhisper,
  initWhisperVad,
  type TranscribeOptions,
  type WhisperContext,
} from 'whisper.rn';

import { mergeTokensIntoWords, offsetWords, type AsrWord, type Span } from '../domain';
import { bundledModel, DTW_PRESET, VAD_MODEL, WHISPER_MODEL } from './models';

export const SAMPLE_RATE = 16_000;
const BYTES_PER_SAMPLE = 2;

/**
 * whisper.cpp reports every timestamp in centiseconds, for VAD spans as well as
 * transcription segments. At 16 kHz one centisecond is exactly 160 samples, so a
 * span boundary lands on a sample boundary with no rounding.
 */
const BYTES_PER_CENTISECOND = (SAMPLE_RATE / 100) * BYTES_PER_SAMPLE;

/**
 * whisper's encoder runs at a fixed 1500 mel frames, 30 seconds, whatever the
 * call actually contains. Chunks pack up to just under that so no call pays for
 * an internal split and no call wastes a window.
 */
export const MAX_CHUNK_MS = 28_000;

/** Spans this short carry no word and cost a full encoder pass. */
export const MIN_SPAN_MS = 120;

/** whisper.rn defaults to two threads on a four-core phone, halving throughput. */
const MAX_THREADS = 4;

/** whisper.rn only accelerates on Apple hardware; asking elsewhere costs a failed init. */
const useGpu = Platform.OS === 'ios';

const VAD_OPTIONS = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 100,
  maxSpeechDurationS: MAX_CHUNK_MS / 1000,
  // The default 30 ms clips the plosive off the front of a word.
  speechPadMs: 100,
  samplesOverlap: 0.1,
};

export function msToByteOffset(ms: number): number {
  return Math.round(ms / 10) * BYTES_PER_CENTISECOND;
}

export function pcmDurationMs(byteLength: number): number {
  return Math.round((byteLength / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000);
}

/** Speech spans, in milliseconds from the start of the clip. */
export async function detectSpeech(pcm: ArrayBuffer): Promise<Span[]> {
  const context = await initWhisperVad({
    ...bundledModel(VAD_MODEL),
    useGpu,
    nThreads: MAX_THREADS,
  });

  try {
    const segments = await context.detectSpeechData(pcm, VAD_OPTIONS);
    return segments.map((segment) => ({
      t0Ms: Math.round(segment.t0 * 10),
      t1Ms: Math.round(segment.t1 * 10),
    }));
  } finally {
    await context.release();
  }
}

export async function openWhisper(): Promise<WhisperContext> {
  return initWhisper({
    ...bundledModel(WHISPER_MODEL),
    useGpu,
    // A local patch to whisper.rn. Turns on whisper.cpp's DTW token timestamps
    // and returns a probability per token, which is the low-confidence signal.
    dtwAheadsPreset: DTW_PRESET,
  });
}

export interface ChunkResult {
  words: AsrWord[];
  aborted: boolean;
}

export interface ChunkHandle {
  /** Resolves when the chunk is done, or immediately when it is stopped. */
  promise: Promise<ChunkResult>;
  stop: () => Promise<void>;
}

/**
 * Transcribes one packed chunk and returns words on the clip's own timeline.
 *
 * `maxLen: 1` with `tokenTimestamps` makes whisper emit one segment per token,
 * which is the only way word-level timing comes out of this binding at all. The
 * tokens are merged back into words here rather than anywhere downstream, so
 * nothing else has to know that " recog", "ni", "tion" was ever three things.
 */
export function transcribeChunk(
  context: WhisperContext,
  pcm: ArrayBuffer,
  chunk: Span,
  options: { prompt?: string; onProgress?: (percent: number) => void } = {}
): ChunkHandle {
  const slice = pcm.slice(
    msToByteOffset(chunk.t0Ms),
    Math.min(msToByteOffset(chunk.t1Ms), pcm.byteLength)
  );

  const transcribeOptions: TranscribeOptions & {
    onProgress?: (progress: number) => void;
  } = {
    language: 'en',
    translate: false,
    maxThreads: MAX_THREADS,
    maxLen: 1,
    tokenTimestamps: true,
    onProgress: options.onProgress,
  };
  // whisper.cpp treats an empty prompt differently from no prompt.
  if (options.prompt) transcribeOptions.prompt = options.prompt;

  const task = context.transcribeData(slice, transcribeOptions);

  return {
    stop: task.stop,
    promise: task.promise.then((result) => {
      if (result.isAborted) return { words: [], aborted: true };

      const tokens = result.segments.map((segment) => ({
        text: segment.text,
        t0Ms: segment.t0 * 10,
        t1Ms: segment.t1 * 10,
        // The patch surfaces whisper.cpp's per-token probability. A word carries
        // its least confident token, which is what the transcript flags.
        p: segment.tokens[0]?.p,
      }));

      return { words: offsetWords(mergeTokensIntoWords(tokens), chunk.t0Ms), aborted: false };
    }),
  };
}
