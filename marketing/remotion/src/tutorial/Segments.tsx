import React from 'react';
import { Sequence } from 'remotion';

import { Punch } from '../Phone';
import { PhoneFrame, Pointer, SCALE, devicePoint } from '../parts';
import { Focus, FocusRegion } from './Focus';
import { FPS, POINTERS, Segment, clipStart } from './timeline';

/**
 * A run of screen recordings inside the device, cut hard, one after the other.
 *
 * Every beat and every app-shaped hook is built from this. A beat that shows
 * one screen lists one segment; the export beat lists two, because the thing
 * it is about happens at both ends of a sixty-eight second recording and the
 * fifty seconds in between are a progress bar.
 *
 * **The whole screen is always shown before any part of it is.** A segment may
 * carry a `focus`, and if it does the shot opens wide, moves in on the one
 * control the sentence is about, and comes back out before the cut — see
 * `Focus` for why that is the third answer this video has given to the question
 * of how much of a screen to show. Nothing is ever cropped without having been
 * shown whole first, which is what the second cut's flat rule was protecting.
 */
export const Segments: React.FC<{ segments: Segment[]; fillFrames?: number }> = ({
  segments,
  fillFrames,
}) => {
  // A segment with no length of its own takes what is left of the shot. Hooks
  // use that: their length is the recording's, which the composition knows and
  // the config cannot.
  const fixed = segments.reduce((n, s) => n + (s.durationSec ? Math.round(s.durationSec * FPS) : 0), 0);
  const loose = segments.filter((s) => !s.durationSec).length;
  const spare = Math.max(0, (fillFrames ?? fixed) - fixed);

  let at = 0;
  return (
    <>
      {segments.map((seg, i) => {
        const from = at;
        const frames = seg.durationSec
          ? Math.round(seg.durationSec * FPS)
          : Math.max(1, Math.round(spare / Math.max(1, loose)));
        at += frames;
        const p = seg.pointer ? POINTERS[seg.pointer] : undefined;

        return (
          <Sequence key={`${seg.file}:${i}`} from={from} durationInFrames={frames}>
            <Punch>
              {/* The ring rides inside the move rather than beside it. A
                  pointer that stayed put while the phone leaned in would slide
                  off the glyph it is pointing at, which is worse than none. */}
              <Focus region={seg.focus as FocusRegion | undefined}>
                <PhoneFrame file={seg.file} startFrom={clipStart(seg.startSec)} rate={seg.rate} />
                {p ? (
                  <Pointer
                    {...devicePoint(p.deviceX, p.deviceY)}
                    // The radius is in device pixels like the point is, so the
                    // ring keeps its size relative to the glyph it is round
                    // whatever scale the device is drawn at.
                    r={p.r * SCALE}
                    at={8}
                  />
                ) : null}
              </Focus>
            </Punch>
          </Sequence>
        );
      })}
    </>
  );
};
