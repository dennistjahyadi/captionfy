import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, color, font } from '../brand';
import { Mark } from '../Chrome';
import { useSafeBox } from '../parts';

import type { Word } from './script';
import { F } from './time';

/**
 * A sentence set large, each word arriving on the frame it is spoken.
 *
 * This is the hook and the offer: the places in a voiced ad where there is no
 * phone on screen and the words themselves are the picture. It is a caption in
 * the product's own sense — a line that builds under a voice — which is the
 * one motion language this app is allowed to open on.
 *
 * `Headline` springs its words two frames apart from a single start; this one
 * takes the start of every word from the recording, so the line keeps the
 * voice's own rhythm, pauses included. The spring lands a couple of frames
 * *before* the word is heard: a word that appears exactly on its onset reads
 * as late, because the eye is slower than the ear.
 */
export type Line = {
  words: Word[];
  size?: number;
  /** Indices within `words` set in the accent rather than paper. */
  accent?: number[];
  weight?: 'bold' | 'serif';
};

export const Kinetic: React.FC<{
  lines: Line[];
  /** Centre of the block, as a fraction of frame height. */
  atY?: number;
  /** Frame at which the whole block leaves. */
  outAt?: number;
  gap?: number;
  /**
   * How the transcript's spelling is shown. `hook` lowercases the first word
   * and keeps the question mark; `label` lowercases and drops the trailing
   * comma and full stop, so "Pay once," reads as a headline rather than as a
   * subtitle. The subtitles keep the transcript's own punctuation.
   */
  clean?: 'hook' | 'label';
}> = ({ lines, atY = 0.46, outAt, gap = 18, clean }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const SAFE = useSafeBox();
  const half = Math.min(width / 2 - SAFE.x0, SAFE.x1 - width / 2);

  const leave =
    outAt === undefined
      ? 0
      : interpolate(frame, [outAt, outAt + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.quad),
        });
  if (leave >= 1) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: height * atY,
        left: width / 2 - half,
        width: half * 2,
        transform: `translateY(-50%) scale(${1 - leave * 0.06})`,
        opacity: 1 - leave,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap,
        pointerEvents: 'none',
      }}
    >
      {lines.map((line, l) => (
        <div
          key={l}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0 0.28em',
            fontSize: line.size ?? 88,
          }}
        >
          {line.words.map((w, i) => {
            const s = spring({
              frame: frame - (F(w.s) - 3),
              fps,
              config: { damping: 200, stiffness: 170, mass: 0.6 },
              durationInFrames: 13,
            });
            const isAccent = line.accent?.includes(i);
            return (
              <span
                key={`${w.w}-${i}`}
                style={{
                  fontFamily: line.weight === 'serif' ? font.serif : font.bold,
                  lineHeight: 1.08,
                  letterSpacing: line.weight === 'serif' ? -1 : -2.5,
                  color: isAccent ? ACCENT : color.paper,
                  textShadow: isAccent
                    ? '0 0 34px rgba(255,224,61,0.35), 0 8px 40px rgba(0,0,0,0.8)'
                    : '0 8px 40px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.75)',
                  opacity: s,
                  display: 'inline-block',
                  transform: `translateY(${(1 - s) * 30}px) scale(${0.92 + s * 0.08})`,
                }}
              >
                {show(w.w, clean, l === 0 && i === 0)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const show = (w: string, clean: 'hook' | 'label' | undefined, first: boolean): string => {
  if (!clean) return w;
  let out = w.replace(/[,.]+$/, '');
  if (clean === 'label' || first) out = out.charAt(0).toLowerCase() + out.slice(1);
  return out;
};

/**
 * The brand, arriving centred and then lifting to the headline slot.
 *
 * The name lands alone in the middle of a black frame on its word, and when
 * the phone rises from the foot of the frame the lockup moves up out of its
 * way and shrinks to a label. One object doing two jobs, rather than a logo
 * card cutting to a screenshot — the app arrives *under* its name.
 */
export const Brand: React.FC<{ at: number; liftAt: number; outAt: number; size?: number }> = ({
  at,
  liftAt,
  outAt,
  size = 168,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  if (frame < at) return null;

  const rise = spring({
    frame: frame - at,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.9 },
    durationInFrames: 22,
  });
  const lift = spring({
    frame: frame - liftAt,
    fps,
    config: { damping: 200, stiffness: 70, mass: 1.1 },
    durationInFrames: 30,
  });
  const out = interpolate(frame, [outAt, outAt + 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (out <= 0) return null;

  // From the centre of the frame to the band above the phone's head, and from
  // full size to the size a headline is set at.
  const y = interpolate(lift, [0, 1], [height * 0.44, 262]);
  const scale = interpolate(lift, [0, 1], [1, 0.58]);

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        transform: `translateY(${-50 + (1 - rise) * 6}%) scale(${scale})`,
        opacity: rise * out,
        pointerEvents: 'none',
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
  );
};

/**
 * A word in a pill, struck through as it is named.
 *
 * "No subscription, no renewal": each arrives as a thing the app does not have
 * and the accent draws a line through it on the beat. It is a graphic and not
 * a claim about anyone else — no price, no brand, no "other apps" — which is
 * the line `../../README.md` draws for anything that might one day run paid.
 */
export const Struck: React.FC<{ text: string; at: number; strikeAt: number }> = ({
  text,
  at,
  strikeAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;

  const land = spring({
    frame: frame - at,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.7 },
    durationInFrames: 14,
  });
  const strike = interpolate(frame, [strikeAt, strikeAt + 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // The pill dims once the line is through it, so the eye moves on to the next.
  const dim = 1 - strike * 0.45;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '16px 42px',
        borderRadius: 999,
        border: `3px solid ${color.line}`,
        background: color.surface,
        fontFamily: font.semibold,
        fontSize: 58,
        letterSpacing: -1,
        color: color.paper,
        opacity: land * dim,
        transform: `translateY(${(1 - land) * 24}px) scale(${0.94 + land * 0.06})`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      {text}
      <div
        style={{
          position: 'absolute',
          left: '-4%',
          top: '50%',
          height: 9,
          borderRadius: 5,
          width: `${108 * strike}%`,
          background: ACCENT,
          transform: 'translateY(-50%) rotate(-6deg)',
          transformOrigin: 'left center',
          boxShadow: '0 0 18px rgba(255,224,61,0.5)',
        }}
      />
    </div>
  );
};

/**
 * A Wi-Fi mark with a line through it, drawing itself in.
 *
 * "Wi-Fi or not": three arcs and a dot, then the slash across them. The
 * arcs are stroked in from the dot outward on their own timing so the mark
 * assembles rather than appears, and the slash lands on the second word.
 */
export const WifiOff: React.FC<{ at: number; slashAt: number; atY?: number; size?: number }> = ({
  at,
  slashAt,
  atY = 0.3,
  size = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  if (frame < at) return null;

  const rise = spring({
    frame: frame - at,
    fps,
    config: { damping: 200, stiffness: 140, mass: 0.8 },
    durationInFrames: 16,
  });
  const arc = (i: number) =>
    interpolate(frame, [at + 2 + i * 4, at + 12 + i * 4], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  const slash = interpolate(frame, [slashAt, slashAt + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Arcs about the dot at (50, 84), radii 18, 36, 54, spanning 90 degrees.
  const arcPath = (r: number) => {
    const a = Math.PI / 4;
    const x0 = 50 - r * Math.sin(a);
    const y0 = 84 - r * Math.cos(a);
    const x1 = 50 + r * Math.sin(a);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y0}`;
  };
  const len = (r: number) => (Math.PI / 2) * r;

  return (
    <div
      style={{
        position: 'absolute',
        top: height * atY,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        transform: `translateY(-50%) translateY(${(1 - rise) * 20}px)`,
        opacity: rise,
        pointerEvents: 'none',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {[18, 36, 54].map((r, i) => (
          <path
            key={r}
            d={arcPath(r)}
            fill="none"
            stroke={color.paper}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={len(r)}
            strokeDashoffset={len(r) * (1 - arc(i))}
            opacity={0.92}
          />
        ))}
        <circle cx={50} cy={84} r={5.5} fill={color.paper} opacity={rise} />
        <line
          x1={18}
          y1={22}
          x2={18 + 64 * slash}
          y2={22 + 66 * slash}
          stroke={ACCENT}
          strokeWidth={8}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255,224,61,0.6))' }}
        />
      </svg>
    </div>
  );
};
