import React from 'react';
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import { ACCENT, ON_ACCENT, color, font } from '../brand';
import { Mark } from '../Chrome';
import { SAFE, SAFE_CENTRE, SAFE_WIDTH } from './timeline';

const ease = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

/**
 * The ground everything sits on.
 *
 * A product film is mostly one considered colour, and this one is the app's own
 * `ink` with a slow warm lift under the middle — enough that the frame is not a
 * flat rectangle, not so much that it competes with a caption. It does not
 * move: the motion in this film belongs to the product, and a drifting
 * background is the tell of a template.
 */
export const Ground: React.FC = () => (
  <AbsoluteFill style={{ background: color.ink }}>
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(120% 70% at 50% 42%, rgba(255,224,61,0.07) 0%, rgba(255,224,61,0.02) 38%, rgba(0,0,0,0) 72%)',
      }}
    />
  </AbsoluteFill>
);

/**
 * The app's own exported file, 1:1.
 *
 * 1080 × 1920 in, 1080 × 1920 out — no scaling, no device frame, nothing drawn
 * on top of the captions. This is the one shot the whole film is for, and every
 * pixel of it was laid out by `layoutCaptionFrame` and rasterised by
 * `CaptionPainter` on the device. The only treatment is a vignette, and even
 * that is kept off the lower third where the captions live.
 */
export const ExportShot: React.FC<{ startFrom: number }> = ({ startFrom }) => (
  <AbsoluteFill>
    <OffthreadVideo
      src={staticFile('film/export.mp4')}
      startFrom={startFrom}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(75% 55% at 50% 42%, rgba(0,0,0,0) 40%, rgba(15,14,13,0.45) 100%)',
      }}
    />
  </AbsoluteFill>
);

/**
 * A slice of a screen recording, floating as a card.
 *
 * The recordings are 1080 × 2400 — a phone, not a frame — so a beat picks the
 * band of the screen it is actually about and this shows that band at close to
 * native scale. Shrinking the whole 2400 to fit would make every piece of UI
 * 44% of the size the app draws it at, which in an advertisement for a
 * typography feature is the one thing that cannot happen.
 *
 * The card has a border and a shadow because at that crop there is no phone in
 * shot to say "this is a screen". Without them it reads as a screenshot somebody
 * pasted in.
 */
export const ScreenCard: React.FC<{
  file: string;
  crop: { y: number; h: number };
  scale?: number;
  top: number;
  startFrom?: number;
}> = ({ file, crop, scale = 0.78, top, startFrom = 0 }) => {
  const frame = useCurrentFrame();
  const enter = ease(frame, 0, 18);

  const width = 1080 * scale;
  const height = crop.h * scale;

  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - width / 2,
        top,
        width,
        height,
        borderRadius: 30,
        overflow: 'hidden',
        border: `2px solid ${color.line}`,
        boxShadow: '0 40px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
        opacity: enter,
        // A product film moves in, it does not cut in. Eighteen frames of rise
        // and a hair of scale is the whole gesture.
        transform: `translateY(${(1 - enter) * 26}px) scale(${0.985 + enter * 0.015})`,
      }}
    >
      <OffthreadVideo
        src={staticFile(`film/${file}`)}
        startFrom={startFrom}
        muted
        style={{
          position: 'absolute',
          top: -crop.y * scale,
          left: 0,
          width,
          height: 2400 * scale,
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

/**
 * A ring drawn around something in a screen recording that the viewer would
 * otherwise miss.
 *
 * Used once, on the aeroplane in the status bar. The offline claim is the one
 * this app can make and its competitors cannot, and the evidence for it is
 * sixteen pixels of white glyph in the corner of a phone. Saying "it works
 * offline" over footage where nobody can find the aeroplane is an assertion;
 * pointing at it is a proof.
 */
export const Pointer: React.FC<{ x: number; y: number; r: number; at?: number }> = ({
  x,
  y,
  r,
  at = 0,
}) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0) return null;
  const draw = ease(frame, 0, 16);
  const pulse = 1 + Math.sin(frame / 7) * 0.02;

  return (
    <svg
      width={1080}
      height={1920}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      <circle
        cx={x}
        cy={y}
        r={r * pulse}
        fill="none"
        stroke={ACCENT}
        strokeWidth={4}
        strokeDasharray={2 * Math.PI * r}
        strokeDashoffset={2 * Math.PI * r * (1 - draw)}
        transform={`rotate(-90 ${x} ${y})`}
        opacity={0.95}
      />
    </svg>
  );
};

