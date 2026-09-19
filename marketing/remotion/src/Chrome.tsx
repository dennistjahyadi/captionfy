import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, ON_ACCENT, SAFE, color, font } from './brand';

/**
 * The app icon, drawn rather than imported, so the yellow pill can land the way
 * a box highlight lands on a word. That is what the icon is a picture of.
 */
export const Mark: React.FC<{ size: number; startFrame?: number; tight?: boolean }> = ({
  size,
  startFrame = 0,
  tight = false,
}) => {
  const frame = useCurrentFrame() - startFrame;
  const s = size / 1024;

  const grow = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rows = [0, 1].map((i) =>
    interpolate(frame, [i * 4, i * 4 + 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );

  return (
    // The icon's own 1024 box is mostly padding, which is right for a launcher
    // and wrong beside a word: at 96 px the pills came out six pixels tall and
    // read as a stray dash. `tight` crops to the artwork.
    <svg
      width={size}
      height={tight ? size * 0.62 : size}
      viewBox={tight ? '190 330 650 400' : '0 0 1024 1024'}
      style={{ display: 'block' }}
    >
      <rect
        x="215.04"
        y="353.28"
        width={342.02 * rows[0]}
        height="63.49"
        rx="31.74"
        fill={color.mute}
      />
      <rect
        x="215.04"
        y="607.23"
        width={280.58 * rows[1]}
        height="63.49"
        rx="31.74"
        fill={color.mute}
      />
      <rect
        x="215.04"
        y="457.73"
        width={593.92 * grow}
        height="108.54"
        rx="54.27"
        fill={ACCENT}
        style={{ filter: `drop-shadow(0 0 ${40 * s}px rgba(255,224,61,0.45))` }}
      />
    </svg>
  );
};

/** The demo clip, with a vignette so white type holds off the bright bokeh. */
export const Stage: React.FC<{
  src?: string;
  startFrom?: number;
  dim?: number;
  blur?: number;
}> = ({ src = 'demo-1080x1920.mp4', startFrom = 0, dim = 0.34, blur = 0 }) => (
  <AbsoluteFill>
    <OffthreadVideo
      src={staticFile(src)}
      startFrom={startFrom}
      muted
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: blur ? `blur(${blur}px)` : undefined,
        // A blur samples past the edge and leaves a soft rim; overscan past it.
        transform: blur ? `scale(${1 + blur / 120})` : undefined,
      }}
    />
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, rgba(15,14,13,${dim + 0.15}) 0%, rgba(15,14,13,${dim * 0.5}) 38%, rgba(15,14,13,${dim + 0.3}) 100%)`,
      }}
    />
  </AbsoluteFill>
);

/**
 * What sits behind a phone shot.
 *
 * Not flat ink. A shot where nothing at all moves is dead air, and the hook
 * research is blunt about what half a second of that costs inside the first
 * three seconds — so the clip keeps playing behind the device, blurred far
 * enough back that it reads as depth rather than as content competing with the
 * screen.
 */
export const PhoneBackdrop: React.FC<{ startFrom?: number }> = ({ startFrom = 0 }) => (
  <Stage startFrom={startFrom} dim={0.72} blur={46} />
);

/** A small status pill — the kind of chip the app itself puts on Home. */
export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'mute' | 'accent' | 'ok';
  startFrame?: number;
}> = ({ children, tone = 'mute', startFrame = 0 }) => {
  const frame = useCurrentFrame() - startFrame;
  const enter = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 'ok' is a dark pill with a green word in it, not a green pill. The app's
  // `good` is the colour of a file that exists; shouting it behind a whole
  // badge would out-loud the captions, which are the thing being sold.
  const fill = tone === 'accent' ? ACCENT : 'rgba(26,24,23,0.88)';
  const ink = tone === 'accent' ? ON_ACCENT : tone === 'ok' ? color.good : color.paper;

  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px)`,
        background: fill,
        color: ink,
        border: tone === 'accent' ? 'none' : `2px solid ${color.line}`,
        fontFamily: font.semibold,
        fontSize: 38,
        padding: '18px 34px',
        borderRadius: 999,
        letterSpacing: -0.2,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

/**
 * The speech envelope, scrolling under a fixed playhead the way the timing
 * sheet's waveform does.
 *
 * `hitsMs` are the moments the speaker got louder, and they are not decoration
 * in the ad about emphasis — they are the claim. Because the strip scrolls
 * against the same clock the caption track reads, the yellow spike arrives at
 * the centre line on the exact frame the word it belongs to lights up. If the
 * two ever drifted apart, the ad would be showing that the mechanism does not
 * work.
 */
