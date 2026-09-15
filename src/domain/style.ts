/**
 * Caption styles: the presets and the properties every one of them exposes.
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
 *
 * Nothing here is a special case for one preset. A look this app does not have
 * yet should be reachable by setting these properties differently, and when it
 * is not, the right change is another property rather than another branch in the
 * layout — which is where `reveal`, `shadow`, `entrance`, `plate` and the big
 * word's `band` came from.
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

/**
 * Whether a caption line arrives whole or a word at a time.
 *
 * `line` is the subtitle tradition: the sentence is on screen and something marks
 * where the speaker is in it. `word` is what short-form video actually does — the
 * line builds as it is spoken and a word the viewer has not heard yet is not on
 * screen at all. Every competitor clip in `references/` uses `word`, and one of
 * them opens by showing a static block of text as the thing that makes people
 * scroll past.
 *
 * The line still wraps and shrinks against its whole self, so the type size and
 * the row count are decided once for the line rather than changing under the
 * reader as words land.
 */
export type Reveal = 'line' | 'word';

/**
 * A shadow, or — with no offset and the caster's own colour — a glow.
 *
 * Every ratio is a fraction of the font size the thing is drawn at, so a shadow
 * is the same shape at preview size and at 1080p. `blurRatio` is a Gaussian
 * sigma, because that is what Skia takes; the burn-in converts it to the radius
 * `android.graphics` wants.
 *
 * This is here because an outline is not the only way to hold type off a
 * photograph, and it is the least fashionable one. A hard stroke reads as a
 * caption burned on by software. A soft shadow reads as design.
 */
export interface ShadowStyle {
  /** A colour, or `OWN_COLOR` for a glow in the colour of the word casting it. */
  color: string;
  blurRatio: number;
  dxRatio: number;
  dyRatio: number;
}

/**
 * A shadow that takes the colour of whatever casts it.
 *
 * A glow is a word bleeding its own colour outward, so it has to follow the
 * colour the user picked rather than staying the yellow it was designed in. The
 * layout resolves it to a real colour before anything draws, so the draw list
 * that crosses into the export never carries a sentinel.
 */
export const OWN_COLOR = 'own';

export const NO_SHADOW: ShadowStyle = {
  color: '#00000000',
  blurRatio: 0,
  dxRatio: 0,
  dyRatio: 0,
};

/**
 * How a word arrives, for every word rather than only the emphasised one.
 *
 * `EmphasisStyle.riseFrom` predates this and stays: the big word's entrance is
 * part of what a preset says about big words, and it is allowed to differ from
 * what the line around it does.
 *
 * Computed in the layout like everything else, so the export runs the same
 * animation the preview did. A spring driven by the UI thread would be a second
 * animation the encoder never sees (invariant 2).
 */
export interface EntranceStyle {
  /** Scale the word appears from, about its own centre. 1 is no scaling. */
  scaleFrom: number;
  /** How far below its place the word starts, as a fraction of the font size. */
  dyRatio: number;
  opacityFrom: number;
  /** 0 means the word is simply there. */
  ms: number;
}

export const NO_ENTRANCE: EntranceStyle = {
  scaleFrom: 1,
  dyRatio: 0,
  opacityFrom: 1,
  ms: 0,
};

/**
 * A card behind the whole caption block.
 *
 * Not the per-word box `highlightMode: 'box'` draws: this is one rectangle under
 * every row, which is what turns a caption into a pasted-on paper label. Padding
 * and radius are fractions of the base font size.
 */
export interface PlateStyle {
  color: string;
  padXRatio: number;
  padYRatio: number;
  radiusRatio: number;
  /** Lifts a white card off a bright frame, where nothing else would separate them. */
  shadow: ShadowStyle;
}

export const NO_PLATE: PlateStyle = {
  color: '#00000000',
  padXRatio: 0,
  padYRatio: 0,
  radiusRatio: 0,
  shadow: NO_SHADOW,
};

