/**
 * One still from the video, for the Home list.
 *
 * Taken a second in rather than at zero, because the first frame of a phone
 * recording is often the black one before exposure settles, and a list of black
 * tiles tells the user nothing about which project is which.
 */
import * as VideoThumbnails from 'expo-video-thumbnails';
import { File } from 'expo-file-system';

import type { Project } from '../domain';
import { thumbnailFile } from './store';

const AT_MS = 1000;

export async function makeThumbnail(project: Project): Promise<void> {
  const target = thumbnailFile(project.id);
  if (target.exists) return;

  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(project.sourceUri, {
      time: Math.min(AT_MS, Math.max(0, project.durationMs - 100)),
      quality: 0.6,
    });
    new File(uri).move(target);
  } catch {
    // A missing thumbnail costs a grey tile. It is not worth failing a project
    // the user can still open, transcribe and export.
  }
}
