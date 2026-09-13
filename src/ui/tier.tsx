/**
 * What the free tier costs, said the same way everywhere it is said.
 *
 * Invariant 5 is a promise about consistency as much as about timing: the count
 * on Home before the picker, on Export before the render and on Saved after it
 * have to be one sentence from one place, or the app has three opinions about
 * what the user owns. One component, three screens.
 *
 * The whole row is the tap target. The spec has a chip and a link side by side
 * and both go to the same screen, so making the gap between them dead would be a
 * miss the user cannot see the reason for.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FreeTierStatus } from '../policy/free-tier';
import { Label } from './atoms';
import { color, MIN_TOUCH, radius, space } from './theme';

export function FreeTierLine({
  tier,
  accent,
  onPress,
  style,
}: {
  tier: FreeTierStatus;
  accent: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  // Nothing at all once they have paid. Not a green tick, not a thank you: the
  // reward for buying it is never being sold to again.
  if (tier.line === '') return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tier.line}. Unlock everything.`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <View style={styles.chip}>
        <Label variant="micro" tone="mute">
          {tier.line}
        </Label>
      </View>
      <Label variant="micro" style={{ color: accent }}>
        Unlock everything →
      </Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
});
