import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';

import { Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from '../tutorial/Captions';
import { Glow, LogoLockup } from '../tutorial/Graphics';
import { Brand, Kinetic, WifiOff } from '../voiced/Kinetic';
import { AIRPLANE, Label, Labels, PhoneShots, STATUS_BAR_FOCUS, Shot } from '../voiced/Shots';
import { F } from '../voiced/time';

import { SCRIPT, VOICE, VOICE_GAIN } from './script';

const { PHRASES, CUES, TOTAL_FRAMES, said } = SCRIPT;

/**
 * Video 03, second angle — "can your caption app work with no internet?"
 *
 * One voice, 22.4 s, and a picture cut to it. The same four movements as the
 * pay-once ad, with the tutorial rearranged around the claim:
 *
 *  1. **The hook** (0–2.3 s). The question set large on black, "no internet?"
 *     in the accent.
 *  2. **The name, then the phone** (2.5–3.7 s). "Wordburn" lands on "this one
 *     can"; the phone rises under it showing Home.
 *  3. **The tutorial** (3.7–15.4 s). The physical action first: the shade down
 *     and the Airplane tile pressed, the aeroplane appearing in the status
 *     bar. Then the picker and the clip, then Processing finishing with the
 *     aeroplane still up there — leaned in on and ringed while the voice says
 *     it all runs on your phone — and the app's own step into the editor. Fix,
 *     style, export as before, and the Saved screen under "nothing leaves your
 *     gallery".
 *  4. **The offer and the close** (15.9–23 s). "pay once / keep it forever",
 *     then the lockup with the store line, and a Wi-Fi mark drawing itself in
 *     and getting its slash on "Wi-Fi or not".
 */
const SHOTS: Shot[] = [
  // Home under the brand, from the airplane recording so the shade that
  // follows pulls down over the same screen.
  { file: 'toggle.mp4', startSec: 0.6, fromSec: 3.05, toSec: 3.75 },
  // "Flip on airplane mode": the shade already down, the Airplane tile pressed
  // at 5.75 s into the clip and lit by 6.0, the aeroplane in the bar with it.
  { file: 'toggle.mp4', startSec: 4.9, fromSec: 3.75, toSec: 4.96, tap: { x: 792, y: 1099, atSec: 4.55 } },
  // "drop in a clip": the system picker, the clip tile pressed at 5.0 s.
  { file: 'pick.mp4', startSec: 4.3, fromSec: 4.96, toSec: 5.94, tap: { x: 540, y: 1408, atSec: 5.62 } },
  // "and captions still show up because it all runs on your phone": the
  // transcription finishing — the words land at 40.2 s — with the aeroplane
  // still in the status bar, leaned in on and ringed on "because"; then the
  // app's own step into the editor at 42.75, which the next shot continues.
  { file: 'pick.mp4', startSec: 39.85, fromSec: 5.94, toSec: 9.7, pointer: AIRPLANE, focus: STATUS_BAR_FOCUS(1.5, 2.65) },
  // "Tap a word to fix it": the "1 to check" chip pressed at 2.9 s, the word's sheet at 3.3.
  // The three quick steps run a quarter second ahead of their words, for the
  // reason the pay-once cut gives: a screen already there when its word lands
  // reads at the voice's pace, one arriving on the word reads behind it.
  { file: 'fix.mp4', startSec: 2.15, fromSec: 9.55, toSec: 11.0, tap: { x: 166, y: 1283, atSec: 10.25 } },
  // "pick a style": Read along pressed at 9.95 s.
  { file: 'style.mp4', startSec: 9.35, fromSec: 11.0, toSec: 11.95, tap: { x: 791, y: 1482, atSec: 11.55 } },
  // "export": Save to gallery pressed at 2.55 s.
  { file: 'saving.mp4', startSec: 1.95, fromSec: 11.95, toSec: 13.0, tap: { x: 540, y: 1996, atSec: 12.5 } },
  // "nothing uploads, nothing leaves your gallery": the Saved screen, the tick and the file's name.
  { file: 'saving.mp4', startSec: 81.3, fromSec: 13.0, toSec: 15.7 },
];

/** The phone rises on "can" and leaves before "pay once". */
const PHONE_IN = F(3.05);
const PHONE_OUT = F(15.55);

/** No step ticks, and the three quick steps as one line — see `Stepline`. */
const LABELS: Label[] = [
  { at: said(3), until: said(4), text: 'airplane mode on' },
  { at: said(4), until: said(5), text: 'pick a clip' },
  { at: said(5), until: said(6), text: 'captions appear' },
  { at: said(6), until: said(7) - 8, text: 'runs on your phone', kicker: 'no internet' },
  {
    at: said(7) - 8,
    until: said(10),
    text: 'fix · style · export',
    parts: [
      { text: 'fix', at: said(7) },
      { text: 'style', at: said(8) },
      { text: 'export', at: said(9) },
    ],
  },
  { at: said(10), until: PHONE_OUT, text: 'stays in your gallery', kicker: 'nothing uploads' },
];

const OFFER_IN = said(12);
const OFFER_OUT = F(17.85);
const CLOSE_IN = F(18.0);

export const NoInternetAd: React.FC = () => {
  useFonts();

  return (
    <ProjectProvider value={{ safe: { x0: 60, x1: 960, y0: 211, y1: 1498 }, dir: 'tutorial' }}>
      <AbsoluteFill>
        <Ground solid />

        <Sequence from={F(0)} layout="none">
          <Audio src={staticFile(VOICE)} volume={VOICE_GAIN} />
        </Sequence>

        {/* 1. The hook. */}
        <Glow atY={0.46} />
        <Kinetic
          lines={[
            { words: PHRASES[0].slice(0, 2), size: 96 },
            { words: PHRASES[0].slice(2, 4), size: 96 },
            { words: PHRASES[1].slice(0, 2), size: 96 },
            { words: PHRASES[1].slice(2, 4), accent: [0, 1], size: 96 },
          ]}
          atY={0.46}
          gap={4}
          clean="hook"
          outAt={F(2.25)}
        />

        {/* 2. The name, on "this one can", then the phone under it. */}
        <Brand at={F(2.45)} liftAt={PHONE_IN} outAt={said(3) - 8} />

        {/* 3. The tutorial. */}
        <PhoneShots shots={SHOTS} enterAt={PHONE_IN} exitAt={PHONE_OUT} />
        <Labels labels={LABELS} steps={0} />

        {/* 4. The offer. */}
        <Sequence from={OFFER_IN - 6} durationInFrames={OFFER_OUT + 12 - OFFER_IN}>
          <Glow at={0} atY={0.44} />
        </Sequence>
        <Kinetic
          lines={[
            { words: PHRASES[12], accent: [0, 1], size: 132 },
            { words: PHRASES[13], size: 88 },
          ]}
          atY={0.44}
          outAt={OFFER_OUT}
          gap={6}
          clean="label"
        />

        {/* The close: the lockup, and the Wi-Fi mark crossed out on the last line. */}
        <Sequence from={CLOSE_IN - 10} layout="none">
          <Glow atY={0.44} />
        </Sequence>
        <LogoLockup at={CLOSE_IN} atY={0.44} cta="Free on Google Play" />
        <WifiOff at={said(15, 4) - 4} slashAt={said(16)} atY={0.235} />

        <Captions cues={CUES} atY={0.74} size={54} />
      </AbsoluteFill>
    </ProjectProvider>
  );
};

export { TOTAL_FRAMES };
