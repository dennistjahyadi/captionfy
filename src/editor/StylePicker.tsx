/**
 * The style sheet.
 *
 * Nine presets and the properties every one of them exposes, because a preset
 * is a set of defaults and never a lock. What the user picks is stored as
 * choices rather than as a pile of properties, so a colour follows them from
 * preset to preset while Clean subtitle still looks like Clean subtitle.
 *
 * The tiles are not thumbnails. Each one lays out the line that is on screen
 * right now, through the same `layoutCaptionFrame` the preview and the export
 * use, at the video's own proportions and cropped to the caption. Nine little
 * drawings of what the button does, rather than nine pictures of what it did
 * for somebody else.
 *
 * They share one canvas. Nine of them would cost nine picture recordings a tick,
 * and the per-update work was already the expensive two thirds of this screen
 * at four; as translated groups in a single canvas it is one recording however
 * many presets the list grows to.
 */
import { Canvas, Group, LinearGradient, rect, Rect, vec } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutRectangle,
} from 'react-native';

import {
  accentColor,
  HIGHLIGHT_SWATCHES,
  projectStyle,
  styleChoices,
  styleOverridesFor,
  STYLE_PRESETS,
  type CaptionPosition,
  type MeasureText,
  type Project,
  type StyleChoices,
  type StyleOverrides,
  type TextSize,
} from '../domain';
import { CaptionElements } from '../render/CaptionOverlay';
import { createFrameSource, type FrameSource } from '../render/frame';
import type { FontLookup } from '../render/typefaces';
import { Label } from '../ui/atoms';
import type { Clock } from '../ui/clock';
import { hexToHue, hueToHex, HUE_STOPS } from '../ui/color';
import { color, MIN_TOUCH, radius, space } from '../ui/theme';
import { SheetAction } from './Sheet';

/**
 * How much of the caption band a tile shows, in points.
 *
 * Enough for Editorial's three rows at the largest size, which is the tallest
 * thing any preset can produce. Below that the tile clips the row above and
 * below the big word, which is the half of Editorial that makes it Editorial.
 */
const TILE_HEIGHT = 96;

/**
 * A preset's choices, with a big word in a band of its own brought back into
 * the block for the tile only.
 *
 * Spotlight puts a word across the top of the frame and the rest of the line in
 * the lower third, which is most of a phone screen apart. A tile is a hundred
 * points tall: shown honestly it is one word or the other, and a tile that
 * answers "what does this look like" with half the answer is worse than one
 * that shows the pieces together. The preview under the sheet is where the real
 * arrangement is, and it is on screen while the tile is being tapped.
 */
function tileOverrides(chosen: StyleOverrides): StyleOverrides {
  return { ...chosen, emphasis: { ...chosen.emphasis, band: undefined } };
}

/**
 * How often a tile redraws.
 *
 * Four of these animate beside the preview, and the preview is the one that has
 * to keep sixty frames a second. Twenty is plenty for a thumbnail: it is enough
 * to see a karaoke fill travel and a big word rise, which is the entire question
 * a tile answers.
 */
const TILE_INTERVAL_MS = 50;

/**
 * How much of the screen the controls may take before they scroll.
 *
 * The rest belongs to the preview, which is the thing being decided about. The
 * grid and the colour are in view from the start; size, position and words per
 * line are a thumb away.
 */
const SCROLL_SHARE = 0.4;

const SWATCH = 34;
const HUE_HEIGHT = 32;

/** The three the sheet offers. `top` exists in the domain and sits outside safety. */
const POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: 'upperMiddle', label: 'Upper' },
  { value: 'middle', label: 'Middle' },
  { value: 'lowerThird', label: 'Lower' },
];

const SIZES: { value: TextSize; label: string }[] = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
];

const WORDS_PER_LINE = [1, 2, 3, 4, 5];