/**
 * Whether a colour would put any pixels on the screen.
 *
 * Every colour in this app is `#RRGGBB` or Skia's `#RRGGBBAA`, alpha last. A
 * fully transparent one is how a preset says it does not want the thing at all,
 * which is cheaper to read than an optional property on nine preset literals.
 */
export function isPaintable(color: string): boolean {
  return !(color.length === 9 && color.slice(7).toUpperCase() === '00');
}

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
  /**
   * Put the big word in a band of its own, away from the rest of the line.
   *
   * The whole shape of the loudest reference clip: a huge word across the top of
   * the frame and the sentence it belongs to, small, down in the lower third.
   * Undefined keeps it in the block with everything else, which is what a pull
   * quote wants.
   *
   * Only meaningful with `ownRow`, because a word inline in a row cannot be
   * somewhere else on the screen.
   */
  band?: CaptionPosition;
  /**
   * The big word's own shadow, where it differs from the line's.
   *
   * Undefined means it casts what every other word casts. A glow belongs to the
   * word it is picking out and would be noise under the rest of the sentence.
   */
  shadow?: ShadowStyle;
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
  /**
   * Cast by that fill.
   *
   * It earns its place on the one preset that prints on a light card: the box is
   * the accent, the accent is whatever the user picked, and white was already a
   * swatch. A hard ink offset means the highlight is a shape before it is a
   * colour, so it survives a colour that matches the paper.
   */
  boxShadow: ShadowStyle;
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
  /** Whether the line is on screen whole or builds as it is spoken. */
  reveal: Reveal;
  /** Cast by every word. The emphasised word may override it. */
  shadow: ShadowStyle;
  /** How every word arrives. */
  entrance: EntranceStyle;
  /** One card behind the whole block. */
  plate: PlateStyle;
  emphasis: EmphasisStyle;
}

/**
 * A preset with the user's changes on top.
 *
 * `emphasis` is partial where `StyleProps` has it whole, because the style sheet
 * changes one thing about the big word — usually its colour — and storing the
 * other nine properties alongside it would freeze that preset's emphasis at
 * whatever it was on the day the user picked a colour.
 */
export type StyleOverrides = Partial<
  Omit<StyleProps, 'emphasis' | 'shadow' | 'entrance' | 'plate'>
> & {
  emphasis?: Partial<EmphasisStyle>;
  shadow?: Partial<ShadowStyle>;
  entrance?: Partial<EntranceStyle>;
  plate?: Partial<PlateStyle>;
};

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
 *
 * There is no primary source to cite. TikTok and Meta both publish safe zones as
 * downloadable templates rather than numbers, and both say outright that the zone
 * moves with caption length, interactive add-ons and text direction, so no fixed
 * fraction can be correct for every post. These are the consensus of the
 * third-party guides that measured the current apps, which disagree with each
 * other by three to eight points; they were checked in September 2026 and are
 * rounded outward, towards covering more rather than less.
 *
 * They are drawn as a warning, not enforced: a caption is allowed to sit wherever
 * the user puts it.
 */
export const PLATFORM_SAFE_ZONES = {
  tiktok: { top: 0.1, bottom: 0.22, left: 0.04, right: 0.24 },
  reels: { top: 0.11, bottom: 0.2, left: 0.04, right: 0.18 },
  shorts: { top: 0.09, bottom: 0.18, left: 0.04, right: 0.16 },
} as const;

export interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The one rectangle that is clear on all three platforms.
 *
 * The overlay draws a union rather than three rectangles because a creator posts
 * the same clip to all three and has no use for knowing which of them would have
 * covered the word. The widest inset on each side wins.
 */
export function safeZoneUnion(): SafeZone {
  const zones = Object.values(PLATFORM_SAFE_ZONES);
  return {
    top: Math.max(...zones.map((zone) => zone.top)),
    bottom: Math.max(...zones.map((zone) => zone.bottom)),
    left: Math.max(...zones.map((zone) => zone.left)),
    right: Math.max(...zones.map((zone) => zone.right)),
  };
}

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

