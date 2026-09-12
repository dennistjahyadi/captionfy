/**
 * The video a project is made from, kept where the project can still find it.
 *
 * The picker does not hand back the file in the gallery. It hands back a copy it
 * made in this app's cache, which Android is free to delete whenever it wants
 * the space back. A project pointing at that copy plays for an afternoon and
 * then opens on a black rectangle with a transcript it can no longer show over
 * anything, which is invariant 3 broken by the operating system rather than by a
 * crash. So the video moves into the project directory at pick time and the
 * project only ever refers to its own copy.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { Project } from '../domain';
import { projectDirectory } from './store';

/** Used when the picked file has no extension to copy. */
const DEFAULT_EXTENSION = 'mp4';

/**
 * What the project's own copy is called.
 *
 * The extension is carried over because the player picks a container by it, and
 * a `.mov` renamed to `.mp4` is a video some decoders refuse. Anything the
 * picker hands over without one is assumed to be an MP4, which is what a phone
 * camera and every share sheet produce.
 */
export function sourceName(pickedUri: string): string {
  const path = pickedUri.split('?')[0];
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return `source.${(match?.[1] ?? DEFAULT_EXTENSION).toLowerCase()}`;
}

export function sourceFiles(id: string): File[] {
  return new Directory(projectDirectory(id))
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.startsWith('source.'));
}

/**
 * Whether the project's video is still there.
 *
 * A URI this app did not write is not ours to check, so it is taken on trust and
 * the player reports the truth instead.
 */
export function sourceExists(project: Project): boolean {
  if (!project.sourceUri.startsWith('file://')) return true;
  const file = new File(project.sourceUri);
  return file.exists && file.size > 0;
}

/**
 * Brings a picked video into the project directory and returns its new URI.
 *
 * The picked file is moved when it is the picker's own copy in this app's cache,
 * because that copy is ours to consume and a second one would double the space a
 * project costs. Anything else is somebody else's file and is copied.
 */
export function adoptSource(id: string, pickedUri: string): string {
  // Not a path this app can read with the filesystem API: a media store URI is
  // handed to the player as it is, and the player resolves it.
  if (!pickedUri.startsWith('file://')) return pickedUri;

  const picked = new File(pickedUri);
  if (!picked.exists) return pickedUri;

  const target = new File(projectDirectory(id), sourceName(pickedUri));
  if (target.exists) target.delete();

  if (pickedUri.startsWith(Paths.cache.uri)) picked.moveSync(target);
  else picked.copySync(target);

  return target.uri;
}
