import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, color, font } from '../brand';

/**
 * The two pictures this ad has that its siblings do not: a monthly allowance
 * running out, and one video becoming a hundred.
 *
 * Both are built out of the same object — a small vertical tile with a
 * caption bar in it, which is a video with captions on it, which is the app
 * icon's own subject. The pain shows three of them being used up under a
 * counter; the answer shows one of them multiplying into a grid and every one
 * of the hundred getting its bar. The viewer meets the tile in the first
 * five seconds and sees it again at eighteen, so the second picture answers
 * the first without either of them saying so.
 *
 * Nothing here names anybody else. "Most caption apps" is the voice's claim
 * and the graphic is a counter, a tile and two pills — no brand, no price,
 * no screenshot of anybody's paywall.
 */

const leaveAt = (frame: number, outAt: number) =>
  interpolate(frame, [outAt, outAt + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });

/** A video with captions on it: the shape the app icon is a picture of, at tile size. */
const Tile: React.FC<{
  w: number;
  h: number;
  /** 0 fresh, 1 used up. */
  used?: number;
  /** Whether the bar is the accent (a captioned video) or waiting. */
  lit?: number;
  style?: React.CSSProperties;
}> = ({ w, h, used = 0, lit = 1, style }) => {
  const bar = (frac: number, i: number, accent: boolean) => (
    <div
      key={i}
      style={{
        width: `${frac * 100}%`,
        height: Math.max(3, w * 0.065),
        borderRadius: 999,
        background: accent ? ACCENT : color.paper,
        opacity: accent ? 0.35 + lit * 0.65 : 0.34,
        boxShadow: accent && lit > 0.6 ? `0 0 ${w * 0.12}px rgba(255,224,61,${0.35 * lit})` : 'none',
      }}
    />
  );
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: w * 0.12,
        background: color.surface,
        border: `${Math.max(1, w * 0.014)}px solid ${color.line}`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        gap: Math.max(2, w * 0.05),
        padding: `0 ${w * 0.14}px ${h * 0.16}px`,
        opacity: 1 - used * 0.7,
        transform: `scale(${1 - used * 0.05})`,
        ...style,
      }}
    >
      {bar(0.62, 0, false)}
      {bar(0.78, 1, true)}
      {bar(0.5, 2, false)}
    </div>
  );
};

/**
 * "Most caption apps give you a few videos a month, then make you wait or pay."
 *
 * Three tiles arrive, one on each of the first three words; a chip over them
 * says what the allowance is; the tiles are spent one at a time on "then make
 * you", the chip counting down with them and turning coral at nought; and the
 * two things you are left with land as pills under the empties, on their
 * words, with the voice's own "or" between them.
 */
