import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';

import { useFonts } from '../useFonts';
import { EndCard, ExportShot, Ground, Pointer, ScreenCard, Title } from './parts';
import { BEATS, CONFIG, DISSOLVE, clipStart, exportStartFrame, pointerFor } from './timeline';

/**
 * How the offline card is framed.
 *
 * One pair of numbers, used by the card and by the ring that points into it, so
 * the two cannot drift apart.
 */
const OFFLINE_SCALE = 0.82;
const OFFLINE_TOP = 560;

export type FilmProps = {
  /** Which line of type the `claim` beat carries. Paid creative wants A/B. */
  variant: string;
};

/**
 * One beat, wrapped in the dissolve that carries it in.
 *
 * Every cut in this film is a cross-dissolve, which is a decision and not a
 * default. `marketing/README.md` argues for hard cuts with a frame of overshoot,
 * on the grounds that a smooth zoom reads as a corporate product video — and
 * that is exactly right for the organic posts it was written about, where
 * reading as manufactured is the thing being punished. This is a paid unit
 * asked for as a product film, so the note is inverted on purpose rather than
 * forgotten.
 */
const Beat: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, DISSOLVE, frames - DISSOLVE, frames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * Video 01 — the product film.
 *
 * Built entirely from things this repository owns: the app's own exported file,
 * emulator recordings of the app, and type set in the app's own faces. No stock
 * footage and no faces, which is not squeamishness — `STORE-ASSETS.md` sets out
 * why, and the short version is that free libraries do not collect model
 * releases and a paid advertisement is the exact use a release exists to cover.
 */
export const Film: React.FC<FilmProps> = ({ variant }) => {
  useFonts();

  const variants = CONFIG.variants as Record<string, string>;

  return (
    <AbsoluteFill>
      <Ground />

      {BEATS.map((beat) => {
        const title =
          beat.id === 'claim' ? (variants[variant] ?? variants[CONFIG.defaultVariant]) : beat.title;

        return (
          <Sequence key={beat.id} from={beat.from} durationInFrames={beat.frames}>
            <Beat frames={beat.frames}>
              {beat.source === 'export' ? (
                <ExportShot startFrom={exportStartFrame(beat.id)} />
              ) : null}

              {beat.source === 'app:style' && beat.crop ? (
                <ScreenCard
                  file="style.mp4"
                  crop={beat.crop}
                  scale={0.78}
                  top={520}
                  // Not from frame zero. The recording opens on the sheet
                  // sliding up and only reaches the scroll — the part that
                  // shows there are more than six presets — four seconds in,
                  // and this beat is five seconds long.
                  startFrom={clipStart(beat)}
                />
              ) : null}

              {beat.source === 'app:offline' && beat.crop ? (
                <>
                  <ScreenCard
                    file="offline.mp4"
                    crop={beat.crop}
                    scale={OFFLINE_SCALE}
                    top={OFFLINE_TOP}
                    startFrom={clipStart(beat)}
                  />
                  {/*
                    The aeroplane, circled — placed by the same arithmetic that
                    places the card, not by eye.

                    The glyph's position was measured off
                    `input/app/offline.start.png` in the recording's own pixel
                    space and lives in `config.json`; here it is mapped through
                    the card's crop and scale. Typing a frame coordinate instead
                    would be a number that silently stops pointing at anything
                    the first time the crop moves — which it already did once.
                  */}
                  <Pointer {...pointerFor(beat, OFFLINE_SCALE, OFFLINE_TOP)} at={26} />
                </>
              ) : null}

              {beat.source === 'card' ? <EndCard cta={CONFIG.cta} /> : null}

              {title ? (
                <Title
                  text={title}
                  at={Math.round(beat.voInAt * CONFIG.format.fps)}
                  pos={beat.titlePos === 'mid' ? 'mid' : 'top'}
                />
              ) : null}
            </Beat>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
