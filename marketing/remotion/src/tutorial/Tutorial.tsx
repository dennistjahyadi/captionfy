import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

import { Body } from './Body';
import { Hook, HookProps } from './Hook';
import { BODY_FRAMES, HOOK_FRAMES, bodyFramesFor, hookFramesFor } from './timeline';

export const TUTORIAL_FRAMES = HOOK_FRAMES + BODY_FRAMES;

/** A whole video's length, for whichever voice is being previewed. */
export const tutorialFrames = (voice: string | undefined, hook: string) =>
  hookFramesFor(voice, hook) + bodyFramesFor(voice);

/**
 * One whole video, for the studio: a hook, then the body.
 *
 * The render does not go through this. `render.mjs` renders the body once and
 * each hook on its own and joins them with ffmpeg's concat demuxer, so the body
 * in all six files is the same bytes and a controlled test stays controlled.
 * This composition exists so the join can be previewed as a sequence, which is
 * the only way to judge whether a hook's last frame and the body's first one
 * cut well against each other.
 */
export const Tutorial: React.FC<HookProps> = ({ hook, voice }) => {
  const head = hookFramesFor(voice, hook);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={head}>
        <Hook hook={hook} voice={voice} />
      </Sequence>
      <Sequence from={head} durationInFrames={bodyFramesFor(voice)}>
        <Body voice={voice} />
      </Sequence>
    </AbsoluteFill>
  );
};
