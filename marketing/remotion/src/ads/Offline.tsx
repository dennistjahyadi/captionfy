import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

import { CaptionTrack, ScriptLine } from '../Captions';
import { Badge, CtaOverlay, PhoneBackdrop, Stage } from '../Chrome';
import { Phone, Punch, ShotLabel, Tap } from '../Phone';
import { SAFE, color } from '../brand';
import { HomeScreen, EditorScreen, ProcessingScreen } from '../screens';
import { useFonts } from '../useFonts';

/**
 * "It never leaves your phone."
 *
 * Rebuilt from a version that was three statements on a blurred gradient. The
 * three claims are the same; what changed is that each one is now attached to
 * the screen that proves it. "No account" over Home with no sign-in on it. "No
 * upload" over Processing with the words arriving. "No internet" over the
 * editor, with an aeroplane in the phone's own status bar the whole way
 * through. A claim and its evidence in the same shot is the only kind of demo
 * worth fifteen seconds.
 */

const OPEN: ScriptLine[] = [
  { words: [{ text: 'these', ms: 240 }, { text: 'captions', ms: 420 }], holdMs: 60 },
  { words: [{ text: 'were', ms: 220 }, { text: 'made', ms: 320 }, { text: 'with', ms: 200 }] },
  { words: [{ text: 'no', ms: 300 }, { text: 'internet.', ms: 620, hit: true }], holdMs: 400 },
];

const CLOSE: ScriptLine[] = [
  { words: [{ text: 'it', ms: 220 }, { text: 'all', ms: 240 }, { text: 'runs', ms: 300 }] },
  { words: [{ text: 'on', ms: 200 }, { text: 'the', ms: 180 }, { text: 'phone', ms: 340 }] },
  { words: [{ text: 'in', ms: 200 }, { text: 'your', ms: 220 }, { text: 'hand.', ms: 560, hit: true }], holdMs: 400 },
];

/** What the editor's little stage plays while it is on screen. */
const IN_EDITOR: ScriptLine[] = [
  { words: [{ text: 'those', ms: 300 }, { text: 'videos', ms: 360 }] },
  { words: [{ text: 'actually', ms: 420 }, { text: 'pulled.', ms: 520, hit: true }], holdMs: 600 },
];

const OPEN_F = 84;
const HOME_F = 66;
const PROC_F = 72;
const EDIT_F = 78;
const CLOSE_F = 96;
export const OFFLINE_FRAMES = OPEN_F + HOME_F + PROC_F + EDIT_F + CLOSE_F;

const PHONE_TOP = 330;

export const Offline: React.FC = () => {
  useFonts();

  return (
    <AbsoluteFill style={{ background: color.ink }}>
      {/* The payoff in the opening frame: captions, already running. */}
      <Sequence durationInFrames={OPEN_F}>
        <AbsoluteFill>
          <Stage startFrom={30} />
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: 1920 * SAFE.top + 20,
            }}
          >
            <Badge tone="ok" startFrame={4}>
              airplane mode
            </Badge>
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 1920 * SAFE.bottom + 60,
            }}
          >
            <CaptionTrack lines={OPEN} look="box" fontSize={100} width="84%" />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={OPEN_F} durationInFrames={HOME_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={120} />
            <ShotLabel>no account</ShotLabel>
            <Phone airplane top={PHONE_TOP}>
              <HomeScreen />
              <Tap x={307} y={272} at={22} />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + HOME_F} durationInFrames={PROC_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={200} />
            <ShotLabel>no upload</ShotLabel>
            <Phone airplane top={PHONE_TOP}>
              <ProcessingScreen />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + HOME_F + PROC_F} durationInFrames={EDIT_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={280} />
            <ShotLabel>no internet</ShotLabel>
            <Phone airplane top={PHONE_TOP}>
              <EditorScreen lines={IN_EDITOR} />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + HOME_F + PROC_F + EDIT_F} durationInFrames={CLOSE_F}>
        <AbsoluteFill>
          <Stage startFrom={420} />
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 1920 * SAFE.bottom + 60,
            }}
          >
            <CaptionTrack lines={CLOSE} look="box" fontSize={100} width="84%" />
          </AbsoluteFill>
          <CtaOverlay at={30} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
