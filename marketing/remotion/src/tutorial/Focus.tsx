import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT } from '../brand';
import { Tap } from '../Phone';
import { BEZEL, BORDER, PHONE_LEFT, PHONE_TOP, SCALE } from '../parts';

/**
 * A move in on one part of the app, and back out.
 *
 * The first cut of this video showed a *band* of the screen per beat and was
 * rejected for it: a viewer who has never seen the app cannot tell a cropped
 * band from a whole screen, so every cut looked like a different app. The
 * second cut answered that by never cropping at all — the whole 1080 × 2400
 * inside a device, for every beat — and bought honesty at the price of a
 * minute of a phone sitting still while a voice talks over it.
 *
 * This is the third answer and it keeps both halves. Every beat **opens on the
 * whole screen**, so the viewer is placed, and then moves in on the one control
 * the sentence is about, and comes back out before the cut. Nothing is ever
 * shown cropped without first having been shown whole.
 *
 * **The region is given in the recording's own pixels**, which is the part that
 * matters for the app's spacing. A rectangle typed in frame coordinates would
 * have to be re-derived every time `SCALE` or the framing moved, and would
 * drift off the control it was drawn around; in device pixels it is read
 * straight off a screenshot of the app and stays true to the app's own padding
 * — a focus box round a card is the card's own bounds plus the app's own
 * margin, not a crop that happens to look about right.
 */
export type FocusRegion = {
  /** The region, in the recording's 1080 × 2400 space. */
  deviceX: number;
  deviceY: number;
  deviceW: number;
  deviceH: number;
  /** Seconds into the segment: when to move in, and when to start coming out. */
  inSec: number;
  outSec: number;
  /** How wide the region should end up, as a fraction of frame width. */
  fill?: number;
  /** Draw the accent rectangle around it. Default true. */
  box?: boolean;
  /**
   * Move the camera, or only mark the control where it stands. Default true.
   *
   * Zooming is how a beat says "this one", and it works until it is the answer
   * to every beat — eight moves in fifty seconds is a tic, and the eye starts
   * watching the camera instead of the app. Most controls here are legible at
   * full size and need marking rather than magnifying: the box and the tap draw
   * in place, nothing moves, and the shot stays still. The push-in is kept for
   * the two or three targets that genuinely cannot be read otherwise — the
   * aeroplane in the status bar is thirty device pixels.
   */
  zoom?: boolean;
  /** Seconds into the segment to press the control, if this beat leads to the next screen. */
  tapAt?: number;
};

const SCREEN_X = PHONE_LEFT + BORDER + BEZEL;
const SCREEN_Y = PHONE_TOP + BORDER + BEZEL;

/** A device rectangle, in finished-frame pixels. */
export const deviceRect = (r: FocusRegion) => ({
  x: SCREEN_X + r.deviceX * SCALE,
  y: SCREEN_Y + r.deviceY * SCALE,
  w: r.deviceW * SCALE,
  h: r.deviceH * SCALE,
});

export const Focus: React.FC<{
  region?: FocusRegion;
  children: React.ReactNode;
}> = ({ region, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (!region) return <>{children}</>;

  const rect = deviceRect(region);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  const zooming = region.zoom !== false;
  const target = (width * (region.fill ?? 0.68)) / rect.w;
  // Never push the device so large that the move reads as a jump rather than a
  // lean. Past about 2.6 the recording's own pixels start to show.
  const scale = zooming ? Math.min(target, 2.6) : 1;

  const inAt = Math.round(region.inSec * fps);
  const outAt = Math.round(region.outSec * fps);

  // Springs in both directions: a linear zoom is the corporate product video
  // this project keeps arguing against, and the settle at the end of a spring
  // is most of what makes a move read as deliberate.
  // Slower than it was. A move that takes most of a second reads as a camera
  // finding something; one that takes half a second reads as a cut that did not
  // commit. The way back is slower still, because leaving is not news.
  const going = spring({
    frame: frame - inAt,
    fps,
    config: { damping: 200, stiffness: 62, mass: 1.3 },
    durationInFrames: 34,
  });
  const back = spring({
    frame: frame - outAt,
    fps,
    config: { damping: 200, stiffness: 70, mass: 1.15 },
    durationInFrames: 28,
  });
  const k = going * (1 - back);

  const s = 1 + (scale - 1) * k;
  // With no zoom there is nothing to recentre, so the shot holds still and only
  // the mark arrives.
  const move = zooming ? k : 0;
  // Where the region's centre should sit once we are in: a little above the
  // middle, because the subtitle block owns the lower quarter.
  const toX = width / 2;
  const toY = height * 0.46;

  return (
    <>
      <div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: `${cx}px ${cy}px`,
          transform: `translate(${(toX - cx) * move}px, ${(toY - cy) * move}px) scale(${s})`,
        }}
      >
        {children}
      </div>
      {region.box === false ? null : (
        <FocusBox rect={rect} cx={cx} cy={cy} k={k} move={move} s={s} toX={toX} toY={toY} />
      )}
      {/* The tap that gets you to the next screen.
          A tutorial that cuts from one screen to the next asks the viewer to
          believe a step happened off camera. The ring contracts onto the
          control the beat has just been holding, a beat before the hand-off, so
          the next screen arrives as the consequence of something rather than as
          a new shot. It rides the move's transform like the box does, or it
          would land next to the thing it is tapping. */}
      {region.tapAt === undefined ? null : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transformOrigin: `${cx}px ${cy}px`,
            transform: `translate(${(toX - cx) * move}px, ${(toY - cy) * move}px) scale(${s})`,
            pointerEvents: 'none',
          }}
        >
          <Tap x={cx} y={cy} at={Math.round(region.tapAt * fps)} />
        </div>
      )}
    </>
  );
};