export const Waveform: React.FC<{
  bars?: number;
  hitsMs?: number[];
  /** Seconds of audio across the whole strip. */
  windowMs?: number;
  height?: number;
  width?: number | string;
}> = ({ bars = 72, hitsMs = [], windowMs = 3600, height = 120, width = '80%' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  /** How loud the speaker was at a moment: a floor of speech, plus any hit. */
  const amplitudeAt = (atMs: number) => {
    // Deterministic in time, not in bar index, so the shape travels with the
    // audio instead of shimmering in place as the strip scrolls.
    const seed = Math.floor(atMs / 45);
    const noise = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const speech = atMs < 0 ? 0 : 0.2 + noise * 0.38;
    const loud = hitsMs.reduce(
      (peak, hit) => Math.max(peak, Math.max(0, 1 - Math.abs(atMs - hit) / 260)),
      0
    );
    return { amp: Math.min(1, speech + loud * 0.8), loud };
  };

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const atMs = nowMs - windowMs / 2 + (i / (bars - 1)) * windowMs;
        const { amp, loud } = amplitudeAt(atMs);
        const played = atMs <= nowMs;
        const isHit = loud > 0.4;

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(3, amp * 100)}%`,
              borderRadius: 999,
              background: isHit ? ACCENT : played ? color.paper : color.line,
              opacity: isHit ? 1 : played ? 0.5 : 0.35,
            }}
          />
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -10,
          bottom: -10,
          width: 3,
          marginLeft: -1.5,
          background: color.paper,
          opacity: 0.45,
        }}
      />
    </div>
  );
};

/**
 * The last three seconds. Name, what it is, what it costs, where to get it.
 *
 * No price in currency: `store.ts` refuses to compose one in the app and an ad
 * that hardcodes a number is wrong in every country but one.
 */
export const EndCard: React.FC<{ kicker: string; startFrame?: number }> = ({
  kicker,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame() - startFrame;
  const rise = (delay: number) =>
    interpolate(frame, [delay, delay + 12], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });

  return (
    <AbsoluteFill
      style={{
        background: color.ink,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 90px',
      }}
    >
      <Mark size={300} startFrame={startFrame} />

      <div
        style={{
          opacity: rise(14),
          transform: `translateY(${(1 - rise(14)) * 22}px)`,
          fontFamily: font.bold,
          fontSize: 116,
          color: color.paper,
          letterSpacing: -2.5,
          marginTop: 18,
        }}
      >
        Wordburn
      </div>

      <div
        style={{
          opacity: rise(20),
          transform: `translateY(${(1 - rise(20)) * 22}px)`,
          fontFamily: font.medium,
          fontSize: 44,
          color: color.mute,
          textAlign: 'center',
          lineHeight: 1.35,
          maxWidth: 820,
          marginTop: 10,
        }}
      >
        {kicker}
      </div>

      <div
        style={{
          opacity: rise(30),
          transform: `translateY(${(1 - rise(30)) * 22}px)`,
          marginTop: 46,
          background: ACCENT,
          color: ON_ACCENT,
          fontFamily: font.bold,
          fontSize: 46,
          padding: '26px 56px',
          borderRadius: 999,
        }}
      >
        On Google Play
      </div>

      <div
        style={{
          opacity: rise(36),
          fontFamily: font.semibold,
          fontSize: 34,
          color: color.mute,
          marginTop: 22,
          letterSpacing: 0.4,
        }}
      >
        Free to try · one payment to unlock
      </div>
    </AbsoluteFill>
  );
};

/**
 * The call to action, laid over a shot that is still running.
 *
 * It replaces a three-and-a-half second end card, which was about a fifth of
 * each ad spent on a static logo. Completion rate is the signal TikTok
 * distributes on — 50% is where distribution picks up — so a fifth of the
 * runtime with nothing happening in it was paying for the brand with the reach.
 * The captions keep playing underneath this.
 */
export const CtaOverlay: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame() - at;
  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  if (frame < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 1920 * SAFE.top + 40,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        opacity: enter,
        transform: `translateY(${(1 - enter) * -20}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Mark size={132} startFrame={at} tight />
        <div
          style={{
            fontFamily: font.bold,
            fontSize: 78,
            color: color.paper,
            letterSpacing: -2,
            textShadow: '0 6px 24px rgba(0,0,0,0.85)',
          }}
        >
          Wordburn
        </div>
      </div>
      <div
        style={{
          background: ACCENT,
          color: ON_ACCENT,
          fontFamily: font.bold,
          fontSize: 34,
          padding: '18px 38px',
          borderRadius: 999,
        }}
      >
        Android · on Google Play
      </div>
    </div>
  );
};

/** A full-frame statement card: the hook, before any footage. */
export const HookCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: color.ink,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 80px',
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Screenshot: React.FC<{ src: string; width: number }> = ({ src, width }) => (
  <Img
    src={staticFile(src)}
    style={{ width, borderRadius: 26, border: `3px solid ${color.line}` }}
  />
);
