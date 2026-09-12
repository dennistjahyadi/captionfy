/**
 * The handful of pieces every screen is built from.
 *
 * Small on purpose. A caption app has four screens and the video is the hero on
 * all of them, so the chrome needs a button, a label and a divider, not a
 * component library.
 */
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { color, MIN_TOUCH, radius, space, type } from './theme';

type Variant = keyof typeof type;

export function Label({
  children,
  variant = 'body',
  tone = 'paper',
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: Variant;
  tone?: 'paper' | 'mute' | 'signal' | 'accent';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const tones = { paper: color.paper, mute: color.mute, signal: color.signal, accent: color.paper };
  return (
    <Text numberOfLines={numberOfLines} style={[type[variant], { color: tones[tone] }, style]}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  title,
  onPress,
  accent,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  accent: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: accent, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#111111" />
      ) : (
        <Text style={[type.heading, styles.primaryLabel]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function QuietButton({
  title,
  onPress,
  tone = 'mute',
}: {
  title: string;
  onPress: () => void;
  tone?: 'mute' | 'signal';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quiet, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[type.label, { color: tone === 'signal' ? color.signal : color.mute }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Determinate, driven by real audio processed. There is no indeterminate state. */
export function ProgressBar({ fraction, accent }: { fraction: number; accent: string }) {
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` as const;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width, backgroundColor: accent }]} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  primary: {
    minHeight: MIN_TOUCH + 8,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  primaryLabel: { color: '#111111' },
  quiet: {
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  divider: { height: 1, backgroundColor: color.line },
});