/** Ink on paper, for the one preset that puts a card under the words. */
const INK = '#141110';
const PAPER = '#FFFFFFF7';

/**
 * The nine presets.
 *
 * Four were the v1 set. Four more came out of watching what the apps this one
 * competes with actually ship — the clips in `references/` — and taking the
 * mechanisms apart rather than the pictures: every one of them builds the line a
 * word at a time, every one of them holds the type off the frame with a shadow
 * rather than a stroke, and every one of them has a second size that is three or
 * four times the first. Those are now properties any preset can take, so what is
 * below is nine arrangements of one vocabulary and not nine special cases.
 *
 * The picker was budgeted for eight without a redesign. The ninth arrived with
 * the grid moved into one canvas, which is what took the ceiling off: a tenth
 * costs a row of buttons and one more translated group.
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
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: NO_PLATE,
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
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: MAX_WORDS_PER_LINE,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: NO_PLATE,
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
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: 'upperMiddle',
      align: 'left',
      maxWordsPerLine: 5,
      maxRows: EDITORIAL_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'medium',
      upcomingOpacity: 0.45,
      uppercase: false,
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: NO_PLATE,
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
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: 5,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'semibold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: NO_PLATE,
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
  {
    id: 'spotlight',
    name: 'Spotlight',
    props: {
      // Nothing marks the word being spoken, because the word being spoken is
      // the last one on screen: the reveal is the highlight.
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: 3,
      maxRows: 2,
      fontFamily: SERIF_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'word',
      shadow: { color: '#000000A6', blurRatio: 0.22, dxRatio: 0, dyRatio: 0.05 },
      entrance: { scaleFrom: 1, dyRatio: 0.2, opacityFrom: 0, ms: 140 },
      plate: NO_PLATE,
      emphasis: {
        // The big word crosses the top of the frame while the sentence it came
        // from stays in the lower third. Two bands, one line, and the whole
        // reason `band` exists.
        color: ACCENT,
        scale: 3.4,
        fontFamily: SERIF_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: true,
        band: 'top',
        minScale: 2,
        fallbackScale: 1.6,
        riseFrom: 0.92,
        riseMs: 200,
        shadow: { color: '#0000008C', blurRatio: 0.1, dxRatio: 0, dyRatio: 0.03 },
      },
    },
  },
  {
    id: 'stack',
    name: 'Word stack',
    props: {
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: 'upperMiddle',
      align: 'left',
      maxWordsPerLine: 5,
      maxRows: EDITORIAL_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'word',
      shadow: { color: '#000000A6', blurRatio: 0.2, dxRatio: 0, dyRatio: 0.04 },
      // Up and in, which is the entrance every one of these apps offers under
      // some name. The rows above hold still while the newest one lands.
      entrance: { scaleFrom: 0.88, dyRatio: 0.34, opacityFrom: 0, ms: 170 },
      plate: NO_PLATE,
      emphasis: {
        color: ACCENT,
        scale: 1.7,
        fontFamily: SERIF_FAMILY,
        weight: 'extrabold',
        italic: true,
        ownRow: true,
        minScale: 1.2,
        fallbackScale: 1.1,
        riseFrom: 0.9,
        riseMs: 170,
        // A glow in the word's own colour, which is what an italic accent word
        // is wearing in every one of these clips. It follows the swatch because
        // `OWN_COLOR` resolves against the word, not against a preset.
        shadow: { color: OWN_COLOR, blurRatio: 0.3, dxRatio: 0, dyRatio: 0 },
      },
    },
  },
  {
    id: 'headline',
    name: 'Headline',
    props: {
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: 'upperMiddle',
      align: 'center',
      maxWordsPerLine: 5,
      maxRows: EDITORIAL_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'word',
      shadow: { color: '#000000B3', blurRatio: 0.16, dxRatio: 0, dyRatio: 0.045 },
      // Settling down onto the line rather than rising into it: a word that
      // arrives slightly too big reads as spoken hard.
      entrance: { scaleFrom: 1.14, dyRatio: 0, opacityFrom: 0, ms: 130 },
      plate: NO_PLATE,
      emphasis: {
        color: ACCENT,
        scale: 2.9,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: true,
        minScale: 1.7,
        fallbackScale: 1.4,
        riseFrom: 1.16,
        riseMs: 150,
      },
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    props: {
      // The one preset that does two things to the word being spoken at once:
      // it fills, and the halo around it turns colour with the fill. None of
      // the four reference clips does this, and it is the one that most wants
      // an emphasis picked from how a word was *said* rather than from a
      // keyword list — the big word is the one the speaker leaned on, and here
      // it is the one that lights up.
      highlightMode: 'karaoke',
      highlightColor: ACCENT,
      textColor: '#FFFFFF',
      spokenColor: ACCENT,
      // A hairline, not an edge. Inside a bloom the glyphs need something to
      // hold their shape, which is what a neon tube's own dark rim does.
      outlineColor: '#000000',
      outlineRatio: 0.022,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: 'lowerThird',
      align: 'center',
      maxWordsPerLine: 3,
      maxRows: 2,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'word',
      shadow: { color: OWN_COLOR, blurRatio: 0.28, dxRatio: 0, dyRatio: 0 },
      entrance: { scaleFrom: 0.84, dyRatio: 0, opacityFrom: 0, ms: 150 },
      plate: NO_PLATE,
      emphasis: {
        color: ACCENT,
        scale: 1.9,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: true,
        minScale: 1.3,
        fallbackScale: 1.15,
        riseFrom: 0.82,
        riseMs: 190,
        shadow: { color: OWN_COLOR, blurRatio: 0.42, dxRatio: 0, dyRatio: 0 },
      },
    },
  },
  {
    id: 'newsprint',
    name: 'Newsprint',
    props: {
      // The one preset that reads dark on light, so the box is the accent and
      // the word on it stays ink: an accent word on an accent box is a hole.
      highlightMode: 'box',
      highlightColor: INK,
      textColor: INK,
      spokenColor: INK,
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: ACCENT,
      // Letterpress, the same hard ink offset the big word wears. It is also
      // what keeps a pale highlight — white is a swatch — a visible shape on a
      // white card.
      boxShadow: { color: INK, blurRatio: 0, dxRatio: 0.03, dyRatio: 0.03 },
      textSize: 'S',
      position: 'upperMiddle',
      align: 'center',
      maxWordsPerLine: 3,
      maxRows: 2,
      fontFamily: SERIF_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      // The card is the size of the whole line from the moment it appears, so
      // the line arrives whole and the box walks along it.
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: {
        color: PAPER,
        padXRatio: 0.34,
        padYRatio: 0.14,
        radiusRatio: 0.06,
        shadow: { color: '#0000005E', blurRatio: 0.22, dxRatio: 0, dyRatio: 0.1 },
      },
      emphasis: {
        color: ACCENT,
        scale: 1,
        fontFamily: SERIF_FAMILY,
        weight: 'extrabold',
        italic: true,
        ownRow: false,
        minScale: 1,
        fallbackScale: 1,
        riseFrom: 1,
        riseMs: 0,
        // A hard offset in ink, with no blur: letterpress, and the reason a pale
        // accent word stays readable on a white card whatever colour is picked.
        shadow: { color: INK, blurRatio: 0, dxRatio: 0.04, dyRatio: 0.04 },
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
export function resolveStyle(styleId: string, overrides: StyleOverrides = {}): StyleProps {
  const base = presetById(styleId);
  const merged = {
    ...base,
    ...overrides,
    shadow: { ...base.shadow, ...overrides.shadow },
    entrance: { ...base.entrance, ...overrides.entrance },
    plate: { ...base.plate, ...overrides.plate },
    emphasis: { ...base.emphasis, ...overrides.emphasis },
  };

  return {
    ...merged,
    entrance: {
      ...merged.entrance,
      opacityFrom: clamp01(merged.entrance.opacityFrom),
      ms: Math.max(0, merged.entrance.ms),
    },
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

/**
 * The colour the user actually chose, whichever property carries it.
 *
 * Every preset paints the caption colour somewhere different: box highlight puts
 * it behind dark text, karaoke fills the spoken word with it, and the two presets
 * that mark nothing as it is spoken have only the big word to put it on. The
 * chrome asks this question because the interface has no accent of its own: the
 * only saturated colour in the app is the caption colour of the project you are
 * in.
 */