export function StylePicker({
  project,
  aspect,
  fonts,
  measure,
  clock,
  reducedMotion,
  fill = false,
  onChange,
  onClose,
}: {
  project: Project;
  /** The video's own proportions, so a tile crops the frame the preview draws. */
  aspect: number;
  fonts: FontLookup;
  measure: MeasureText;
  clock: Clock;
  reducedMotion: boolean;
  /**
   * Take the height it is given instead of a share of the window.
   *
   * In the sheet the controls are a guest over the editor and the preview under
   * them is the thing being decided about, so they stop at `SCROLL_SHARE`. On a
   * screen of their own there is nothing underneath to protect.
   */
  fill?: boolean;
  onChange(styleId: string, choices: StyleChoices): void;
  /** Omitted where the screen's own bar is the way out: two of them is one too many. */
  onClose?(): void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);

  const style = projectStyle(project);
  const accent = accentColor(style);

  const choices = useMemo(
    () => styleChoices(project.styleId, project.styleOverrides),
    [project.styleId, project.styleOverrides]
  );

  // One frame source per preset, each with the same choices resolved onto it, so
  // a tile shows what tapping it would actually produce.
  const previews = useMemo(
    () =>
      STYLE_PRESETS.map((preset) => ({
        id: preset.id,
        name: preset.name,
        source: createFrameSource({
          ...project,
          styleId: preset.id,
          styleOverrides: tileOverrides(styleOverridesFor(preset.id, choices)),
        }),
      })),
    [project, choices]
  );

  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - space.sm) / 2) : 0;
  const set = (change: Partial<StyleChoices>) => onChange(project.styleId, { ...choices, ...change });

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Label variant="title">Style</Label>
          <Label variant="micro" tone="mute">
            The dashed box is what every platform leaves uncovered.
          </Label>
        </View>
        {onClose ? <SheetAction label="Done" onPress={onClose} tone="quiet" accent={accent} /> : null}
      </View>

      <ScrollView
        style={fill ? styles.fill : { maxHeight: Math.round(windowHeight * SCROLL_SHARE) }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <PresetGrid
          previews={previews}
          tileWidth={tileWidth}
          aspect={aspect}
          fonts={fonts}
          measure={measure}
          clock={clock}
          reducedMotion={reducedMotion}
          selectedId={project.styleId}
          accent={accent}
          onMeasure={setGridWidth}
          onPick={(id) => onChange(id, choices)}
        />

        <Field label="Highlight colour">
          <View style={styles.swatches}>
            {HIGHLIGHT_SWATCHES.map((swatch) => (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={`Highlight colour ${swatch}`}
                accessibilityState={{ selected: sameColor(swatch, accent) }}
                onPress={() => set({ color: swatch })}
                hitSlop={(MIN_TOUCH - SWATCH) / 2}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: swatch },
                  sameColor(swatch, accent) && styles.swatchOn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              />
            ))}
          </View>
          <HueStrip color={accent} onPick={(picked) => set({ color: picked })} />
        </Field>

        <Field label="Size">
          <Choices
            options={SIZES}
            value={style.textSize}
            accent={accent}
            onPick={(textSize) => set({ textSize })}
          />
        </Field>

        <Field label="Position">
          <Choices
            options={POSITIONS}
            value={style.position}
            accent={accent}
            onPick={(position) => set({ position })}
          />
        </Field>

        <Field label="Words per line">
          <Choices
            options={WORDS_PER_LINE.map((count) => ({ value: count, label: String(count) }))}
            value={style.maxWordsPerLine}
            accent={accent}
            onPick={(maxWordsPerLine) => set({ maxWordsPerLine })}
          />
        </Field>
      </ScrollView>
    </>
  );
}

interface Preview {
  id: string;
  name: string;
  source: FrameSource;
}

/**
 * Every preset, drawing the line that is on screen right now.
 *
 * The buttons are ordinary views laid out by the flow; the drawings are one
 * canvas over the top of them, with each preset a translated, clipped group
 * landing in the rectangle its button reported. One canvas because the cost
 * measured on the phone was a layout and a picture recording per tile, and
 * this is what turns nine of the second into one.
 *
 * Each preset lays out into a canvas the size of the whole frame at tile width,
 * and the tile is a window onto the caption in it. Laying out into a short
 * canvas instead would put a lower third a third of the way up a letterbox and
 * show the user a size the export will never produce.
 */
