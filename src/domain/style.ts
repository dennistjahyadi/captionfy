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

/**
 * How the word being spoken is marked.
 *
 * `snap` is `karaoke` without the sweep: the word changes colour whole, the
 * instant it is reached, and the line in front of it waits in the unspoken
 * colour. It is the mechanism of the reference clip in
 * `references/kitverify-offer-portrait.mp4` and of most of what the caption
 * apps ship as their own default, and it is a mode rather than a preset flag
 * because the only thing it changes is when the colour arrives.
 *
 * `active` is the other half of that pair and the one this app was missing: the
 * mark travels with the voice and leaves nothing behind it. Every word on the
 * line is `textColor` except the one being said, which is `highlightColor`, so
 * a viewer's eye is pulled to a single moving word rather than to a growing
 * block of colour. It is what the "bold yellow word" archetype every short-form
 * app documents actually does, and `snap` cannot express it: `snap` says how far
 * the speaker has got, `active` says where the speaker is.
 *
 * Like `snap` it cost the export nothing. The burn-in draws whatever colour the
 * draw list names, so a new mode is a branch in `colorOf` and nowhere else.
 */
export type HighlightMode = 'karaoke' | 'snap' | 'active' | 'box' | 'fade' | 'none';
export type TextSize = 'S' | 'M' | 'L';
/**
 * Where the caption block sits: the fraction of the canvas height its centre
 * lands on, 0 at the top edge and 1 at the bottom.
 *
 * It was four named bands, and four is not enough. "Lower" was one number and
 * the whole complaint about it was that a lower third that clears TikTok's tray
 * on one clip sits on somebody's face in the next; the same is true upward.
 * A fraction takes no more room in a project file, says exactly the same thing
 * about the four old names — `CAPTION_BAND` is them — and lets the user put the
 * line anywhere between and past them.
 *
 * The centre, not an edge, because that is what a finger dragging a block of
 * text is holding. The old names anchored differently from each other (`top` by
 * its top, `lowerThird` by its bottom, `middle` by its middle), which is
 * invisible until something has to interpolate between two of them.
 */
export type CaptionPosition = number;
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
  /**
   * Words this style is not marking.
   *
   * The quiet half of the pair the sheet offers: the line under the box, the
   * words still to come in `karaoke` and `snap`, and simply the caption where
   * nothing is marked at all. `captionTextColor` is the reader.
   */
  textColor: string;
  /** Words already spoken, in the two modes that colour them: `karaoke` and `snap`. */
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
 * The left and right margins, as fractions of the canvas.
 *
 * The horizontal inset is symmetric for centred text and modest. TikTok's action
 * rail eats far more of the right edge than this, but insetting centred text by
 * the rail width pushes every caption visibly off centre. Left-aligned text is a
 * different case: it starts at the margin and grows rightward straight into the
 * rail, so it gets `railRight` instead.
 *
 * Vertical placement is not in here any more. It is a number on the style —
 * see `CaptionPosition` — and `CAPTION_BAND` is the three or four places worth
 * offering a tap for.
 */
export const CAPTION_INSET = { x: 0.08, railRight: 0.2 };

/**
 * The bands the style sheet offers as one tap, and the presets are written in.
 *
 * They are ordinary `CaptionPosition` values with nothing special about them:
 * the slider and the drag reach every number between and either side, and a
 * preset is free to sit at 0.62 if that is where it looks right. These are here
 * so that "Lower" means the same thing in nine presets and so that a drag has
 * something to snap to.
 *
 * `top` is not offered as a tap. It is where the free tier's mark lives (see
 * `watermark.ts`), so it is somewhere to arrive at deliberately rather than by
 * reaching for the first chip in a row.
 */
export const CAPTION_BAND = { top: 0.15, upper: 0.31, middle: 0.5, lower: 0.75 };

/** How close a drag has to land to a band before it is taken as that band. */
export const BAND_SNAP = 0.012;

/**
 * How far a caption may be pushed, as a fraction of the canvas.
 *
 * Not the safe zone: that is a warning drawn over the preview and a caption is
 * allowed to sit outside it. This is only the promise that a block still has
 * some of itself on screen, so a slider dragged to its end cannot produce a
 * frame with no captions in it and no way to tell why.
 */
