/**
 * Text shapes shared by editing, the dictionary and line segmentation.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */

/** Sentence-ending punctuation. A caption line breaks after one of these. */
const SENTENCE_END = /[.!?…]["'”’)\]]*$/u;

/**
 * Strips case and punctuation for comparison.
 *
 * The dictionary has to match "kit very by," against `heard as` "kit very by",
 * and "fix the other two like this" has to recognise the same misheard word
 * whether or not whisper put a comma after it. Apostrophes survive because
 * "dont" and "don't" are different words to a reader.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/gu, "'")
    .replace(/[^\p{L}\p{N}']+/gu, '');
}

/** True when the word ends a sentence, punctuation and closing quotes included. */
export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text);
}

/** Splits a word into its leading punctuation, its body, and its trailing punctuation. */
export function splitAffixes(text: string): { lead: string; body: string; trail: string } {
  const lead = /^[^\p{L}\p{N}]*/u.exec(text)?.[0] ?? '';
  const rest = text.slice(lead.length);
  const trail = /[^\p{L}\p{N}]*$/u.exec(rest)?.[0] ?? '';
  return { lead, body: rest.slice(0, rest.length - trail.length), trail };
}

/** Splits user-typed text into words, collapsing any run of whitespace. */
export function splitWords(text: string): string[] {
  const trimmed = text.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/u);
}
