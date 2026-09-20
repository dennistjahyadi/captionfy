import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, color, font } from '../brand';
import { useSafeBox } from '../parts';

/**
 * The voiceover, on screen, one short phrase at a time.
 *
 * **These are the video's own subtitles and not Wordburn's output.** The words
 * come from the `vo` lines in `config.json` — the script — and `captions.json`
 * says only *when* each of them is spoken. That distinction is this project's
 * first rule: every caption drawn over a recording of the app came out of the
 * app, and nothing in `../../../pipeline/` transcribes anything. The alignment
 * that produced the timings ran once, offline, outside the repository.
 *
 * Why subtitles at all, on an advertisement for a captions app: most of this
 * will be watched muted, the body is a minute long, and a muted viewer who can
 * only read a four-word label per beat is being asked to take the rest on
 * trust. The headline still carries the beat on its own — these are the
 * sentence under it, not a replacement for it.
 *
 * The active word is marked rather than revealed: the whole cue is present and
 * legible from the frame it appears, and the accent travels across it. A line
 * that builds word by word makes the reader wait for the voice; a line that is
 * already there lets the eye run ahead, which is the whole reason captions
 * raise completion.
 */
export type Cue = {
  fromSec: number;
  toSec: number;
  words: { w: string; s: number }[];
};

export const Captions: React.FC<{
  cues: Cue[];
  /** Where the block sits, as a fraction of frame height. Its centre. */
  atY?: number;
  size?: number;
}> = ({ cues, atY = 0.74, size = 58 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const SAFE = useSafeBox();
  const t = frame / fps;

  // The cue being spoken, or the one just finished — holding the last cue for a
  // beat stops the block flickering out in every gap between phrases.
  const HOLD = 0.24;
  const i = cues.findIndex((c) => t >= c.fromSec && t <= c.toSec + HOLD);
  if (i < 0) return null;
  const cue = cues[i];

  const inFrames = Math.round(cue.fromSec * fps);
  const rise = spring({
    frame: frame - inFrames,
    fps,
    config: { damping: 200, stiffness: 180, mass: 0.5 },
    durationInFrames: 10,
  });
  const out = interpolate(t, [cue.toSec, cue.toSec + HOLD], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Centred on the frame and clamped to the safe box, the same way `Title` is,
  // so the subtitle and the headline share the video's axis.
  const half = Math.min(width / 2 - SAFE.x0, SAFE.x1 - width / 2);

  return (
    <>
      {/*
        A scrim, which an earlier version of this deliberately did not have.
        The argument against was that the ground is solid black for most of the
        runtime and a plate over black is a grey rectangle that reads as a
        subtitle track somebody left on. That argument was about the ground and
        forgot the phone: the block lands over the app's own lower third, which
        is a transcript, a sheet or a waveform — the densest, busiest part of
        every screen in this video. A shadow is not enough over that.

        So: not a plate but a band, dark in the middle and gone at both edges,
        with no edge of its own to read as furniture. It is drawn only while a
        cue is up, and it fades with the cue.
      */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: height * atY - 190,
          width: '100%',
          height: 330,
          // 0.86, not the 0.62 this started at. The band is over the app's own
          // transcript for a third of the runtime, and there the competition is
          // not luminance — it is that the app's words are the same shape as the
          // subtitle's. Darkening both equally kept the contrast and kept the
          // clutter; this puts the app's text far enough back to stop reading as
          // words, which is what the subtitle needs from it.
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.86) 30%, rgba(0,0,0,0.86) 70%, rgba(0,0,0,0) 100%)',
          opacity: Math.min(rise, out),
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: height * atY,
        left: width / 2 - half,
        width: half * 2,
        transform: `translateY(${(1 - rise) * 26 - 50}px)`,
        opacity: Math.min(rise, out),
        textAlign: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 16px',
        pointerEvents: 'none',
      }}
    >
      {cue.words.map((w, n) => {
        const next = cue.words[n + 1];
        const live = t >= w.s && (!next || t < next.s);
        return (
          <span
            key={`${w.w}-${n}`}
            style={{
              fontFamily: font.bold,
              fontSize: size,
              lineHeight: 1.18,
              letterSpacing: -1,
              color: live ? ACCENT : color.paper,
              // A shadow as well as the band above, not instead of it. The
              // band handles the busy case — type over the app's own transcript
              // — and the shadow handles the edges of it, where the gradient has
              // already gone to nothing and the frame underneath may be an
              // export shot rather than black.
              textShadow: '0 6px 28px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)',
              transform: live ? 'translateY(-2px)' : 'none',
              transition: 'none',
            }}
          >
            {w.w}
          </span>
          );
        })}
      </div>
    </>
  );
};
