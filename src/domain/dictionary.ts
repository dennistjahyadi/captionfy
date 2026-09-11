/**
 * The user's own spellings, applied to every transcript.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * A creator says the same brand name, handle and place name in every video, and
 * whisper gets the same ones wrong every time. One correction should be the last
 * one. This is also what carries non-English words inside English sentences,
 * which is why v1 can be English-only without being useless in Jakarta.
 */
import { normalizeForMatch, splitAffixes } from './text';
import type { DictionaryEntry, Word } from './types';

/**
 * whisper.cpp caps the initial prompt at half the text context, which is 224
 * tokens on every model including `base.en`. Words the tokenizer has never seen
 * cost several tokens each, so the budget is spent in characters with a wide
 * margin rather than counted exactly.
 */
export const PROMPT_MAX_CHARS = 600;
/** A hard ceiling as well, so a long dictionary cannot crowd out the audio. */
export const PROMPT_MAX_ENTRIES = 64;

type Phrase = { parts: string[]; spelling: string };

/**
 * Replaces what the engine heard with what the user spells.
 *
 * Matching is case-insensitive, ignores punctuation, and runs on whole words, so
 * "kit very by," matches `heard as` "kit very by". A phrase that spans several
 * words collapses into one word taking the first start and the last end, which is
 * a merge and therefore an allowed timing change.
 *
 * A run containing a word the user edited by hand is skipped. Their own typing
 * outranks a rule they wrote earlier.
 */
export function applyDictionary(words: Word[], dict: DictionaryEntry[]): Word[] {
  const phrases = buildPhrases(dict);
  if (phrases.length === 0) return words;

  const normalized = words.map((word) => normalizeForMatch(word.text));
  const result: Word[] = [];
  let changed = false;
  let index = 0;

  while (index < words.length) {
    const match = phrases.find((phrase) => matchesAt(words, normalized, index, phrase.parts));

    if (!match) {
      result.push(words[index]);
      index += 1;
      continue;
    }

    const run = words.slice(index, index + match.parts.length);
    const replaced = replaceRun(run, match.spelling);
    index += match.parts.length;

    // An entry whose spelling is already what the engine wrote is not a change,
    // and marking it `dictionary` would put a "changed by your dictionary" note
    // on a word nothing happened to.
    if (run.length === 1 && replaced.text === run[0].text) {
      result.push(run[0]);
      continue;
    }

    result.push(replaced);
    changed = true;
  }

  return changed ? result : words;
}

/** Longest phrase first, so "kit very by" wins over a one-word entry inside it. */
function buildPhrases(dict: DictionaryEntry[]): Phrase[] {
  const phrases: Phrase[] = [];

  for (const entry of dict) {
    for (const heard of entry.heardAs) {
      const parts = heard
        .split(/\s+/u)
        .map(normalizeForMatch)
        .filter((part) => part !== '');
      if (parts.length > 0) phrases.push({ parts, spelling: entry.spelling });
    }
  }

  return phrases.sort((a, b) => b.parts.length - a.parts.length || a.spelling.localeCompare(b.spelling));
}

function matchesAt(words: Word[], normalized: string[], index: number, parts: string[]): boolean {
  if (index + parts.length > words.length) return false;

  for (let offset = 0; offset < parts.length; offset += 1) {
    if (normalized[index + offset] !== parts[offset]) return false;
    // The user's own edit is never overwritten.
    if (words[index + offset].origin === 'edited') return false;
  }

  return true;
}

function replaceRun(run: Word[], spelling: string): Word {
  const first = run[0];
  const last = run[run.length - 1];
  // Punctuation around the match is the sentence's, not the word's, so it stays.
  const { lead } = splitAffixes(first.text);
  const { trail } = splitAffixes(last.text);
  const confidences = run.map((word) => word.conf).filter((conf): conf is number => conf !== undefined);

  return {
    ...first,
    text: `${lead}${spelling}${trail}`,
    // What the engine heard across the whole span, so "add to dictionary" from
    // this word offers the mishearing that produced it.
    asrText: run.map((word) => word.asrText).join(' '),
    start: first.start,
    end: last.end,
    conf: confidences.length > 0 ? Math.min(...confidences) : undefined,
    origin: 'dictionary',
    breakAfter: last.breakAfter,
    confirmed: undefined,
  };
}

/**
 * Dictionary spellings as an initial prompt, to bias decoding toward them.
 *
 * whisper takes the prompt as prior context, so listing the spellings makes the
 * decoder likelier to produce them in the first place rather than relying on the
 * replacement above to clean up afterwards. Returns an empty string when there is
 * nothing to say, because an empty prompt and no prompt are not the same to
 * whisper.cpp.
 */
export function dictionaryPrompt(
  dict: DictionaryEntry[],
  maxEntries = PROMPT_MAX_ENTRIES,
  maxChars = PROMPT_MAX_CHARS
): string {
  const spellings: string[] = [];
  let length = 0;

  for (const entry of dict.slice(0, maxEntries)) {
    const spelling = entry.spelling.trim();
    if (spelling === '') continue;
    const cost = spelling.length + 2;
    if (length + cost > maxChars) break;
    spellings.push(spelling);
    length += cost;
  }

  return spellings.join(', ');
}

/**
 * Seeds a dictionary entry from a correction the user just made.
 *
 * The word sheet's "Add to dictionary" is one tap because both fields are
 * already known: the corrected text is the spelling, and what the engine heard
 * is the first variant.
 */
export function entryFromWord(word: Word, id: string, createdAt: string): DictionaryEntry {
  // Word boundaries survive normalisation here, because a multi-word mishearing
  // has to come back out as a multi-word phrase for `applyDictionary` to match it.
  const heard = word.asrText
    .split(/\s+/u)
    .map(normalizeForMatch)
    .filter((part) => part !== '')
    .join(' ');

  return {
    id,
    spelling: splitAffixes(word.text).body || word.text,
    heardAs: heard === '' ? [] : [heard],
    createdAt,
  };
}
