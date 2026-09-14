/**
 * The rectangle a caption is drawn into, and the box it should stay inside.
 *
 * Both used to live in the editor screen, which was the only place with a
 * preview in it. The default-style screen is the second, and a second copy of
 * the safe zone is two answers to "what does every platform cover".
 */
import { StyleSheet, View } from 'react-native';

import { safeZoneUnion } from '../domain';
import { color, radius } from './theme';

/** The largest box of `aspect` that fits, which is what `contentFit="contain"` draws. */
export function containRect(boxWidth: number, boxHeight: number, aspect: number) {
  const width = boxHeight * aspect;
  return width <= boxWidth
    ? { width: Math.round(width), height: boxHeight }
    : { width: boxWidth, height: Math.round(boxWidth / aspect) };
}

/**
 * What all three platforms leave uncovered, dashed over the preview.
 *
 * Fractions of the frame, so it lands in the same place on the export, and drawn
 * over the video rather than over the stage: the letterbox is not part of
 * anybody's post. A warning and not a rule — a caption is allowed to sit outside
 * it, and some of them should.
 */
export function SafeZone() {
  const zone = safeZoneUnion();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.safeZone,
        {
          top: `${zone.top * 100}%`,
          bottom: `${zone.bottom * 100}%`,
          left: `${zone.left * 100}%`,
          right: `${zone.right * 100}%`,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  safeZone: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.signal,
    borderRadius: radius.control,
  },
});
