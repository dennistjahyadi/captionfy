/**
 * The curtain: the whole screen says "wait", and nothing on it can be touched.
 *
 * It drops when a video is picked and stays until the next screen has the
 * project. The picker copies the file into this app's cache before it hands
 * control back, which on a long clip is seconds, and for those seconds Home used
 * to sit there fully tappable with a spinner on one button. Somebody could open
 * Settings, or a second project, halfway through making the first.
 *
 * It is a view over the screen rather than a `Modal`, on purpose. A modal is a
 * window above every screen, so one left down across the push to Processing
 * would cover Processing too; a view is part of the screen it is on and the
 * pushed screen covers it, so the screen underneath can keep it down until it
 * is looked at again and never be seen uncovering itself. What a view does not
 * own is the Android back button, so that is taken separately for as long as
 * the curtain is up.
 *
 * The animation is the product's own signature, a box highlight stepping word to
 * word along the message, and it runs on the native driver so that it keeps
 * moving while the JS thread is busy moving the file. Under reduced motion the
 * first word is highlighted and nothing moves.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, View } from 'react-native';

import { Label } from './atoms';
import { useReducedMotion } from './motion';
import { color, DEFAULT_ACCENT, ON_ACCENT, radius, space } from './theme';

/** How long the highlight sits on each word. */
const STEP_MS = 520;
/** How long the curtain takes to drop. */
const FADE_MS = 180;

export function Curtain({ title, note }: { title: string; note?: string }) {
  const reducedMotion = useReducedMotion();
  const words = useMemo(() => title.split(' '), [title]);
  const step = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      fade.setValue(1);
      step.setValue(0);
      return;
    }

    Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(step, {
        toValue: words.length,
        duration: words.length * STEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [fade, reducedMotion, step, words.length]);

  return (
    <Animated.View
      style={[styles.screen, { opacity: fade }]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityViewIsModal
    >
      <View style={styles.line}>
        {words.map((word, index) => (
          <Word key={`${index}-${word}`} word={word} index={index} step={step} />
        ))}
      </View>
      {note ? (
        <Label variant="label" tone="mute" style={styles.note}>
          {note}
        </Label>
      ) : null}
    </Animated.View>
  );
}

/**
 * One word, and the highlight that lands on it for its turn.
 *
 * Two copies of the text on top of each other: the plain one always there, the
 * boxed one fading in for its step. Colour is not a native-driven property but
 * opacity is, so the highlighted word is a second layer rather than a recolour.
 */
function Word({ word, index, step }: { word: string; index: number; step: Animated.Value }) {
  const on = step.interpolate({
    inputRange: [index - 0.01, index, index + 0.99, index + 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.word}>
      <Label variant="title" style={styles.text}>
        {word}
      </Label>
      <Animated.View style={[styles.box, { opacity: on }]}>
        <Label variant="title" style={[styles.text, styles.onBox]}>
          {word}
        </Label>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Every edge, spelled out: `absoluteFillObject` is not in this React Native's types. */
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: space.xs,
  },
  word: { paddingHorizontal: space.xs },
  text: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  box: {
    position: 'absolute',
    top: 0,
    left: space.xs,
    right: space.xs,
    bottom: 0,
    backgroundColor: DEFAULT_ACCENT,
    borderRadius: radius.control,
  },
  onBox: { color: ON_ACCENT },
  note: { textAlign: 'center' },
});
