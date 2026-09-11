/**
 * Getting a test clip into the rig. Throwaway.
 *
 * One picker for the whole test set and a short list of clips already used, so
 * running fifteen clips across three models does not mean fifteen trips through
 * the system file browser.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import SpikeMetrics from '../../modules/spike-metrics';

export type Clip = {
  uri: string;
  /** The provider's display name. Goes in the CSV unless the operator edits it. */
  name: string;
  sizeBytes: number;
};

/**
 * Video and bare audio in one picker. The test set is half mp4 and half wav or
 * mp3, and the pipeline never cared: audio-extract decodes whatever container
 * the platform can open, and the ASR only ever sees the PCM that comes out.
 *
 * The gallery picker cannot show either half. It lists MediaStore, so a file
 * copied onto the device by drag-and-drop or `adb push` is invisible to it until
 * something triggers a media scan, and it refuses audio outright.
 */
const MEDIA_MIME_TYPES = ['audio/*', 'video/*'];

/**
 * Android's document picker opens on Recent, which lists only what the media
 * scanner has indexed. A clip dropped onto the emulator was never scanned, so
 * Recent comes up empty and the file looks like it never arrived. Handing the
 * picker the Downloads tree opens it where drag-and-drop actually puts things.
 */
const DOWNLOADS_URI =
  'content://com.android.externalstorage.documents/document/primary%3ADownload';

const RECENT_LIMIT = 8;

/** Opens the system picker at Downloads. Resolves to null when cancelled. */
export async function pickClip(): Promise<Clip | null> {
  const picked = await File.pickFileAsync({
    mimeTypes: MEDIA_MIME_TYPES,
    initialUri: Platform.OS === 'android' ? DOWNLOADS_URI : undefined,
  });
  if (picked.canceled || !picked.result) return null;
  return describeClip(picked.result.uri);
}

/** Resolves a URI to a name and size. Falls back to the URI when the provider is silent. */
export async function describeClip(uri: string): Promise<Clip> {
  const info = await SpikeMetrics.describeSource(uri);
  return { uri, name: info.name || fallbackName(uri), sizeBytes: info.sizeBytes };
}

/** True when the URI can still be opened. A remembered clip can outlive its file. */
export async function isClipReadable(uri: string): Promise<boolean> {
  try {
    return (await SpikeMetrics.describeSource(uri)).readable;
  } catch {
    return false;
  }
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return 'size unknown';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ------------------------------------------------------------------ recents

/**
 * The picker takes a persistable read grant on every pick, so a remembered URI
 * still opens after the app is killed. That is what makes a recents list worth
 * keeping rather than re-picking each time.
 */
function recentsFile(): File {
  return new File(Paths.document, 'recent-clips.json');
}

export function loadRecentClips(): Clip[] {
  const file = recentsFile();
  if (!file.exists) return [];
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isClip).slice(0, RECENT_LIMIT);
  } catch {
    // A half-written file is not worth a crash on a throwaway rig.
    return [];
  }
}

/** Moves a clip to the front of the list and returns the new list. */
export function rememberClip(clip: Clip): Clip[] {
  const rest = loadRecentClips().filter((entry) => entry.uri !== clip.uri);
  return writeRecents([clip, ...rest].slice(0, RECENT_LIMIT));
}

export function forgetClip(uri: string): Clip[] {
  return writeRecents(loadRecentClips().filter((entry) => entry.uri !== uri));
}

function writeRecents(clips: Clip[]): Clip[] {
  const file = recentsFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(clips));
  return clips;
}

function isClip(value: unknown): value is Clip {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.uri === 'string' && typeof record.name === 'string';
}

/**
 * Last path segment, percent-decoded. A document URI ends in a provider id such
 * as `msf:1000000045`, so this is only ever a stopgap for when the provider
 * would not give up a display name.
 */
function fallbackName(uri: string): string {
  const segment = uri.split('/').pop() ?? uri;
  try {
    return decodeURIComponent(segment).split('/').pop() || segment;
  } catch {
    return segment;
  }
}
