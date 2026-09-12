/**
 * The handful of things the app remembers about itself.
 *
 * Not about any one project: what the user has already been shown, and later the
 * style a new project starts on. Paid state is not here, it is in
 * `entitlement.json`, because a receipt and a dismissed coach card have nothing
 * to do with each other.
 */
import { File, Paths } from 'expo-file-system';

import { DEFAULT_STYLE_ID, type StyleOverrides } from '../domain';

export interface Settings {
  /** The editor's one coach card. Shown once, on the first project that has
   * anything to check, and never again. */
  coachCardSeen: boolean;
  /**
   * What the next project will look like: the last style the user settled on.
   *
   * Kept here as well as on the project because a creator has a look, not a
   * look per clip, and being made to rebuild it on every video is the complaint
   * this whole screen exists to answer.
   */
  styleId: string;
  styleOverrides: StyleOverrides;
}

export const NEW_SETTINGS: Settings = {
  coachCardSeen: false,
  styleId: DEFAULT_STYLE_ID,
  styleOverrides: {},
};

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

/** Remembers a style as the one the next project starts on. */
export function rememberStyle(styleId: string, styleOverrides: StyleOverrides): void {
  saveSettings({ ...loadSettings(), styleId, styleOverrides });
}
