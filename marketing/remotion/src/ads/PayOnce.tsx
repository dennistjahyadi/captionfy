import React from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from 'remotion';

import { CaptionTrack, ScriptLine, trackDurationMs } from '../Captions';
import { CtaOverlay, PhoneBackdrop, Stage } from '../Chrome';
import { Phone, Punch, ShotLabel, Tap } from '../Phone';
import { ACCENT, SAFE, color, font } from '../brand';
import { UnlockScreen } from '../screens';
import { useFonts } from '../useFonts';

/**
 * "One payment."
 *
 * Two research findings shaped this one, and the first cut got both wrong.
 *
 * It used to open on `$19.99 / PER MONTH · FOREVER` struck through in yellow.
 * TikTok's advertising policy prohibits "negative judgements about a targeted
 * brand's ... price/cost, features, functionality, quality" without evidence or
 * a clear disclaimer, and a struck-out competitor price is exactly that shape
 * even with no brand named. Organic posts are judged under the Community
 * Guidelines instead, so it would probably have run — right up until somebody
 * put money behind it, which is when a rejection costs a campaign rather than a
 * post. The number now lives in the post copy, where it is a founder's opinion
 * about a category, and the video makes a claim about Wordburn only.
 *
 * It also opened on a statement rather than on the product. OpusClip's hook
 * study makes "product/outcome showcase" the highest-performing opening at
 * 6,037 average views — "the payoff is literally the opening frame" — while the
 * explainer setup it used to be is merely the most common one. So the first
 * three seconds are the captions working, before anything is claimed.
 */

const OPEN: ScriptLine[] = [
  { words: [{ text: 'captions,', ms: 520 }], holdMs: 60 },
  { words: [{ text: 'on', ms: 200 }, { text: 'your', ms: 220 }, { text: 'phone.', ms: 520 }], holdMs: 200 },
  { words: [{ text: 'no', ms: 280 }, { text: 'subscription.', ms: 700, hit: true }], holdMs: 320 },
];

const ARGUMENT: ScriptLine[] = [
  { words: [{ text: 'most', ms: 260 }, { text: 'caption', ms: 340 }, { text: 'apps', ms: 380 }], holdMs: 100 },
  { words: [{ text: 'bill', ms: 300 }, { text: 'you', ms: 240 }, { text: 'every', ms: 300 }, { text: 'month,', ms: 440 }] },
  { words: [{ text: 'forever.', ms: 640, hit: true }], holdMs: 380 },
  { words: [{ text: 'this', ms: 260 }, { text: 'one', ms: 280 }, { text: 'bills', ms: 340 }, { text: 'you', ms: 240 }] },
  { words: [{ text: 'once.', ms: 640, hit: true }], holdMs: 420 },
];

const CLOSE: ScriptLine[] = [
  { words: [{ text: 'no', ms: 240 }, { text: 'credits.', ms: 540 }], holdMs: 160 },
  { words: [{ text: 'no', ms: 240 }, { text: 'videos', ms: 320 }, { text: 'per', ms: 200 }, { text: 'month.', ms: 520 }], holdMs: 240 },
  { words: [{ text: 'pay', ms: 280 }, { text: 'once.', ms: 420 }] },
  { words: [{ text: 'caption', ms: 360 }, { text: 'forever.', ms: 620, hit: true }], holdMs: 500 },
];

/**
 * What a subscription looks like and what one payment looks like, drawn in the
 * icon's own pills.
 *
 * A stack that keeps arriving and runs off the top of the frame is the claim
 * about recurring billing that the struck-through price used to make, with
 * nothing in it about anybody else's number.
 */
const ChargeStack: React.FC = () => {
  const frame = useCurrentFrame();

  const PILL_EVERY = 7;
  const arrived = Math.max(0, Math.floor((frame - 10) / PILL_EVERY));

  const column = (label: string, count: number, accent: boolean) => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 16,
        height: 480,
      }}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 14,
          overflow: 'hidden',
          // The stack fades out at the top rather than stopping, because the
          // point of it is that it does not stop.
          maskImage: 'linear-gradient(to top, black 58%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 58%, transparent 100%)',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: '0 0 auto',
              width: '84%',
              height: 38,
              borderRadius: 999,
              background: accent ? ACCENT : color.mute,
              opacity: accent ? 1 : 0.8,
              boxShadow: accent ? `0 0 40px rgba(255,224,61,0.4)` : undefined,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: font.bold,
          fontSize: 50,
          color: accent ? ACCENT : color.paper,
          letterSpacing: -1.2,
          // "every month" wrapped onto two lines inside its column and threw
          // the whole shot off its centre.
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );

  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ width: '82%', display: 'flex', gap: 70, opacity: enter }}>
      {column('every month', Math.min(arrived, 13), false)}
      {column('once', arrived > 0 ? 1 : 0, true)}
    </div>
  );
};

const OPEN_F = Math.ceil((trackDurationMs(OPEN) / 1000) * 30);
const STACK_F = Math.ceil(((trackDurationMs(ARGUMENT) + 250) / 1000) * 30);
const UNLOCK_F = 78;
const CLOSE_F = Math.ceil(((trackDurationMs(CLOSE) + 250) / 1000) * 30);
export const PAY_ONCE_FRAMES = OPEN_F + STACK_F + UNLOCK_F + CLOSE_F;

export const PayOnce: React.FC = () => {
  useFonts();

  return (
    <AbsoluteFill style={{ background: color.ink }}>
      <Sequence durationInFrames={OPEN_F}>
        <AbsoluteFill>
          <Stage startFrom={60} />
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

      <Sequence from={OPEN_F} durationInFrames={STACK_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={150} />
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              gap: 80,
              padding: '0 70px',
            }}
          >
            <ChargeStack />
            <CaptionTrack lines={ARGUMENT} look="box" fontSize={84} width="90%" />
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + STACK_F} durationInFrames={UNLOCK_F}>
        <Punch>
          <AbsoluteFill style={{ background: color.ink }}>
            <PhoneBackdrop startFrom={240} />
            <ShotLabel>in the app</ShotLabel>
            <Phone>
              <UnlockScreen />
              <Tap x={307} y={454} at={30} />
            </Phone>
          </AbsoluteFill>
        </Punch>
      </Sequence>

      <Sequence from={OPEN_F + STACK_F + UNLOCK_F} durationInFrames={CLOSE_F}>
        <AbsoluteFill>
          <Stage startFrom={400} />
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 1920 * SAFE.bottom + 60,
            }}
          >
            <CaptionTrack lines={CLOSE} look="box" fontSize={98} width="84%" />
          </AbsoluteFill>
          <CtaOverlay at={26} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
