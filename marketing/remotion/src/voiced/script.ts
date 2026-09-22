/**
 * A voiced ad's script: the recording's words, grouped into the phrases the
 * subtitles show, with the frame each one starts on.
 *
 * The word times were measured once, offline, off the recording, and live in
 * the video's own `words.*.json`. Nothing in `../../../pipeline/` turns audio
 * into words — the rule video 02's self-check greps for — and this module
 * only reads the numbers it is handed.
 */
import type { Cue } from '../tutorial/Captions';

import { F, LEAD, TAIL } from './time';

export type Word = { w: string; s: number; e: number; p: number };

export type Script = {
  WORDS: Word[];
  PHRASES: Word[][];
  /** The subtitles, in composition seconds. */
  CUES: Cue[];
  TOTAL_FRAMES: number;
  /** The first frame a given word of a phrase is spoken. */
  said: (phrase: number, word?: number) => number;
  /** The frame the phrase's last word ends. */
  done: (phrase: number) => number;
};

/**
 * `phrases` is the run of word counts, one per subtitle; it is checked
 * against the word list so a re-transcription that changes the count fails
 * loudly instead of shifting every cue after it. `subtitled` names which
 * phrases get a subtitle: not the ones where the words are already the
 * picture, set large and arriving on the voice — a subtitle repeating them
 * would be the same sentence twice in two sizes.
 */
export const buildScript = (
  words: Word[],
  phrases: number[],
  subtitled: number[],
  voiceSec: number
): Script => {
  const total = phrases.reduce((a, b) => a + b, 0);
  if (total !== words.length) {
    throw new Error(`the word file has ${words.length} words, the phrase table expects ${total}`);
  }

  const PHRASES: Word[][] = [];
  let i = 0;
  for (const n of phrases) {
    PHRASES.push(words.slice(i, i + n));
    i += n;
  }

  const cueOf = (n: number): Cue => {
    const p = PHRASES[n];
    return {
      fromSec: p[0].s + LEAD,
      toSec: p[p.length - 1].e + LEAD,
      words: p.map((w) => ({ w: w.w, s: w.s + LEAD })),
    };
  };

  return {
    WORDS: words,
    PHRASES,
    CUES: subtitled.map(cueOf),
    TOTAL_FRAMES: F(voiceSec + TAIL),
    said: (phrase, word = 0) => F(PHRASES[phrase][word].s),
    done: (phrase) => F(PHRASES[phrase][PHRASES[phrase].length - 1].e),
  };
};
