/**
 * The plane every editing surface is docked in.
 *
 * Three sheets now — word, timing, shift — and the style picker next. Pulled out
 * because a sheet a few pixels taller or a shade lighter than the one before it
 * reads as a different app rather than as a different action, and because the
 * dismissal rule has to be the same on all of them: the backdrop and the Android
 * back button both mean leave, changing nothing. A sheet that committed on
 * dismissal would commit when a phone went into a pocket.
 *
 * There is one of these mounted at a time and the contents change inside it.
 * Unmounting one `Modal` in the same commit that mounts another leaves Android
 * showing neither: the timing sheet opened from the word sheet and nothing
 * appeared at all, which is how this was found.
 */
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Label } from '../ui/atoms';
import { useReducedMotion } from '../ui/motion';
import { color, MIN_TOUCH, radius, space } from '../ui/theme';

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  // Asked here rather than passed in: the slide belongs to this component, and a
  // caller that had to remember to turn it off would eventually forget.
  const reducedMotion = useReducedMotion();

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.dock}
      >
        <View style={styles.sheet}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type ActionTone = 'tile' | 'quiet' | 'accent' | 'danger';

/**
 * A sheet action: a label, and no icon.
 *
 * No icon set has been chosen, and one hand-drawn glyph per action would be four
 * inconsistent marks where four words are already unambiguous.
 */
export function SheetAction({
  label,
  onPress,
  tone,
  accent,
  accessibilityLabel,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone: ActionTone;
  accent: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'tile' && styles.tile,
        tone === 'accent' && { backgroundColor: accent, borderColor: accent },
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Label
        variant="label"
        tone={tone === 'danger' ? 'signal' : 'paper'}
        style={tone === 'accent' ? styles.onAccent : undefined}
      >
        {label}
      </Label>
    </Pressable>
  );
}

/** Where a held button starts repeating, and how fast it goes once it does. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 110;

/**
 * A button that steps once on a tap and keeps stepping while it is held.
 *
 * `onSettle` fires when the finger comes up, once, however many steps went by.
 * That is what the loop hangs off: re-seeking the player eight times a second
 * under a held finger would play nothing but the same forty milliseconds of
 * pre-roll over and over.
 */
export function RepeatButton({
  label,
  accessibilityLabel,
  onStep,
  onSettle,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onStep: () => void;
  onSettle?: () => void;
  disabled?: boolean;
}) {
  // The timers outlive the render that started them, so they call through refs
  // rather than closing over the values of one particular render.
  const step = useRef(onStep);
  step.current = onStep;
  const settle = useRef(onSettle);
  settle.current = onSettle;

  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});

  const clear = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.repeat) clearInterval(timers.current.repeat);
    timers.current = {};
  }, []);

  useEffect(() => clear, [clear]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPressIn={() => {
        step.current();
        timers.current.delay = setTimeout(() => {
          timers.current.repeat = setInterval(() => step.current(), REPEAT_INTERVAL_MS);
        }, REPEAT_DELAY_MS);
      }}
      onPressOut={() => {
        clear();
        settle.current?.();
      }}
      style={({ pressed }) => [
        styles.action,
        styles.stepper,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Label variant="label">{label}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099' },
  dock: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  action: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flex: 1, borderWidth: 1, borderColor: color.line },
  stepper: { minWidth: MIN_TOUCH + space.lg, borderWidth: 1, borderColor: color.line },
  onAccent: { color: '#111111' },
});
