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
 * Which frame of a span stands for how loud that span was.
 *
 * Three quarters up, settled by measurement on the Stage 0 clips rather than by
 * argument. Whisper's word boundaries are loose, so a word span carries the
 * quiet either side of the sound, and on a slow speaker most of a span is that
 * quiet. A mean reads the silence as part of the word; a median lands in it
 * outright, which put the clip reference on the noise floor and left 32 words in
 * 72 pinned at the loudness cap. At three quarters the top decile of a clip sits
 * between 4 and 7 dB over the reference on all four clips, fast talkers and slow,
 * which is the spread the scoring weights were written for. Higher still, at the
 * ninth decile, the spread collapses and loudness stops telling words apart.
 */
export const SPAN_LEVEL_PERCENTILE = 0.75;

/** How loud a span was. Zero when the range holds no frame. */
export function spanLevel(envelope: Float32Array, startMs: Ms, endMs: Ms): number {
  const from = Math.max(0, frameIndexAt(startMs));
  const to = Math.min(envelope.length, Math.max(from + 1, frameIndexAt(endMs)));
  if (from >= envelope.length) return 0;

  const levels = Array.from(envelope.subarray(from, to)).sort((a, b) => a - b);
  return levels[Math.min(levels.length - 1, Math.floor((levels.length - 1) * SPAN_LEVEL_PERCENTILE))];
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
 * The typical loudness of speech in a clip: the middle span, by `spanLevel`.
 *
 * Spans, not the whole clip, so a music-only intro or a long silence cannot drag
 * the reference down and make ordinary speech look shouted.
 *
 * Each span is reduced to one level before they are compared, rather than
 * pooling every frame into one list. Pooling would weight a long word more
 * heavily than a short one, and would measure the reference differently from the
 * way a single word is measured against it. Same statistic on both sides is what
 * makes "three decibels over the median" mean the same thing on every clip.
 */
export function speechMedian(envelope: Float32Array, spans: { start: Ms; end: Ms }[]): number {
  const levels = spans
    .map((span) => spanLevel(envelope, span.start, span.end))
    .filter((level) => level > 0)
    .sort((a, b) => a - b);

  if (levels.length === 0) return 0;
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
