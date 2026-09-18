/**
 * A frame source, a clock, and the overlay between them.
 *
 * The only thing on a preview screen that redraws per frame. The canvas is the
 * video's own rectangle, not the screen's, so a caption a fifth of the way down
 * the preview is a fifth of the way down the exported file whatever the phone's
 * aspect ratio is.
 *
 * The editor and the default-style screen both draw captions this way, and a
 * second copy of the subscription would be a second place for the preview to
 * fall out of step with the layout (invariant 2).
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { layoutWatermark, type MeasureText } from '../domain';
import type { Clock } from '../ui/clock';
import { CaptionOverlay } from './CaptionOverlay';
import type { FrameSource } from './frame';
import type { FontLookup } from './typefaces';

export const CaptionLayer = memo(function CaptionLayer({
  source,
  clock,
  fonts,
  measure,
  width,
  height,
  reducedMotion,
  watermark = false,
  onFps,
}: {
  source: FrameSource;
  clock: Clock;
  fonts: FontLookup;
  measure: MeasureText;
  width: number;
  height: number;
  reducedMotion: boolean;
  /**
   * Draw the free tier's mark. Invariant 5: the preview shows it because the
   * exported file will, and finding it there afterwards is the surprise that
   * invariant forbids.
   */
  watermark?: boolean;
  onFps?: (fps: number) => void;
}) {
  const [tMs, setTMs] = useState(0);
  useEffect(() => clock.subscribe(setTMs), [clock]);

  const canvas = useMemo(() => ({ width, height }), [width, height]);
  const frame = source.frameAt(tMs, canvas, measure, { reducedMotion });

  // Once per canvas, not once per frame: the mark does not move, and this runs
  // inside the only component on the screen that redraws sixty times a second.
  const mark = useMemo(
    () => (watermark ? layoutWatermark(canvas, measure) : undefined),
    [watermark, canvas, measure]
  );

  useDrawCounter(onFps);

  return (
    <CaptionOverlay
      frame={frame}
      width={width}
      height={height}
      fonts={fonts}
      watermark={mark}
    />
  );
});

/** Counts committed draw lists per second. */
function useDrawCounter(report?: (fps: number) => void) {
  const drawn = useRef(0);

  useEffect(() => {
    drawn.current += 1;
  });

  useEffect(() => {
    if (!report) return;
    const handle = setInterval(() => {
      report(drawn.current);
      drawn.current = 0;
    }, 1000);
    return () => clearInterval(handle);
  }, [report]);
}