function PresetGrid({
  previews,
  tileWidth,
  aspect,
  fonts,
  measure,
  clock,
  reducedMotion,
  selectedId,
  accent,
  onMeasure,
  onPick,
}: {
  previews: Preview[];
  tileWidth: number;
  aspect: number;
  fonts: FontLookup;
  measure: MeasureText;
  clock: Clock;
  reducedMotion: boolean;
  selectedId: string;
  accent: string;
  onMeasure: (width: number) => void;
  onPick: (id: string) => void;
}) {
  const [tMs, setTMs] = useState(0);
  const [cells, setCells] = useState<Record<string, LayoutRectangle>>({});
  const shown = useRef(0);

  useEffect(
    () =>
      clock.subscribe((next) => {
        if (Math.abs(next - shown.current) < TILE_INTERVAL_MS) return;
        shown.current = next;
        setTMs(next);
      }),
    [clock]
  );

  const canvas = useMemo(
    () => ({ width: tileWidth, height: Math.max(TILE_HEIGHT, Math.round(tileWidth / aspect)) }),
    [tileWidth, aspect]
  );

  // A gap between two lines has nothing to centre on, and a tile that jumped
  // back to the top for those few frames would read as a flicker.
  const settled = useRef<Record<string, number>>({});

  const place = useCallback((id: string, layout: LayoutRectangle) => {
    setCells((current) =>
      current[id] && current[id].x === layout.x && current[id].y === layout.y
        ? current
        : { ...current, [id]: layout }
    );
  }, []);

  const grid = gridSize(cells);

  return (
    <View style={styles.grid} onLayout={(event) => onMeasure(event.nativeEvent.layout.width)}>
      {tileWidth > 0
        ? previews.map((preview) => (
            <PresetButton
              key={preview.id}
              id={preview.id}
              name={preview.name}
              width={tileWidth}
              selected={preview.id === selectedId}
              accent={accent}
              onLayout={place}
              onPick={onPick}
            />
          ))
        : null}

      {/* Over the buttons rather than under them, so a tile's own border and
          label are not painted on; transparent everywhere a caption is not, and
          never in the way of a tap. */}
      {tileWidth > 0 && grid ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Canvas style={{ width: grid.width, height: grid.height }}>
            {previews.map((preview) => {
              const cell = cells[preview.id];
              if (!cell) return null;

              const frame = preview.source.frameAt(tMs, canvas, measure, { reducedMotion });
              const offset = cropOffset(frame, canvas.height);
              if (offset !== null) settled.current[preview.id] = offset;

              return (
                <Group key={preview.id} clip={rect(cell.x, cell.y, tileWidth, TILE_HEIGHT)}>
                  <Group
                    transform={[
                      { translateX: cell.x },
                      { translateY: cell.y - (settled.current[preview.id] ?? 0) },
                    ]}
                  >
                    <CaptionElements frame={frame} fonts={fonts} />
                  </Group>
                </Group>
              );
            })}
          </Canvas>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One preset's button: the frame it is drawn in, its border and its name.
 *
 * Memoised and told nothing about time, so the twenty ticks a second that
 * redraw the canvas do not walk nine buttons' worth of views with them.
 */
const PresetButton = memo(function PresetButton({
  id,
  name,
  width,
  selected,
  accent,
  onLayout,
  onPick,
}: {
  id: string;
  name: string;
  width: number;
  selected: boolean;
  accent: string;
  onLayout: (id: string, layout: LayoutRectangle) => void;
  onPick: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      onPress={() => onPick(id)}
      onLayout={(event) => onLayout(id, event.nativeEvent.layout)}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.7 : 1 }, styles.tile]}
    >
      <View style={[styles.tileClip, selected && { borderColor: accent }]} />
      <Label variant="micro" tone={selected ? 'paper' : 'mute'}>
        {name}
      </Label>
    </Pressable>
  );
});

