/**
 * Stage 0 result log. Throwaway.
 *
 * One row per (clip, model). The transcript rides in the last column so word error
 * rate can be hand-counted straight from the file, and the same rows go to the
 * native `Caption` log tag so a release build can be read over adb without the
 * file ever leaving the device.
 */
import { Directory, File, Paths } from 'expo-file-system';

import SpikeMetrics from '../../modules/spike-metrics';
import type { ClipRun, ModelRun } from './runner';

const COLUMNS = [
  'started_at',
  'device',
  'soc',
  'os',
  'cores',
  'build',
  'clip',
  'tag',
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
] as const;

export const CSV_FILE_NAME = 'rig-a.csv';

export function resultsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'spike-results');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function csvFile(): File {
  return new File(resultsDirectory(), CSV_FILE_NAME);
}

/** Appends one row per model and mirrors each to logcat. Returns the rows written. */
export function appendRun(run: ClipRun): string[] {
  const rows = run.models.map((model) => toRow(run, model));
  const file = csvFile();

  const header = file.exists ? '' : `${COLUMNS.join(',')}\n`;
  if (!file.exists) file.create({ intermediates: true });
  file.write(`${header}${rows.map((row) => `${row}\n`).join('')}`, { append: true });

  SpikeMetrics.log(`CSV_HEADER ${COLUMNS.join(',')}`);
  rows.forEach((row) => SpikeMetrics.log(`CSV_ROW ${row}`));

  return rows;
}

function toRow(run: ClipRun, model: ModelRun): string {
  const clipSeconds = run.audio.durationMs / 1000;
  const transcribeSeconds = model.transcribeMs / 1000;
  const firstWord = model.words[0];
  const lastWord = model.words[model.words.length - 1];

  return [
    run.startedAt,
    run.device.model,
    run.device.soc,
    run.device.osVersion,
    run.device.cpuCores,
    run.buildType,
    run.clipName,
    run.clipTag,
    model.modelId,
    model.modelFileName,
    4,
    model.gpu ? 'yes' : 'no',
    clipSeconds.toFixed(2),
    (run.speechMs / 1000).toFixed(2),
    run.vadEnabled ? 'yes' : 'no',
    run.vadFellBack ? 'yes' : 'no',
    run.spans.length,
    run.chunks.length,
    run.detectLanguageOnce ? 'detect-once' : 'detect-per-chunk',
    run.audio.sourceSampleRate,
    run.audio.sourceChannelCount,
    run.extractMs,
    run.vadMs,
    model.transcribeMs,
    // The brief's budget is stated per 60 s of clip, so normalise to that.
    clipSeconds > 0 ? ((transcribeSeconds * 60) / clipSeconds).toFixed(1) : '',
    clipSeconds > 0 ? (transcribeSeconds / clipSeconds).toFixed(2) : '',
    model.peakRssMb,
    model.peakIsPerRun ? 'yes' : 'no',
    model.words.length,
    firstWord ? Math.round(firstWord.t0Ms) : '',
    lastWord ? Math.round(lastWord.t1Ms) : '',
    model.detectedLanguage,
    model.error ?? '',
    model.transcript,
  ]
    .map(escapeCell)
    .join(',');
}

function escapeCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Word-level timings, one JSON line per model run.
 *
 * Separate from the CSV because checking whether timestamps drift under music
 * means reading every word boundary, and that does not belong in a column.
 */
export function appendWords(run: ClipRun): void {
  const file = new File(resultsDirectory(), 'rig-a-words.jsonl');
  const lines = run.models.map((model) =>
    JSON.stringify({
      startedAt: run.startedAt,
      clip: run.clipName,
      tag: run.clipTag,
      model: model.modelId,
      device: run.device.model,
      build: run.buildType,
      words: model.words.map((word) => [word.text, Math.round(word.t0Ms), Math.round(word.t1Ms)]),
    })
  );

  if (!file.exists) file.create({ intermediates: true });
  file.write(lines.map((line) => `${line}\n`).join(''), { append: true });
}
