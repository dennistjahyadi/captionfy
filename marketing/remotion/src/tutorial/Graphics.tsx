import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, ON_ACCENT, color, font } from '../brand';
import { Mark } from '../Chrome';

/**
 * The abstract half of this video: what it looks like when there is no app on
 * screen.
 *
 * **Everything here is the app icon, enlarged.** The icon is three pills — two
 * muted rows and a yellow bar across them — and it is a picture of a caption
 * with one word highlighted. Rather than invent a motion language for the hook
 * and the close, both are built out of that same shape at full-frame size. A
 * hook that opens on drifting gradients and then cuts to a phone is two
 * videos; a hook that opens on the icon's own geometry and then resolves into
 * the product is one.
 *
 * It also means the abstract part is *about* something. A viewer who has never
 * heard of this app has, by the end of the hook, watched a line of words appear
 * and a highlight travel across it — which is what the product does — before a
 * single screenshot.
 */

/** A row of word-shaped pills. Widths are irregular on purpose: even ones read as a loading skeleton. */
const ROWS: number[][] = [
  [132, 96, 176, 74],
  [88, 148, 112, 190],
  [164, 78, 124],
];

/**
 * A caption line building itself, with the accent travelling across it.
 *
 * Two motions, deliberately out of step. The pills **arrive** in sequence, each
 * on its own spring, so the block assembles rather than appearing. Then the
 * accent **travels** the whole set at a steadier rate, so at any moment some
 * words are still landing while the highlight is already moving — which is what
 * a real caption does under a real voice, and what a single synchronised
 * animation never looks like.
 *
 * The travelling pill is yellow and the settled ones are white at low opacity:
 * the same relationship the icon has, and the same one `Read along` has in the
 * app itself.
 */
export const CaptionBars: React.FC<{
  at?: number;
  /** Where the block sits vertically, as a fraction of frame height. */
  atY?: number;
  /** Seconds for the accent to cross the whole block. */
  sweepSec?: number;
  scale?: number;
  opacity?: number;
  /** Frames at which the block collapses away, for a beat that resolves into something else. */
  outAt?: number;
}> = ({ at = 0, atY = 0.46, sweepSec = 2.6, scale = 1, opacity = 1, outAt }) => {
  const frame = useCurrentFrame() - at;
  const { fps, width, height } = useVideoConfig();
  if (frame < 0) return null;

  // The close hands over to the brand rather than cutting to it: the line of
  // words shrinks and fades on the frame the mark starts to arrive, so the
  // logo reads as what the captions became.
  const leave =
    outAt === undefined
      ? 0
      : interpolate(frame, [outAt - at, outAt - at + 14], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.quad),
        });
  if (leave >= 1) return null;

  const all = ROWS.flat();
  const sweep = interpolate(frame, [12, 12 + sweepSec * fps], [-0.5, all.length + 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  let n = -1;
  return (
    <div
      style={{
        position: 'absolute',
        top: height * atY,
        left: 0,
        width: '100%',
        transform: `translateY(-50%) scale(${scale * (1 - leave * 0.22)})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        opacity: opacity * (1 - leave),
        pointerEvents: 'none',
      }}
    >
      {ROWS.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 18 }}>
          {row.map((w, c) => {
            n += 1;
            const i = n;
            const land = spring({
              frame: frame - i * 3,
              fps,
              config: { damping: 200, stiffness: 140, mass: 0.7 },
              durationInFrames: 16,
            });
            // How close the accent is to this pill, 1 on it and 0 a pill away.
            const near = Math.max(0, 1 - Math.abs(sweep - i));
            return (
              <div
                key={c}
                style={{
                  width: w,
                  height: 42,
                  borderRadius: 21,
                  background: near > 0.02 ? ACCENT : color.paper,
                  opacity: land * (0.26 + near * 0.74),
                  transform: `translateY(${(1 - land) * 22}px) scaleY(${1 + near * 0.16})`,
                  boxShadow: near > 0.4 ? `0 0 ${30 * near}px rgba(255,224,61,${0.5 * near})` : 'none',
                }}
              />
            );
          })}
        </div>
      ))}
      <div style={{ width, height: 0 }} />
    </div>
  );
};

/**
 * The brand, centred, with the store line under it.
 *
 * Used at the end of every video and at the moment the body first names the
 * app. It is centred rather than hung at the top — a close is the one moment
 * with nothing else in the frame to balance against, and anything off-centre
 * there reads as a layout that used to have something beside it.
 *
 * The mark draws its own pills in (see `Mark`), so the lockup's own entrance is
 * kept simple: a short rise and a settle. Two things springing at once is the
 * motion equivalent of two typefaces.
 */
export const LogoLockup: React.FC<{
  at?: number;
  cta?: string;
  /** Fraction of frame height for the centre of the lockup. */
  atY?: number;
  size?: number;
}> = ({ at = 0, cta, atY = 0.46, size = 150 }) => {
  const frame = useCurrentFrame() - at;
  const { fps, height } = useVideoConfig();
  if (frame < 0) return null;

  const rise = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.9 },
    durationInFrames: 22,
  });
  const ctaIn = spring({
    frame: frame - 16,
    fps,
    config: { damping: 200, stiffness: 140, mass: 0.8 },
    durationInFrames: 18,
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: height * atY,
        left: 0,
        width: '100%',
        transform: `translateY(-50%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 26}px)`,
        }}
      >
        <Mark size={size} startFrame={at} tight />
        <div
          style={{
            fontFamily: font.bold,
            fontSize: size * 0.62,
            color: color.paper,
            letterSpacing: -3,
            textShadow: '0 8px 34px rgba(0,0,0,0.85)',
          }}
        >
          Wordburn
        </div>
      </div>

      {cta ? (
        <div
          style={{
            background: ACCENT,
            color: ON_ACCENT,
            fontFamily: font.bold,
            fontSize: 38,
            padding: '20px 44px',
            borderRadius: 999,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 20}px) scale(${0.94 + ctaIn * 0.06})`,
            boxShadow: '0 18px 60px rgba(255,224,61,0.22)',
          }}
        >
          {cta}
        </div>
      ) : null}
    </div>
  );
};

/**
 * A slow wash of accent behind the abstract beats.
 *
 * The ground is solid black everywhere else in this video and stays that way —
 * this is a *lit* black rather than a gradient background: one very soft pool
 * of the brand yellow, well under 8% at its strongest, that breathes once
 * across the beat. On the phone beats there is a device to look at and this
 * would be clutter; on the two beats with no product on screen it is the
 * difference between a composition and a title card.
 */
export const Glow: React.FC<{ at?: number; atY?: number }> = ({ at = 0, atY = 0.46 }) => {
  const frame = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const t = frame / fps;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(58% 34% at 50% ${atY * 100}%, rgba(255,224,61,${
          0.05 + pulse * 0.03
        }) 0%, rgba(255,224,61,0.02) 45%, rgba(0,0,0,0) 72%)`,
        pointerEvents: 'none',
      }}
    />
  );
};
