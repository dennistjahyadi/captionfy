/**
 * The energy envelope: how loud the speaker was, frame by frame.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Computed once from the PCM that ASR already decoded, and used twice: it is the
 * signal behind automatic emphasis, and it is the waveform the timing sheet
 * draws. Decoding the audio a second time to draw a waveform would be paying
 * twice for something already in memory.
 */
import type { Ms } from './types';

/**
 * One envelope frame per 10 ms.
 *
 * Fine enough that an 80 ms word still has eight frames to average, coarse
 * enough that a minute of audio is 6,000 floats rather than a million.
 */
export const ENVELOPE_FRAME_MS = 10;

/** Level used for a frame with no signal at all, so a log never sees zero. */
export const SILENCE_FLOOR_DB = -60;

/** Root mean square amplitude per 10 ms frame. */
export function computeEnvelope(pcm: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate <= 0) throw new Error('sampleRate must be positive');

  const perFrame = Math.max(1, Math.round((sampleRate * ENVELOPE_FRAME_MS) / 1000));
  const frames = Math.ceil(pcm.length / perFrame);
  const envelope = new Float32Array(frames);

  for (let frame = 0; frame < frames; frame += 1) {
    const from = frame * perFrame;
    const to = Math.min(from + perFrame, pcm.length);
    let sum = 0;
    for (let index = from; index < to; index += 1) sum += pcm[index] * pcm[index];
    envelope[frame] = Math.sqrt(sum / Math.max(1, to - from));
  }

  return envelope;
}

/**
 * The same thing straight off signed 16-bit PCM.
 *
 * `audio-extract` produces s16le and that is what whisper.rn wants, so this is
 * the shape the bytes are already in. Squaring in place spares a second buffer
 * the size of the whole clip, which on a three-minute video is 11 MB of float32
 * that never needs to exist.
 */
export function computeEnvelopeFromPcm16(pcm: Int16Array, sampleRate: number): Float32Array {
  if (sampleRate <= 0) throw new Error('sampleRate must be positive');

  const perFrame = Math.max(1, Math.round((sampleRate * ENVELOPE_FRAME_MS) / 1000));
  const frames = Math.ceil(pcm.length / perFrame);
  const envelope = new Float32Array(frames);
  const scale = 1 / 32_768;

  for (let frame = 0; frame < frames; frame += 1) {
    const from = frame * perFrame;
    const to = Math.min(from + perFrame, pcm.length);
    let sum = 0;
    for (let index = from; index < to; index += 1) {
      const sample = pcm[index] * scale;
      sum += sample * sample;
    }
    envelope[frame] = Math.sqrt(sum / Math.max(1, to - from));
  }

  return envelope;
}

export function frameIndexAt(tMs: Ms): number {
  return Math.floor(tMs / ENVELOPE_FRAME_MS);
}

export function envelopeDurationMs(envelope: Float32Array): Ms {
  return envelope.length * ENVELOPE_FRAME_MS;
}

/** Mean frame energy over `[startMs, endMs)`. Zero when the range holds no frame. */
export function meanEnergy(envelope: Float32Array, startMs: Ms, endMs: Ms): number {
  const from = Math.max(0, frameIndexAt(startMs));
  const to = Math.min(envelope.length, Math.max(from + 1, frameIndexAt(endMs)));
  if (from >= envelope.length) return 0;

  let sum = 0;
  for (let index = from; index < to; index += 1) sum += envelope[index];
  return sum / (to - from);
}

/**
 * A level as decibels relative to a reference.
 *
 * Floored rather than allowed to reach negative infinity, because a silent frame
 * inside a word is a measurement, not an error, and every consumer would
 * otherwise have to guard against it.
 */
export function toDb(level: number, reference: number): number {
  if (level <= 0 || reference <= 0) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(level / reference));
}

/**
 * The median frame energy inside the given spans.
 *
 * Spans, not the whole clip, so a music-only intro or a long silence cannot drag
 * the reference down and make ordinary speech look shouted.
 */
export function speechMedian(envelope: Float32Array, spans: { start: Ms; end: Ms }[]): number {
  const levels: number[] = [];

  for (const span of spans) {
    const from = Math.max(0, frameIndexAt(span.start));
    const to = Math.min(envelope.length, frameIndexAt(span.end));
    for (let index = from; index < to; index += 1) levels.push(envelope[index]);
  }

  if (levels.length === 0) return 0;
  levels.sort((a, b) => a - b);
  const middle = levels.length >> 1;
  return levels.length % 2 === 1 ? levels[middle] : (levels[middle - 1] + levels[middle]) / 2;
}

/**
 * Peaks for a waveform view, one per bucket across `[startMs, endMs)`.
 *
 * The timing sheet draws a fixed window around a word, so it asks for exactly as
 * many buckets as it has pixels rather than reading the envelope directly.
 * Buckets take the maximum rather than the mean, because a waveform drawn from
 * means looks flat and a user judging where a word starts needs the attack.
 */
export function peaksForRange(
  envelope: Float32Array,
  startMs: Ms,
  endMs: Ms,
  buckets: number
): Float32Array {
  const peaks = new Float32Array(Math.max(0, Math.round(buckets)));
  if (peaks.length === 0 || endMs <= startMs) return peaks;

  const from = frameIndexAt(startMs);
  const to = frameIndexAt(endMs);
  const perBucket = (to - from) / peaks.length;

  for (let bucket = 0; bucket < peaks.length; bucket += 1) {
    const first = Math.floor(from + bucket * perBucket);
    const last = Math.max(first + 1, Math.floor(from + (bucket + 1) * perBucket));
    let peak = 0;
    for (let index = first; index < last; index += 1) {
      if (index < 0 || index >= envelope.length) continue;
      if (envelope[index] > peak) peak = envelope[index];
    }
    peaks[bucket] = peak;
  }

  return peaks;
}
