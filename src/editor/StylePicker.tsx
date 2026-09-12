/**
 * The style sheet.
 *
 * Four presets and the properties every one of them exposes, because a preset is
 * a set of defaults and never a lock. What the user picks is stored as choices
 * rather than as a pile of properties, so a colour follows them from preset to
 * preset while Clean subtitle still looks like Clean subtitle.
 *
 * The tiles are not thumbnails. Each one lays out the line that is on screen
 * right now, through the same `layoutCaptionFrame` the preview and the export
 * use, at the video's own proportions and cropped to the caption. Four little
 * drawings of what the button does, rather than four pictures of what it did for
 * somebody else.
 */
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

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
  type TextSize,
} from '../domain';
import { CaptionOverlay } from '../render/CaptionOverlay';
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
  onChange(styleId: string, choices: StyleChoices): void;
  onClose(): void;
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
          styleOverrides: styleOverridesFor(preset.id, choices),
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
        <SheetAction label="Done" onPress={onClose} tone="quiet" accent={accent} />
      </View>

      <ScrollView
        style={{ maxHeight: Math.round(windowHeight * SCROLL_SHARE) }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
          {tileWidth > 0
            ? previews.map((preview) => (
                <PresetTile
                  key={preview.id}
                  name={preview.name}
                  source={preview.source}
                  width={tileWidth}
                  aspect={aspect}
                  fonts={fonts}
                  measure={measure}
                  clock={clock}
                  reducedMotion={reducedMotion}
                  selected={preview.id === project.styleId}
                  accent={accent}
                  onPick={() => onChange(preview.id, choices)}
                />
              ))
            : null}
        </View>

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

/**
 * One preset, drawing the current line.
 *
 * The canvas is the whole frame at tile width, and the tile is a window onto the
 * caption in it. Laying out into a short canvas instead would put a lower third
 * a third of the way up a letterbox and show the user a size the export will
 * never produce.
 */
const PresetTile = memo(function PresetTile({
  name,
  source,
  width,
  aspect,
  fonts,
  measure,
  clock,
  reducedMotion,
  selected,
  accent,
  onPick,
}: {
  name: string;
  source: FrameSource;
  width: number;
  aspect: number;
  fonts: FontLookup;
  measure: MeasureText;
  clock: Clock;
  reducedMotion: boolean;
  selected: boolean;
  accent: string;
  onPick: () => void;
}) {
  const [tMs, setTMs] = useState(0);
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
    () => ({ width, height: Math.max(TILE_HEIGHT, Math.round(width / aspect)) }),
    [width, aspect]
  );
  const frame = source.frameAt(tMs, canvas, measure, { reducedMotion });

  // A gap between two lines has nothing to centre on, and a tile that jumped
  // back to the top for those few frames would read as a flicker.
  const settled = useRef(0);
  const offset = cropOffset(frame, canvas.height);
  if (offset !== null) settled.current = offset;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      onPress={onPick}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.7 : 1 }, styles.tile]}
    >
      <View style={[styles.tileClip, selected && { borderColor: accent }]}>
        <View style={{ position: 'absolute', top: -settled.current, width: canvas.width, height: canvas.height }}>
          <CaptionOverlay frame={frame} width={canvas.width} height={canvas.height} fonts={fonts} />
        </View>
      </View>
      <Label variant="micro" tone={selected ? 'paper' : 'mute'}>
        {name}
      </Label>
    </Pressable>
  );
});

/** Where to cut the frame so the caption is in the middle of the tile. */
function cropOffset(frame: { words: { y: number; height: number }[] }, canvasHeight: number): number | null {
  if (frame.words.length === 0) return null;

  let top = Infinity;
  let bottom = -Infinity;
  for (const word of frame.words) {
    top = Math.min(top, word.y);
    bottom = Math.max(bottom, word.y + word.height);
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
