import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { color, font } from '../brand';
import { Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from '../tutorial/Captions';
import { Glow, LogoLockup } from '../tutorial/Graphics';
import { Brand, Kinetic, Struck } from '../voiced/Kinetic';
import { AIRPLANE, Label, Labels, PhoneShots, Shot } from '../voiced/Shots';
import { F } from '../voiced/time';

import { SCRIPT, VOICE, VOICE_GAIN } from './script';

const { WORDS, PHRASES, CUES, TOTAL_FRAMES, said } = SCRIPT;

/**
 * Video 03, third angle — "ever open your caption app and get lost in all
 * the AI tools you never asked for?"
 *
 * One voice, 23.5 s, and a picture cut to it. The same four movements as the
 * other two, with a fifth thing this one has to show: clutter, and its absence.
 *
 *  1. **The hook** (0–4.7 s). The question set large on black, each word
 *     arriving as it is said, "AI tools" in the accent. From "lost" onward a
 *     feature pill lands in the margins on every word — avatars, dubbing,
 *     templates, auto zoom — tilted, dim, crowding the question from the
 *     outside in. That is the picture of the problem: the thing you came for
 *     is in the middle and everything else is piling up round it.
 *  2. **The name, then the phone** (5.3–7.4 s). On "Wordburn" the clutter
 *     drops out of the frame and the name lands alone in the middle, with
 *     "just the captions part" under it on the voice. On the pause before
 *     "open it" the phone rises and the name lifts to become its label.
 *  3. **The tutorial** (7.0–13.7 s). Six steps in the app's own recordings —
 *     open, drop in a clip, captions, fix, style, export — one shot per step,
 *     each carrying the real press that took the app to the next screen. The
 *     last three are one headline with the accent walking along it.
 *     Then **the absence** (13.7–17.5 s): Home, held, dimmed, with "feed",
 *     "templates" and "AI studio" struck through over it as each is named;
 *     on "that's the whole app" the pills leave and the phone comes back up
 *     to full brightness, because what is left is the app. Then Processing
 *     with the aeroplane in the status bar under "it runs on your phone".
 *  4. **The offer and the close** (18.6–23.5 s). The phone leaves. "pay once"
 *     large, "keep it forever" under it; then the lockup with the store line
 *     and the last sentence subtitled beneath it.
 */

/**
 * Every window is placed against what the recording is doing, not against
 * how long the line is. The recorded press is visible in each clip and the
 * ring is put two or three frames ahead of it so the press reads as the
 * ring's consequence. The windows are the pay-once cut's, moved to this
 * recording's words.
 */
const SHOTS: Shot[] = [
  // "Open it": Home rising with the name over it, and the New video press at
  // 1.5 s into the clip landing just after the words — the open is the press.
  { file: 'pick.mp4', startSec: 0.55, fromSec: 7.0, toSec: 8.4, tap: { x: 540, y: 642, atSec: 7.85 } },
  // "drop in a clip": the system picker already up, the clip tile pressed at 5.0 s.
  { file: 'pick.mp4', startSec: 4.3, fromSec: 8.4, toSec: 9.4, tap: { x: 540, y: 1408, atSec: 9.0 } },
  // "captions show up": the editor with play just pressed, the mark travelling.
  { file: 'editor.mp4', startSec: 1.3, fromSec: 9.4, toSec: 10.15 },
  // "tap a word to fix it": the "1 to check" chip pressed at 2.9 s, the word's
  // sheet at 3.3. These three run a quarter second ahead of their words, as
  // they do in the pay-once cut: a screen already there when the word lands,
  // and pressed on it, reads at the voice's pace instead of behind it.
  { file: 'fix.mp4', startSec: 2.1, fromSec: 10.15, toSec: 11.4, tap: { x: 166, y: 1283, atSec: 10.9 } },
  // "pick a style": the tiles populated, Read along pressed at 9.95 s.
  { file: 'style.mp4', startSec: 9.3, fromSec: 11.4, toSec: 12.4, tap: { x: 791, y: 1482, atSec: 12.0 } },
  // "export": Save to gallery pressed at 2.55 s, the bar appears.
  { file: 'saving.mp4', startSec: 1.95, fromSec: 12.4, toSec: 13.4, tap: { x: 540, y: 1996, atSec: 12.95 } },
  // "no feed, no templates, no AI studio — that's the whole app": Home, held,
  // and settled before the first "no" so the pills land on it and not on the
  // tail of the export. One screen with one button on it, which is the claim.
  { file: 'home.mp4', startSec: 0, fromSec: 13.4, toSec: 17.5 },
  // "it runs on your phone": Processing finishing — the words land at 40.2 s —
  // with the aeroplane in the phone's own status bar, ringed.
  { file: 'pick.mp4', startSec: 39.5, fromSec: 17.5, toSec: 18.75, pointer: AIRPLANE },
];

/** The phone rises in the pause before "open it" and leaves before "pay once". */
const PHONE_IN = F(7.0);
const PHONE_OUT = F(18.6);

/**
 * No step ticks, and the three quick steps are one line — the pay-once cut's
 * `Stepline`, for the reason given there: three headlines in two and a half
 * seconds read as too fast, and the count was the problem, not the footage.
 */
const LABELS: Label[] = [
  { at: said(6), until: said(7), text: 'open it' },
  { at: said(7), until: said(8), text: 'drop in a clip' },
  { at: said(8), until: said(9) - 8, text: 'captions appear' },
  {
    at: said(9) - 8,
    until: said(12) - 6,
    text: 'fix · style · export',
    parts: [
      { text: 'fix', at: said(9) },
      { text: 'style', at: said(10) },
      { text: 'export', at: said(11) },
    ],
  },
  { at: said(15), until: said(16), text: "that's the whole app", kicker: 'nothing else' },
  { at: said(16), until: PHONE_OUT, text: 'runs on your phone', kicker: '100% offline' },
];

/**
 * The hook leaves after "for?" and the clutter drops with it, so the frame
 * is empty for a third of a second before the name lands on its word.
 */
const HOOK_OUT = F(4.95);
const CLUTTER_OUT = F(4.9);
const BRAND_IN = F(5.3);

/** The struck words sit over a dimmed phone and leave together on "that's". */
const STRUCK_IN = said(12) - 4;
const STRUCK_OUT = said(15) - 6;

const OFFER_IN = said(17);
const OFFER_OUT = F(20.45);
const CLOSE_IN = F(20.6);

export const JustCaptionsAd: React.FC = () => {
  useFonts();

  return (
    <ProjectProvider value={{ safe: { x0: 60, x1: 960, y0: 211, y1: 1498 }, dir: 'tutorial' }}>
      <AbsoluteFill>
        <Ground solid />

        <Sequence from={F(0)} layout="none">
          <Audio src={staticFile(VOICE)} volume={VOICE_GAIN} />
        </Sequence>

        {/* 1. The hook, and the clutter piling up round it. */}
        <Glow atY={0.46} />
        <Clutter outAt={CLUTTER_OUT} />
        <Kinetic
          lines={[
            { words: WORDS.slice(0, 3), size: 82 },
            { words: WORDS.slice(3, 6), size: 82 },
            { words: WORDS.slice(6, 11), size: 82 },
            { words: WORDS.slice(11, 14), accent: [0, 1], size: 82 },
            { words: WORDS.slice(14, 17), size: 82 },
          ]}
          atY={0.46}
          gap={4}
          clean="hook"
          outAt={HOOK_OUT}
        />

        {/* 2. The name, with what it is under it, then the phone under both. */}
        <Brand at={BRAND_IN} liftAt={PHONE_IN} outAt={said(6) - 8} />
        <Kinetic
          lines={[{ words: PHRASES[5], accent: [2], size: 64 }]}
          atY={0.555}
          clean="label"
          outAt={PHONE_IN - 4}
        />

        {/* 3. The tutorial, and the absence. */}
        <PhoneShots shots={SHOTS} enterAt={PHONE_IN} exitAt={PHONE_OUT} />
        <Dim from={STRUCK_IN} until={STRUCK_OUT} />
        <Absence at={STRUCK_IN} outAt={STRUCK_OUT} />
        <Labels labels={LABELS} steps={0} />

        {/* 4. The offer. */}
        <Sequence from={OFFER_IN - 6} durationInFrames={OFFER_OUT + 12 - OFFER_IN}>
          <Glow at={0} atY={0.44} />
        </Sequence>
        <Kinetic
          lines={[
            { words: PHRASES[17], accent: [0, 1], size: 132 },
            { words: PHRASES[18], size: 88 },
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
 * The tools nobody asked for, arriving one per word from "lost" to "never".
 *
 * Eight pills in the margins of the frame, above and below the question, each
 * landing on a word of it and sitting slightly askew. They are generic names
 * for the things a captions app grows — no brand, no screenshot, nothing that
 * is a claim about anyone in particular — and they are dim on purpose: the
 * question stays the loudest thing in the frame, and the clutter reads as
 * clutter because it is around it rather than over it.
 *
 * They drift a little while they are up, so the frame is never still, and
 * they drop out of the bottom of the frame together on the beat before the
 * name lands — the same gesture as "just the captions part", a beat early.
 */
const CLUTTER: { text: string; word: number; x: number; y: number; rot: number }[] = [
  { text: 'AI avatars', word: 7, x: 300, y: 340, rot: -6 },
  { text: 'AI dubbing', word: 8, x: 770, y: 290, rot: 5 },
  { text: 'templates', word: 9, x: 230, y: 560, rot: -9 },
  { text: 'auto zoom', word: 10, x: 820, y: 520, rot: 6 },
  { text: 'AI b-roll', word: 11, x: 240, y: 1250, rot: 5 },
  { text: 'AI voices', word: 12, x: 790, y: 1230, rot: -4 },
  { text: 'trending', word: 13, x: 330, y: 1420, rot: -7 },
  { text: 'AI studio', word: 14, x: 750, y: 1410, rot: 8 },
];

const Clutter: React.FC<{ outAt: number }> = ({ outAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {CLUTTER.map((p, i) => {
        const at = F(WORDS[p.word].s) - 2;
        if (frame < at) return null;
        const land = spring({
          frame: frame - at,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
          durationInFrames: 18,
        });
        const drop = interpolate(frame, [outAt + i, outAt + i + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.quad),
        });
        if (drop >= 1) return null;
        // A slow sway, out of phase pill to pill, so nothing sits perfectly still.
        const sway = Math.sin((frame - at) / 11 + i * 1.7) * 2.2;
        return (
          <div
            key={p.text}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              padding: '14px 32px',
              borderRadius: 999,
              border: `2px solid ${color.line}`,
              background: color.surface,
              fontFamily: font.semibold,
              fontSize: 42,
              letterSpacing: -0.5,
              color: color.mute,
              whiteSpace: 'nowrap',
              opacity: Math.min(1, land) * (1 - drop) * 0.92,
              transform: `translate(-50%, -50%) translateY(${(1 - land) * 40 + drop * 260}px) rotate(${
                p.rot + sway + drop * p.rot * 2
              }deg) scale(${0.8 + land * 0.2})`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
              pointerEvents: 'none',
            }}
          >
            {p.text}
          </div>
        );
      })}
    </>
  );
};

/**
 * The phone put back a step while the three words are struck over it.
 *
 * Not black: the app is still there underneath, which is the point of the
 * beat — when the pills leave, what comes back up is the whole app.
 */
const Dim: React.FC<{ from: number; until: number }> = ({ from, until }) => {
  const frame = useCurrentFrame();
  const dim = interpolate(frame, [from, from + 8, until, until + 10], [0, 0.62, 0.62, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (dim <= 0) return null;
  return <AbsoluteFill style={{ background: '#000', opacity: dim, pointerEvents: 'none' }} />;
};

/**
 * "No feed, no templates, no AI studio" — the three words, struck as they
 * are said, stacked over the phone's own middle.
 *
 * Over the phone rather than instead of it: the app stays in shot under the
 * things it does not have, and the beat after this is the app alone.
 */
const Absence: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
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
        top: height * 0.5,
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        transform: `translateY(-50%) scale(${1 - leave * 0.06})`,
        opacity: 1 - leave,
        pointerEvents: 'none',
      }}
    >
      {/* Each pill on its "no", the line through it on the word itself. */}
      <Struck text="feed" at={said(12) - 2} strikeAt={said(12, 1) + 2} />
      <Struck text="templates" at={said(13) - 2} strikeAt={said(13, 1) + 2} />
      <Struck text="AI studio" at={said(14) - 2} strikeAt={said(14, 2) + 2} />
    </div>
  );
};
