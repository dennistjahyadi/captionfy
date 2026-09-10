/**
 * Word assembly from whisper token segments.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */

/**
 * One segment as whisper.cpp returns it when `maxLen: 1` and `tokenTimestamps: true`
 * are set: a single token, not necessarily a whole word. Timestamps are already in
 * milliseconds; whisper.cpp reports centiseconds and the engine converts at the boundary.
 */
export type TokenSegment = {
  /** Raw token text, leading space intact. The space is the word boundary signal. */
  text: string;
  t0Ms: number;
  t1Ms: number;
};

export type Word = {
  text: string;
  t0Ms: number;
  t1Ms: number;
};

/**
 * Joins whisper's sub-word tokens back into words.
 *
 * Whisper's tokenizer emits `" recog"`, `"ni"`, `"tion"`, `","` as four separate
 * segments. A token opens a new word when it carries a leading space; everything
 * else continues the word before it, which is also what keeps punctuation attached.
 * Counting those four as four words would inflate every word count and every word
 * error rate we compute in Stage 0.
 */
export function mergeTokensIntoWords(tokens: TokenSegment[]): Word[] {
  const words: Word[] = [];

  for (const token of tokens) {
    const trimmed = token.text.trim();
    if (trimmed === '') continue;

    const startsNewWord = /^\s/.test(token.text);
    const previous = words[words.length - 1];

    if (previous && !startsNewWord) {
      previous.text += trimmed;
      previous.t1Ms = Math.max(previous.t1Ms, token.t1Ms, token.t0Ms);
      continue;
    }

    words.push({
      text: trimmed,
      t0Ms: token.t0Ms,
      t1Ms: Math.max(token.t0Ms, token.t1Ms),
    });
  }

  return words;
}

/**
 * Shifts words onto the timeline of the whole clip.
 *
 * Each VAD speech span is transcribed on its own, so whisper reports timestamps
 * relative to the start of that span rather than the start of the video.
 */
export function offsetWords(words: Word[], offsetMs: number): Word[] {
  return words.map((word) => ({
    text: word.text,
    t0Ms: word.t0Ms + offsetMs,
    t1Ms: word.t1Ms + offsetMs,
  }));
}
