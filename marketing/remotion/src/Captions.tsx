import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { ACCENT, ON_ACCENT, color, font } from './brand';

/**
 * A word and how long it is held, in milliseconds.
 *
 * Durations rather than absolute times, because an ad script is written as a
 * rhythm and every absolute time in one would have to be renumbered the moment
 * a word changed. `layOut` turns them into spans the way the app's own
 * transcript already carries them.
 */
export type ScriptWord = {
  text: string;
  /** How long this word is the spoken one. */
  ms: number;
  /** The word the speaker leaned on — what `emphasis.ts` picks acoustically. */
  hit?: boolean;
};

export type ScriptLine = {
  words: ScriptWord[];
  /** Silence held after the line before the next one takes over. */
  holdMs?: number;
};

export type Look = 'box' | 'neon' | 'clean';

type Span = ScriptWord & { from: number; to: number };

const layOut = (words: ScriptWord[], startMs: number): Span[] => {
  let t = startMs;
  return words.map((word) => {
    const from = t;
    t += word.ms;
    return { ...word, from, to: t };
  });
};

const lineDuration = (line: ScriptLine) =>
  line.words.reduce((sum, word) => sum + word.ms, 0) + (line.holdMs ?? 0);

/** Every line in a track, with the absolute span it owns. */
export const trackSpans = (lines: ScriptLine[], startMs = 0) => {
  let t = startMs;
  return lines.map((line) => {
    const from = t;
    t += lineDuration(line);
    return { line, from, to: t };
  });
};

export const trackDurationMs = (lines: ScriptLine[]) =>
  lines.reduce((sum, line) => sum + lineDuration(line), 0);

/**
 * The midpoint of every emphasised word in a track.
 *
 * The waveform reads this, so the spike and the word that lights up come off
 * the same script rather than off two hand-tuned numbers that would drift the
 * first time a line was re-cut.
 */
export const hitTimes = (lines: ScriptLine[], startMs = 0): number[] => {
  const hits: number[] = [];
  for (const entry of trackSpans(lines, startMs)) {
    let t = entry.from;
    for (const word of entry.line.words) {
      if (word.hit) hits.push(t + word.ms / 2);
      t += word.ms;
    }
  }
  return hits;
};

const ENTRANCE_MS = 150;

/**
 * One word, mid-entrance.
 *
 * The entrance is computed from the clock rather than driven by a spring, for
 * the same reason the app computes it inside the layout: a render has to be
 * able to ask what this word looked like at frame 412 and get an answer.
 */
const Word: React.FC<{
  span: Span;
  nowMs: number;
  look: Look;
  accent: string;
  fontSize: number;
}> = ({ span, nowMs, look, accent, fontSize }) => {
  const age = nowMs - span.from;
  const active = nowMs >= span.from && nowMs < span.to;

  const enter = interpolate(age, [0, ENTRANCE_MS], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = 1 - (1 - enter) ** 3;

  const hit = span.hit === true;
  const HIT_SCALE = 1.1;
  const scale = (0.86 + 0.14 * eased) * (hit ? HIT_SCALE : 1);
  const dy = (1 - eased) * fontSize * 0.18;

  const boxed = look === 'box' && active;
  const glowing = look === 'neon' && (active || hit);

  // `box`'s own preset sets `emphasis.color` to the accent, so a word the
  // speaker leaned on keeps the colour after the highlight has moved past it.
  // Only while the box is actually under it does it flip to `ON_ACCENT`.
  const paint =
    look === 'box'
      ? boxed
        ? ON_ACCENT
        : hit
          ? accent
          : color.paper
      : hit || (look === 'neon' && active)
        ? accent
        : color.paper;

  return (
    <span
      style={{
        display: 'inline-block',
        opacity: eased,
        transform: `translateY(${dy}px) scale(${scale})`,
        padding: look === 'box' ? `${fontSize * 0.06}px ${fontSize * 0.14}px` : 0,
        // A scale is a transform, so it costs no layout — an emphasised word
        // grows over its neighbour's gap rather than pushing it away. The gap
        // has to cover the overhang or the line reads as one long word, which
        // is `ONELISTENS` in the first cut of the emphasis ad.
        // The overhang is half the extra width, so it grows with the word, not
        // with the type size: ~0.55em per character is close enough for this
        // face at this weight. `box` starts from a smaller gap because every
        // word already carries the highlight's own padding.
        margin: `0 ${fontSize * ((look === 'box' ? 0.02 : 0.16) + (hit ? ((HIT_SCALE - 1) / 2) * 0.55 * span.text.length : 0))}px`,
        borderRadius: fontSize * 0.16,
        background: boxed ? accent : 'transparent',
        color: paint,
        textShadow: glowing
          ? `0 0 ${fontSize * 0.34}px ${accent}, 0 ${fontSize * 0.04}px ${fontSize * 0.1}px rgba(0,0,0,0.8)`
          : `0 ${fontSize * 0.045}px ${fontSize * 0.12}px rgba(0,0,0,0.75)`,
      }}
    >
      {span.text}
    </span>
  );
};

/**
 * A caption track: one line on screen at a time, built a word at a time.
 *
 * `reveal: 'word'` is what every reference clip in the app's `references/` does
 * and what 78.6% of the clips in OpusClip's sample do. A line that arrives whole
 * is the thing the research measured at 1.6%.
 */
export const CaptionTrack: React.FC<{
  lines: ScriptLine[];
  startMs?: number;
  look?: Look;
  fontSize?: number;
  accent?: string;
  uppercase?: boolean;
  width?: number | string;
}> = ({
  lines,
  startMs = 0,
  look = 'box',
  fontSize = 96,
  accent = ACCENT,
  uppercase = false,
  width = '82%',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const spans = trackSpans(lines, startMs);
  const current = spans.find((entry) => nowMs >= entry.from && nowMs < entry.to);
  if (!current) return null;

  const words = layOut(current.line.words, current.from).filter((span) => nowMs >= span.from);

  return (
    <div
      style={{
        width,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0,
        fontFamily: font.bold,
        fontSize,
        lineHeight: 1.12,
        textAlign: 'center',
        textTransform: uppercase ? 'uppercase' : 'none',
        WebkitTextStroke: look === 'clean' ? `${fontSize * 0.018}px rgba(0,0,0,0.5)` : undefined,
      }}
    >
      {words.map((span, i) => (
        <Word
          key={`${span.text}-${i}`}
          span={span}
          nowMs={nowMs}
          look={look}
          accent={accent}
          fontSize={fontSize}
        />
      ))}
    </div>
  );
};
