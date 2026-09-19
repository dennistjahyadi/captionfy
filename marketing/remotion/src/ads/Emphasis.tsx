import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

import { CaptionTrack, ScriptLine, hitTimes, trackDurationMs } from '../Captions';
import { CtaOverlay, PhoneBackdrop, Stage, Waveform } from '../Chrome';
import { Phone, Punch, ShotLabel, Tap } from '../Phone';
import { SAFE, color, font } from '../brand';
import { EditorScreen, KeywordPanel } from '../screens';
import { useFonts } from '../useFonts';

/**
 * "It hears the word you leaned on."
 *
 * The only claim in this set about a capability nobody else has, and now the
 * only one that shows both sides of it. Every competitor's emphasis is a
 * setting — invideo's own panel is on screen in one of the clips in
 * `references/`, "Emphasized text", applied to words the user marks. So the ad
 * shows somebody tagging words by hand, and then shows this app's transcript
 * with the same job already done and nothing tapped.
 *
 * `emphasis.ts` takes the pick from loudness over the clip's speech median, how
 * long the word was held, and the pause around it. The waveform under the
 * captions reads its spikes from the same `hit` flags the words do, so the
 * spike and the word light up on one frame.
 */

const OPEN: ScriptLine[] = [
  { words: [{ text: 'watch', ms: 300 }, { text: 'the', ms: 180 }, { text: 'word', ms: 340 }] },
  { words: [{ text: 'i', ms: 180 }, { text: 'leaned', ms: 480, hit: true }, { text: 'on.', ms: 380 }], holdMs: 280 },
];

const CLOSE: ScriptLine[] = [
  { words: [{ text: 'louder,', ms: 460, hit: true }], holdMs: 120 },
  { words: [{ text: 'held', ms: 380, hit: true }, { text: 'longer,', ms: 480 }], holdMs: 120 },
  { words: [{ text: 'a', ms: 160 }, { text: 'pause', ms: 440, hit: true }, { text: 'before', ms: 320 }, { text: 'it.', ms: 380 }], holdMs: 260 },
  { words: [{ text: 'nothing', ms: 400 }, { text: 'to', ms: 180 }, { text: 'tag.', ms: 520, hit: true }], holdMs: 520 },
];

/** What the editor's little stage plays while the transcript is on screen. */
const IN_EDITOR: ScriptLine[] = [
  { words: [{ text: 'those', ms: 300 }, { text: 'videos', ms: 360 }] },
  { words: [{ text: 'actually', ms: 420 }, { text: 'pulled.', ms: 520, hit: true }], holdMs: 500 },
];

const OPEN_START_MS = 150;
const CLOSE_START_MS = 200;

const OPEN_F = Math.ceil(((trackDurationMs(OPEN) + OPEN_START_MS) / 1000) * 30);
const MANUAL_F = 96;
const AUTO_F = 90;
const CLOSE_F = Math.ceil(((trackDurationMs(CLOSE) + CLOSE_START_MS) / 1000) * 30);
export const EMPHASIS_FRAMES = OPEN_F + MANUAL_F + AUTO_F + CLOSE_F;

export const Emphasis: React.FC = () => {
  useFonts();

  return (
    <AbsoluteFill style={{ background: color.ink }}>
      {/* The payoff in the opening frame: a word lighting up on the loud beat. */}
      <Sequence durationInFrames={OPEN_F}>
        <AbsoluteFill>
          <Stage startFrom={300} dim={0.42} />
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 1920 * SAFE.bottom + 40,
              gap: 44,
            }}
          >
            <CaptionTrack
              lines={OPEN}
              startMs={OPEN_START_MS}
              look="neon"
              fontSize={98}
              uppercase
              width="86%"
            />
            <Waveform
              hitsMs={hitTimes(OPEN, OPEN_START_MS)}
              windowMs={3200}
              height={104}
              width="78%"
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* The manual way, which is what "emphasis" means in every other app. */}
      <Sequence from={OPEN_F} durationInFrames={MANUAL_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={120} />
            <ShotLabel>every other app</ShotLabel>
            <Phone>
              <KeywordPanel />
              {/* The two chips `KeywordPanel` tags: "pulled" on the first row,
                  "20%" on the second. Screen coordinates, not frame ones — the
                  tap lives inside the device, so the phone's scale carries it. */}
              <Tap x={421} y={170} at={20} />
              <Tap x={300} y={230} at={46} />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + MANUAL_F} durationInFrames={AUTO_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={330} />
            <ShotLabel>this one</ShotLabel>
            <Phone>
              <EditorScreen lines={IN_EDITOR} />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + MANUAL_F + AUTO_F} durationInFrames={CLOSE_F}>
        <AbsoluteFill>
          <Stage startFrom={470} dim={0.42} />
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 1920 * SAFE.bottom + 40,
              gap: 40,
            }}
          >
            <CaptionTrack
              lines={CLOSE}
              startMs={CLOSE_START_MS}
              look="neon"
              fontSize={94}
              uppercase
              width="86%"
            />
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Waveform
                hitsMs={hitTimes(CLOSE, CLOSE_START_MS)}
                windowMs={3200}
                height={96}
                width="78%"
              />
              <div
                style={{
                  fontFamily: font.semibold,
                  fontSize: 30,
                  color: color.mute,
                  letterSpacing: 1.2,
                }}
              >
                PICKED FROM THE AUDIO, NOT FROM A LIST
              </div>
            </div>
          </AbsoluteFill>
          <CtaOverlay at={40} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
