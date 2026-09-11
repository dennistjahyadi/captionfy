/**
 * Function words that never carry the emphasis of a sentence.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * A caption app that blows up "the" because the speaker happened to lean on it
 * looks broken, so these are excluded outright rather than scored down. The list
 * is English because v1 is English.
 *
 * Fillers are in here too. "Like", "just", "really", "so", "um" are often the
 * loudest and longest things a creator says, which is exactly why they need to
 * be barred rather than left to the loudness signal.
 *
 * Entries are compared after `normalizeForMatch`, so they are lowercase and
 * carry no punctuation.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // Articles and determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'each', 'every',
  'either', 'neither', 'both', 'another', 'such', 'no', 'all',
  // Pronouns
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
  'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever',
  // Auxiliaries and common verbs with no content of their own
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having', 'will', 'would', 'shall', 'should', 'can', 'could',
  'may', 'might', 'must', 'get', 'got', 'gets', 'go', 'goes', 'going', 'gonna', 'wanna',
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", "won't",
  "it's", "that's", "there's", "i'm", "you're", "we're", "they're", "i've", "you've",
  // Prepositions
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'without', 'from', 'by', 'about', 'into',
  'onto', 'over', 'under', 'between', 'through', 'during', 'before', 'after', 'above',
  'below', 'up', 'down', 'out', 'off', 'again', 'than', 'as', 'per',
  // Conjunctions and connectives
  'and', 'or', 'but', 'if', 'because', 'while', 'although', 'though', 'unless', 'until',
  'when', 'where', 'why', 'how', 'so', 'then', 'thus', 'however', 'therefore', 'also',
  'too', 'yet', 'nor',
  // Fillers, hedges and discourse markers
  'um', 'uh', 'erm', 'ah', 'oh', 'eh', 'hmm', 'mhm', 'yeah', 'yep', 'okay', 'ok',
  'like', 'just', 'really', 'actually', 'basically', 'literally', 'honestly', 'anyway',
  'well', 'right', 'sure', 'kinda', 'sorta', 'stuff', 'thing', 'things',
  // Quantity words with no figure in them
  'very', 'much', 'many', 'more', 'most', 'less', 'least', 'few', 'lot', 'lots',
  'here', 'there', 'now', 'not', 'only', 'even', 'still', 'already', 'always', 'never',
]);

export function isStopword(normalized: string): boolean {
  return STOPWORDS.has(normalized);
}
