import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, color, font } from '../brand';
import { useSafeBox } from '../parts';

/**
 * The beat's label, and the loudest thing in the frame after the phone.
 *
 * `Title` — the one video 01 uses — fades and settles as a block. That is a
 * product film's gesture and it is right there. This is the organic one: the
 * words arrive one after another on a spring, so the line assembles in the
 * half-second a thumb takes to decide, and the eye has something moving to
 * land on.
 *
 * Words, not letters. A per-letter reveal at this size is a title sequence and
 * reads as decoration; per word it reads as somebody talking.
 *
 * **A rule under it, not a plate.** The headline sits over solid black for most
 * of the runtime, so it needs no background, and a short accent rule under the
 * last line gives the block a foot to stand on without putting furniture in the
 * frame. On an export shot, where the ground is somebody's video, the shadow
 * does the separating.
 */
export const Headline: React.FC<{
  text: string;
  kicker?: string;
  at?: number;
  /** Anchored above the phone by its foot, or floated at a fraction of height. */
  pos?: 'above' | 'mid';
  size?: number;
  /** Frame height fraction, `mid` only. */
  atY?: number;
}> = ({ text, kicker, at = 0, pos = 'above', size, atY = 0.34 }) => {
  const frame = useCurrentFrame() - at;
  const { fps, width, height } = useVideoConfig();
  const SAFE = useSafeBox();
  if (frame < 0) return null;

  const words = text.split(/\s+/).filter(Boolean);
  const auto = text.length > 40 ? 66 : text.length > 24 ? 74 : 84;
  const fontSize = size ?? auto;

  // Centred on the frame, clamped to the safe box — the same axis the phone and
  // the subtitles use. See `Title` for why the box's own centre is not it.
  const half = Math.min(width / 2 - SAFE.x0, SAFE.x1 - width / 2);

  const box =
    pos === 'above'
      // 375 is PHONE_TOP; the headline hangs off the phone's head so a one-line
      // and a two-line label both stop the same distance above the device.
      ? { bottom: height - 375 + 26 }
      : { top: height * atY };

  const kick = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 160, mass: 0.6 },
    durationInFrames: 12,
  });

  return (
    <div
      style={{
        position: 'absolute',
        ...box,
        left: width / 2 - half,
        width: half * 2,
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: font.semibold,
            fontSize: 28,
            letterSpacing: 6,
            color: ACCENT,
            marginBottom: 18,
            textTransform: 'uppercase',
            opacity: kick,
            transform: `translateY(${(1 - kick) * 10}px)`,
          }}
        >
          {kicker}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 20px' }}>
        {words.map((w, i) => {
          // Two frames apart. Faster and the line is a block again; slower and
          // the last word lands after the voice has already said it.
          const s = spring({
            frame: frame - i * 2,
            fps,
            config: { damping: 200, stiffness: 150, mass: 0.7 },
            durationInFrames: 14,
          });
          return (
            <span
              key={`${w}-${i}`}
              style={{
                fontFamily: font.bold,
                fontSize,
                lineHeight: 1.1,
                letterSpacing: -2.5,
                color: color.paper,
                textShadow: '0 8px 40px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.75)',
                opacity: s,
                display: 'inline-block',
                transform: `translateY(${(1 - s) * 22}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>

      <div
        style={{
          margin: '22px auto 0',
          height: 6,
          borderRadius: 3,
          background: ACCENT,
          width: interpolate(
            spring({ frame: frame - words.length * 2, fps, config: { damping: 200 }, durationInFrames: 18 }),
            [0, 1],
            [0, 92]
          ),
          opacity: 0.95,
        }}
      />
    </div>
  );
};

/**
 * Where we are in the walk-through, as nine ticks.
 *
 * A tutorial that shows nine things in a minute has one problem a hook does
 * not: at twenty seconds a viewer cannot tell whether there are two more of
 * these or twenty. Nine ticks with the current one lit answers that in the
 * corner of the eye, and answering it is worth a few pixels — it is the same
 * argument as a progress bar on a long article.
 *
 * It sits above the phone's head and below the headline's foot, inside the
 * organic safe box, and it does not animate beyond the fill moving: a
 * progress indicator that draws attention to itself is competing with the
 * thing whose progress it is reporting.
 */
export const Steps: React.FC<{ index: number; total: number; y?: number }> = ({
  index,
  total,
  y = 330,
}) => (
  <div
    style={{
      position: 'absolute',
      top: y,
      left: 0,
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}
  >
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        style={{
          width: i === index ? 34 : 12,
          height: 6,
          borderRadius: 3,
          background: i === index ? ACCENT : color.line,
          opacity: i <= index ? 1 : 0.55,
        }}
      />
    ))}
  </div>
);