export const Quota: React.FC<{
  /** Frames: one per tile. */
  tilesAt: number[];
  chipAt: number;
  /** Frames: one per tile, when it is spent. */
  usedAt: number[];
  waitAt: number;
  payAt: number;
  outAt: number;
  atY?: number;
}> = ({ tilesAt, chipAt, usedAt, waitAt, payAt, outAt, atY = 0.44 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  if (frame < Math.min(...tilesAt)) return null;
  const leave = leaveAt(frame, outAt);
  if (leave >= 1) return null;

  const land = (at: number, dur = 14) =>
    spring({ frame: frame - at, fps, config: { damping: 200, stiffness: 150, mass: 0.7 }, durationInFrames: dur });
  const spent = (at: number) =>
    interpolate(frame, [at, at + 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });

  // The chip: the allowance until the first one is spent, then a countdown.
  const spentCount = usedAt.filter((a) => frame >= a).length;
  const left = tilesAt.length - spentCount;
  const chipText = spentCount === 0 ? `${tilesAt.length} / month` : `${left} left`;
  const chipChangedAt = spentCount === 0 ? chipAt : usedAt[spentCount - 1];
  const chipPop = spring({
    frame: frame - chipChangedAt,
    fps,
    config: { damping: 200, stiffness: 220, mass: 0.5 },
    durationInFrames: 10,
  });
  const chipIn = land(chipAt);
  const empty = left === 0;

  const orIn = land(payAt);

  return (
    <div
      style={{
        position: 'absolute',
        top: height * atY,
        left: 0,
        width: '100%',
        transform: `translateY(-50%) scale(${1 - leave * 0.06})`,
        opacity: 1 - leave,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 36,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '12px 34px',
          borderRadius: 999,
          border: `3px solid ${empty ? color.signal : color.line}`,
          background: color.surface,
          fontFamily: font.semibold,
          fontSize: 40,
          letterSpacing: -0.5,
          color: empty ? color.signal : color.paper,
          opacity: chipIn,
          transform: `translateY(${(1 - chipIn) * 16}px) scale(${0.96 + chipPop * 0.04})`,
        }}
      >
        {chipText}
      </div>

      <div style={{ display: 'flex', gap: 26 }}>
        {tilesAt.map((at, i) => {
          const s = land(at);
          return (
            <div
              key={i}
              style={{
                opacity: s,
                transform: `translateY(${(1 - s) * 26}px) scale(${0.92 + s * 0.08})`,
              }}
            >
              <Tile w={150} h={266} used={spent(usedAt[i])} />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: 96 }}>
        <Pill text="wait" at={waitAt} />
        <div
          style={{
            fontFamily: font.medium,
            fontSize: 40,
            color: color.mute,
            opacity: orIn,
          }}
        >
          or
        </div>
        <Pill text="pay" at={payAt} />
      </div>
    </div>
  );
};

/** A consequence, in the palette's warning colour. */
const Pill: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - at,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.7 },
    durationInFrames: 14,
  });
  if (frame < at) return <div style={{ width: 0 }} />;
  return (
    <div
      style={{
        padding: '16px 42px',
        borderRadius: 999,
        border: `3px solid ${color.signal}`,
        background: color.surface,
        fontFamily: font.semibold,
        fontSize: 58,
        letterSpacing: -1,
        color: color.signal,
        opacity: s,
        transform: `translateY(${(1 - s) * 24}px) scale(${0.94 + s * 0.06})`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      {text}
    </div>
  );
};

const COLS = 10;
const ROWS = 10;
const CELL_W = 42;
const CELL_H = 70;
const GAP = 7;
const GRID_W = COLS * CELL_W + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL_H + (ROWS - 1) * GAP;
const BIG_W = 150;
const BIG_H = 266;

/**
 * "One video or a hundred, same thing."
 *
 * One tile, the same one the pain beat spent three of, lands in the middle
 * on "one" with a 1 over it. On "hundred" it shrinks into the top-left cell
 * of a ten-by-ten grid and the other ninety-nine fill in behind it in a wave
 * from that corner, the number counting up to a hundred as they do. On
 * "same" the accent sweeps the grid corner to corner and every bar it passes
 * stays lit: every one of them captioned, none of them counted.
 *
 * The wave and the sweep both run on the cell's distance from the corner,
 * so they read as one motion that was started twice rather than two effects.
 */
export const Hundred: React.FC<{
  oneAt: number;
  hundredAt: number;
  sameAt: number;
  outAt: number;
  atY?: number;
}> = ({ oneAt, hundredAt, sameAt, outAt, atY = 0.42 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (frame < oneAt) return null;
  const leave = leaveAt(frame, outAt);
  if (leave >= 1) return null;

  const one = spring({
    frame: frame - oneAt,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.7 },
    durationInFrames: 16,
  });
  const shrink = spring({
    frame: frame - hundredAt,
    fps,
    config: { damping: 200, stiffness: 110, mass: 0.9 },
    durationInFrames: 18,
  });
  // The accent's position along the diagonals, a little ahead of the corner
  // before it starts and past the far corner when it is done.
  const sweep = interpolate(frame, [sameAt, sameAt + 20], [-1.5, COLS + ROWS], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const litOf = (d: number) => {
    if (frame < sameAt) return 0;
    return interpolate(sweep - d, [-0.5, 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };
  const crestOf = (d: number) => (frame < sameAt ? 0 : Math.max(0, 1 - Math.abs(sweep - d) / 1.6));

  // The wave: each cell lands on a spring delayed by its distance from the
  // corner, and the number over the grid is a count of the cells that have
  // landed — it says what is on screen rather than running ahead of it.
  const STAGGER = 0.7;
  const landOf = (d: number) =>
    spring({
      frame: frame - hundredAt - 3 - d * STAGGER,
      fps,
      config: { damping: 200, stiffness: 170, mass: 0.6 },
      durationInFrames: 12,
    });
  let count = 1;
  const landed: number[][] = [];
  for (let r = 0; r < ROWS; r += 1) {
    landed.push([]);
    for (let c = 0; c < COLS; c += 1) {
      const l = r === 0 && c === 0 ? 1 : landOf(r + c);
      landed[r].push(l);
      if (!(r === 0 && c === 0) && l >= 0.5) count += 1;
    }
  }
  // The last cell lands about here; the number settles with it.
  const countPop = spring({
    frame: frame - hundredAt - 3 - (COLS + ROWS - 2) * STAGGER - 6,
    fps,
    config: { damping: 200, stiffness: 160, mass: 0.6 },
    durationInFrames: 14,
  });

  const gridTop = height * atY - GRID_H / 2;
  const gridLeft = width / 2 - GRID_W / 2;

  // The one tile: centred and large, then the top-left cell.
  const big = {
    left: interpolate(shrink, [0, 1], [GRID_W / 2 - BIG_W / 2, 0]),
    top: interpolate(shrink, [0, 1], [GRID_H / 2 - BIG_H / 2, 0]),
    w: interpolate(shrink, [0, 1], [BIG_W, CELL_W]),
    h: interpolate(shrink, [0, 1], [BIG_H, CELL_H]),
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (r === 0 && c === 0) continue;
      const d = r + c;
      const land = landed[r][c];
      if (land <= 0) continue;
      const lit = litOf(d);
      const crest = crestOf(d);
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: c * (CELL_W + GAP),
            top: r * (CELL_H + GAP),
            opacity: land,
            transform: `translateY(${(1 - land) * 10}px) scale(${0.8 + land * 0.2 + crest * 0.06})`,
          }}
        >
          <Tile w={CELL_W} h={CELL_H} lit={lit} />
        </div>
      );
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${1 - leave * 0.06})`,
        transformOrigin: `${width / 2}px ${height * atY}px`,
        opacity: 1 - leave,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: gridTop - 118,
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontFamily: font.bold,
          fontSize: 132,
          lineHeight: 1,
          letterSpacing: -4,
          color: count >= 100 ? ACCENT : color.paper,
          textShadow:
            count >= 100
              ? '0 0 34px rgba(255,224,61,0.35), 0 8px 40px rgba(0,0,0,0.8)'
              : '0 8px 40px rgba(0,0,0,0.9)',
          opacity: one,
          transform: `translateY(-50%) translateY(${(1 - one) * 24}px) scale(${1 + (count >= 100 ? (1 - countPop) * 0.1 : 0)})`,
        }}
      >
        {count}
      </div>

      <div style={{ position: 'absolute', top: gridTop, left: gridLeft, width: GRID_W, height: GRID_H }}>
        {cells}
        <div
          style={{
            position: 'absolute',
            left: big.left,
            top: big.top,
            opacity: one,
            transform: `translateY(${(1 - one) * 26}px) scale(${0.92 + one * 0.08 + crestOf(0) * 0.06})`,
          }}
        >
          <Tile w={big.w} h={big.h} lit={frame < sameAt ? 1 - shrink : litOf(0)} />
        </div>
      </div>
    </div>
  );
};
