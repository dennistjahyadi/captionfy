import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { Punch } from '../Phone';
import { ExportShot, Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from './Captions';
import { focusDim, focusMoves } from './Focus';
import { CaptionBars, Glow, LogoLockup } from './Graphics';
import { Headline, Steps } from './Headline';
import { Segments } from './Segments';
import { BeatSfx } from './Sfx';
import {
  CONFIG,
  DIR,
  FPS,
  Segment,
  beatsFor,
  cuesFor,
  exportStartFrame,
  voiceFileFor,
} from './timeline';

/**
 * The tutorial body — the same forty-four seconds under all six hooks.
 *
 * It is a walk through the app in the order somebody would actually use it:
 * pick, transcribe, read, fix, time, style, teach, export. Every beat is the
 * whole screen inside a device, one short label above it, and a full sentence
 * in the voice. The label is what a muted viewer reads; the sentence is what
 * makes it make sense. Splitting the two is the change this cut was made for —
 * the previous one put the whole explanation on screen, which meant the
 * explanation had to be three words long.
 *
 * Hard cuts with a frame of overshoot between beats, not dissolves: a dissolve
 * is the film's gesture and the film is a paid unit. These are organic posts,
 * where a transition reads as manufactured.
 *
 * Rendered once, to `out/body.mp4`, and joined to each hook without
 * re-encoding — so the body in every one of the six files is the same bytes,
 * which is what makes them a controlled test of the hook.
 */
/**
 * How long one beat keeps playing under the next.
 *
 * Beats used to tile exactly and cut hard. A hard cut is right for the hook —
 * it is the gesture the whole organic format runs on — but inside a
 * walk-through it asks the viewer to believe a step happened off camera: one
 * screen simply becomes another. Eight frames of overlap, with the incoming
 * beat fading up over the outgoing one, reads as the app moving from one screen
 * to the next rather than as a slideshow of screenshots.
 *
 * It costs nothing in length. The beats still start where they started; each
 * one merely keeps drawing for eight frames after its slot, underneath its
 * successor, and the last one is clipped by the composition.
 */
const OVERLAP = 8;

export const Body: React.FC<{ voice?: string }> = ({ voice }) => {
  useFonts();
  const beats = beatsFor(voice);
  const cues = cuesFor(voiceFileFor(voice));
  const track = voiceFileFor(voice);

  return (
    <ProjectProvider value={{ safe: CONFIG.safeBox, dir: DIR }}>
      <AbsoluteFill>
        <Ground solid />

        {/* One recording, played whole from frame zero, rather than nine pieces
            placed per beat. The beats were cut *to* this file by
            `split-voice.mjs`, so every boundary already lands on a boundary in
            the read; playing it as one piece means the picture cannot drift
            from the voice however the beats are re-ordered or re-timed. */}
        {track ? <Audio src={staticFile(`${DIR}/${track}`)} /> : null}

        {beats.map((beat, i) => (
          <Sequence
            key={beat.id}
            from={beat.from}
            durationInFrames={beat.frames + OVERLAP}
          >
            <Dissolve enter={i > 0}>
              {beat.segments ? (
                // `introSec` holds the brand on screen before the app appears.
                // Beat one says "Meet Wordburn" and used to open straight on a
                // screenshot, which names the app in the voice and shows it in
                // the picture at the same moment — so neither lands. The mark
                // comes first, alone, and the phone arrives under the second
                // half of the sentence.
                <Sequence
                  from={Math.round((beat.introSec ?? 0) * FPS)}
                  durationInFrames={beat.frames + OVERLAP}
                >
                  <Segments
                    segments={beat.segments as Segment[]}
                    fillFrames={beat.frames + OVERLAP - Math.round((beat.introSec ?? 0) * FPS)}
                  />
                </Sequence>
              ) : null}

              {beat.introSec ? <Intro sec={beat.introSec} /> : null}

              <BeatSfx
                index={i}
                isLast={i === beats.length - 1}
                moveFrom={beats
                  .slice(0, i)
                  .reduce((n, b2) => n + focusMoves(b2.segments as Segment[] | undefined, b2.frames, FPS).length, 0)}
                moves={focusMoves(
                  beat.segments as Segment[] | undefined,
                  beat.frames,
                  FPS,
                  Math.round((beat.introSec ?? 0) * FPS)
                )}
              />

              {beat.source === 'export' ? (
                <Punch>
                  <ExportShot startFrom={exportStartFrame(beat.id)} />
                </Punch>
              ) : null}

              {beat.title ? (
                <BeatChrome
                  text={beat.title}
                  kicker={beat.kicker ?? undefined}
                  at={Math.round(beat.voInAt * FPS)}
                  pos={beat.titlePos === 'mid' ? 'mid' : 'above'}
                  segments={beat.segments as Segment[] | undefined}
                  beatFrames={beat.frames}
                  introFrames={Math.round((beat.introSec ?? 0) * FPS)}
                  index={i}
                  total={beats.length}
                />
              ) : null}

              {/* The close. It used to play the app's finished export with the
                  name over it; that export has Wordburn's own captions burned
                  into it, so against this cut's subtitles it read as two
                  caption tracks at once. Now it is the abstract language the
                  hook opened in — the line of words assembling, the accent
                  crossing it — resolving into the mark, centred, with the store
                  line under it. The video ends where it began, on the icon's own
                  shape, having shown the product in between. */}
              {beat.source === 'black' ? (
                // The close does not open on the logo. The line under it is
                // three claims and then an instruction — "offline, one payment,
                // no subscription" and then "you can find it now on Google
                // Play" — and a mark sitting still through all four says
                // nothing during the first three. So the abstract language the
                // hook opened in runs through the claims, and collapses into
                // the brand on the frame the instruction begins. `brandAtSec`
                // is read off the word timings in captions.json, not guessed.
                <>
                  <Glow atY={0.46} />
                  <CaptionBars
                    at={4}
                    atY={0.44}
                    sweepSec={(beat.brandAtSec ?? 5.4) - 0.6}
                    outAt={Math.round((beat.brandAtSec ?? 5.4) * FPS) - 6}
                  />
                  <LogoLockup
                    at={Math.round((beat.brandAtSec ?? 5.4) * FPS)}
                    cta={CONFIG.cta}
                    atY={0.44}
                  />
                </>
              ) : null}
            </Dissolve>
          </Sequence>
        ))}

        {/* Outside the beats, because the voice is one unbroken recording and a
            phrase is free to straddle a cut. Inside a beat's Sequence the cue
            times would have to be rebased on every boundary, and a cue that
            crossed one would be chopped in half. */}
        <Captions cues={cues} />
      </AbsoluteFill>
    </ProjectProvider>
  );
};

/**
 * The headline and the step ticks, which stand down while the phone leans in.
 *
 * They live together because they share one reason to disappear: both sit
 * above the phone's head, and the phone's head rises when it moves in on a
 * control. Fading them is better than shrinking the move — by the time the
 * move has happened the headline has been read, and the subtitle underneath is
 * carrying the sentence.
 */
const BeatChrome: React.FC<{
  text: string;
  kicker?: string;
  at: number;
  pos: 'above' | 'mid';
  segments?: Segment[];
  beatFrames: number;
  introFrames: number;
  index: number;
  total: number;
}> = ({ text, kicker, at, pos, segments, beatFrames, introFrames, index, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const show = 1 - focusDim(segments, beatFrames, frame, fps, introFrames);
  if (show <= 0.01) return null;

  return (
    <div style={{ opacity: show }}>
      <Headline text={text} kicker={kicker} at={at} pos={pos} />
      <Steps index={index} total={total} />
    </div>
  );
};

/**
 * A beat, fading up over the one it replaces.
 *
 * Later siblings paint over earlier ones, so the incoming beat only has to
 * arrive at zero opacity and climb; the outgoing beat is still drawing
 * underneath it for `OVERLAP` frames and needs to do nothing at all. The first
 * beat does not fade — there is nothing under it, and a body that opens by
 * fading up out of the hook would soften the one cut that should be hard.
 */
const Dissolve: React.FC<{ enter: boolean; children: React.ReactNode }> = ({
  enter,
  children,
}) => {
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

/**
 * The brand, alone, at the head of the beat that names it.
 *
 * It fades as the phone arrives rather than cutting, so the two never share the
 * frame at full strength — the mark has the first half of the sentence and the
 * app has the second.
 */
const Intro: React.FC<{ sec: number }> = ({ sec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = sec * fps;
  const out = interpolate(frame, [end - 10, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Glow atY={0.46} />
      <LogoLockup at={2} atY={0.46} size={168} />
    </AbsoluteFill>
  );
};
