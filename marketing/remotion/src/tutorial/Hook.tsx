import React from 'react';
import { AbsoluteFill } from 'remotion';

import { Waveform } from '../Chrome';
import { ChargeStack } from '../ads/PayOnce';
import { ExportShot, Ground, ProjectProvider, Title } from '../parts';
import { useFonts } from '../useFonts';
import { Segments } from './Segments';
import { CONFIG, DIR, FPS, HOOK_FRAMES, clipStart, hookById } from './timeline';

export type HookProps = { hook: string };

/**
 * One hook: three seconds, resolved by the end of them.
 *
 * Six of these exist and they are the only thing that differs between the six
 * videos. Each is a different opening shape — the payoff, a physical action,
 * a contrarian claim, a demonstration, three statements, the other payoff —
 * and the text is on screen inside the first second, because the algorithm
 * has made up its mind by 1.5 s and a large share of viewers arrive muted.
 */
export const Hook: React.FC<HookProps> = ({ hook: id }) => {
  useFonts();
  const hook = hookById(id);
  const titleAt = Math.round(hook.titleAt * FPS);
  const pos = hook.titlePos === 'mid' ? 'mid' : 'top';

  return (
    <ProjectProvider value={{ safe: CONFIG.safeBox, dir: DIR }}>
      <AbsoluteFill>
        <Ground />

        {hook.kind === 'export' ? <ExportShot startFrom={clipStart(hook.startSec)} /> : null}

        {hook.kind === 'emphasis' ? (
          <>
            <ExportShot startFrom={clipStart(hook.startSec)} />
            {/* The speech envelope scrolling under a playhead, its spike
                arriving on the frame the export's own loud word lights up.
                The spike times are read off the export and live in the
                config; if they drift from the file, the hook is showing the
                mechanism not working. */}
            <div
              style={{
                position: 'absolute',
                top: 1150,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Waveform
                hitsMs={(hook.hitsSec ?? []).map((s) => s * 1000)}
                windowMs={3200}
                height={104}
                width="78%"
              />
            </div>
          </>
        ) : null}

        {hook.kind === 'screens' && hook.segments ? <Segments segments={hook.segments} /> : null}

        {hook.kind === 'pay-once' && hook.segments ? (
          <>
            <Segments segments={hook.segments} />
            {/* A stack of pills that keeps arriving beside one that does not:
                the claim about recurring billing, with nothing in it about
                anybody else's number. The number lives in the post copy. */}
            <div
              style={{
                position: 'absolute',
                top: 600,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                transform: 'scale(0.82)',
                transformOrigin: 'top center',
              }}
            >
              <ChargeStack />
            </div>
          </>
        ) : null}

        <Title text={hook.title} at={titleAt} pos={pos} size={hook.title.length > 44 ? 66 : 74} />
      </AbsoluteFill>
    </ProjectProvider>
  );
};

export { HOOK_FRAMES };
