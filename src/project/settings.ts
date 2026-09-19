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
  /**
   * Whether the Welcome screen has had its turn.
   *
   * The spec called this `modelVerified`, from the days when first launch meant
   * downloading 83 MB and hoping. The models are in the APK now, so there is
   * nothing to verify and the only question left is whether this person has been
   * told what the app is.
   */
  welcomeSeen: boolean;
  /** The editor's one coach card. Shown once, on the first project that has
   * anything to check, and never again. */
  coachCardSeen: boolean;
  /**
   * Finished exports, ever, across every project.
   *
   * Counted here rather than read off `entitlement.exportsUsed`, which stops
   * counting the moment somebody pays — that number is about what is owed, and
   * this one is about how much this person has actually used the app. Only the
   * feedback card reads it, and nothing gates on it.
   */
  exportsMade: number;
  /**
   * Whether the feedback card has had its one turn.
   *
   * Set by taking it up as well as by dismissing it: the ask happens once and
   * the Settings row is permanent, so there is nothing left for a second card to
   * do except interrupt.
   */
  feedbackAsked: boolean;
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
  welcomeSeen: false,
  coachCardSeen: false,
  exportsMade: 0,
  feedbackAsked: false,
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

export function markWelcomeSeen(): void {
  saveSettings({ ...loadSettings(), welcomeSeen: true });
}

/**
 * One more finished export.
 *
 * Called from `runExport` beside the entitlement write, which is the one place
 * that knows a file exists — counting it on the Saved screen instead would count
 * again every time that screen came back into focus.
 */
export function recordExportMade(): void {
  const settings = loadSettings();
  saveSettings({ ...settings, exportsMade: settings.exportsMade + 1 });
}

/** The feedback card has been shown and answered, whichever way. */
export function markFeedbackAsked(): void {
  saveSettings({ ...loadSettings(), feedbackAsked: true });
}

/** Remembers a style as the one the next project starts on. */
export function rememberStyle(styleId: string, styleOverrides: StyleOverrides): void {
  saveSettings({ ...loadSettings(), styleId, styleOverrides });
}
