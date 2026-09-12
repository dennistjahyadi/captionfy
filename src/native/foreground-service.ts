/**
 * Keeping the process alive while a clip transcribes.
 *
 * The service does no work. React Native's JS thread keeps running when the app
 * is backgrounded; what it cannot survive is the system deciding the process is
 * idle and freezing or killing it. A foreground service is what says otherwise,
 * and the notification is the price Android charges for saying it.
 *
 * Android only. On iOS every call is a no-op and the runner stops cleanly at the
 * end of the current chunk instead, which is v1's stated scope.
 */
import { Platform } from 'react-native';

import ForegroundService from '../../modules/foreground-service';

export async function start(text: string, percent: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ForegroundService.start(text, percent);
  } catch {
    // A missing notification permission costs the notification, not the run.
    // Failing the transcription over it would be worse than running quietly.
  }
}

export async function update(percent: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ForegroundService.update(percent);
  } catch {
    // As above.
  }
}

export async function stop(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ForegroundService.stop();
  } catch {
    // As above.
  }
}

/** Asks for the notification permission Android 13 and up needs to show progress. */
export async function requestNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await ForegroundService.requestNotificationPermission();
  } catch {
    return false;
  }
}
