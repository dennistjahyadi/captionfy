/**
 * Caption styles: the four v1 presets and the properties every one of them exposes.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * A preset is a set of defaults, never a lock. Users complain loudly about apps
 * where picking a look takes the colour picker away, so every preset carries the
 * same editable properties and an override always wins.
 *
 * Emphasis is data, decided in `emphasis.ts` from how the speaker said the word.
 * Every preset says how that data looks, and they disagree on purpose: a tutorial
 * caption wants bold, a pull-quote wants a display serif three times the size.
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

/**
 * Editorial stacks words before, the big word, and words after. Three rows is
 * the shape, so it ignores the property above rather than negotiating with it.
 */
export const EDITORIAL_MAX_ROWS = 3;

export type HighlightMode = 'karaoke' | 'box' | 'fade' | 'none';
export type TextSize = 'S' | 'M' | 'L';
export type CaptionPosition = 'top' | 'upperMiddle' | 'middle' | 'lowerThird';
export type CaptionAlign = 'left' | 'center';
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/** How a preset renders a word the emphasis rule picked. */
export interface EmphasisStyle {
  /** Colour of an emphasised word whenever the highlight is not already colouring it. */
  color: string;
  /** Size, as a multiple of the base size. */
  scale: number;
  fontFamily: string;
  weight: FontWeight;
  italic: boolean;
  /**
   * Give the word a row to itself, with the rest of the line above and below.
   * The magazine pull-quote shape, and the reason Editorial exists.
   */
  ownRow: boolean;
  /** How far `scale` may be auto-fitted down to make the word fit the width. */
  minScale: number;
  /**
   * What a word too long to fit even at `minScale` renders at instead.
   *
   * A word that will not fit keeps the colour and gives up the size, rather than
   * shrinking until it is smaller than the words around it.
   */
  fallbackScale: number;
  /** Scale the word appears from, over `riseMs`. 1 is no animation. */
  riseFrom: number;
  riseMs: number;
}

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
  align: CaptionAlign;
  /** 1..5. Also caps how many words a line may hold. */
  maxWordsPerLine: number;
  /** How many rows a line may wrap onto before the type shrinks to fit. */
  maxRows: number;
  fontFamily: string;
  weight: FontWeight;
  /** Opacity of words not yet spoken. 1 means upcoming words look like spoken ones. */
  upcomingOpacity: number;
  uppercase: boolean;
  emphasis: EmphasisStyle;
}

/** Font size as a fraction of canvas height, so preview and export agree at any size. */
export const TEXT_SIZE_RATIO: Record<TextSize, number> = { S: 0.036, M: 0.046, L: 0.058 };

/** Row pitch as a multiple of the font size. */
export const LINE_HEIGHT_RATIO = 1.24;

/**
 * Where captions may sit, as fractions of the canvas.
 *
 * The horizontal inset is symmetric for centred text and modest. TikTok's action
 * rail eats far more of the right edge than this, but insetting centred text by
 * the rail width pushes every caption visibly off centre. Left-aligned text is a
 * different case: it starts at the margin and grows rightward straight into the
 * rail, so it gets `railRight` instead.
 */
export const CAPTION_INSET = { x: 0.08, railRight: 0.2, top: 0.12, upperMiddle: 0.28, bottom: 0.22 };

/**
 * Platform chrome, as fractions of the canvas, for the safe-zone overlay only.
 * Nothing in the layout reads these.
 */
export const PLATFORM_SAFE_ZONES = {
  tiktok: { top: 0.1, bottom: 0.22, left: 0.04, right: 0.24 },
  reels: { top: 0.11, bottom: 0.2, left: 0.04, right: 0.18 },
  shorts: { top: 0.09, bottom: 0.18, left: 0.04, right: 0.16 },
} as const;

/** Bundled families. The renderer maps a family and weight onto a loaded face. */
export const SANS_FAMILY = 'Be Vietnam Pro';
export const SERIF_FAMILY = 'Spectral';

/**
 * The preset a new project starts on.
 *
 * One constant, because this is the thing to A/B against Editorial.
 */
