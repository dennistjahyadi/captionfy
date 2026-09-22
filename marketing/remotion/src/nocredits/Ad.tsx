import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from '../tutorial/Captions';
import { Glow, LogoLockup } from '../tutorial/Graphics';
import { Brand, Kinetic, Struck } from '../voiced/Kinetic';
import { Label, Labels, PhoneShots, Shot } from '../voiced/Shots';
import { F } from '../voiced/time';

import { Hundred, Quota } from './Graphics';
import { SCRIPT, VOICE } from './script';

const { PHRASES, CUES, TOTAL_FRAMES, said } = SCRIPT;

/**
 * Video 03, third angle — "have you ever run out of credits just to caption
 * a video?"
 *
 * One voice, 27.1 s, and a picture cut to it. Longer than its two siblings by
 * a sentence at each end, and the extra sentences are the ones with no app
 * in them, so this cut has two graphics the others do not. Six movements:
 *
 *  1. **The hook** (0–2.5 s). The question set large on black, each word on
 *     its own onset, "credits" in the accent. Nothing else.
 *  2. **The pain** (3.4–7.4 s). Three video tiles under a "3 / month" chip;
 *     the tiles are spent on "then make you", the chip counts down to nought
 *     and turns coral, and "wait" and "pay" land as pills beneath the empties
 *     on their own words. The sentence is subtitled: the graphic is a picture
 *     of it, not the words themselves.
 *  3. **The name, and what it has none of** (8.4–12.3 s). "Wordburn" lands
 *     alone in the middle on the word, and "credits", "quota" and "limit"
 *     arrive as pills under it and take the accent line through them as each
 *     "no" is said. The phone waits: the claim is the picture here, and a
 *     device rising under three pills would have covered them.
 *  4. **The tutorial** (12.2–18.4 s). The phone rises in the pause before
 *     "drop in a clip" and the name lifts to become its label. Home and the
 *     New video press, the picker and the clip, the editor with the mark
 *     travelling, the fix chip, Save to gallery — one shot per step, each on
 *     the word that names it and each carrying the press the recording made.
 *     Then "next one": Home again, New video pressed again, which is what the
 *     words mean.
 *  5. **The hundred** (18.6–20.7 s). The phone leaves. One tile lands in the
 *     middle on "one", multiplies into a ten-by-ten grid on "hundred" with the
 *     number counting up over it, and on "same" the accent sweeps the grid and
 *     every bar it passes stays lit.
 *  6. **The offer and the close** (21.2–27.8 s). "pay once / keep it forever"
 *     large, then the lockup with the store line and the last sentence
 *     subtitled beneath it.
 *
 * No sound effects, as in both siblings: the voice is the only track, and
 * every cut, tap and landing is carried by the picture.
 */

/**
 * Every window is placed against what the recording is doing, not against
 * how long the line is; the ring goes two or three frames ahead of the press
 * the recording actually made, so the press reads as the ring's consequence.
 */
const SHOTS: Shot[] = [
  // Home under the brand, the New video press at 1.5 s into the clip landing on "Drop".
  { file: 'pick.mp4', startSec: 0.6, fromSec: 12.3, toSec: 13.5, tap: { x: 540, y: 642, atSec: 13.12 } },
  // "in a clip": the system picker, the clip tile pressed at 5.0 s.
  { file: 'pick.mp4', startSec: 4.3, fromSec: 13.5, toSec: 14.35, tap: { x: 540, y: 1408, atSec: 14.1 } },
  // "captions show up": the editor with play just pressed, the mark travelling word by word.
  { file: 'editor.mp4', startSec: 1.3, fromSec: 14.35, toSec: 15.3 },
  // "tap a word to fix it": the "1 to check" chip pressed at 2.9 s — the press
  // the recording made, and the one that opens the dotted word's sheet at 3.3.
  { file: 'fix.mp4', startSec: 2.4, fromSec: 15.3, toSec: 16.75, tap: { x: 166, y: 1283, atSec: 15.72 } },
  // "export": Save to gallery pressed at 2.55 s, the bar appears.
  { file: 'saving.mp4', startSec: 2.15, fromSec: 16.75, toSec: 17.6, tap: { x: 540, y: 1996, atSec: 17.08 } },
  // "next one": Home again, New video pressed again on "one". The phone leaves over it.
  { file: 'pick.mp4', startSec: 1.1, fromSec: 17.6, toSec: 18.7, tap: { x: 540, y: 642, atSec: 17.92 } },
];

