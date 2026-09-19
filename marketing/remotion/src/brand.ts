/**
 * The app's own palette and type, copied from `src/ui/theme.ts` and
 * `src/domain/style.ts` rather than re-invented.
 *
 * The point of these ads is that the captions in them are the captions the app
 * makes. A near-miss yellow or a different weight would be advertising a
 * product nobody can download.
 */
export const color = {
  ink: '#0F0E0D',
  surface: '#1A1817',
  line: '#2C2926',
  mute: '#9A928A',
  paper: '#F2EFEC',
  signal: '#FF7A66',
  good: '#3DDC84',
} as const;

/** `DEFAULT_ACCENT` in the app. */
export const ACCENT = '#FFE03D';
/** `ON_ACCENT` — what reads on top of the accent. */
export const ON_ACCENT = '#111111';

export const font = {
  bold: 'WB Sans ExtraBold',
  semibold: 'WB Sans SemiBold',
  medium: 'WB Sans Medium',
  serif: 'WB Serif',
} as const;

/** TikTok's own frame. Also, not by accident, Wordburn's export size. */
export const FORMAT = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * `safeZoneUnion()` in the app, in the same fractions: the part of a vertical
 * frame no platform's chrome sits on. Nothing that has to be read goes outside
 * it, in an ad for a captions app least of all.
 */
export const SAFE = { top: 0.11, bottom: 0.22, left: 0.05, right: 0.24 } as const;