/**
 * The line of type.
 *
 * One line of thought per beat, set large, high in the frame, and never below
 * `SAFE.y1` — which on a paid unit is 1128, not the 1498 an organic post gets.
 * It arrives by fading and settling rather than popping: a pop is a TikTok
 * caption, and this film is not pretending to be one.
 */
export const Title: React.FC<{
  text: string;
  at?: number;
  kicker?: string;
  /**
   * `top` for a beat whose picture is a card lower in the frame; `mid` for one
   * playing the export full-bleed.
   *
   * The export is not an empty backdrop — the app drew two things on it. The
   * free-tier watermark sits at the top-left, 0.118 of the height down, which
   * is exactly where a title at `SAFE.y0 + 70` lands: the first cut set "No
   * account. No upload. No server." straight through "Captions by Wordburn".
   * The captions themselves own the lower third. `mid` is the band between
   * them, and it is the only place on an export beat a line can go.
   */
  pos?: 'top' | 'mid';
}> = ({ text, at = 0, kicker, pos = 'top' }) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0) return null;
  const enter = ease(frame, 0, 20);

  return (
    <div
      style={{
        position: 'absolute',
        top: pos === 'mid' ? 700 : SAFE.y0 + 70,
        left: SAFE_CENTRE - SAFE_WIDTH / 2,
        width: SAFE_WIDTH,
        textAlign: 'center',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 18}px)`,
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: font.semibold,
            fontSize: 26,
            letterSpacing: 5,
            color: ACCENT,
            marginBottom: 20,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: font.bold,
          fontSize: 74,
          lineHeight: 1.16,
          letterSpacing: -2,
          color: color.paper,
          textShadow: '0 8px 40px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.75)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * The end.
 *
 * Three seconds, which `marketing/README.md` argues hard against for organic —
 * completion rate is what TikTok distributes on and a static logo is a fifth of
 * the runtime doing nothing. A paid unit is the exception the same file names:
 * it is bought impressions rather than earned ones, and the thing being bought
 * is the name landing. Still only three seconds.
 */
export const EndCard: React.FC<{ cta: string }> = ({ cta }) => {
  const frame = useCurrentFrame();
  const rise = (d: number) => ease(frame, d, d + 14);

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 1920 - SAFE.y1,
      }}
    >
      <div style={{ opacity: rise(0) }}>
        <Mark size={220} startFrame={2} />
      </div>
      <div
        style={{
          opacity: rise(14),
          transform: `translateY(${(1 - rise(14)) * 20}px)`,
          fontFamily: font.bold,
          fontSize: 104,
          color: color.paper,
          letterSpacing: -2.8,
          marginTop: 16,
        }}
      >
        Wordburn
      </div>
      <div
        style={{
          opacity: rise(24),
          transform: `translateY(${(1 - rise(24)) * 16}px)`,
          marginTop: 34,
          background: ACCENT,
          color: ON_ACCENT,
          fontFamily: font.bold,
          fontSize: 40,
          padding: '20px 44px',
          borderRadius: 999,
        }}
      >
        {cta}
      </div>
      <div
        style={{
          opacity: rise(32),
          fontFamily: font.medium,
          fontSize: 34,
          color: color.mute,
          marginTop: 22,
        }}
      >
        One payment. No subscription.
      </div>
    </AbsoluteFill>
  );
};
