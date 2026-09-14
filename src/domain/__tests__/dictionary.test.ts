import { evenWords, word } from '../__fixtures__/project';
import {
  applyDictionary,
  dictionaryMatches,
  dictionaryPrompt,
  entryFromWord,
  PROMPT_MAX_CHARS,
  PROMPT_MAX_ENTRIES,
} from '../dictionary';
import type { DictionaryEntry } from '../types';

const entry = (spelling: string, heardAs: string[]): DictionaryEntry => ({
  id: spelling,
  spelling,
  heardAs,
  createdAt: '2026-09-12T00:00:00.000Z',
});

const kitVerify = entry('KitVerify', ['kit very by', 'kit verify']);

describe('applyDictionary', () => {
  const heard = [
    word({ id: 'w1', text: 'the', start: 0, end: 200 }),
    word({ id: 'w2', text: 'kit', start: 200, end: 400, conf: 0.9 }),
    word({ id: 'w3', text: 'very', start: 400, end: 700, conf: 0.3 }),
    word({ id: 'w4', text: 'by', start: 700, end: 1200, conf: 0.8 }),
    word({ id: 'w5', text: 'app', start: 1300, end: 1600 }),
  ];

  it('collapses a multi-word match into one word spanning the same time', () => {
    const next = applyDictionary(heard, [kitVerify]);
    expect(next.map((w) => w.text)).toEqual(['the', 'KitVerify', 'app']);
    expect(next[1]).toMatchObject({ start: 200, end: 1200, origin: 'dictionary' });
  });

  it('keeps the first word id, so a line flag on it survives', () => {
    expect(applyDictionary(heard, [kitVerify])[1].id).toBe('w2');
  });

  it('keeps what the engine heard across the whole span', () => {
    expect(applyDictionary(heard, [kitVerify])[1].asrText).toBe('kit very by');
  });

  it('carries the least confident piece', () => {
    expect(applyDictionary(heard, [kitVerify])[1].conf).toBe(0.3);
  });

  it('ignores case and punctuation around the match', () => {
    const punctuated = [
      word({ id: 'w1', text: '"Kit', start: 0, end: 200 }),
      word({ id: 'w2', text: 'Very', start: 200, end: 400 }),
      word({ id: 'w3', text: 'By,"', start: 400, end: 600 }),
    ];
    expect(applyDictionary(punctuated, [kitVerify])[0].text).toBe('"KitVerify,"');
  });

  it('matches the longest phrase first', () => {
    const words = [
      word({ id: 'w1', text: 'kit', start: 0, end: 200 }),
      word({ id: 'w2', text: 'very', start: 200, end: 400 }),
      word({ id: 'w3', text: 'by', start: 400, end: 600 }),
    ];
    const dict = [entry('Kit', ['kit']), kitVerify];
    expect(applyDictionary(words, dict).map((w) => w.text)).toEqual(['KitVerify']);
  });

  it('leaves a word the user edited alone', () => {
    const edited = heard.map((w) => (w.id === 'w3' ? { ...w, origin: 'edited' as const } : w));
    expect(applyDictionary(edited, [kitVerify]).map((w) => w.text)).toEqual([
      'the',
      'kit',
      'very',
      'by',
      'app',
    ]);
  });

  it('replaces every occurrence', () => {
    const twice = [
      word({ id: 'w1', text: 'kit', start: 0, end: 200 }),
      word({ id: 'w2', text: 'verify', start: 200, end: 400 }),
      word({ id: 'w3', text: 'and', start: 400, end: 600 }),
      word({ id: 'w4', text: 'kit', start: 600, end: 800 }),
      word({ id: 'w5', text: 'verify', start: 800, end: 1000 }),
    ];
    expect(applyDictionary(twice, [kitVerify]).map((w) => w.text)).toEqual([
      'KitVerify',
      'and',
      'KitVerify',
    ]);
  });

  it('returns the same array when nothing matches', () => {
    const words = [word({ id: 'w1', text: 'nothing', start: 0, end: 200 })];
    expect(applyDictionary(words, [kitVerify])).toBe(words);
  });

  it('does not mark a word the engine already spelled correctly', () => {
    const words = [word({ id: 'w1', text: 'KitVerify', start: 0, end: 200 })];
    expect(applyDictionary(words, [entry('KitVerify', ['kitverify'])])).toBe(words);
  });

  it('does nothing with an empty dictionary', () => {
    expect(applyDictionary(heard, [])).toBe(heard);
  });
});

describe('dictionaryPrompt', () => {
  it('names the spellings in a sentence, because whisper reads it as speech', () => {
    expect(dictionaryPrompt([entry('KitVerify', []), entry('Jakarta', [])])).toBe(
      'This video mentions KitVerify, Jakarta.'
    );
  });

  it('stops at the character budget rather than overrunning the prompt', () => {
    const long = Array.from({ length: 200 }, (_, index) => entry(`Spelling${index}`, []));
    expect(dictionaryPrompt(long).length).toBeLessThanOrEqual(PROMPT_MAX_CHARS + 40);
  });

  it('stops at the entry ceiling', () => {
    const many = Array.from({ length: 200 }, (_, index) => entry(`S${index}`, []));
    expect(dictionaryPrompt(many, PROMPT_MAX_ENTRIES, 100_000).split(', ')).toHaveLength(
      PROMPT_MAX_ENTRIES
    );
  });

  it('is empty when there is nothing to bias toward', () => {
    expect(dictionaryPrompt([])).toBe('');
  });
});

describe('entryFromWord', () => {
  it('prefills both fields from a correction the user just made', () => {
    const corrected = word({
      id: 'w1',
      text: 'KitVerify,',
      asrText: 'Kit Very By',
      start: 0,
      end: 200,
      origin: 'edited',
    });
    expect(entryFromWord(corrected, 'd1', '2026-09-12T00:00:00.000Z')).toMatchObject({
      spelling: 'KitVerify',
      heardAs: ['kit very by'],
    });
  });
});

describe('dictionaryMatches', () => {
  const dict = [kitVerify, entry('Wordburn', ['wordbun'])];

  it('counts nothing when the dictionary changes nothing', () => {
    expect(dictionaryMatches(evenWords(['So', 'today', 'I']), dict)).toBe(0);
    expect(dictionaryMatches(evenWords(['kit', 'verify']), [])).toBe(0);
  });

  it('counts a word it would rewrite', () => {
    expect(dictionaryMatches(evenWords(['I', 'tried', 'wordbun']), dict)).toBe(1);
  });

  it('counts a phrase it would collapse as one fix, not three', () => {
    expect(dictionaryMatches(evenWords(['I', 'tried', 'kit', 'very', 'by']), dict)).toBe(1);
  });

  it('counts every place it would strike', () => {
    expect(dictionaryMatches(evenWords(['wordbun', 'and', 'wordbun', 'again']), dict)).toBe(2);
  });

  it('never counts a word the user typed themselves', () => {
    const words = evenWords(['I', 'tried', 'wordbun']).map((word) =>
      word.text === 'wordbun' ? { ...word, origin: 'edited' as const } : word
    );

    expect(dictionaryMatches(words, dict)).toBe(0);
  });
});