export function accentColor(style: StyleProps): string {
  if (style.highlightMode === 'box') return style.boxColor;
  if (style.highlightMode === 'karaoke') return style.highlightColor;
  return style.emphasis.color;
}

/**
 * What picking a colour changes, which is not the same property in every preset.
 *
 * One swatch, one visible result, whatever preset is selected: the box fill in
 * box highlight, the fill and the words already said in karaoke, and the big word
 * in the two presets that mark nothing as it is spoken. The big word takes the
 * colour in every case, so switching preset after picking a colour keeps it.
 *
 * Returned as overrides rather than applied, so the caller is the one thing that
 * writes to a project, and so a preset switch merges them the same way.
 */
export function highlightColorOverrides(style: StyleProps, color: string): StyleOverrides {
  const emphasis = { color };

  if (style.highlightMode === 'box') return { boxColor: color, emphasis };
  if (style.highlightMode === 'karaoke') {
    return { highlightColor: color, spokenColor: color, emphasis };
  }
  return { emphasis };
}

/**
 * What the user chose, as opposed to what their preset happened to come with.
 *
 * Undefined means "whatever this preset says". The distinction is the whole
 * reason this type exists: a preset is a set of defaults, so switching to Clean
 * subtitle has to give you Clean's small white type, while a colour you picked
 * yourself has to follow you from preset to preset. Only a value that differs
 * from the preset it was set on is a choice.
 */
