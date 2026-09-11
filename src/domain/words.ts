/**
 * Word assembly from whisper token segments.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * This is the engine side of the boundary: timing and text as whisper reports
 * them, with no ids and no edit history. `transcript.ts` turns these into the
 * `Word` the rest of the domain edits.
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
  /** Token probability, 0..1, from the patched whisper.rn. Undefined when unavailable. */
  p?: number;
};

export type AsrWord = {
  text: string;
  t0Ms: number;
  t1Ms: number;
  /** The least confident token in the word. Undefined when no token carried a probability. */
  conf?: number;
};

/**
 * Joins whisper's sub-word tokens back into words.
 *
 * Whisper's tokenizer emits `" recog"`, `"ni"`, `"tion"`, `","` as four separate
 * segments. A token opens a new word when it carries a leading space; everything
 * else continues the word before it, which is also what keeps punctuation attached.
 * Counting those four as four words would inflate every word count and every word
 * error rate we compute in Stage 0.
 *
 * A word is only as trustworthy as its least trustworthy token, so the minimum
 * probability carries rather than the mean: one badly guessed syllable is what
 * makes a word worth checking.
 */
export function mergeTokensIntoWords(tokens: TokenSegment[]): AsrWord[] {
  const words: AsrWord[] = [];

  for (const token of tokens) {
    const trimmed = token.text.trim();
    if (trimmed === '') continue;

    const startsNewWord = /^\s/.test(token.text);
    const previous = words[words.length - 1];

    if (previous && !startsNewWord) {
      previous.text += trimmed;
      previous.t1Ms = Math.max(previous.t1Ms, token.t1Ms, token.t0Ms);
      previous.conf = lower(previous.conf, token.p);
      continue;
    }

    words.push({
      text: trimmed,
      t0Ms: token.t0Ms,
      t1Ms: Math.max(token.t0Ms, token.t1Ms),
      conf: token.p,
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
export function offsetWords(words: AsrWord[], offsetMs: number): AsrWord[] {
  return words.map((word) => ({
    text: word.text,
    t0Ms: word.t0Ms + offsetMs,
    t1Ms: word.t1Ms + offsetMs,
    conf: word.conf,
  }));
}

function lower(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}
