/**
 * The v1 chrome.
 *
 * Six named colours, one type family, spacing on fours, and radius by role.
 * The rule the whole thing hangs on: the chrome carries no accent of its own.
 * `accent` is the caption colour of the project you are in, so the only
 * saturated pixels in the interface are the ones you chose for your video.
 */

export const color = {
  /** The ground. Warm near-black, so a video thumbnail does not float on a hole. */
  ink: '#0F0E0D',
  /** Sheets, list rows, the style picker. The only raised plane. */
  surface: '#1A1817',
  /** Hairlines. Separation is a line, never a shadow. */
  line: '#2C2926',
  /** Secondary text, inactive icons, every timecode. */
  mute: '#9A928A',
  /** Primary text. Not pure white: beside a bright frame that glares. */
  paper: '#F2EFEC',
  /** Failed export, delete, the safe-zone overlay. Nothing else may use it. */
  signal: '#FF7A66',
  /** A file that exists now. The one success state, and nothing else may use it. */
  good: '#3DDC84',
} as const;

/** What a caption colour looks like in the chrome, and what reads on top of it. */
export const DEFAULT_ACCENT = '#FFE03D';
export const ON_ACCENT = '#111111';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;

/**
 * Radius by role rather than one value everywhere.
 *
 * `video` is zero on purpose: a rounded corner in the preview is a promise the
 * exported file does not keep.
 */
export const radius = { control: 8, sheet: 14, pill: 999, video: 0 } as const;

export const font = {
  regular: 'BeVietnamPro-Medium',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-ExtraBold',
  /**
   * The caption face, borrowed by the chrome exactly once.
   *
   * Spectral belongs inside the video, in the Editorial preset. Welcome is the
   * one screen with no video on it, and the promise it makes — captions that
   * look edited — is a promise about type. Saying it in the interface sans would
   * be describing the product in a voice the product never uses.
   */
  serif: 'Spectral-ExtraBold',
} as const;

/**
 * The type scale. Sizes are unscaled points; every `Text` in the app leaves
 * `allowFontScaling` on, so the system setting still multiplies them.
 */
export const type = {
  display: { fontFamily: font.bold, fontSize: 32, lineHeight: 37, letterSpacing: -0.6 },
  /** Welcome's headline, and nothing else in the app. */
  serif: { fontFamily: font.serif, fontSize: 38, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 25 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  micro: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
} as const;

/** Nothing interactive is smaller than this, whatever it looks like. */
export const MIN_TOUCH = 44;
