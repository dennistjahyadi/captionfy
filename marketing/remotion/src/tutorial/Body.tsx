import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

import { CtaOverlay } from '../Chrome';
import { Punch } from '../Phone';
import { ExportShot, Ground, Pointer, ProjectProvider, ScreenCard, Title, pointerFor } from '../parts';
import { useFonts } from '../useFonts';
import { CARD_SCALE, CARD_TOP, Segments } from './Segments';
import { BEATS, CONFIG, DIR, FPS, POINTERS, Segment, clipStart, exportStartFrame } from './timeline';

/**
 * The tutorial body — the same 27.5 seconds under all six hooks.
 *
 * Every beat is a band of a screen recording as a card, one lowercase line
 * above it, a hard cut with a frame of overshoot between beats. Not a
 * dissolve: that is the film's gesture, and the film is a paid unit. These are
 * organic posts, where a transition reads as manufactured and the cut itself
 * is the rhythm.
 *
 * Rendered once, to `out/body.mp4`, and joined to each hook without
 * re-encoding — so the body in every one of the six files is the same bytes,
 * which is what makes them a controlled test of the hook.
 */
export const Body: React.FC = () => {
  useFonts();

  return (
    <ProjectProvider value={{ safe: CONFIG.safeBox, dir: DIR }}>
      <AbsoluteFill>
        <Ground />

        {BEATS.map((beat) => (
          <Sequence key={beat.id} from={beat.from} durationInFrames={beat.frames}>
            <Punch>
              <AbsoluteFill>
                {beat.source === 'export' ? <ExportShot startFrom={exportStartFrame(beat.id)} /> : null}

                {/* A beat that cuts between screens — the export's progress
                    bar and then Saved, which on this emulator are fifty
                    seconds apart — lists its segments the way a hook does. */}
                {beat.segments ? <Segments segments={beat.segments as Segment[]} /> : null}

                {!beat.segments && beat.source.startsWith('app:') && beat.crop ? (
                  <>
                    <ScreenCard
                      file={`${beat.source.slice(4)}.mp4`}
                      crop={beat.crop}
                      scale={CARD_SCALE}
                      top={CARD_TOP}
                      startFrom={clipStart(beat.startSec)}
                      enter="cut"
                    />
                    {beat.pointer ? (
                      <Pointer {...pointerFor(POINTERS[beat.pointer], beat.crop, CARD_SCALE, CARD_TOP)} at={14} />
                    ) : null}
                  </>
                ) : null}

                {beat.title ? (
                  <Title
                    text={beat.title}
                    kicker={beat.kicker ?? undefined}
                    at={Math.round(beat.voInAt * FPS)}
                    pos={beat.titlePos === 'mid' ? 'mid' : 'top'}
                  />
                ) : null}

                {/* The close is a running shot with the name over it, not a card:
                    completion is what gets distributed, and a static logo is a
                    tenth of the runtime doing nothing. */}
                {beat.id === 'close' ? <CtaOverlay at={6} line={CONFIG.cta} /> : null}
              </AbsoluteFill>
            </Punch>
          </Sequence>
        ))}
      </AbsoluteFill>
    </ProjectProvider>
  );
};
