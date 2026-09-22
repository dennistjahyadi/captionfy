import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { Tap } from '../Phone';
import { PHONE_TOP, PhoneFrame, Pointer, SCALE, devicePoint } from '../parts';
import { Focus, FocusRegion } from '../tutorial/Focus';
import { ACCENT, color, font } from '../brand';
import { useSafeBox } from '../parts';
import { Headline, Steps } from '../tutorial/Headline';

import { F, FPS } from './time';

/**
 * The tutorial half of a voiced ad: the app's own recordings inside one
 * phone, one shot per step, each cut on the word that names it.
 *
 * Shots crossfade rather than punch. Video 02's body found that a hard cut
 * inside a walk-through asks the viewer to believe a step happened off
 * camera; an eight-frame fade over an identical phone frame reads as the app
 * moving from one screen to the next.
 */

/** Frames one shot keeps drawing under the next. */
export const OVERLAP = 8;

/**
 * The phone is drawn a little under video 02's size, scaled about its head so
 * the headline slot above it does not move and the foot comes up from 1603
 * to 1431. At full size the Save button, the dotted word and the foot of
 * every sheet sat under the subtitle band, and a tap ring on a control the
 * band covers is a tap on nothing. The shots here are about a second each,
 * too short for the zoom video 02 uses to lift a low control into view, so
 * the whole phone comes up instead.
 */
export const PHONE_SCALE = 0.86;

export type Shot = {
  file: string;
  /** Seconds into the recording to start from. */
  startSec: number;
  /** Composition time, in recording seconds (before `LEAD`). */
  fromSec: number;
  toSec: number;
  /** A tap ring on the control the recording is about to press, in the device's own pixels. */
  tap?: { x: number; y: number; atSec: number };
  /** A ring round a point on the device — the aeroplane in the status bar. */
  pointer?: { x: number; y: number; r: number };
  focus?: FocusRegion;
  rate?: number;
};

/** The aeroplane glyph in the emulator's status bar and the lean-in on it: video 02's own measurements. */
export const AIRPLANE = { x: 944, y: 68, r: 33 } as const;
export const STATUS_BAR_FOCUS = (inSec: number, outSec: number, fill = 0.62): FocusRegion => ({
  deviceX: 520,
  deviceY: 0,
  deviceW: 545,
  deviceH: 210,
  inSec,
  outSec,
  fill,
  zoom: true,
});

/**
 * Every shot, inside the one device, which rises once and leaves once
 * however many screens it shows in between.
 */
export const PhoneShots: React.FC<{ shots: Shot[]; enterAt: number; exitAt: number }> = ({
  shots,
  enterAt,
  exitAt,
}) => (
  <Phone enterAt={enterAt} exitAt={exitAt}>
    {shots.map((shot, i) => (
      <Sequence
        key={`${shot.file}:${i}`}
        from={F(shot.fromSec)}
        durationInFrames={F(shot.toSec) - F(shot.fromSec) + OVERLAP}
      >
        <Dissolve enter={i > 0}>
          <Focus region={shot.focus}>
            <PhoneFrame file={shot.file} startFrom={Math.round(shot.startSec * FPS)} rate={shot.rate} />
            {shot.pointer ? (
              <Pointer {...devicePoint(shot.pointer.x, shot.pointer.y)} r={shot.pointer.r * SCALE} at={10} />
            ) : null}
            {shot.tap ? (
              <Tap {...devicePoint(shot.tap.x, shot.tap.y)} at={F(shot.tap.atSec) - F(shot.fromSec)} />
            ) : null}
          </Focus>
        </Dissolve>
      </Sequence>
    ))}
  </Phone>
);

/**
 * The device, rising into the frame and leaving it.
 *
 * It comes up on a spring — a phone that eases in reads as a slide in a deck —
 * and goes down on an ease, because leaving is not news.
 */