export const POSITION_RANGE = { min: 0.06, max: 0.94 };

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
 * Focus, and it is first in the list as well, so the tile a new user taps is the
 * look they are already in. It was Read along, and before that Box highlight;
 * the argument that moved it is in `references/deep-research-report.md` and it is not a
 * popularity one. A default is not a favourite. It is the look that has to
 * survive footage nobody has seen, a creator in a niche nobody chose it for, a
 * phone at arm's length and a viewer who has motion turned off — and the
 * property that buys all four is *controlled* contrast: white type on a dark
 * card that the app puts there, rather than white type hoping the frame behind
 * it is dark.
 *
 * Read along is the look this one is built from and it keeps everything that
 * was right about it: the whole line on screen so the eye can be a word ahead of
 * the voice, and one restrained cue for where the voice is. What it changes is
 * that the cue is a pill rather than a colour change — a shape survives a frame
 * the colour does not — and that the line no longer relies on the video being
 * dark enough for a shadow to be enough.
 */
export const DEFAULT_STYLE_ID = 'focus';

/** The accent yellow every preset shares until the user picks another. */
const ACCENT = '#FFE03D';

/** Ink on paper, for the one preset that puts a card under the words. */
const INK = '#141110';
const PAPER = '#FFFFFFF7';

/**
 * The default's blue, darkened from the one the research measured.
 *
 * White on the `#4F6BFF` in the reference shot is 4.30:1, which misses WCAG's
 * 4.5:1 for body text and only passes as large text. Captions are large text on
 * a phone and would have scraped through, but the default is the one preset
 * that has to be right at any size the size control can reach, and two points of
 * blue is not a design decision worth failing a threshold over. This is 5.32:1
 * against white, measured rather than eyeballed.
 */
const FOCUS_BLUE = '#2F5FEA';

/**
 * The card under the default's line: near-black at 78%.
 *
 * Opaque would be a subtitle bar on top of the video. Transparent would be the
 * thing this preset exists to stop being. At 78% the footage is still legible
 * through it and the type has a known background whatever is behind it.
 */
const NIGHT = '#111111C7';

/** The warm charcoal Clarity prints on: 7.48:1 under white. */
const CHARCOAL = '#59544FE6';

/** The yellow of the archetype every short-form app ships some version of. */
const BOLD_YELLOW = '#FFD60A';

/** Core's structural accent, and the one warm colour in a business-shaped look. */
const CORAL = '#FF5A5F';

/** Rocket's keyword lavender, and Neon glow's halo. */
const LAVENDER = '#C8B8FF';
const HOT_PINK = '#FF5CE1';

/**
 * A word that has not been said yet, in the presets that leave it on screen.
 *
 * White at 55%, not grey, so it stays a dimmer version of the word it becomes
 * rather than a different colour that happens to be near it — and so a picked
 * text colour dims the same way whatever it is.
 */
const UNSAID = '#FFFFFF8C';

/**
 * The eighteen presets.
 *
 * Four were the v1 set. Six more came out of watching what the apps this one
 * competes with actually ship — the clips in `references/` — and taking the
 * mechanisms apart rather than the pictures: every one of them builds the line a
 * word at a time, every one of them holds the type off the frame with a shadow
 * rather than a stroke, and every one of them has a second size that is three or
 * four times the first. Those are all properties any preset can take, so what is
 * below is eighteen arrangements of one vocabulary and not eighteen special
 * cases.
 *
 * The last eight came from `references/deep-research-report.md`, which took the category
 * leader's published style catalogue apart the same way — not by copying the
 * pictures, which are somebody else's, but by naming the behaviour each look
 * relies on and asking which property of this file already says it. Seven of the
 * eight needed nothing new. The eighth wanted a mark that moves with the voice
 * and leaves nothing behind it, and that became `highlightMode: 'active'`,
 * which is the test this file sets itself: a look it cannot reach should become
 * a property rather than a branch.
 *
 * Two things in those looks this app still cannot set, both already written down
 * as gaps: letter spacing, which would have to go through the measurer to
 * survive invariant 2, and a condensed display face, which is another font file
 * against what is left of the APK's headroom. Rocket in particular is a
 * condensed poster face in the original and an extra-bold grotesk here.
 *
 * Line height is the third. It is one ratio for the whole app, and the research
 * asks for a tighter one on several of these; a global changed for one preset is
 * a global changed for ten, so it stays where it is until it is a property.
 *
 * The picker was budgeted for eight tiles without a redesign, and the grid
 * moving into one canvas took the ceiling off. Eighteen is past what that
 * redesign anticipated in *scrolling* rather than in drawing — see the note in
 * `StylePicker`.
 */
