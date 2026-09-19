import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

import { ACCENT, color, font } from './brand';

/**
 * The device the app runs on, and the reason the rebuild happened.
 *
 * The first cut of these ads was word-by-word text floating on a blurred
 * gradient. It could have been an ad for any captions tool on earth, because it
 * never once showed the product. The highest-performing hook type is
 * product/outcome showcase — the payoff in the opening frame — and a payoff the
 * viewer cannot identify is not one.
 */
export const PHONE = {
  width: 640,
  height: 1300,
  bezel: 13,
  radius: 54,
  statusHeight: 46,
} as const;

export const SCREEN = {
  width: PHONE.width - PHONE.bezel * 2,
  height: PHONE.height - PHONE.bezel * 2 - PHONE.statusHeight,
} as const;

/** A plane, drawn, because Be Vietnam Pro has no aeroplane glyph. */
const PlaneIcon: React.FC<{ size: number; fill: string }> = ({ size, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path
      d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"
      fill={fill}
    />
  </svg>
);

const StatusBar: React.FC<{ airplane?: boolean }> = ({ airplane = false }) => (
  <div
    style={{
      height: PHONE.statusHeight,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 26px',
      fontFamily: font.semibold,
      fontSize: 22,
      color: color.paper,
    }}
  >
    <span>9:41</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {airplane ? (
        <PlaneIcon size={22} fill={ACCENT} />
      ) : (
        <span style={{ color: color.mute, fontSize: 20 }}>LTE</span>
      )}
      <span
        style={{
          width: 30,
          height: 15,
          borderRadius: 4,
          border: `2px solid ${color.mute}`,
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            bottom: 2,
            width: 17,
            borderRadius: 2,
            background: color.paper,
          }}
        />
      </span>
    </span>
  </div>
);

/**
 * A cut, with weight.
 *
 * Every shot change in these ads is a hard cut rather than a transition — a
 * smooth zoom reads as a corporate product video, and the whole finding behind
 * this rebuild is that the corporate product video is what gets scrolled past.
 * What a cut still wants is a frame or two of overshoot, or it reads as a
 * slideshow.
 */
export const Punch: React.FC<{ children: React.ReactNode; from?: number }> = ({
  children,
  from = 1.05,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${from + (1 - from) * t})`,
        opacity: interpolate(frame, [0, 3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    >
      {children}
    </div>
  );
};

/**
 * The device, scaled up until it runs off the bottom of the frame.
 *
 * At its natural size it sat in the middle of a 1080 × 1920 canvas with a third
 * of the frame empty around it, which is a product-page composition, not a feed
 * one. Bleeding it off the bottom edge fills the frame and puts the part that
 * matters — the top of the screen — where the eye already is. The screens
 * themselves are still laid out at 640 × 1300 and scaled as a unit, so none of
 * `screens.tsx` has to know.
 */
export const Phone: React.FC<{
  children: React.ReactNode;
  airplane?: boolean;
  /** Where the top of the device sits in the 1080 × 1920 frame. */
  top?: number;
  scale?: number;
}> = ({ children, airplane = false, top = 300, scale = 1.42 }) => (
  <div
    style={{
      position: 'absolute',
      left: (1080 - PHONE.width * scale) / 2,
      top,
      width: PHONE.width,
      height: PHONE.height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      borderRadius: PHONE.radius,
      background: color.ink,
      border: `3px solid ${color.line}`,
      boxShadow: '0 40px 90px rgba(0,0,0,0.75)',
      padding: PHONE.bezel,
      overflow: 'hidden',
    }}
  >
    <StatusBar airplane={airplane} />
    <div
      style={{
        width: SCREEN.width,
        height: SCREEN.height,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {children}
    </div>
  </div>
);

/**
 * A tap. Not a cursor — a finger-sized ring that contracts onto the point, so
 * the viewer reads it as a thumb without a hand being drawn.
 */
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0 || frame > 24) return null;

  const press = interpolate(frame, [0, 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const ripple = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 46,
          top: y - 46,
          width: 92,
          height: 92,
          borderRadius: 999,
          border: `6px solid ${color.paper}`,
          opacity: 0.45 + press * 0.55,
          transform: `scale(${0.7 + press * 0.7})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 46,
          top: y - 46,
          width: 92,
          height: 92,
          borderRadius: 999,
          background: color.paper,
          opacity: (1 - ripple) * 0.55,
          transform: `scale(${0.4 + ripple * 1.9})`,
        }}
      />
    </>
  );
};

/**
 * The one line of commentary a shot is allowed.
 *
 * Above the phone, not over it: covering the app in an ad whose whole job is to
 * show the app is the mistake the first cut made everywhere at once.
 */
export const ShotLabel: React.FC<{ children: React.ReactNode; top?: number }> = ({
  children,
  top = 150,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [2, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: font.bold,
        fontSize: 82,
        color: color.paper,
        letterSpacing: -1.6,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 18}px)`,
        textShadow: '0 6px 22px rgba(0,0,0,0.8)',
      }}
    >
      {children}
    </div>
  );
};
