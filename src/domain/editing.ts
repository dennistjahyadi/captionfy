/**
 * Text edits on words.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Invariant 1 lives here: changing what a word says never changes when it is
 * said. The only timing these functions touch is the timing of a span they are
 * cutting up or joining together, and even then the outer edges of that span
 * stay exactly where they were.
 */
import { divideInterval } from './timing';
import { normalizeForMatch, splitWords } from './text';
import type { IdFactory, Word } from './types';

/**
 * Replaces a word's text, keeping its start and end.
 *
 * Typing a space is how the user splits a word, so text with whitespace in it
 * becomes several words sharing the original span, divided by how long each
 * piece is to write. Character length is a crude proxy for speaking time, but it
 * is stable, explainable, and the timing sheet is one tap away when it is wrong.
 *
 * Empty text is a no-op. Deleting a word is `deleteWord`, and a text field that
 * has been cleared mid-typing must not destroy the word under the cursor.
 */
export function editWordText(words: Word[], id: string, newText: string, newId: IdFactory): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;

  const parts = splitWords(newText);
  if (parts.length === 0) return words;

  const word = words[index];
  if (parts.length === 1) {
    if (parts[0] === word.text && word.origin === 'edited') return words;
    return replaceRange(words, index, 1, [{ ...word, text: parts[0], origin: 'edited' }]);
  }

  const spans = divideInterval(
    word.start,
    word.end,
    parts.map((part) => part.length)
  );

  const replacements = parts.map((part, part_index) => ({
    ...word,
    // The first piece keeps the id so the transcript's scroll position, the
    // selection and any line flag keyed on this word all survive the edit.
    id: part_index === 0 ? word.id : newId(),
    text: part,
    // Every piece carries the same `asrText`, because that is what the engine
    // heard for this whole span. It is what "add to dictionary" needs, whichever
    // piece the user opens afterwards.
    asrText: word.asrText,
    origin: 'edited' as const,
    start: spans[part_index].start,
    end: spans[part_index].end,
    // Only the last piece can inherit a break, otherwise the line would break in
    // the middle of what used to be one word.
    breakAfter: part_index === parts.length - 1 ? word.breakAfter : undefined,
  }));

  return replaceRange(words, index, 1, replacements);
}

/**
 * Splits one word into two at a character offset.
 *
 * The same span division as `editWordText`, reached from a cursor position
 * rather than from a typed space.
 */
export function splitWord(words: Word[], id: string, atChar: number, newId: IdFactory): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;

  const word = words[index];
  const cut = Math.round(atChar);
  if (cut <= 0 || cut >= word.text.length) return words;

  return editWordText(words, id, `${word.text.slice(0, cut)} ${word.text.slice(cut)}`, newId);
}

/**
 * Joins a run of words into one, taking the earliest start and the latest end.
 *
 * The pieces are joined with no separator. Whisper splitting "KitVerify" into
 * "Kit" and "Verify" is what this action exists for, and a merged word that
 * contained a space would be split apart again by the next text edit. Keeping
 * two words together on one line is `setBreakAfter(..., 'none')` instead.
 */
export function mergeWords(words: Word[], ids: string[]): Word[] {
  const indices = ids
    .map((id) => words.findIndex((word) => word.id === id))
    .filter((index) => index !== -1);
  if (indices.length < 2) return words;

  const from = Math.min(...indices);
  const to = Math.max(...indices);
  const run = words.slice(from, to + 1);
  const confidences = run.map((word) => word.conf).filter((conf): conf is number => conf !== undefined);

  const merged: Word = {
    ...run[0],
    text: run.map((word) => word.text).join(''),
    asrText: run.map((word) => word.asrText).join(' '),
    start: Math.min(...run.map((word) => word.start)),
    end: Math.max(...run.map((word) => word.end)),
    // The merged word is only as trustworthy as its least trustworthy piece.
    conf: confidences.length > 0 ? Math.min(...confidences) : undefined,
    origin: 'edited',
    breakAfter: run[run.length - 1].breakAfter,
    confirmed: undefined,
    emphasis: mergedEmphasis(run),
  };

  return replaceRange(words, from, run.length, [merged]);
}

/**
 * An explicit "make big" survives a merge; an explicit "keep normal" only
 * survives if every piece agreed. Anything else hands the question back to the
 * automatic rule, which is what a local recompute will answer.
 */
function mergedEmphasis(run: Word[]): Word['emphasis'] {
  if (run.some((word) => word.emphasis === 'on')) return 'on';
  if (run.every((word) => word.emphasis === 'off')) return 'off';
  return undefined;
}

/** Removes a word. Its time is left as a gap rather than given to a neighbour. */
export function deleteWord(words: Word[], id: string): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;
  return replaceRange(words, index, 1, []);
}

/** Sets manual line-break control on a word. */
export function setBreakAfter(words: Word[], id: string, breakAfter: Word['breakAfter']): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;
  return replaceRange(words, index, 1, [{ ...words[index], breakAfter }]);
}

/**
 * The word sheet's "Make big" and "Make normal".
 *
 * `undefined` hands the word back to the automatic rule, which is how a user
 * undoes an override rather than having to remember what the app had chosen.
 */
export function setEmphasis(words: Word[], id: string, emphasis: Word['emphasis']): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;
  if (words[index].emphasis === emphasis) return words;
  return replaceRange(words, index, 1, [{ ...words[index], emphasis }]);
}

/**
 * The "Looks right" action: clears the low-confidence mark without editing.
 *
 * `conf` is left alone so the engine's own signal stays readable.
 */
export function confirmWord(words: Word[], id: string): Word[] {
  const index = words.findIndex((word) => word.id === id);
  if (index === -1) return words;
  return replaceRange(words, index, 1, [{ ...words[index], confirmed: true }]);
}

/**
 * Other words the engine misheard the same way.
 *
 * Behind "Fix 2 more like this". Matching is on `asrText`, not on the displayed
 * text, so a word already corrected once is still recognised as the same
 * mishearing. Words the user has edited by hand are left out: their text is a
 * decision already made.
 */
export function sameHeardWordIds(words: Word[], id: string): string[] {
  const source = words.find((word) => word.id === id);
  if (!source) return [];

  const heard = normalizeForMatch(source.asrText);
  if (heard === '') return [];

  return words
    .filter((word) => word.id !== id && word.origin === 'asr' && normalizeForMatch(word.asrText) === heard)
    .map((word) => word.id);
}

/** Applies the same correction to several words at once, one undo step. */
export function editWordsText(words: Word[], ids: string[], newText: string, newId: IdFactory): Word[] {
  return ids.reduce((current, id) => editWordText(current, id, newText, newId), words);
}

function replaceRange(words: Word[], index: number, count: number, replacements: Word[]): Word[] {
  return [...words.slice(0, index), ...replacements, ...words.slice(index + count)];
}
