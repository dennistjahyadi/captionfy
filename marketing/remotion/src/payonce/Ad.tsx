import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from '../tutorial/Captions';
import { Glow, LogoLockup } from '../tutorial/Graphics';
import { Brand, Kinetic, Struck } from '../voiced/Kinetic';
import { AIRPLANE, Label, Labels, PhoneShots, STATUS_BAR_FOCUS, Shot } from '../voiced/Shots';
import { F } from '../voiced/time';

import { SCRIPT, VOICE } from './script';

const { PHRASES, CUES, TOTAL_FRAMES, said } = SCRIPT;

/**
 * Video 03 — "still paying every month just to caption your videos?"
 *
 * One voice, 22.6 s, and a picture cut to it. Four movements:
 *
 *  1. **The hook** (0–3 s). No app. The question set large on black, each word
 *     arriving as it is said, "every month" in the accent. A muted viewer has
 *     read the whole question by the time the algorithm decides.
 *  2. **The name, then the phone** (3.5–5 s). "Wordburn" lands alone in the
 *     middle of the frame; on "phone" the device rises under it and the name
 *     lifts to become its label.
 *  3. **The tutorial** (5.8–14.7 s). Five steps in the app's own recordings —
 *     pick, captions, fix, style, export — one shot per step, each cut on the
 *     word that names it and each carrying the real tap that took the app to
 *     the next screen. Then the proof: Processing with the aeroplane in the
 *     status bar, leaned in on and ringed, while the voice says nothing
 *     uploads.
 *  4. **The offer and the close** (14.8–23 s). The phone leaves. "pay once"
 *     large, "keep it forever" under it, then "subscription" and "renewal"
 *     struck through as they are named; and the lockup with the store line,
 *     with the last sentence subtitled under it.
 */

/**
 * Every window is placed against what the recording is doing, not against
 * how long the line is. The recorded press is visible in each clip — the
 * button dims, the tile lifts, the word boxes — and the ring is put two or
 * three frames ahead of it so the press reads as the ring's consequence.
 */
const SHOTS: Shot[] = [
  // Home under the brand, and the New video press at 1.5 s into the clip.
  { file: 'pick.mp4', startSec: 0.3, fromSec: 4.25, toSec: 5.7, tap: { x: 540, y: 642, atSec: 5.4 } },
  // "Drop in a clip": the system picker already up, the clip tile pressed at 5.0 s.
  { file: 'pick.mp4', startSec: 4.3, fromSec: 5.7, toSec: 6.85, tap: { x: 540, y: 1408, atSec: 6.36 } },
  // "captions show up": the editor with play just pressed, the box travelling.
  { file: 'editor.mp4', startSec: 1.3, fromSec: 6.85, toSec: 8.0 },
  // "tap a word to fix it": the "1 to check" chip pressed at 2.9 s — the press
  // the recording actually made, and the one that opens the dotted word's
  // sheet at 3.3. The word itself sits under the subtitle band; the chip is
  // above it and is the app's own way of getting to that word.
  //
  // These three run a quarter second ahead of their words. The voice says
  // them in two and a half seconds, and a screen that arrives on its word
  // and is pressed a beat later is gone before it has been seen; one that is
  // already there when the word lands, and is pressed on it, reads at the
  // voice's pace instead of behind it.
  { file: 'fix.mp4', startSec: 2.1, fromSec: 7.8, toSec: 9.4, tap: { x: 166, y: 1283, atSec: 8.55 } },
  // "pick a style": the tiles populated, Read along pressed at 9.95 s.
  { file: 'style.mp4', startSec: 9.3, fromSec: 9.4, toSec: 10.45, tap: { x: 791, y: 1482, atSec: 10.0 } },
  // "export": Save to gallery pressed at 2.55 s, the bar appears.
  { file: 'saving.mp4', startSec: 1.95, fromSec: 10.45, toSec: 11.8, tap: { x: 540, y: 1996, atSec: 11.0 } },
  // "Nothing uploads, it all runs offline": Processing, the aeroplane ringed,
  // the camera leaning in on the status bar — gently, to half the size it
  // used to, and staying there. The way back out was a second camera move
  // straight after three cuts, and the phone leaves anyway.
  { file: 'pick.mp4', startSec: 28, fromSec: 11.8, toSec: 14.75, pointer: AIRPLANE, focus: STATUS_BAR_FOCUS(0.6, 9, 0.46) },
];

