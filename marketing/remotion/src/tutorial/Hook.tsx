import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';

import { Waveform } from '../Chrome';
import { Punch } from '../Phone';
import { ExportShot, Ground, ProjectProvider } from '../parts';
import { useFonts } from '../useFonts';
import { Captions } from './Captions';
import { CaptionBars, Glow } from './Graphics';
import { Headline } from './Headline';
import { focusMoves } from './Focus';
import { Segments } from './Segments';
import { HookSfx } from './Sfx';
import { CONFIG, DIR, FPS, HOOK_FRAMES, clipStart, cuesFor, hookByIdFor, hookFramesFor, hooksFor } from './timeline';

export type HookProps = { hook: string; voice?: string };

/**
 * One hook: three and a half seconds, resolved well before the end of them.
 *
 * Six of these exist and they are the only thing that differs between the six
 * videos. Each is a different opening shape — the payoff, a physical action, a
 * contrarian claim, a demonstration, three statements, the other payoff — and
 * the text is on screen at 0.2 s, because the algorithm has made up its mind
 * by 1.5 and a large share of viewers arrive muted.
 *
 * Two kinds. `export` plays the app's own finished file full-bleed, which is
 * the right frame for the two hooks whose subject is the output rather than
 * the app. `phone` shows a recording of the app inside a device, the same way
 * the body does, so a viewer who arrives on one of those four is already
 * looking at the thing the body is about to explain.
 */
export const Hook: React.FC<HookProps> = ({ hook: id, voice }) => {
  useFonts();
  const hook = hookByIdFor(voice, id);
  const titleAt = Math.round(hook.titleAt * FPS);
  const frames = hookFramesFor(voice, id);
  // Its place in the set, so the seven do not all open on the same note.
  const order = Math.max(0, hooksFor(voice).findIndex((h) => h.id === id));

  return (
    <ProjectProvider value={{ safe: CONFIG.safeBox, dir: DIR }}>
      <AbsoluteFill>
        <Ground solid />

        {/* The hook's own recording, from frame zero. The picture is cut to the
            voice rather than the other way round: `hookFrames` is the file's
            length plus a tail, so there is never silence at the end of a hook
            and never a word clipped off one. */}
        {hook.audio ? <Audio src={staticFile(`${DIR}/${hook.audio}`)} /> : null}

        <HookSfx
          index={order}
          moves={focusMoves(hook.segments, frames, FPS)}
        />

        {/* A hook that opens on a screenshot is asking a stranger to care about
            an interface before they have been told why. `graphic` hooks show
            nobody's app: the icon's own geometry at full size — a line of words
            assembling with the accent travelling across it, which is what the
            product does — and the headline over it. The app arrives in the body,
            on the line that names it. */}
        {hook.kind === 'graphic' ? (
          <>
            <Glow atY={0.5} />
            <CaptionBars atY={0.5} sweepSec={Math.max(1.8, frames / FPS - 1.2)} />
          </>
        ) : null}

        {hook.kind === 'export' ? (
          <Punch>
            <ExportShot startFrom={clipStart(hook.startSec)} />
          </Punch>
        ) : null}

        {hook.waveform ? (
          // The speech envelope scrolling under a playhead, its spike arriving
          // on the frame the export's own loud word lights up. The spike times
          // are read off the export and live in the config; if they drift from
          // the file, the hook is showing the mechanism not working.
          <div
            style={{
              position: 'absolute',
              top: 1180,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Waveform
              hitsMs={(hook.hitsSec ?? []).map((s) => s * 1000)}
              windowMs={3400}
              height={104}
              width="78%"
            />
          </div>
        ) : null}

        {hook.kind === 'phone' && hook.segments ? (
          <Segments segments={hook.segments} fillFrames={frames} />
        ) : null}

        <Headline
          text={hook.title}
          at={titleAt}
          pos={hook.titlePos === 'mid' ? 'mid' : 'above'}
        />

        {/* A hook is where a muted viewer decides, so the sentence under the
            headline matters most here. It sits a little higher than the body's
            so it clears TikTok's own caption on a short post. */}
        <Captions cues={cuesFor(hook.audio)} atY={0.7} size={52} />
      </AbsoluteFill>
    </ProjectProvider>
  );
};

export { HOOK_FRAMES };