/**
 * The rectangle that says which control is being talked about.
 *
 * It rides the same transform as the phone, so it stays exactly on the control
 * rather than sliding against it, and it fades in behind the move rather than
 * with it — a box that arrives at the same instant as the zoom reads as a
 * screenshot annotation, where one that catches up reads as a camera finding
 * the thing.
 */
const FocusBox: React.FC<{
  rect: { x: number; y: number; w: number; h: number };
  cx: number;
  cy: number;
  k: number;
  move: number;
  s: number;
  toX: number;
  toY: number;
}> = ({ rect, cx, cy, k, move, s, toX, toY }) => {
  const pad = 10;
  const show = interpolate(k, [0.45, 0.85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (show <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        transformOrigin: `${cx}px ${cy}px`,
        transform: `translate(${(toX - cx) * move}px, ${(toY - cy) * move}px) scale(${s})`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: rect.x - pad,
          top: rect.y - pad,
          width: rect.w + pad * 2,
          height: rect.h + pad * 2,
          // Hairlines, because the box is drawn at up to 2.6× and a 3 px border
          // would be 8 px of yellow around a control that is 40 px tall.
          border: `${2 / s}px solid ${ACCENT}`,
          borderRadius: 14 / s,
          boxShadow: `0 0 ${24 / s}px rgba(255,224,61,0.35)`,
          opacity: show * 0.95,
        }}
      />
    </div>
  );
};

/**
 * How far into a move the beat is, at this frame, without rendering anything.
 *
 * The headline sits above the phone's head and the phone grows when it leans
 * in, so the two collide — the label ends up printed across the app's own
 * status bar. Rather than shrink the move until they never touch, which would
 * cost the move most of its point, the chrome stands down while the move is
 * happening and comes back when it is over. By then the headline has done its
 * job anyway: the subtitle is carrying the sentence and the box is carrying
 * the attention.
 *
 * This is the same arithmetic `Segments` uses to place the segments, repeated
 * rather than shared because sharing it would mean threading a context through
 * the phone to reach a label that is not inside it. Eased rather than sprung:
 * it only drives an opacity, and a spring on an opacity is a flicker.
 */
export const focusDim = (
  segments: { durationSec?: number; focus?: FocusRegion }[] | undefined,
  beatFrames: number,
  frame: number,
  fps: number,
  /** Frames the segments start after the beat does — a beat with an intro. */
  offset = 0
): number => {
  if (!segments?.length) return 0;
  frame -= offset;
  beatFrames -= offset;

  const fixed = segments.reduce(
    (n, s) => n + (s.durationSec ? Math.round(s.durationSec * fps) : 0),
    0
  );
  const loose = segments.filter((s) => !s.durationSec).length;
  const spare = Math.max(0, beatFrames - fixed);

  let at = 0;
  for (const seg of segments) {
    const frames = seg.durationSec
      ? Math.round(seg.durationSec * fps)
      : Math.max(1, Math.round(spare / Math.max(1, loose)));
    const local = frame - at;
    at += frames;
    if (local < 0 || local >= frames || !seg.focus) continue;
    const inAt = seg.focus.inSec * fps;
    const outAt = seg.focus.outSec * fps;
    return interpolate(local, [inAt, inAt + 14, outAt, outAt + 16], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }
  return 0;
};

/**
 * Where a beat's moves begin and end, in frames from the beat's first frame.
 *
 * `Sfx` needs this and only this: it does not care where the camera goes, only
 * when it starts going. Same segment arithmetic as `focusDim`, returned rather
 * than sampled, because a sound is placed once at a frame where an opacity is
 * evaluated at every frame.
 */
export const focusMoves = (
  segments: { durationSec?: number; focus?: FocusRegion }[] | undefined,
  beatFrames: number,
  fps: number,
  /** Frames the segments start after the beat does — a beat with an intro. */
  offset = 0
): { inAt: number; outAt: number }[] => {
  if (!segments?.length) return [];
  beatFrames -= offset;

  const fixed = segments.reduce(
    (n, s) => n + (s.durationSec ? Math.round(s.durationSec * fps) : 0),
    0
  );
  const loose = segments.filter((s) => !s.durationSec).length;
  const spare = Math.max(0, beatFrames - fixed);

  const out: { inAt: number; outAt: number }[] = [];
  let at = 0;
  for (const seg of segments) {
    const frames = seg.durationSec
      ? Math.round(seg.durationSec * fps)
      : Math.max(1, Math.round(spare / Math.max(1, loose)));
    if (seg.focus) {
      out.push({
        inAt: offset + at + Math.round(seg.focus.inSec * fps),
        outAt: offset + at + Math.round(seg.focus.outSec * fps),
      });
    }
    at += frames;
  }
  return out;
};