/** The phone rises on "phone" and leaves before "pay once". */
const PHONE_IN = F(4.25);
const PHONE_OUT = F(14.55);

/**
 * No step ticks. They were one more thing changing on every cut, and the
 * three quick steps are one line now — see `Stepline`.
 */
const LABELS: Label[] = [
  { at: said(3), until: said(4), text: 'pick a clip' },
  { at: said(4), until: said(5) - 8, text: 'captions appear' },
  {
    at: said(5) - 8,
    until: said(8),
    text: 'fix · style · export',
    parts: [
      { text: 'fix', at: said(5) },
      { text: 'style', at: said(6) },
      { text: 'export', at: said(7) },
    ],
  },
  { at: said(8), until: PHONE_OUT, text: '100% offline', kicker: 'nothing uploads' },
];

const OFFER_IN = said(10);
const OFFER_OUT = F(18.95);
const CLOSE_IN = F(19.15);

export const PayOnceAd: React.FC = () => {
  useFonts();

  return (
    <ProjectProvider value={{ safe: { x0: 60, x1: 960, y0: 211, y1: 1498 }, dir: 'tutorial' }}>
      <AbsoluteFill>
        <Ground solid />

        <Sequence from={F(0)} layout="none">
          <Audio src={staticFile(VOICE)} />
        </Sequence>

        {/* 1. The hook. */}
        <Glow atY={0.46} />
        <Kinetic
          lines={[
            { words: PHRASES[0].slice(0, 2), size: 96 },
            { words: PHRASES[0].slice(2, 4), accent: [0, 1], size: 96 },
            { words: PHRASES[1].slice(0, 3), size: 96 },
            { words: PHRASES[1].slice(3, 5), size: 96 },
          ]}
          atY={0.46}
          gap={4}
          clean="hook"
          outAt={F(2.95)}
        />

        {/* 2. The name, then the phone under it. */}
        <Brand at={F(3.3)} liftAt={PHONE_IN} outAt={said(3) - 8} />

        {/* 3. The tutorial. */}
        <PhoneShots shots={SHOTS} enterAt={PHONE_IN} exitAt={PHONE_OUT} />
        <Labels labels={LABELS} steps={0} />

        {/* 4. The offer. */}
        <Sequence from={OFFER_IN - 6} durationInFrames={OFFER_OUT + 12 - OFFER_IN}>
          <Glow at={0} atY={0.42} />
        </Sequence>
        <Kinetic
          lines={[
            { words: PHRASES[10], accent: [0, 1], size: 132 },
            { words: PHRASES[11], size: 88 },
          ]}
          atY={0.4}
          outAt={OFFER_OUT}
          gap={6}
          clean="label"
        />
        <Offer at={said(12)} outAt={OFFER_OUT} />

        {/* The close. */}
        <Sequence from={CLOSE_IN - 10} layout="none">
          <Glow atY={0.44} />
        </Sequence>
        <LogoLockup at={CLOSE_IN} atY={0.44} cta="Free on Google Play" />

        {/* The subtitles, outside every Sequence so a phrase may straddle a cut. */}
        <Captions cues={CUES} atY={0.74} size={54} />
      </AbsoluteFill>
    </ProjectProvider>
  );
};

export { TOTAL_FRAMES };

/**
 * "No subscription, no renewal" — the two words, struck as they are said.
 *
 * Under the big line rather than replacing it: the offer is still on screen
 * while the two things it is not are crossed out beneath it.
 */
const Offer: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  if (frame < at) return null;
  const leave = interpolate(frame, [outAt, outAt + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  if (leave >= 1) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: height * 0.565,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: 26,
        transform: `translateY(-50%) scale(${1 - leave * 0.06})`,
        opacity: 1 - leave,
        pointerEvents: 'none',
      }}
    >
      {/* "subscription" on its word, the line through it a beat later; "renewal" the same. */}
      <Struck text="subscription" at={said(12, 1) - 3} strikeAt={said(12, 1) + 5} />
      <Struck text="renewal" at={said(13, 1) - 3} strikeAt={said(13, 1) + 5} />
    </div>
  );
};
