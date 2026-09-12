/**
 * The two model files the product needs.
 *
 * One transcription model, decided by the Stage 0 spike, and the VAD that gates
 * it. Neither is bundled: together they are 85 MB, which is most of an install,
 * and they are fetched once on first launch. That download is the only time the
 * app needs the network.
 */
import { Directory, File, Paths } from 'expo-file-system';

const WHISPER_HOST = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const VAD_HOST = 'https://huggingface.co/ggml-org/whisper-vad/resolve/main';

export interface ModelFile {
  fileName: string;
  url: string;
  /** Shown on the first-launch screen. Also the sanity check on a finished download. */
  approxBytes: number;
}

/**
 * `base.en-q8_0`. English-only, which is the whole of v1's scope.
 *
 * Round 1 measured multilingual `small-q5_1` against this and it lost on both
 * axes: four times slower, and wrong on the names the English-only models got
 * right. See README for the evidence.
 */
export const WHISPER_MODEL: ModelFile = {
  fileName: 'ggml-base.en-q8_0.bin',
  url: `${WHISPER_HOST}/ggml-base.en-q8_0.bin`,
  approxBytes: 82 * 1024 * 1024,
};

export const VAD_MODEL: ModelFile = {
  fileName: 'ggml-silero-v6.2.0.bin',
  url: `${VAD_HOST}/ggml-silero-v6.2.0.bin`,
  approxBytes: 3 * 1024 * 1024,
};

export const REQUIRED_MODELS = [WHISPER_MODEL, VAD_MODEL];

/**
 * whisper.cpp's alignment-heads preset. Must match the weights: the heads are
 * model-specific and a wrong set gives timestamps that look plausible and are not.
 */
export const DTW_PRESET = 'base.en' as const;

function modelsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'models');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function modelFile(model: ModelFile): File {
  return new File(modelsDirectory(), model.fileName);
}

/**
 * True when the file is present and plausibly whole.
 *
 * Size rather than a checksum. Hashing 82 MB on a mid-range phone at every
 * launch costs more than it is worth, and the `.part` rename below already
 * guarantees that a file at the real name is a file that finished. The size
 * check is what catches a file truncated by something other than us.
 */
export function isReady(model: ModelFile): boolean {
  const file = modelFile(model);
  return file.exists && file.size > model.approxBytes * 0.9;
}

export function allModelsReady(): boolean {
  return REQUIRED_MODELS.every(isReady);
}

export function totalDownloadBytes(): number {
  return REQUIRED_MODELS.filter((model) => !isReady(model)).reduce(
    (total, model) => total + model.approxBytes,
    0
  );
}

/**
 * Downloads a model if it is not already on disk.
 *
 * On Android the response body streams straight into the destination, so a
 * download that dies partway leaves a truncated file behind. That file passes an
 * existence check and then fails deep inside whisper's loader, which reads as a
 * mysteriously empty transcript. Downloading under a `.part` name and renaming
 * on success means a file at the real name is always a file that finished.
 */
export async function ensureModel(
  model: ModelFile,
  onProgress?: (fraction: number) => void
): Promise<File> {
  if (isReady(model)) {
    onProgress?.(1);
    return modelFile(model);
  }

  const target = modelFile(model);
  if (target.exists) target.delete();

  const partial = new File(modelsDirectory(), `${model.fileName}.part`);
  if (partial.exists) partial.delete();

  const downloaded = await File.downloadFileAsync(model.url, partial, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });

  downloaded.rename(model.fileName);
  return modelFile(model);
}

/** Fetches whatever is missing, reporting one fraction across all of it. */
export async function ensureAllModels(onProgress?: (fraction: number) => void): Promise<void> {
  const missing = REQUIRED_MODELS.filter((model) => !isReady(model));
  if (missing.length === 0) {
    onProgress?.(1);
    return;
  }

  const total = missing.reduce((sum, model) => sum + model.approxBytes, 0);
  let done = 0;

  for (const model of missing) {
    await ensureModel(model, (fraction) => onProgress?.((done + fraction * model.approxBytes) / total));
    done += model.approxBytes;
  }

  onProgress?.(1);
}
