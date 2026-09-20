import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

import { DIR } from './timeline';

/**
 * The punctuation under the cuts and the moves.
 *
 * **No sound is used twice in one video.** That is the rule this was rebuilt
 * for. The first version had three cut sounds rotating across nine beats, which
 * meant each was heard three times and the ear found the loop immediately — a
 * rotation is still a repeat, just a slower one. `make-sfx.mjs` now generates
 * one distinct file for every event a video can contain (nine cuts, twelve of
 * each move, twelve marks, seven openers, one riser) and every call site passes
 * a running index, so a render draws each file at most once.
 *
 * They are still a family rather than a collection: the cuts walk down a
 * pentatonic series as the tutorial proceeds and the marks walk up, so no two
 * are the same and none is a surprise.
 *
 * **Quiet.** The voice is the content. Everything sits between 0.16 and 0.3 of
 * full, which registers as the cut having weight rather than as an effect
 * having happened.
 *
 * **Only where something happens.** A sound on the cut, one on the lean in, a
 * mark when the box lands, a quieter one on the pull back, and one riser at the
 * close used exactly once in the whole video — which is what lets it mean
 * "this is the end" rather than "here is another noise".
 */
const pad = (n: number) => String(n + 1).padStart(2, '0');

/**
 * Where a hook's move sounds start in the family.
 *
 * A hook and the body are joined into one file, so "no sound twice in one
 * video" has to hold across the join — and the body cannot simply continue the
 * hook's count, because the body is rendered **once** and shared by all seven
 * hooks whose move counts differ. The two therefore take disjoint ranges: the
 * body has ten moves and takes 0-9, hooks have at most two and take 10-11.
 */
const HOOK_MOVE_BASE = 10;

/** Wraps at the family size, which no beat list here reaches. */
const file = (kind: string, n: number, count: number) => `${kind}-${pad(n % count)}`;

export const Cue: React.FC<{ file: string; at: number; volume: number }> = ({
  file: name,
  at,
  volume,
}) => (
  <Sequence from={Math.max(0, at)} durationInFrames={90} layout="none">
    <Audio src={staticFile(`${DIR}/${name}.wav`)} volume={volume} />
  </Sequence>
);

/**
 * Everything one beat needs, placed relative to the beat's own first frame.
 *
 * `moveFrom` is how many moves the earlier beats already used, so the indices
 * keep counting across the whole body instead of restarting — without it, beat
 * one and beat two would both take `in-01`.
 */
export const BeatSfx: React.FC<{
  index: number;
  isLast: boolean;
  moveFrom: number;
  moves: { inAt: number; outAt: number }[];
}> = ({ index, isLast, moveFrom, moves }) => (
  <>
    <Cue file={file('cut', index, 9)} at={0} volume={0.26} />

    {moves.map((m, i) => {
      const n = moveFrom + i;
      return (
        <React.Fragment key={i}>
          <Cue file={file('in', n, 12)} at={m.inAt} volume={0.2} />
          {/* The mark lands behind the move rather than with it, on the frame
              the box finishes drawing — see `Focus` for why the box is late. */}
          <Cue file={file('mark', n, 12)} at={m.inAt + 16} volume={0.18} />
          <Cue file={file('out', n, 12)} at={m.outAt} volume={0.16} />
        </React.Fragment>
      );
    })}

    {/* Once in the video, under the last beat. */}
    {isLast ? <Cue file="riser" at={6} volume={0.22} /> : null}
  </>
);

/**
 * The hook's opening note and its own moves.
 *
 * The opener is picked by the hook's place in the set so the seven finished
 * videos do not all begin on the same note; within one video it is heard once.
 * A hook's moves take the top of the family, 10-11, where the body takes 0-9 —
 * see `HOOK_MOVE_BASE`.
 */
export const HookSfx: React.FC<{
  index: number;
  moves: { inAt: number; outAt: number }[];
}> = ({ index, moves }) => (
  <>
    <Cue file={file('open', index, 7)} at={0} volume={0.3} />
    {moves.map((m, i) => (
      <React.Fragment key={i}>
        <Cue file={file('in', HOOK_MOVE_BASE + i, 12)} at={m.inAt} volume={0.2} />
        <Cue file={file('mark', HOOK_MOVE_BASE + i, 12)} at={m.inAt + 16} volume={0.18} />
        <Cue file={file('out', HOOK_MOVE_BASE + i, 12)} at={m.outAt} volume={0.16} />
      </React.Fragment>
    ))}
  </>
);
