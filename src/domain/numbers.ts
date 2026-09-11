/**
 * Recognising a figure, however it was written.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Numbers are what a viewer stops scrolling for: the price, the count, the
 * percentage. whisper writes them either as digits or as words depending on the
 * sentence, so both have to be caught or the signal fires at random.
 */
import { normalizeForMatch, splitAffixes } from './text';

/** Number words whisper is likely to spell out. Compared after normalisation. */
const NUMBER_WORDS: ReadonlySet<string> = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion', 'trillion',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth',
  'tenth', 'half', 'quarter', 'double', 'triple', 'dozen',
]);

/** Currency signs whisper emits, plus the written forms that mean the same thing. */
const CURRENCY = /[$€£¥₫₹₱]/u;
const CURRENCY_WORDS: ReadonlySet<string> = new Set([
  'dollars', 'dollar', 'euros', 'euro', 'pounds', 'rupiah', 'dong', 'yen', 'percent',
]);

/**
 * True when the word carries a figure.
 *
 * "second" is in the number list and is also an ordinary noun. That mistake costs
 * one point on one word, which the minimum score and the one-per-line cap absorb;
 * missing every spoken price would cost the whole feature.
 */
export function isNumeric(text: string): boolean {
  if (/\d/u.test(text)) return true;
  if (CURRENCY.test(text)) return true;
  if (text.includes('%')) return true;

  const body = normalizeForMatch(splitAffixes(text).body);
  return NUMBER_WORDS.has(body) || CURRENCY_WORDS.has(body);
}
