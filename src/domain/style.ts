/**
 * Caption styles: the four v1 presets and the properties every one of them exposes.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * A preset is a set of defaults, never a lock. Users complain loudly about apps
 * where picking a look takes the colour picker away, so every preset carries the
 * same editable properties and an override always wins.
 */
import { MAX_WORDS_PER_LINE } from './lines';

/**
 * Rows a caption line may wrap onto before the type shrinks to fit.
 *
 * Two, not one, because a five-word line at size L does not fit the width of a
 * 9:16 frame and shrinking that far would be unreadable. It is not the number of
 * caption lines on screen, which is one.
 */
const DEFAULT_MAX_ROWS = 2;

export type HighlightMode = 'karaoke' | 'pop' | 'box' | 'none';
export type TextSize = 'S' | 'M' | 'L';
export type CaptionPosition = 'top' | 'middle' | 'lowerThird';

export interface StyleProps {
  /** How the word being spoken is marked. */
  highlightMode: HighlightMode;
  /** The one place this design is allowed to be loud. */
  highlightColor: string;
  /** Words not currently highlighted. */
  textColor: string;
  /** Words already spoken, in karaoke mode. */
  spokenColor: string;
  outlineColor: string;
  /** Outline width as a fraction of the font size, so it scales with the canvas. */
  outlineRatio: number;
  /** Fill behind the active word in box mode. */
  boxColor: string;
  textSize: TextSize;
  position: CaptionPosition;
  /** 1..5. Also caps how many words a line may hold. */
  maxWordsPerLine: number;
  /** How many rows a line may wrap onto before the type shrinks to fit. */
  maxRows: number;
  fontFamily: string;
  /** How far the active word grows in pop mode. 1 is no growth. */
  popScale: number;
  uppercase: boolean;
}

/** Font size as a fraction of canvas height, so preview and export agree at any size. */
export const TEXT_SIZE_RATIO: Record<TextSize, number> = { S: 0.036, M: 0.046, L: 0.058 };

/** Row pitch as a multiple of the font size. */
export const LINE_HEIGHT_RATIO = 1.24;

/**
 * Where captions may sit, as fractions of the canvas.
 *
 * The horizontal inset is symmetric and modest. TikTok's action rail eats far
 * more of the right edge than this, but insetting text by the rail width pushes
 * every caption visibly off centre; the rail is shown by the safe-zone overlay
 * instead, where the user can judge it against their own frame.
 */
export const CAPTION_INSET = { x: 0.08, top: 0.12, bottom: 0.22 };

/**
 * Platform chrome, as fractions of the canvas, for the safe-zone overlay only.
 * Nothing in the layout reads these.
 */
export const PLATFORM_SAFE_ZONES = {
  tiktok: { top: 0.1, bottom: 0.22, left: 0.04, right: 0.24 },
  reels: { top: 0.11, bottom: 0.2, left: 0.04, right: 0.18 },
  shorts: { top: 0.09, bottom: 0.18, left: 0.04, right: 0.16 },
} as const;

export const DEFAULT_STYLE_ID = 'box';

/**
 * The four presets.
 *
 * The picker is built to hold eight without a redesign, so this list is the only
 * thing that changes when a fifth is added.
 */
export const STYLE_PRESETS: { id: string; name: string; props: StyleProps }[] = [
  {
    id: 'box',
    name: 'Box highlight',
    props: {
      highlightMode: 'box',
      highlightColor: '#111111',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineRatio: 0.055,
      boxColor: '#FFE03D',
      textSize: 'M',
      position: 'lowerThird',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: 'Inter',
      popScale: 1,
      uppercase: false,
    },
  },
  {
    id: 'karaoke',
    name: 'Karaoke fill',
    props: {
      highlightMode: 'karaoke',
      highlightColor: '#FFE03D',
      textColor: '#FFFFFF',
      spokenColor: '#FFE03D',
      outlineColor: '#000000',
      outlineRatio: 0.055,
      boxColor: '#00000000',
      textSize: 'M',
      position: 'lowerThird',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: 'Inter',
      popScale: 1,
      uppercase: false,
    },
  },
  {
    id: 'pop',
    name: 'Pop highlight',
    props: {
      highlightMode: 'pop',
      highlightColor: '#FFE03D',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineRatio: 0.06,
      boxColor: '#00000000',
      textSize: 'M',
      position: 'lowerThird',
      maxWordsPerLine: 3,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: 'Inter',
      popScale: 1.18,
      uppercase: true,
    },
  },
  {
    id: 'clean',
    name: 'Clean subtitle',
    props: {
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineRatio: 0.04,
      boxColor: '#00000000',
      textSize: 'S',
      position: 'lowerThird',
      maxWordsPerLine: 5,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: 'Inter',
      popScale: 1,
      uppercase: false,
    },
  },
];

/** The six swatches offered next to the custom colour picker. */
export const HIGHLIGHT_SWATCHES = ['#FFE03D', '#3DDC84', '#FF5A5F', '#4D9BFF', '#C77DFF', '#FFFFFF'];

export function presetById(styleId: string): StyleProps {
  const preset = STYLE_PRESETS.find((entry) => entry.id === styleId);
  return (preset ?? STYLE_PRESETS.find((entry) => entry.id === DEFAULT_STYLE_ID)!).props;
}

/** A preset plus the user's overrides. The one way a style reaches the layout. */
export function resolveStyle(styleId: string, overrides: Partial<StyleProps> = {}): StyleProps {
  const merged = { ...presetById(styleId), ...overrides };
  return {
    ...merged,
    maxWordsPerLine: Math.min(5, Math.max(1, Math.round(merged.maxWordsPerLine))),
    maxRows: Math.max(1, Math.round(merged.maxRows)),
    popScale: Math.max(1, merged.popScale),
  };
}