export const DEFAULT_STYLE_ID = 'box';

/** The accent yellow every preset shares until the user picks another. */
const ACCENT = '#FFE03D';

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
      boxColor: ACCENT,
      textSize: 'M',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      emphasis: {
        color: ACCENT,
        scale: 1.15,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: false,
        minScale: 1,
        fallbackScale: 1,
        riseFrom: 1,
        riseMs: 0,
      },
    },
  },
  {
    id: 'karaoke',
    name: 'Karaoke fill',
    props: {
      highlightMode: 'karaoke',
      highlightColor: ACCENT,
      textColor: '#FFFFFF',
      spokenColor: ACCENT,
      outlineColor: '#000000',
      outlineRatio: 0.055,
      boxColor: '#00000000',
      textSize: 'M',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      emphasis: {
        color: ACCENT,
        scale: 1.15,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: false,
        minScale: 1,
        fallbackScale: 1,
        riseFrom: 1,
        riseMs: 0,
      },
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    props: {
      // Colour-filling every word would fight the display serif for attention,
      // so the line reads by opacity instead: what is said is solid, what is
      // coming is faint.
      highlightMode: 'fade',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineRatio: 0.03,
      boxColor: '#00000000',
      textSize: 'S',
      position: 'upperMiddle',
      align: 'left',
      maxWordsPerLine: 5,
      maxRows: EDITORIAL_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'medium',
      upcomingOpacity: 0.45,
      uppercase: false,
      emphasis: {
        color: ACCENT,
        scale: 2.6,
        fontFamily: SERIF_FAMILY,
        weight: 'extrabold',
        italic: true,
        ownRow: true,
        minScale: 1.6,
        fallbackScale: 1.2,
        riseFrom: 0.85,
        riseMs: 120,
      },
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
      align: 'center',
      maxWordsPerLine: 5,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'semibold',
      upcomingOpacity: 1,
      uppercase: false,
      emphasis: {
        // A tutorial caption should not jump around. Weight is the whole effect.
        color: '#FFFFFF',
        scale: 1,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: false,
        minScale: 1,
        fallbackScale: 1,
        riseFrom: 1,
        riseMs: 0,
      },
    },
  },
];

/** The six swatches offered next to the custom colour picker. */
export const HIGHLIGHT_SWATCHES = [ACCENT, '#3DDC84', '#FF5A5F', '#4D9BFF', '#C77DFF', '#FFFFFF'];

export function presetById(styleId: string): StyleProps {
  const preset = STYLE_PRESETS.find((entry) => entry.id === styleId);
  return (preset ?? STYLE_PRESETS.find((entry) => entry.id === DEFAULT_STYLE_ID)!).props;
}

/** A preset plus the user's overrides. The one way a style reaches the layout. */
export function resolveStyle(styleId: string, overrides: Partial<StyleProps> = {}): StyleProps {
  const base = presetById(styleId);
  const merged = { ...base, ...overrides, emphasis: { ...base.emphasis, ...overrides.emphasis } };

  return {
    ...merged,
    maxWordsPerLine: Math.min(5, Math.max(1, Math.round(merged.maxWordsPerLine))),
    maxRows: Math.max(1, Math.round(merged.maxRows)),
    upcomingOpacity: Math.min(1, Math.max(0, merged.upcomingOpacity)),
    emphasis: {
      ...merged.emphasis,
      scale: Math.max(1, merged.emphasis.scale),
      minScale: Math.min(Math.max(1, merged.emphasis.minScale), Math.max(1, merged.emphasis.scale)),
      fallbackScale: Math.max(1, merged.emphasis.fallbackScale),
    },
  };
}

/** Left and right margins in canvas fractions, which alignment decides. */
export function insetsFor(style: StyleProps): { left: number; right: number } {
  return style.align === 'left'
    ? { left: CAPTION_INSET.x, right: CAPTION_INSET.railRight }
    : { left: CAPTION_INSET.x, right: CAPTION_INSET.x };
}
