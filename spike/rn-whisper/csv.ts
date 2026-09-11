/**
 * Stage 0 result log. Throwaway.
 *
 * One row per (clip, model). The transcript rides in the second-to-last column so
 * word error rate can be hand-counted straight from the file, with a free-text
 * `notes` column after it, and the same rows go to the native `Caption` log tag so
 * a release build can be read over adb without the file ever leaving the device.
 *
 * The row shape itself lives in `row.ts`, which has no native imports and is unit
 * tested. This file only decides where the bytes go.
 */
import { Directory, File, Paths } from 'expo-file-system';

import SpikeMetrics from '../../modules/spike-metrics';
import { assertCsvShape, HEADER_LINE, toRow, toRowLine } from './row';
import type { ClipRun } from './runner';

export const CSV_FILE_NAME = 'rig-a.csv';

// Fails at import time, which is app launch, rather than after a session of runs.
assertCsvShape();

export function resultsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'spike-results');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function csvFile(): File {
  return new File(resultsDirectory(), CSV_FILE_NAME);
}

/** Appends one row per model and mirrors each to logcat. Returns the rows written. */
export function appendRun(run: ClipRun, onLog?: (message: string) => void): string[] {
  const rows = run.models.map((model) => toRowLine(toRow(run, model)));
  const file = ensureCurrentCsv(onLog);

  file.write(`${rows.map((row) => `${row}\n`).join('')}`, { append: true });

  SpikeMetrics.log(`CSV_HEADER ${HEADER_LINE}`);
  rows.forEach((row) => SpikeMetrics.log(`CSV_ROW ${row}`));

  return rows;
}

/**
 * Returns a CSV whose header is the header this build writes.
 *
 * This is the round 1 bug. The header was only ever written when the file did not
 * exist, so a CSV created by an older build kept its old header while newer,
 * wider rows were appended under it, and every column past the drift point read
 * as the wrong field. A file with a stale header is moved aside rather than
 * appended to; the old rows are left exactly as they were.
 */
function ensureCurrentCsv(onLog?: (message: string) => void): File {
  const file = csvFile();

  if (file.exists) {
    const firstLine = file.textSync().split('\n', 1)[0]?.trim() ?? '';
    if (firstLine === HEADER_LINE) return file;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedName = `rig-a-${stamp}.csv`;
    file.rename(archivedName);
    onLog?.(
      `existing ${CSV_FILE_NAME} has a header from an older build; ` +
        `moved to ${archivedName} and started a new file`
    );
  }

  const fresh = csvFile();
  fresh.create({ intermediates: true });
  fresh.write(`${HEADER_LINE}\n`);
  return fresh;
}

/**
 * Word-level timings, one file per model run, named `<clip>-<model>.words.json`.
 *
 * Separate from the CSV because seeing whether timestamps drift under a music bed
 * means reading every word boundary, and that does not belong in a column. One
 * file per run rather than one shared log so a clip can be opened on its own.
 *
 * Each word carries both timings so one run answers which method drifts less:
 * `t0`/`t1` from whisper.cpp's heuristic, `dtw_t0`/`dtw_t1` from DTW over the
 * cross-attention. The DTW pair is null when DTW did not run.
 *
 * Returns the files written.
 */
export function writeWordFiles(run: ClipRun): File[] {
  return run.models.map((model) => {
    const file = new File(resultsDirectory(), wordFileName(run.clipName, model.modelId));
    if (file.exists) file.delete();
    file.create({ intermediates: true });
    // All values are milliseconds from the start of the clip, not of the chunk.
    file.write(
      JSON.stringify(
        model.words.map((word, index) => {
          const dtw = model.dtw ? model.dtwWords[index] : undefined;
          return {
            word: word.text,
            t0: Math.round(word.t0Ms),
            t1: Math.round(word.t1Ms),
            dtw_t0: dtw ? Math.round(dtw.t0Ms) : null,
            dtw_t1: dtw ? Math.round(dtw.t1Ms) : null,
          };
        })
      )
    );
    return file;
  });
}

/** `<clip>-<model>.words.json`, with anything a filesystem would object to removed. */
export function wordFileName(clipName: string, modelId: string): string {
  return `${safeName(clipName)}-${safeName(modelId)}.words.json`;
}

function safeName(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}