const Phone: React.FC<{ enterAt: number; exitAt: number; children: React.ReactNode }> = ({
  enterAt,
  exitAt,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  if (frame < enterAt) return null;

  const up = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 200, stiffness: 70, mass: 1.2 },
    durationInFrames: 30,
  });
  const down = interpolate(frame, [exitAt, exitAt + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  if (down >= 1) return null;

  const y = (1 - up) * height * 0.85 + down * height * 0.6;

  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${width / 2}px ${PHONE_TOP}px`,
        transform: `translateY(${y}px) scale(${PHONE_SCALE})`,
        opacity: 1 - down,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A shot fading up over the one under it; the first arrives with the phone and needs no fade. */
const Dissolve: React.FC<{ enter: boolean; children: React.ReactNode }> = ({ enter, children }) => {
  const frame = useCurrentFrame();
  const opacity = enter
    ? interpolate(frame, [0, OVERLAP], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      })
    : 1;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** The last few frames of a Sequence, fading out — so the next label can spring in over nothing. */
const FadeOut: React.FC<{ lastFrames: number; children: React.ReactNode }> = ({ lastFrames, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // `useVideoConfig` inside a Sequence reports the Sequence's own length.
  const opacity = interpolate(frame, [durationInFrames - lastFrames, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export type Label = {
  /** Frames. */
  at: number;
  until: number;
  text: string;
  kicker?: string;
  /** Which of the step ticks is lit, if this label is a step. */
  step?: number;
  /**
   * A run of quick steps as one line — see `Stepline`. `text` is then only
   * the key; the words on screen are the parts.
   */
  parts?: { text: string; at: number }[];
};

/**
 * The label above the phone for each step, on the word that starts it, with
 * the ticks under it for where we are — and, for a step that is a claim
 * rather than an action, a kicker over it and no tick.
 */
export const Labels: React.FC<{ labels: Label[]; steps: number }> = ({ labels, steps }) => (
  <>
    {labels.map((l) => (
      <Sequence key={l.text} from={l.at} durationInFrames={l.until - l.at + 6}>
        <FadeOut lastFrames={6}>
          {l.parts ? (
            <Stepline parts={l.parts.map((p) => ({ ...p, at: p.at - l.at }))} />
          ) : (
            <Headline text={l.text} kicker={l.kicker} pos="above" />
          )}
          {l.step === undefined ? null : <Steps index={l.step} total={steps} />}
        </FadeOut>
      </Sequence>
    ))}
  </>
);

/**
 * Three quick steps as one label, each word lighting up as it is reached.
 *
 * "tap a word to fix it, pick a style, export" is two and a half seconds of
 * voice and three screens. The first cut gave each its own headline, its own
 * tick and its own cut, which is nine things arriving in the time it takes
 * to say them — and that, not the footage, is what read as too fast. The
 * line now arrives once, before the first of the three, and the accent
 * moves along it word by word as the voice does: one headline and three
 * colour changes instead of three headlines. The shots underneath still
 * change, because they are the content; the chrome no longer competes with
 * them.
 */
const Stepline: React.FC<{ parts: { text: string; at: number }[] }> = ({ parts }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const SAFE = useSafeBox();
  const half = Math.min(width / 2 - SAFE.x0, SAFE.x1 - width / 2);

  return (
    <div
      style={{
        position: 'absolute',
        // The same foot as `Headline`'s `above`: hung off the phone's head.
        bottom: height - PHONE_TOP + 26,
        left: width / 2 - half,
        width: half * 2,
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0 22px' }}>
        {parts.map((p, i) => {
          const land = spring({
            frame: frame - i * 2,
            fps,
            config: { damping: 200, stiffness: 150, mass: 0.7 },
            durationInFrames: 14,
          });
          const lit = spring({
            frame: frame - p.at,
            fps,
            config: { damping: 200, stiffness: 170, mass: 0.6 },
            durationInFrames: 12,
          });
          const current = frame >= p.at && (i === parts.length - 1 || frame < parts[i + 1].at);
          return (
            <React.Fragment key={p.text}>
              {i > 0 ? (
                <span style={{ fontFamily: font.bold, fontSize: 74, color: color.line, opacity: land }}>·</span>
              ) : null}
              <span
                style={{
                  fontFamily: font.bold,
                  fontSize: 74,
                  lineHeight: 1.1,
                  letterSpacing: -2.5,
                  color: lit > 0.5 ? ACCENT : color.paper,
                  // Waiting words sit back; the one being said is full; a
                  // word already done stays lit but eases back a step.
                  opacity: land * (lit > 0.5 ? (current ? 1 : 0.8) : 0.42),
                  display: 'inline-block',
                  transform: `translateY(${(1 - land) * 22}px) scale(${1 + (current ? lit * 0.06 : 0)})`,
                  textShadow: '0 8px 40px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.75)',
                }}
              >
                {p.text}
              </span>
            </React.Fragment>
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
            spring({ frame: frame - parts.length * 2, fps, config: { damping: 200 }, durationInFrames: 18 }),
            [0, 1],
            [0, 92]
          ),
          opacity: 0.95,
        }}
      />
    </div>
  );
};
