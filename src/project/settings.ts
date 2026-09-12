/**
 * The handful of things the app remembers about itself.
 *
 * Not about any one project: what the user has already been shown, and later the
 * style a new project starts on. Paid state is not here, it is in
 * `entitlement.json`, because a receipt and a dismissed coach card have nothing
 * to do with each other.
 */
import { File, Paths } from 'expo-file-system';

export interface Settings {
  /** The editor's one coach card. Shown once, on the first project that has
   * anything to check, and never again. */
  coachCardSeen: boolean;
}

export const NEW_SETTINGS: Settings = { coachCardSeen: false };

function settingsFile(): File {
  return new File(Paths.document, 'settings.json');
}

export function loadSettings(): Settings {
  const file = settingsFile();
  if (!file.exists) return NEW_SETTINGS;

  try {
    return { ...NEW_SETTINGS, ...(JSON.parse(file.textSync()) as Partial<Settings>) };
  } catch {
    // A half-written settings file costs the user one repeated coach card, which
    // is not worth failing a screen over.
    return NEW_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  settingsFile().write(JSON.stringify(settings));
}

export function markCoachCardSeen(): void {
  saveSettings({ ...loadSettings(), coachCardSeen: true });
}