export const STYLE_PRESETS: { id: string; name: string; props: StyleProps }[] = [
  {
    id: 'focus',
    name: 'Focus',
    props: {
      // The default. Read along's mechanism — the whole line present, one word
      // marked — with the two things a look has to have when nobody has chosen
      // it: a background the app controls rather than one it hopes for, and a
      // mark that is a shape before it is a colour.
      highlightMode: 'box',
      // The word sitting on the pill. White on this blue is 5.32:1.
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      // The card is the edge here, so a stroke would only close up the counters.
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: FOCUS_BLUE,
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'bold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'line',
      // Kept under the card as well as over it: the card is 78% and the frame
      // behind it can be anything.
      shadow: { color: '#000000A6', blurRatio: 0.16, dxRatio: 0, dyRatio: 0.035 },
      // The one piece of movement, and it is three percent of a word's own size
      // over a sixth of a second. Every word waits a shade under full size and
      // settles as it is reached, which is a second cue for where the voice is
      // for anybody who cannot separate the blue from the white. It scales about
      // the word's own centre, so nothing on the line moves sideways, and
      // reduced motion turns it off without taking the colour with it.
      entrance: { scaleFrom: 0.97, dyRatio: 0, opacityFrom: 1, ms: 160 },
      plate: { color: NIGHT, padXRatio: 0.16, padYRatio: 0.08, radiusRatio: 0.14, shadow: NO_SHADOW },
      emphasis: {
        // White and slightly bigger. The default may not have an opinion about
        // the speaker's loudest word beyond letting it be felt, and a blue word
        // off the pill would be the one unreadable thing on a dark card.
        color: '#FFFFFF',
        scale: 1.12,
        fontFamily: SANS_FAMILY,
        weight: 'bold',
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
    id: 'readalong',
    name: 'Read along',
    props: {
      // The whole line waits on screen, dim, and each word turns solid the
      // instant it is said. Two colours and no movement at all: nothing shifts
      // under the reader, so the eye can be a word ahead of the voice, which is
      // the entire point of putting a sentence on a video somebody is watching
      // at speed.
      highlightMode: 'snap',
      highlightColor: '#FFFFFF',
      textColor: UNSAID,
      spokenColor: '#FFFFFF',
      // The shadow is the edge. A stroke at this weight closes up the counters
      // of a word set in white at speed.
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      // The dim is a colour here, not an opacity, because the user is given
      // both colours and an opacity on top of one of them would mean the swatch
      // they picked is not the colour they get.
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'line',
      shadow: { color: '#000000A6', blurRatio: 0.18, dxRatio: 0, dyRatio: 0.04 },
      entrance: NO_ENTRANCE,
      plate: NO_PLATE,
      emphasis: {
        // A touch bigger and nothing else. The word the speaker leaned on
        // should be felt rather than decorated, which is the same restraint
        // Focus inherited when it took this preset's place at the front.
        color: '#FFFFFF',
        scale: 1.14,
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
      position: CAPTION_BAND.lower,
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
      position: CAPTION_BAND.lower,
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
      position: CAPTION_BAND.upper,
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
      position: CAPTION_BAND.lower,
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
      position: CAPTION_BAND.lower,
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
        band: CAPTION_BAND.top,
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
      position: CAPTION_BAND.upper,
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
      position: CAPTION_BAND.upper,
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
      position: CAPTION_BAND.lower,
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
      position: CAPTION_BAND.upper,
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
  {
    id: 'bold',
    name: 'Bold yellow',
    props: {
      // The archetype: white caps, one yellow word, a hard dark edge. It is the
      // look most creator captions are a version of, and it is the reason
      // `active` exists — the mark is *where the voice is*, not how far it has
      // got, so nothing is left coloured behind it and there is exactly one
      // place on the frame for the eye to be.
      highlightMode: 'active',
      highlightColor: BOLD_YELLOW,
      textColor: '#FFFFFF',
      // Unused under `active` and set honestly anyway: a word that has been said
      // goes back to being a word.
      spokenColor: '#FFFFFF',
      // The one preset that keeps a real stroke. The archetype is a stroke, and
      // yellow on white needs a dark edge to be a colour rather than a glare.
      outlineColor: '#111111',
      outlineRatio: 0.05,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'line',
      shadow: { color: '#000000A6', blurRatio: 0.14, dxRatio: 0, dyRatio: 0.04 },
      // The pop, and it is the second cue the colour needs: the word grows into
      // its place as it is reached. Six percent rather than the ten a tap
      // animation would use, because every word on the line is wearing the
      // other end of it at once.
      entrance: { scaleFrom: 0.94, dyRatio: 0, opacityFrom: 1, ms: 150 },
      plate: NO_PLATE,
      emphasis: {
        color: BOLD_YELLOW,
        scale: 1.2,
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
    id: 'core',
    name: 'Core',
    props: {
      // The business default: nothing marks the word being spoken because the
      // reveal is the mark, and the only colour on the frame is the one word the
      // speaker leaned on. Sentence case, four words, a shadow and a short rise
      // — the look of a caption somebody chose rather than one an app added.
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      // The one preset set below extra-bold, which is most of why it reads as
      // professional rather than as a creator caption.
      weight: 'semibold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'word',
      shadow: { color: '#000000B3', blurRatio: 0.18, dxRatio: 0, dyRatio: 0.04 },
      entrance: { scaleFrom: 1, dyRatio: 0.1, opacityFrom: 0, ms: 220 },
      plate: NO_PLATE,
      emphasis: {
        color: CORAL,
        scale: 1.25,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: false,
        minScale: 1,
        fallbackScale: 1,
        riseFrom: 0.94,
        riseMs: 180,
      },
    },
  },
  {
    id: 'clarity',
    name: 'Clarity',
    props: {
      // The card does the work. A warm charcoal at 90% under the whole line
      // gives white type a 7.5:1 background whatever the video is doing, which
      // is the one thing no transparent caption can promise, and the line reads
      // by opacity so nothing on the card changes colour.
      highlightMode: 'fade',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 5,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'bold',
      upcomingOpacity: 0.5,
      uppercase: false,
      // The card is the size of the whole line from the moment it appears, for
      // the same reason Newsprint's is: a plate that grew a word at a time would
      // be the only thing on screen the eye follows.
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      plate: {
        color: CHARCOAL,
        padXRatio: 0.3,
        padYRatio: 0.13,
        radiusRatio: 0.09,
        shadow: { color: '#00000059', blurRatio: 0.2, dxRatio: 0, dyRatio: 0.08 },
      },
      emphasis: {
        color: ACCENT,
        scale: 1.25,
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
    id: 'negative',
    name: 'Negative',
    props: {
      // The inversion, and the most legible thing this app can draw: white caps
      // on a near-black card, and the word being said swaps the two round — ink
      // on a white pill. Both pairs are 21:1, which is as far as contrast goes.
      highlightMode: 'box',
      highlightColor: '#000000',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#FFFFFF',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SANS_FAMILY,
      weight: 'bold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'line',
      shadow: NO_SHADOW,
      entrance: NO_ENTRANCE,
      // Square-ish corners. A rounded card is a label; this one is a block of
      // ink, and the pill inside it is the only soft shape in the preset.
      plate: { color: '#000000F2', padXRatio: 0.24, padYRatio: 0.13, radiusRatio: 0.04, shadow: NO_SHADOW },
      emphasis: {
        // Weight and size only, like Clean subtitle. A third colour in a preset
        // whose whole argument is two of them would be a different preset.
        color: '#FFFFFF',
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
    id: 'sonnet',
    name: 'Sonnet',
    props: {
      // The slow one. A serif, a long soft arrival, a wide shadow and no colour
      // at all: the emphasis is italic and larger rather than gold, which is the
      // one preset here where the big word is a typographic decision instead of
      // a paint one. Reflective footage, read at the speed it was spoken.
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'S',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 4,
      maxRows: DEFAULT_MAX_ROWS,
      fontFamily: SERIF_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: false,
      reveal: 'word',
      // Wider and softer than anything else here. A serif has thin strokes and a
      // hard-edged shadow under one reads as a second, blurrier serif.
      shadow: { color: '#00000099', blurRatio: 0.26, dxRatio: 0, dyRatio: 0.05 },
      // Nearly four hundred milliseconds, against the hundred-and-something
      // every other revealing preset uses. Slowness is the whole content of this
      // look and it is the one property that says so.
      entrance: { scaleFrom: 1, dyRatio: 0.05, opacityFrom: 0, ms: 380 },
      plate: NO_PLATE,
      emphasis: {
        color: '#FFFFFF',
        scale: 1.5,
        fontFamily: SERIF_FAMILY,
        weight: 'extrabold',
        italic: true,
        ownRow: false,
        minScale: 1.2,
        fallbackScale: 1,
        riseFrom: 0.96,
        riseMs: 380,
      },
    },
  },
  {
    id: 'neonglow',
    name: 'Neon glow',
    props: {
      // The other neon, and the reason it is a second preset rather than a tweak
      // to the first: this one has no fill. Every word bleeds a halo of its own
      // colour, so the line glows white and the word being said glows pink, and
      // the mark is the halo changing colour rather than a fill crossing a word.
      highlightMode: 'active',
      highlightColor: HOT_PINK,
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      // A hairline, for the same reason Neon has one: inside a bloom the glyphs
      // need something holding their shape, which is a neon tube's dark rim.
      outlineColor: '#000000',
      outlineRatio: 0.02,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 3,
      maxRows: 2,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'word',
      // `OWN_COLOR` resolves against each word's own colour, so the halo follows
      // the swatch on the lit word and stays white under the rest of the line
      // without either being written down twice.
      shadow: { color: OWN_COLOR, blurRatio: 0.26, dxRatio: 0, dyRatio: 0 },
      entrance: { scaleFrom: 0.94, dyRatio: 0, opacityFrom: 0, ms: 230 },
      plate: NO_PLATE,
      emphasis: {
        color: HOT_PINK,
        scale: 1.6,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: false,
        minScale: 1.2,
        fallbackScale: 1,
        riseFrom: 0.88,
        riseMs: 230,
        shadow: { color: OWN_COLOR, blurRatio: 0.4, dxRatio: 0, dyRatio: 0 },
      },
    },
  },
  {
    id: 'rocket',
    name: 'Rocket',
    props: {
      // The loud one, and the only preset in this file that is deliberately bad
      // at being a default: two words at a time, all caps, a hard zoom in a
      // tenth of a second, and a lavender word twice the size of the line it
      // came out of. Reduced motion takes the zoom and the rise off it and
      // leaves a perfectly good caption, which is the whole reason the entrance
      // is computed in the layout rather than driven by an animator.
      highlightMode: 'none',
      highlightColor: '#FFFFFF',
      textColor: '#FFFFFF',
      spokenColor: '#FFFFFF',
      outlineColor: '#00000000',
      outlineRatio: 0,
      boxColor: '#00000000',
      boxShadow: NO_SHADOW,
      textSize: 'M',
      position: CAPTION_BAND.lower,
      align: 'center',
      maxWordsPerLine: 2,
      maxRows: 2,
      fontFamily: SANS_FAMILY,
      weight: 'extrabold',
      upcomingOpacity: 1,
      uppercase: true,
      reveal: 'word',
      shadow: { color: '#000000CC', blurRatio: 0.12, dxRatio: 0, dyRatio: 0.03 },
      // Arriving too big and slamming down, in a hundred milliseconds. Every
      // other entrance here is a settle; this one is a hit.
      entrance: { scaleFrom: 1.3, dyRatio: 0, opacityFrom: 0, ms: 100 },
      plate: NO_PLATE,
      emphasis: {
        color: LAVENDER,
        scale: 2.2,
        fontFamily: SANS_FAMILY,
        weight: 'extrabold',
        italic: false,
        ownRow: true,
        minScale: 1.4,
        fallbackScale: 1.2,
        riseFrom: 1.35,
        riseMs: 100,
        shadow: { color: OWN_COLOR, blurRatio: 0.34, dxRatio: 0, dyRatio: 0 },
      },
    },
  },
];

/** The six swatches offered next to the custom colour picker. */
export const HIGHLIGHT_SWATCHES = [ACCENT, '#3DDC84', '#FF5A5F', '#4D9BFF', '#C77DFF', '#FFFFFF'];

/**
 * The six offered for the words that are not being marked.
 *
 * A different six, because this control is answering a different question. The
 * body of a caption is white or near-white in almost every video ever posted,
 * and the interesting choices are how far down it goes — so the row runs white,
 * dimmed white, ink, and then the three accents that are worth setting a whole
 * line in.
 */
export const TEXT_SWATCHES = ['#FFFFFF', UNSAID, INK, ACCENT, '#3DDC84', '#4D9BFF'];

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
    position: captionPosition(merged.position, base.position),
    upcomingOpacity: Math.min(1, Math.max(0, merged.upcomingOpacity)),
    emphasis: {
      ...merged.emphasis,
      scale: Math.max(1, merged.emphasis.scale),
      minScale: Math.min(Math.max(1, merged.emphasis.minScale), Math.max(1, merged.emphasis.scale)),
      fallbackScale: Math.max(1, merged.emphasis.fallbackScale),
      band:
        merged.emphasis.band === undefined
          ? undefined
          : captionPosition(merged.emphasis.band, CAPTION_BAND.top),
    },
  };
}

/**
 * The four names positions used to have, and what each one now means.
 *
 * Every project written before this change carries one of these strings in its
 * overrides, and so does `settings.json`. They are read here rather than
 * migrated on disk: a migration is a pass over every file that has to be got
 * right once, and this is four words in the one function every style already
 * goes through.
 */
const LEGACY_BANDS: Record<string, number> = {
  top: CAPTION_BAND.top,
  upperMiddle: CAPTION_BAND.upper,
  middle: CAPTION_BAND.middle,
  lowerThird: CAPTION_BAND.lower,
};

/**
 * A position, whatever it arrives as.
 *
 * Rounded to a thousandth of the frame — two export pixels on a 1080-wide
 * frame, and finer than a finger can mean — so that a drag writes one tidy
 * number rather than sixteen decimal places, and so that two drags that landed
 * in the same place compare equal and `styleChoices` reports nothing chosen.
 */
/**
 * A position a finger chose, taken as a band when it lands near one.
 *
 * A drag that can produce 0.748 can never produce 0.75 again, and the three
 * chips would then never light up once one had been touched. Snapping is what
 * lets the shortcuts and the free control be the same setting: land close
 * enough to a band and you are on it, which is also how "put it back where it
 * was" stays a thing a thumb can do.
 */
export function snapPosition(value: number): CaptionPosition {
  for (const band of Object.values(CAPTION_BAND)) {
    if (Math.abs(value - band) <= BAND_SNAP) return band;
  }
  return captionPosition(value, CAPTION_BAND.lower);
}

export function captionPosition(value: unknown, fallback: CaptionPosition): CaptionPosition {
  if (typeof value === 'string') return LEGACY_BANDS[value] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

  const held = Math.min(POSITION_RANGE.max, Math.max(POSITION_RANGE.min, value));
  return Math.round(held * 1000) / 1000;
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
  if (marksBySpokenColor(style)) return style.highlightColor;
  return style.emphasis.color;
}

/**
 * The colour of the words this style is not marking.
 *
 * The other half of the pair, and the half that was missing: one control cannot
 * describe a caption whose whole design is two colours. In every preset it is
 * the same property — `textColor` is what an unmarked word is drawn in, whether
 * that means "waiting to be said" in `snap` and `karaoke`, "off the box" in box
 * highlight, or simply "the caption" where nothing is marked at all.
 */
export function captionTextColor(style: StyleProps): string {
  return style.textColor;
}

/**
 * Whether the mark is a colour on the word itself, rather than a box or nothing.
 *
 * The three that are: `karaoke` sweeps it across, `snap` puts it on whole, and
 * `active` puts it on and takes it off again. All three answer the swatch by
 * painting `highlightColor`, so all three are the same case here.
 */
function marksBySpokenColor(style: StyleProps): boolean {
  return (
    style.highlightMode === 'karaoke' ||
    style.highlightMode === 'snap' ||
    style.highlightMode === 'active'
  );
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
  if (marksBySpokenColor(style)) {
    return { highlightColor: color, spokenColor: color, emphasis };
  }
  return { emphasis };
}

/**
 * What picking a text colour changes, which is one property in every preset.
 *
 * Simpler than its opposite number above because there is nothing to decide:
 * an unmarked word is `textColor` wherever it appears. It is a function all the
 * same, so that the sheet writes both colours the same way and so that a preset
 * that one day paints its quiet words somewhere else has one place to say so.
 */
export function textColorOverrides(_style: StyleProps, color: string): StyleOverrides {
  return { textColor: color };
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
  /** Whatever `accentColor` would report: the colour this preset marks with. */
  color?: string;
  /** Whatever `captionTextColor` would report: the words it is not marking. */
  textColor?: string;
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
    textColor: chosen(captionTextColor(style), captionTextColor(preset)),
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
  if (choices.textColor !== undefined && choices.textColor !== captionTextColor(preset)) {
    Object.assign(overrides, textColorOverrides(preset, choices.textColor));
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
