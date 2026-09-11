/**
 * Stage 0 model catalogue. Throwaway.
 *
 * The brief asks for q5_0 quantisations. The official ggerganov/whisper.cpp
 * repository does not publish any: the only 5-bit builds there are q5_1, which is
 * the same 5-bit weight budget with per-block minimums instead of a symmetric
 * scale, so it is marginally larger and marginally more accurate. q5_1 is used
 * here and the CSV records the exact filename, so nothing about the comparison is
 * ambiguous. `base` stays at q8_0 as specified.
 *
 * Round 2 runs two models. Multilingual `small-q5_1` is gone: on round 1's
 * accented clip it scored worse than `base.en-q8_0` and took four times as long,
 * so there is nothing left to learn from it.
 */
import { Directory, File, Paths } from 'expo-file-system';

const WHISPER_MODEL_HOST = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const VAD_MODEL_HOST = 'https://huggingface.co/ggml-org/whisper-vad/resolve/main';

export type ModelId = 'base.en-q8_0' | 'small.en-q5_1';

export type ModelSpec = {
  id: ModelId;
  fileName: string;
  url: string;
  approxMb: number;
  /** Passed to whisper as the `language` option. Multilingual models auto-detect. */
  language: 'en' | 'auto';
  multilingual: boolean;
  note: string;
  /** Cannot be deselected. Round 2 is about this model; the other is a reference. */
  alwaysRun: boolean;
};

/** Run order matters: cheapest model first, so a device that OOMs still yields rows. */
export const MODELS: ModelSpec[] = [
  {
    id: 'base.en-q8_0',
    fileName: 'ggml-base.en-q8_0.bin',
    url: `${WHISPER_MODEL_HOST}/ggml-base.en-q8_0.bin`,
    approxMb: 82,
    language: 'en',
    multilingual: false,
    note: 'The production candidate. Runs on every clip.',
    alwaysRun: true,
  },
  {
    id: 'small.en-q5_1',
    fileName: 'ggml-small.en-q5_1.bin',
    url: `${WHISPER_MODEL_HOST}/ggml-small.en-q5_1.bin`,
    approxMb: 190,
    language: 'en',
    multilingual: false,
    note: 'Accuracy ceiling reference. Shows what base gives up, not a shipping candidate.',
    alwaysRun: false,
  },
];

/** Everything needed to fetch a file. A transcription model is this plus how to run it. */
export type DownloadableFile = Pick<ModelSpec, 'fileName' | 'url' | 'approxMb'>;

export const VAD_MODEL: DownloadableFile = {
  fileName: 'ggml-silero-v6.2.0.bin',
  url: `${VAD_MODEL_HOST}/ggml-silero-v6.2.0.bin`,
  approxMb: 3,
};

export function modelsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'models');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function modelFile(spec: Pick<ModelSpec, 'fileName'>): File {
  return new File(modelsDirectory(), spec.fileName);
}

export function isDownloaded(spec: Pick<ModelSpec, 'fileName'>): boolean {
  const file = modelFile(spec);
  return file.exists && file.size > 0;
}

/**
 * Downloads a model if it is not already on disk.
 *
 * On Android the response body streams straight into the destination, so a
 * download that dies partway leaves a truncated file behind. That file passes an
 * existence check and then fails deep inside whisper's loader, which is how one
 * model in a batch silently produces an empty transcript. Downloading under a
 * `.part` name and renaming on success means a file at the real name is always
 * a file that finished.
 */
export async function ensureDownloaded(
  spec: DownloadableFile,
  onProgress?: (fraction: number) => void
): Promise<File> {
  const file = modelFile(spec);
  if (file.exists && file.size > 0) {
    onProgress?.(1);
    return file;
  }
  if (file.exists) file.delete();

  const partial = new File(modelsDirectory(), `${spec.fileName}.part`);
  if (partial.exists) partial.delete();

  const downloaded = await File.downloadFileAsync(spec.url, partial, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });

  downloaded.rename(spec.fileName);
  return modelFile(spec);
}
