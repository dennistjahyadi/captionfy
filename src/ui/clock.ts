/**
 * One read of the player's clock per display frame, broadcast to whoever wants it.
 *
 * The caption overlay, the scrubber and the transcript all follow playback, and
 * all three hanging their own state off the screen would re-render the video
 * view sixty times a second along with them. The clock is a stable object, so
 * the screen that owns it never re-renders; only the pieces that subscribe do,
 * and only when the value they took from the tick actually changed.
 */
import { useEffect, useMemo, useRef } from 'react';

export type ClockListener = (tMs: number) => void;

export interface Clock {
  subscribe(listener: ClockListener): () => void;
}

/**
 * `read` is called once per frame and must be cheap: it is a property read on
 * the native player, not a round trip.
 */
export function useClock(read: () => number): Clock {
  const reader = useRef(read);
  reader.current = read;

  const listeners = useRef<Set<ClockListener>>(new Set());

  useEffect(() => {
    let handle = requestAnimationFrame(function tick() {
      const tMs = reader.current();
      listeners.current.forEach((listener) => listener(tMs));
      handle = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(handle);
  }, []);

  return useMemo<Clock>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    []
  );
}