/** The canvas is as big as the rectangles the buttons reported, or there is none. */
function gridSize(cells: Record<string, LayoutRectangle>): { width: number; height: number } | null {
  const rects = Object.values(cells);
  if (rects.length === 0) return null;

  return {
    width: Math.max(...rects.map((cell) => cell.x + cell.width)),
    height: Math.max(...rects.map((cell) => cell.y + TILE_HEIGHT)),
  };
}

/** Where to cut the frame so the caption is in the middle of the tile. */
function cropOffset(
  frame: { plate?: { y: number; height: number }; words: { y: number; height: number }[] },
  canvasHeight: number
): number | null {
  if (frame.words.length === 0) return null;

  let top = Infinity;
  let bottom = -Infinity;
  for (const word of frame.words) {
    top = Math.min(top, word.y);
    bottom = Math.max(bottom, word.y + word.height);
  }
  // The card is the tile's whole picture where there is one, so it is what the
  // window has to be centred on.
  if (frame.plate) {
    top = Math.min(top, frame.plate.y);
    bottom = Math.max(bottom, frame.plate.y + frame.plate.height);
  }

  const centre = (top + bottom) / 2;
  return Math.min(Math.max(centre - TILE_HEIGHT / 2, 0), Math.max(0, canvasHeight - TILE_HEIGHT));
}

/**
 * Every hue, at the one saturation that reads on video.
 *
 * Drawn in Skia because it is a gradient and React Native has none; a strip of
 * solid slices fine enough not to band would be a hundred views.
 */
function HueStrip({ color: current, onPick }: { color: string; onPick: (color: string) => void }) {
  const [width, setWidth] = useState(0);
  const size = useRef(0);
  size.current = width;

  // The responder is built once and outlives the render that built it, so it
  // reads both the width and the callback through refs. Closing over the
  // callback instead meant a drag applied its colour to whatever preset had been
  // selected when the sheet opened, silently undoing a preset chosen since.
  const picked = useRef(onPick);
  picked.current = onPick;

  const grabbed = useRef(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          grabbed.current = event.nativeEvent.locationX;
          pick(grabbed.current);
        },
        // From where the finger went down, for the same reason the timing
        // handles are: the gradient under it does not move.
        onPanResponderMove: (_event, gesture) => pick(grabbed.current + gesture.dx),
      }),
    []
  );

  const hue = hexToHue(current);

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      accessibilityRole="adjustable"
      accessibilityLabel="Custom highlight colour"
      style={styles.hue}
    >
      {width > 0 ? (
        <Canvas style={{ width, height: HUE_HEIGHT }}>
          <Rect x={0} y={0} width={width} height={HUE_HEIGHT}>
            <LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={HUE_STOPS} />
          </Rect>
        </Canvas>
      ) : null}

      {hue !== null && width > 0 ? (
        <View style={[styles.hueThumb, { left: (hue / 360) * width - 2 }]} />
      ) : null}
    </View>
  );

  function pick(x: number) {
    if (size.current <= 0) return;
    const fraction = Math.min(1, Math.max(0, x / size.current));
    picked.current(hueToHex(fraction * 360));
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Label variant="micro" tone="mute">
        {label}
      </Label>
      {children}
    </View>
  );
}

function Choices<T extends string | number>({
  options,
  value,
  accent,
  onPick,
}: {
  options: { value: T; label: string }[];
  value: T;
  accent: string;
  onPick: (value: T) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(option.value)}
            style={({ pressed }) => [
              styles.choice,
              on && { borderColor: accent, backgroundColor: color.line },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Label variant="label" tone={on ? 'paper' : 'mute'}>
              {option.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Hex compared as a colour rather than as text, so case cannot decide a swatch. */
function sameColor(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  body: { gap: space.lg, paddingBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { gap: space.xs },
  tileClip: {
    height: TILE_HEIGHT,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.ink,
    overflow: 'hidden',
  },
  field: { gap: space.sm },
  swatches: { flexDirection: 'row', gap: space.sm },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: color.paper },
  hue: { height: HUE_HEIGHT, borderRadius: radius.control, overflow: 'hidden', justifyContent: 'center' },
  hueThumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: color.paper,
    borderRadius: radius.pill,
  },
  choices: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
  },
});
