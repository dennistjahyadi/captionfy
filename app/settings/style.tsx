/**
 * The style every new video starts in.
 *
 * Settings used to only report this — a row reading "Box highlight" that could
 * not be tapped, because the style had one home and it was the editor's sheet.
 * That reads as a broken row, and it left somebody with no project open unable
 * to change the one setting this app actually has.
 *
 * It is the same `StylePicker`, over a standing sample line instead of the
 * user's own words, because a picker with nothing to draw is four empty tiles.
 * The preview is the video's rectangle at 9:16 with no video behind it: the
 * shape this app is for, and the frame the export renders into.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { styleOverridesFor, type StyleChoices, type StyleOverrides } from '../../src/domain';
import { StylePicker } from '../../src/editor/StylePicker';
import { loadSettings, rememberStyle } from '../../src/project/settings';
import { CaptionLayer } from '../../src/render/CaptionLayer';
import { createFrameSource } from '../../src/render/frame';
import { createMeasureText } from '../../src/render/measure';
import { SAMPLE_LOOP_MS, sampleProject } from '../../src/render/sample';
import { useCaptionFonts } from '../../src/render/typefaces';
import { Label, QuietButton, Screen } from '../../src/ui/atoms';
import { useClock } from '../../src/ui/clock';
import { useReducedMotion } from '../../src/ui/motion';
import { containRect, SafeZone } from '../../src/ui/stage';
import { space } from '../../src/ui/theme';

/** Vertical video, which is the only shape this app is for. */
const SAMPLE_ASPECT = 9 / 16;

/**
 * How much of the screen the preview takes.
 *
 * The same share the editor's stage shrinks to while its style sheet is open,
 * and for the same reason: the controls are the tall half, and a preview big
 * enough to push the tiles off the screen is a look nobody can pick.
 */
const STAGE_SHARE = 0.3;

/**
 * How long after the last change the choice is written.
 *
 * The hue strip changes the colour on every frame of a drag, and settings.json
 * is not worth a file write per frame. Long enough to collapse a drag into one
 * write, short enough that it has landed before a thumb reaches Back — and the
 * way out flushes it anyway.
 */
const SAVE_DEBOUNCE_MS = 300;

export default function DefaultStyle() {
  const insets = useSafeAreaInsets();

  const [chosen, setChosen] = useState<{ styleId: string; styleOverrides: StyleOverrides }>(() => {
    const settings = loadSettings();
    return { styleId: settings.styleId, styleOverrides: settings.styleOverrides };
  });

  // Debounced, then flushed on the way out, which is the editor's own write
  // policy. Written here rather than only on Back because the system gesture is
  // a way out too — and written before the screen goes rather than only as it
  // goes, because Settings re-reads the row when it is uncovered and the two
  // orders are not guaranteed.
  const latest = useRef(chosen);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    rememberStyle(latest.current.styleId, latest.current.styleOverrides);
  }, []);

  useEffect(() => flush, [flush]);

  const project = useMemo(
    () => sampleProject(chosen.styleId, chosen.styleOverrides),
    [chosen.styleId, chosen.styleOverrides]
  );
  const source = useMemo(() => createFrameSource(project), [project]);

  const fonts = useCaptionFonts();
  // One measurer for the screen, not one per canvas: the preview and the four
  // tiles have to agree about the width of a word (invariant 2).
  const measure = useMemo(() => (fonts ? createMeasureText(fonts) : null), [fonts]);
  const reducedMotion = useReducedMotion();

  // No player here, so the clock is the sample's own: the line plays over and
  // over, and the loop is exactly the words' length so there is no silent gap
  // where the caption blinks out.
  const started = useRef(Date.now());
  const clock = useClock(useCallback(() => (Date.now() - started.current) % SAMPLE_LOOP_MS, []));

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const stageHeight = Math.round(windowHeight * STAGE_SHARE);
  const stage = containRect(windowWidth, stageHeight, SAMPLE_ASPECT);

  const onChange = useCallback(
    (styleId: string, choices: StyleChoices) => {
      const next = { styleId, styleOverrides: styleOverridesFor(styleId, choices) };
      latest.current = next;
      setChosen(next);

      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <QuietButton
          title="Back"
          onPress={() => {
            flush();
            router.back();
          }}
        />
        <Label variant="label" tone="mute">
          Default style
        </Label>
        <View style={styles.balance} />
      </View>

      <View style={[styles.stage, { height: stageHeight }]}>
        {fonts && measure ? (
          <View style={{ width: stage.width, height: stage.height }}>
            <CaptionLayer
              source={source}
              clock={clock}
              fonts={fonts}
              measure={measure}
              width={stage.width}
              height={stage.height}
              reducedMotion={reducedMotion}
            />
            <SafeZone />
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        {fonts && measure ? (
          <StylePicker
            project={project}
            aspect={SAMPLE_ASPECT}
            fonts={fonts}
            measure={measure}
            clock={clock}
            reducedMotion={reducedMotion}
            fill
            onChange={onChange}
          />
        ) : null}
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
        <Label variant="micro" tone="mute">
          Every new video starts here. The words above are a sample — changing this leaves the
          videos you have already captioned alone.
        </Label>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  balance: { width: 72 },
  stage: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  controls: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg },
  foot: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
