/**
 * Whether the phone asked for less movement.
 *
 * The emphasis rise is computed inside the layout, so the answer has to reach
 * `layoutCaptionFrame` rather than an animation driver. The export passes the
 * same value the preview used, or the file would move where the preview did not.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
