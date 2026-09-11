import { ids, word } from '../__fixtures__/project';
import {
  confirmWord,
  deleteWord,
  editWordText,
  editWordsText,
  mergeWords,
  sameHeardWordIds,
  setBreakAfter,
  splitWord,
} from '../editing';
import type { Word } from '../types';

const span = (words: Word[]) => ({ start: words[0].start, end: words[words.length - 1].end });

describe('invariant 1: editing text never changes timing', () => {
  const words = [
    word({ id: 'w1', text: 'kitvery', start: 1000, end: 2000, conf: 0.3 }),
    word({ id: 'w2', text: 'app', start: 2100, end: 2400 }),
  ];

  it('keeps start and end when the text is replaced', () => {
    const next = editWordText(words, 'w1', 'KitVerify', ids());
    expect(next[0]).toMatchObject({ text: 'KitVerify', start: 1000, end: 2000, origin: 'edited' });
    expect(next[1]).toBe(words[1]);
  });

  it('keeps the outer span when a typed space splits the word', () => {
    const next = editWordText(words, 'w1', 'Kit Verify', ids());
    expect(next).toHaveLength(3);
    expect(span(next.slice(0, 2))).toEqual({ start: 1000, end: 2000 });
  });

  it('keeps the outer span when a word is split at a cursor', () => {
    const next = splitWord(words, 'w1', 3, ids());
    expect(next.map((w) => w.text)).toEqual(['kit', 'very', 'app']);
    expect(span(next.slice(0, 2))).toEqual({ start: 1000, end: 2000 });
  });

  it('keeps the outer span when words are merged', () => {
    const next = mergeWords(words, ['w1', 'w2']);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: 'kitveryapp', start: 1000, end: 2400 });
  });

  it('leaves every other word untouched', () => {
    const next = editWordText(words, 'w1', 'Kit Verify', ids());
    expect(next[2]).toBe(words[1]);
  });
});

describe('editWordText', () => {
  const single = [word({ id: 'w1', text: 'kitverify', start: 0, end: 900 })];

  it('divides the span by how long each piece is to write', () => {
    // "Kit" is 3 of 9 characters, so it takes the first third of 900 ms.
    const next = editWordText(single, 'w1', 'Kit Verify', ids());
    expect(next.map((w) => [w.start, w.end])).toEqual([
      [0, 300],
      [300, 900],
    ]);
  });

  it('keeps the original id on the first piece so selection survives', () => {
    const next = editWordText(single, 'w1', 'Kit Verify', ids());
    expect(next.map((w) => w.id)).toEqual(['w1', 'n1']);
  });

  it('never mutates asrText', () => {
    const next = editWordText(single, 'w1', 'Kit Verify', ids());
    expect(next.every((w) => w.asrText === 'kitverify')).toBe(true);
  });

  it('collapses any run of whitespace', () => {
    const next = editWordText(single, 'w1', '  Kit   Verify  ', ids());
    expect(next.map((w) => w.text)).toEqual(['Kit', 'Verify']);
  });

  it('treats empty text as a no-op, because deleting is its own action', () => {
    expect(editWordText(single, 'w1', '   ', ids())).toBe(single);
  });

  it('ignores an unknown id', () => {
    expect(editWordText(single, 'nope', 'x', ids())).toBe(single);
  });

  it('moves a manual break to the last piece', () => {
    const flagged = [word({ id: 'w1', text: 'ab', start: 0, end: 100, breakAfter: 'line' })];
    const next = editWordText(flagged, 'w1', 'a b', ids());
    expect(next[0].breakAfter).toBeUndefined();
    expect(next[1].breakAfter).toBe('line');
  });

  it('marks the word edited even when the text is unchanged, which clears its flag', () => {
    const next = editWordText(single, 'w1', 'kitverify', ids());
    expect(next[0].origin).toBe('edited');
  });
});

describe('splitWord', () => {
  const single = [word({ id: 'w1', text: 'kitverify', start: 0, end: 900 })];

  it('refuses a cut at either end, which would make an empty word', () => {
    expect(splitWord(single, 'w1', 0, ids())).toBe(single);
    expect(splitWord(single, 'w1', 9, ids())).toBe(single);
  });
});

describe('mergeWords', () => {
  const words = [
    word({ id: 'w1', text: 'Kit', start: 0, end: 300, conf: 0.9 }),
    word({ id: 'w2', text: 'Verify', start: 300, end: 900, conf: 0.4 }),
    word({ id: 'w3', text: 'app', start: 1000, end: 1300 }),
  ];

  it('joins without a separator, so the next text edit cannot split it again', () => {
    expect(mergeWords(words, ['w1', 'w2'])[0].text).toBe('KitVerify');
  });

  it('takes the earliest start and the latest end', () => {
    expect(mergeWords(words, ['w1', 'w3'])[0]).toMatchObject({ start: 0, end: 1300 });
  });

  it('swallows everything between the named words', () => {
    expect(mergeWords(words, ['w1', 'w3']).map((w) => w.text)).toEqual(['KitVerifyapp']);
  });

  it('carries the least confident piece', () => {
    expect(mergeWords(words, ['w1', 'w2'])[0].conf).toBe(0.4);
  });

  it('keeps what the engine heard, spaced as it was heard', () => {
    expect(mergeWords(words, ['w1', 'w2'])[0].asrText).toBe('Kit Verify');
  });

  it('needs two words', () => {
    expect(mergeWords(words, ['w1'])).toBe(words);
  });
});

describe('sameHeardWordIds', () => {
  const words = [
    word({ id: 'w1', text: 'kit very', start: 0, end: 100, asrText: 'Kitvery' }),
    word({ id: 'w2', text: 'kitvery,', start: 200, end: 300, asrText: 'kitvery,' }),
    word({ id: 'w3', text: 'KitVerify', start: 400, end: 500, asrText: 'kitvery', origin: 'edited' }),
    word({ id: 'w4', text: 'other', start: 600, end: 700 }),
  ];

  it('matches on what was heard, ignoring case and punctuation', () => {
    expect(sameHeardWordIds(words, 'w1')).toEqual(['w2']);
  });

  it('leaves words the user already edited alone', () => {
    expect(sameHeardWordIds(words, 'w1')).not.toContain('w3');
  });

  it('applies one correction to every match in a single step', () => {
    const next = editWordsText(words, ['w1', 'w2'], 'KitVerify', ids());
    expect(next.filter((w) => w.text === 'KitVerify')).toHaveLength(3);
  });
});

describe('small edits', () => {
  const words = [
    word({ id: 'w1', text: 'a', start: 0, end: 100 }),
    word({ id: 'w2', text: 'b', start: 200, end: 300 }),
  ];

  it('deletes a word without giving its time to a neighbour', () => {
    const next = deleteWord(words, 'w1');
    expect(next).toEqual([words[1]]);
  });

  it('sets a manual break', () => {
    expect(setBreakAfter(words, 'w1', 'none')[0].breakAfter).toBe('none');
  });

  it('confirms a word without touching its confidence', () => {
    const flagged = [word({ id: 'w1', text: 'a', start: 0, end: 100, conf: 0.2 })];
    const next = confirmWord(flagged, 'w1');
    expect(next[0]).toMatchObject({ confirmed: true, conf: 0.2, origin: 'asr' });
  });
});
