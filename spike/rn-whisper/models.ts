/**
 * Stage 0 model catalogue. Throwaway.
 *
 * The brief asks for q5_0 quantisations. The official ggerganov/whisper.cpp
 * repository does not publish any: the only 5-bit builds there are q5_1, which is
 * the same 5-bit weight budget with per-block minimums instead of a symmetric
 * scale, so it is marginally larger and marginally more accurate. q5_1 is used
 * here and the CSV records the exact filename, so nothing about the comparison is
 * ambiguous. `base` stays at q8_0 as specified.
 */
import { Directory, File, Paths } from 'expo-file-system';

const WHISPER_MODEL_HOST = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const VAD_MODEL_HOST = 'https://huggingface.co/ggml-org/whisper-vad/resolve/main';

export type ModelId = 'base.en-q8_0' | 'small.en-q5_1' | 'small-q5_1';

export type ModelSpec = {
  id: ModelId;
  fileName: string;
  url: string;
  approxMb: number;
  /** Passed to whisper as the `language` option. Multilingual models auto-detect. */
  language: 'en' | 'auto';
  multilingual: boolean;
  note: string;
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
    note: 'Low-end fallback candidate',
  },
  {
    id: 'small.en-q5_1',
    fileName: 'ggml-small.en-q5_1.bin',
    url: `${WHISPER_MODEL_HOST}/ggml-small.en-q5_1.bin`,
    approxMb: 190,
    language: 'en',
    multilingual: false,
    note: 'English-only ceiling, for comparison only. Not shippable: creators code-switch.',
  },
  {
    id: 'small-q5_1',
    fileName: 'ggml-small-q5_1.bin',
    url: `${WHISPER_MODEL_HOST}/ggml-small-q5_1.bin`,
    approxMb: 190,
    language: 'auto',
    multilingual: true,
    note: 'The candidate the pass/fail gate is about',
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
 * A half-written file from an interrupted download would load as a corrupt model,
 * so anything already present but implausibly small is discarded rather than reused.
 */
export async function ensureDownloaded(
  spec: DownloadableFile,
  onProgress?: (fraction: number) => void
): Promise<File> {
  const file = modelFile(spec);
  const minimumPlausibleBytes = spec.approxMb * 1024 * 1024 * 0.5;

  if (file.exists && file.size >= minimumPlausibleBytes) {
    onProgress?.(1);
    return file;
  }
  if (file.exists) file.delete();

  return File.downloadFileAsync(spec.url, file, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });
}
