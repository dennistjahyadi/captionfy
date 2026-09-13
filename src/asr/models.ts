/**
 * The two model files the product needs.
 *
 * One transcription model, decided by the Stage 0 spike, and the VAD that gates
 * it. Both ride inside the APK: 83 MB on top of a 63 MB app is an install of
 * about 145 MB, and it buys an app that has never once needed the network. The
 * first-launch download was the largest thing that could go wrong in the product
 * and the only screen that existed to watch something fail.
 *
 * whisper.rn opens a bundled model through Android's AssetManager and streams it
 * into the same buffer a file path would have filled, so nothing is unpacked to
 * disk and there is no second copy of 82 MB on the user's phone.
 */
import { Directory, File, Paths } from 'expo-file-system';

export interface ModelFile {
  /** The name inside the APK's assets, which is the name in `assets/models`. */
  assetName: string;
}

/**
 * `base.en-q8_0`. English-only, which is the whole of v1's scope.
 *
 * Round 1 measured multilingual `small-q5_1` against this and it lost on both
 * axes: four times slower, and wrong on the names the English-only models got
 * right. See README for the evidence.
 */
export const WHISPER_MODEL: ModelFile = { assetName: 'ggml-base.en-q8_0.bin' };

export const VAD_MODEL: ModelFile = { assetName: 'ggml-silero-v6.2.0.bin' };

export const REQUIRED_MODELS = [WHISPER_MODEL, VAD_MODEL];

/**
 * whisper.cpp's alignment-heads preset. Must match the weights: the heads are
 * model-specific and a wrong set gives timestamps that look plausible and are not.
 */
export const DTW_PRESET = 'base.en' as const;

/**
 * How whisper.rn is told to look inside the APK rather than on the filesystem.
 *
 * Its Android side answers `isBundleAsset` with `AAssetManager_open` on this
 * exact string, so it is the asset name and nothing else — no scheme, no
 * directory.
 */
export function bundledModel(model: ModelFile): { filePath: string; isBundleAsset: true } {
  return { filePath: model.assetName, isBundleAsset: true };
}

/**
 * Throws away the models an older build downloaded.
 *
 * Every install before this one fetched 83 MB into `models/` on first run. Those
 * files are now dead weight that the user cannot see and would never think to
 * delete. That directory only ever held the two weights and their `.part` files,
 * and projects live nowhere near it. A failure is swallowed: the app works
 * whether or not the disk is tidy.
 */
export function pruneDownloadedModels(): void {
  try {
    const directory = new Directory(Paths.document, 'models');
    if (!directory.exists) return;

    for (const entry of directory.list()) {
      if (entry instanceof File) entry.delete();
    }
    directory.delete();
  } catch {
    // Nothing here is worth a failed launch.
  }
}
