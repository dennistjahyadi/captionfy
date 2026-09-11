/**
 * The one definition of a rig-a.csv row. Throwaway.
 *
 * Pure TypeScript, no native imports, so the shape can be checked off-device.
 *
 * Round 1 emitted shifted rows. The header and the values were two parallel
 * arrays, and although the commit that added `chunks` and `lang_mode` did add
 * them to both, the CSV already on the phone kept the 32-column header it was
 * created with while the new build appended 34-value rows underneath it. Two
 * things guard against a repeat: values are keyed by column name here, so a
 * value cannot land in a neighbouring column whatever the list does, and
 * `assertRowShape` runs at startup rather than after a session of runs.
 */
import type { ClipRun, ModelRun } from './runner';

export const COLUMNS = [
  'started_at',
  'device',
  'soc',
  'os',
  'cores',
  'build',
  'clip',
  'noise_tag',
  'model',
  'model_file',
  'threads',
  'gpu',
  'clip_seconds',
  'speech_seconds',
  'vad_enabled',
  'vad_fell_back',
  'vad_spans',
  'chunks',
  'lang_mode',
  'source_hz',
  'source_channels',
  'extract_ms',
  'vad_ms',
  'transcribe_ms',
  'seconds_per_60s',
  'realtime_factor',
  'peak_rss_mb',
  'peak_is_per_run',
  'words',
  'first_word_ms',
  'last_word_ms',
  'language',
  'error',
  'transcript',
  'notes',
] as const;

export type Column = (typeof COLUMNS)[number];

/** Every column, by name. A missing key is a type error before it is a bad CSV. */
export type Row = Record<Column, string | number>;

export const HEADER_LINE = COLUMNS.join(',');

export function toRow(run: ClipRun, model: ModelRun): Row {
  const clipSeconds = run.audio.durationMs / 1000;
  const transcribeSeconds = model.transcribeMs / 1000;
  const firstWord = model.words[0];
  const lastWord = model.words[model.words.length - 1];

  return {
    started_at: run.startedAt,
    device: run.device.model,
    soc: run.device.soc,
    os: run.device.osVersion,
    cores: run.device.cpuCores,
    build: run.buildLabel,
    clip: run.clipName,
    noise_tag: run.noiseTag,
    model: model.modelId,
    model_file: model.modelFileName,
    threads: run.maxThreads,
    gpu: model.gpu ? 'yes' : 'no',
    clip_seconds: clipSeconds.toFixed(2),
    speech_seconds: (run.speechMs / 1000).toFixed(2),
    vad_enabled: run.vadEnabled ? 'yes' : 'no',
    vad_fell_back: run.vadFellBack ? 'yes' : 'no',
    vad_spans: run.spans.length,
    chunks: run.chunks.length,
    lang_mode: run.detectLanguageOnce ? 'detect-once' : 'detect-per-chunk',
    source_hz: run.audio.sourceSampleRate,
    source_channels: run.audio.sourceChannelCount,
    extract_ms: run.extractMs,
    vad_ms: run.vadMs,
    transcribe_ms: model.transcribeMs,
    // The brief's budget is stated per 60 s of clip, so normalise to that.
    seconds_per_60s: clipSeconds > 0 ? ((transcribeSeconds * 60) / clipSeconds).toFixed(1) : '',
    realtime_factor: clipSeconds > 0 ? (transcribeSeconds / clipSeconds).toFixed(2) : '',
    peak_rss_mb: model.peakRssMb,
    peak_is_per_run: model.peakIsPerRun ? 'yes' : 'no',
    words: model.words.length,
    first_word_ms: firstWord ? Math.round(firstWord.t0Ms) : '',
    last_word_ms: lastWord ? Math.round(lastWord.t1Ms) : '',
    language: model.detectedLanguage,
    error: model.error ?? '',
    transcript: model.transcript,
    // Left empty by the rig. It is the operator's column, for WER counts and
    // anything about the clip that the rig cannot know.
    notes: '',
  };
}

/** One CSV line, columns in header order. Throws rather than emit a short row. */
export function toRowLine(row: Row): string {
  assertRowShape(row);
  return COLUMNS.map((column) => escapeCell(row[column])).join(',');
}

/**
 * Fails loudly when the header and a row have drifted apart.
 *
 * A shifted CSV is worse than no CSV: round 1's looked fine until the transcript
 * column turned out to hold a language code, and by then the runs were over.
 */
export function assertRowShape(row: Row): void {
  const keys = Object.keys(row);
  const missing = COLUMNS.filter((column) => !(column in row));
  const extra = keys.filter((key) => !(COLUMNS as readonly string[]).includes(key));

  if (missing.length > 0 || extra.length > 0 || keys.length !== COLUMNS.length) {
    throw new Error(
      `rig-a.csv row does not match the header: ${COLUMNS.length} columns, ${keys.length} values.` +
        (missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : '') +
        (extra.length > 0 ? ` Not in the header: ${extra.join(', ')}.` : '')
    );
  }
}

/**
 * Startup self-check. Called when the rig loads so a header/row mismatch stops
 * the app before a clip is run, not after seven of them.
 */
export function assertCsvShape(): void {
  const duplicates = COLUMNS.filter((column, index) => COLUMNS.indexOf(column) !== index);
  if (duplicates.length > 0) {
    throw new Error(`rig-a.csv header has duplicate columns: ${duplicates.join(', ')}`);
  }
  assertRowShape(toRow(SAMPLE_RUN, SAMPLE_RUN.models[0]));
}

function escapeCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A run with every field populated, used by the startup check and the unit test.
 * Real enough to exercise `toRow`; the numbers mean nothing.
 */
export const SAMPLE_RUN: ClipRun = {
  startedAt: '2026-09-11T00:00:00.000Z',
  clipName: 'sample',
  noiseTag: 'music-under-voice',
  device: {
    label: 'sample / sample / arm64-v8a',
    model: 'samsung SM-A546E',
    soc: 'Samsung s5e8835',
    osVersion: 'Android 14 (API 34)',
    abi: 'arm64-v8a',
    cpuCores: 8,
    totalRamMb: 7500,
  },
  buildLabel: 'release',
  isEmulator: false,
  maxThreads: 4,
  audio: {
    path: '/sample.pcm',
    sampleRate: 16_000,
    channelCount: 1,
    sampleCount: 160_000,
    durationMs: 10_000,
    sourceSampleRate: 44_100,
    sourceChannelCount: 2,
    byteLength: 320_000,
  },
  extractMs: 120,
  vadEnabled: true,
  vadMs: 200,
  spans: [{ t0Ms: 0, t1Ms: 5_000 }],
  chunks: [{ t0Ms: 0, t1Ms: 5_000 }],
  vadFellBack: false,
  speechMs: 5_000,
  detectLanguageOnce: true,
  models: [
    {
      modelId: 'base.en-q8_0',
      modelFileName: 'ggml-base.en-q8_0.bin',
      gpu: false,
      reasonNoGpu: 'not supported on Android',
      detectedLanguage: 'en',
      words: [{ text: 'sample', t0Ms: 0, t1Ms: 400 }],
      transcript: 'sample',
      transcribeMs: 2_000,
      peakRssMb: 400,
      peakIsPerRun: true,
    },
  ],
};
