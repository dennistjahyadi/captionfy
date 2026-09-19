import React from 'react';
import { Sequence } from 'remotion';

import { Punch } from '../Phone';
import { Pointer, ScreenCard, pointerFor } from '../parts';
import { FPS, POINTERS, Segment, clipStart } from './timeline';

/** How every app card in video 02 is framed. One pair, so a ring cannot drift off the thing it points at. */
export const CARD_SCALE = 0.78;
export const CARD_TOP = 560;

/**
 * A run of screen recordings, cut hard, one after the other.
 *
 * Hooks and body beats that show more than one screen are built from this: a
 * card per segment, each at the band of the screen it is about, each starting
 * where `config.json` says. Whatever sits above them — a title, a ring — does
 * not cut with them.
 */
export const Segments: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  let at = 0;
  return (
    <>
      {segments.map((seg, i) => {
        const from = at;
        const frames = Math.round(seg.durationSec * FPS);
        at += frames;
        const scale = seg.scale ?? CARD_SCALE;
        const top = seg.top ?? CARD_TOP;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <Punch>
              <ScreenCard
                file={seg.file}
                crop={seg.crop}
                scale={scale}
                top={top}
                startFrom={clipStart(seg.startSec)}
                enter="cut"
              />
              {seg.pointer ? (
                <Pointer {...pointerFor(POINTERS[seg.pointer], seg.crop, scale, top)} at={6} />
              ) : null}
            </Punch>
          </Sequence>
        );
      })}
    </>
  );
};