export interface StyleChoices {
  /** Whatever `accentColor` would report: the one colour the picker offers. */
  color?: string;
  textSize?: TextSize;
  position?: CaptionPosition;
  maxWordsPerLine?: number;
}

/** Reads the choices back out of a project's stored overrides. */
export function styleChoices(styleId: string, overrides: StyleOverrides = {}): StyleChoices {
  const preset = presetById(styleId);
  const style = resolveStyle(styleId, overrides);

  return {
    color: chosen(accentColor(style), accentColor(preset)),
    textSize: chosen(style.textSize, preset.textSize),
    position: chosen(style.position, preset.position),
    maxWordsPerLine: chosen(style.maxWordsPerLine, preset.maxWordsPerLine),
  };
}

/**
 * The overrides that put those choices onto a preset, this preset.
 *
 * The colour goes wherever this preset paints it, which is why the sheet stores
 * a colour and not a property name: the same red is a box fill in one preset and
 * a pull-quote in another.
 */
export function styleOverridesFor(styleId: string, choices: StyleChoices): StyleOverrides {
  const preset = presetById(styleId);
  const overrides: StyleOverrides = {};

  if (choices.textSize !== undefined && choices.textSize !== preset.textSize) {
    overrides.textSize = choices.textSize;
  }
  if (choices.position !== undefined && choices.position !== preset.position) {
    overrides.position = choices.position;
  }
  if (choices.maxWordsPerLine !== undefined && choices.maxWordsPerLine !== preset.maxWordsPerLine) {
    overrides.maxWordsPerLine = choices.maxWordsPerLine;
  }
  if (choices.color !== undefined && choices.color !== accentColor(preset)) {
    Object.assign(overrides, highlightColorOverrides(preset, choices.color));
  }

  return overrides;
}

function chosen<T>(value: T, presetValue: T): T | undefined {
  return value === presetValue ? undefined : value;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Left and right margins in canvas fractions, which alignment decides. */
export function insetsFor(style: StyleProps): { left: number; right: number } {
  return style.align === 'left'
    ? { left: CAPTION_INSET.x, right: CAPTION_INSET.railRight }
    : { left: CAPTION_INSET.x, right: CAPTION_INSET.x };
}
