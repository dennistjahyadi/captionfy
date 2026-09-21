import React from 'react';
import { Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { CaptionTrack, ScriptLine } from './Captions';
import { SCREEN } from './Phone';
import { ACCENT, ON_ACCENT, color, font } from './brand';

/**
 * The app's own screens, rebuilt at phone size.
 *
 * Every colour here is a token from `src/ui/theme.ts` and every string is one
 * the app actually says. They are simplifications — a row count, not a
 * reimplementation — but a viewer who downloads on the strength of one of these
 * has to recognise what opens, so nothing invents a control the app does not
 * have.
 */

const PAD = 30;

const Clip: React.FC<{ width: number; height: number; startFrom?: number }> = ({
  width,
  height,
  startFrom = 0,
}) => (
  <OffthreadVideo
    src={staticFile('demo-1080x1920.mp4')}
    startFrom={startFrom}
    muted
    style={{ width, height, objectFit: 'cover', display: 'block' }}
  />
);

const TopBar: React.FC<{ left: string; middle: string; right: string }> = ({
  left,
  middle,
  right,
}) => (
  <div
    style={{
      height: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${PAD}px`,
      borderBottom: `2px solid ${color.line}`,
      fontFamily: font.semibold,
      fontSize: 22,
      color: color.mute,
    }}
  >
    <span style={{ color: color.paper }}>{left}</span>
    <span>{middle}</span>
    <span style={{ color: ACCENT }}>{right}</span>
  </div>
);

export const HomeScreen: React.FC = () => (
  <div style={{ width: SCREEN.width, height: SCREEN.height, padding: PAD, background: color.ink }}>
    <div style={{ fontFamily: font.bold, fontSize: 48, color: color.paper, letterSpacing: -1.2 }}>
      Wordburn
    </div>
    <div
      style={{
        fontFamily: font.medium,
        fontSize: 22,
        color: color.mute,
        lineHeight: 1.4,
        marginTop: 10,
        maxWidth: 440,
      }}
    >
      Captions for your video, made on this phone. Nothing is uploaded.
    </div>

    <div
      style={{
        marginTop: 26,
        height: 82,
        borderRadius: 10,
        background: ACCENT,
        color: ON_ACCENT,
        fontFamily: font.bold,
        fontSize: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      New video
    </div>

    <div
      style={{
        marginTop: 18,
        display: 'flex',
        justifyContent: 'center',
        gap: 14,
        fontFamily: font.semibold,
        fontSize: 19,
        color: color.mute,
      }}
    >
      <span>Free exports carry a small watermark</span>
      <span style={{ color: ACCENT }}>Unlock ›</span>
    </div>

    <div
      style={{
        marginTop: 34,
        fontFamily: font.semibold,
        fontSize: 20,
        color: color.mute,
      }}
    >
      On this phone
    </div>

    {[
      { d: '0:20', w: '66 words · ready', f: 40 },
      { d: '0:22', w: '46 words · ready', f: 300 },
      { d: '0:41', w: '145 words · ready', f: 170 },
      { d: '0:19', w: '58 words · ready', f: 430 },
    ].map((row) => (
      <div
        key={row.d}
        style={{
          marginTop: 14,
          height: 116,
          borderRadius: 12,
          background: color.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: 16,
        }}
      >
        <div style={{ width: 84, height: 84, borderRadius: 8, overflow: 'hidden' }}>
          <Clip width={84} height={84} startFrom={row.f} />
        </div>
        <div>
          <div style={{ fontFamily: font.bold, fontSize: 28, color: color.paper }}>{row.d}</div>
          <div style={{ fontFamily: font.medium, fontSize: 20, color: color.mute, marginTop: 4 }}>
            {row.w}
          </div>
        </div>
      </div>
    ))}
  </div>
);

/** The words arrive as whisper finishes each segment, which is what this shows. */
const STREAM = [
  'these videos are the ones',
  'that actually pulled,',
  'and the numbers were not',
  'close. then ask for',
  'more than you think',
  "it's worth.",
];

export const ProcessingScreen: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame() - startFrame;

  const pct = Math.min(
    99,
    Math.round(
      interpolate(frame, [0, 62], [8, 99], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      })
    )
  );
  const lines = Math.max(0, Math.floor((frame - 4) / 9));

  return (
    <div style={{ width: SCREEN.width, height: SCREEN.height, background: color.ink }}>
      <div style={{ width: SCREEN.width, height: 470, overflow: 'hidden' }}>
        <Clip width={SCREEN.width} height={470} startFrom={90} />
      </div>

      <div style={{ padding: PAD }}>
        <div style={{ height: 8, background: color.line, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: ACCENT }} />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 14,
            fontFamily: font.semibold,
            fontSize: 22,
            color: color.mute,
          }}
        >
          <span style={{ color: color.paper }}>Transcribing</span>
          <span>{pct}%</span>
        </div>
        <div style={{ fontFamily: font.medium, fontSize: 19, color: color.mute, marginTop: 6 }}>
          About 2s left · nothing is uploaded
        </div>

        <div style={{ marginTop: 26, height: 330, overflow: 'hidden' }}>
          {STREAM.slice(0, lines).map((line, i) => {
            const age = frame - 4 - i * 9;
            const enter = interpolate(age, [0, 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            return (
              <div
                key={line}
                style={{
                  fontFamily: font.medium,
                  fontSize: 26,
                  lineHeight: 1.6,
                  color: color.paper,
                  opacity: enter * (i === lines - 1 ? 1 : 0.55),
                  transform: `translateY(${(1 - enter) * 10}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** The row of words under the stage, with the emphasised ones already bold. */
const TRANSCRIPT: { text: string; hit?: boolean; flagged?: boolean }[][] = [
  [{ text: 'videos,' }, { text: 'and' }, { text: 'the' }, { text: 'numbers' }],
  [{ text: 'those' }, { text: 'videos' }, { text: 'actually' }, { text: 'pulled', hit: true }],
  [{ text: 'then' }, { text: 'ask' }, { text: 'for' }, { text: '20%', hit: true }],
  [{ text: 'more' }, { text: 'than' }, { text: 'you' }, { text: 'think' }],
  [{ text: 'it' }, { text: 'is' }, { text: 'worth.' }],
  [{ text: 'nobody' }, { text: 'wants' }, { text: 'the' }, { text: 'long' }],
  [{ text: 'version' }, { text: 'of' }, { text: 'this', hit: true }],
];

export const EditorScreen: React.FC<{ lines: ScriptLine[]; startMs?: number }> = ({
  lines,
  startMs = 0,
}) => {
  const stageH = 470;
  const clipW = Math.round(stageH * (1080 / 1920));

  return (
    <div style={{ width: SCREEN.width, height: SCREEN.height, background: color.ink }}>
      <TopBar left="Back" middle="0:19 · 66 words" right="Export" />

      <div
        style={{
          height: stageH,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ width: clipW, height: stageH, position: 'relative', overflow: 'hidden' }}>
          <Clip width={clipW} height={stageH} startFrom={150} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 74,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <CaptionTrack lines={lines} startMs={startMs} look="box" fontSize={26} width="88%" />
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: color.line,
          }}
        >
          <div style={{ width: '62%', height: '100%', background: ACCENT }} />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: `16px ${PAD}px`,
          fontFamily: font.semibold,
          fontSize: 19,
        }}
      >
        {[
          { t: '1 to check', on: true },
          { t: 'Style', on: false },
          { t: 'Shift all', on: false },
        ].map((chip) => (
          <span
            key={chip.t}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: `2px solid ${chip.on ? ACCENT : color.line}`,
              color: chip.on ? ACCENT : color.mute,
            }}
          >
            {chip.t}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: color.mute, fontSize: 24 }}>↺ ↻</span>
      </div>

      <div style={{ padding: `4px ${PAD}px` }}>
        {TRANSCRIPT.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: '9px 0',
              fontFamily: font.medium,
              fontSize: 26,
              color: color.paper,
            }}
          >
            {row.map((word) => (
              <span
                key={word.text}
                style={
                  word.hit
                    ? {
                        fontFamily: font.bold,
                        background: ACCENT,
                        color: ON_ACCENT,
                        borderRadius: 6,
                        padding: '0 8px',
                      }
                    : undefined
                }
              >
                {word.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * The manual way, which is what every competitor's emphasis actually is: a
 * list the user tags by hand. Drawn generically — no brand, no logo, because
 * naming one would be the comparative claim TikTok's ad policy refuses.
 */
export const KeywordPanel: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame() - startFrame;
  // The whole transcript, not a sample of it. A nine-word list made the manual
  // way look easy; the argument this shot is making is that it is not, and the
  // length of the list is the argument.
  const WORDS = [
    'those', 'videos', 'actually', 'pulled', 'and', 'the', 'numbers', 'were',
    'not', 'close', 'then', 'ask', 'for', '20%', 'more', 'than', 'you', 'think',
    'it', 'is', 'worth', 'nobody', 'wants', 'the', 'long', 'version', 'of',
    'this', 'so', 'cut', 'it', 'down',
  ];
  const taggedBy = [3, 13];

  return (
    <div
      style={{
        width: SCREEN.width,
        height: SCREEN.height,
        background: color.ink,
        padding: PAD,
      }}
    >
      <div style={{ fontFamily: font.bold, fontSize: 34, color: color.paper }}>
        Emphasised words
      </div>
      <div style={{ fontFamily: font.medium, fontSize: 21, color: color.mute, marginTop: 8 }}>
        Tap every word you want highlighted.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
        {WORDS.map((word, i) => {
          const tagIndex = taggedBy.indexOf(i);
          const tagged = tagIndex >= 0 && frame > 18 + tagIndex * 26;
          return (
            <span
              key={word}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                border: `2px solid ${tagged ? ACCENT : color.line}`,
                background: tagged ? ACCENT : 'transparent',
                color: tagged ? ON_ACCENT : color.mute,
                fontFamily: tagged ? font.bold : font.medium,
                fontSize: 24,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const UnlockScreen: React.FC = () => (
  <div style={{ width: SCREEN.width, height: SCREEN.height, background: color.ink, padding: PAD }}>
    <div style={{ fontFamily: font.bold, fontSize: 44, color: color.paper, letterSpacing: -1 }}>
      Unlock Wordburn
    </div>
    <div style={{ fontFamily: font.medium, fontSize: 22, color: color.mute, marginTop: 10 }}>
      One payment. No subscription, now or later.
    </div>

    {/* Says what the real screen says. It listed "Unlimited exports" and
        "Every caption style", both of which the free tier gives away, so the
        video was advertising a paywall the app does not have. */}
    <div style={{ marginTop: 34 }}>
      {['Removes the watermark', 'Unlimited dictionary words', 'No account, no upload, ever'].map(
        (line) => (
          <div
            key={line}
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              padding: '13px 0',
              fontFamily: font.medium,
              fontSize: 25,
              color: color.paper,
            }}
          >
            <span style={{ color: ACCENT, fontFamily: font.bold }}>✓</span>
            {line}
          </div>
        )
      )}
    </div>

    <div
      style={{
        marginTop: 34,
        height: 86,
        borderRadius: 10,
        background: ACCENT,
        color: ON_ACCENT,
        fontFamily: font.bold,
        fontSize: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Unlock — one payment
    </div>
    <div
      style={{
        textAlign: 'center',
        marginTop: 16,
        fontFamily: font.medium,
        fontSize: 20,
        color: color.mute,
      }}
    >
      Restore purchase
    </div>

    <div
      style={{
        marginTop: 44,
        paddingTop: 26,
        borderTop: `2px solid ${color.line}`,
      }}
    >
      <div style={{ fontFamily: font.semibold, fontSize: 20, color: color.mute }}>
        Free, with or without this
      </div>
      {['Unlimited videos, any length', 'Every caption style', 'Every editing tool', 'SRT export'].map(
        (line) => (
          <div
            key={line}
            style={{
              fontFamily: font.medium,
              fontSize: 22,
              color: color.paper,
              opacity: 0.75,
              padding: '9px 0',
            }}
          >
            {line}
          </div>
        )
      )}
    </div>
  </div>
);