/**
 * The phone rises in the pause after "no limit" — once the struck pills have
 * gone, since it comes up through the slot they sit in — and leaves on the
 * end of "next one", so it is out of the frame before the one tile lands.
 */
const PHONE_IN = F(12.3);
const PHONE_OUT = F(18.1);

const LABELS: Label[] = [
  { at: said(7), until: said(8), text: 'pick a clip', step: 0 },
  { at: said(8), until: said(9), text: 'captions appear', step: 1 },
  { at: said(9), until: said(10), text: 'tap to fix', step: 2 },
  { at: said(10), until: said(11), text: 'save to gallery', step: 3 },
  { at: said(11), until: PHONE_OUT, text: 'next one', step: 4 },
];

const HOOK_OUT = F(3.05);
const PAIN_OUT = F(7.95);
const BRAND_AT = F(8.3);
const PILLS_OUT = F(12.2);
const HUNDRED_OUT = F(20.85);
const OFFER_OUT = F(23.2);
const CLOSE_IN = F(23.42);

export const NoCreditsAd: React.FC = () => {
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
            { words: PHRASES[0].slice(0, 3), size: 96 },
            { words: PHRASES[0].slice(3, 7), accent: [3], size: 96 },
            { words: PHRASES[1].slice(0, 3), size: 96 },
            { words: PHRASES[1].slice(3, 5), size: 96 },
          ]}
          atY={0.46}
          gap={4}
          clean="hook"
          outAt={HOOK_OUT}
        />

        {/* 2. The pain: three a month, spent, then wait or pay. */}
        <Quota
          tilesAt={[said(2, 0) - 2, said(2, 1) - 2, said(2, 2) - 2]}
          chipAt={said(3, 2) - 2}
          usedAt={[said(4, 0), said(4, 1), said(4, 2)]}
          waitAt={said(4, 3) - 3}
          payAt={said(4, 5) - 3}
          outAt={PAIN_OUT}
          atY={0.44}
        />

        {/* 3. The name, then the three things it has none of, struck as they are named. */}
        {/* The name fades a beat later than its siblings' — three frames before the
            first label rather than eight — because the lift starts later here and
            needs the frames; the label springs up into the slot as it goes. */}
        <Brand at={BRAND_AT} liftAt={PHONE_IN} outAt={said(7) - 3} />
        <NoneOf at={said(6, 3) - 3} outAt={PILLS_OUT} />

        {/* 4. The tutorial. */}
        <PhoneShots shots={SHOTS} enterAt={PHONE_IN} exitAt={PHONE_OUT} />
        <Labels labels={LABELS} steps={5} />

        {/* 5. One video or a hundred. */}
        <Hundred
          oneAt={said(12, 0) - 3}
          hundredAt={said(12, 4) - 5}
          sameAt={said(13, 0) - 2}
          outAt={HUNDRED_OUT}
          atY={0.43}
        />

        {/* 6. The offer. */}
        <Sequence from={said(14) - 6} durationInFrames={OFFER_OUT + 12 - said(14)}>
          <Glow at={0} atY={0.44} />
        </Sequence>
        <Kinetic
          lines={[
            { words: PHRASES[14], accent: [0, 1], size: 132 },
            { words: PHRASES[15], size: 88 },
          ]}
          atY={0.44}
          outAt={OFFER_OUT}
          gap={6}
          clean="label"
        />

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
 * "no credits, no quota, no limit" — three pills under the name, each struck
 * through on its own "no".
 *
 * The same `Struck` the pay-once ad uses for "subscription" and "renewal",
 * three across rather than two, in the slot under the brand where that ad
 * puts them under the offer. It is the one beat in this cut where a claim
 * and the name share the frame, which is why the phone waits for it to end.
 */
const NoneOf: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
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
        top: height * 0.585,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        transform: `translateY(-50%) scale(${1 - leave * 0.06})`,
        opacity: 1 - leave,
        pointerEvents: 'none',
      }}
    >
      {/* Each pill on its word, the line through it a frame later: the "no" has
          already been said by then, so the strike lands as the thing it denies is named. */}
      <Struck text="credits" at={said(6, 3) - 3} strikeAt={said(6, 3) + 1} />
      <Struck text="quota" at={said(6, 5) - 3} strikeAt={said(6, 5) + 1} />
      <Struck text="limit" at={said(6, 7) - 3} strikeAt={said(6, 7) + 1} />
    </div>
  );
};
