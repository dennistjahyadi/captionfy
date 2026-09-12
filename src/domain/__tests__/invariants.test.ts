import {
  confirmWord,
  deleteWord,
  editWordText,
  mergeWords,
  setBreakAfter,
  setEmphasis,
  splitWord,
} from '../editing';
import { timingDrift } from '../invariants';
import { nudgeWord } from '../timing';
import { evenWords, ids, word } from '../__fixtures__/project';

const words = evenWords(['So', 'today', 'I', 'tried', 'KitVerify']);

describe('timingDrift', () => {
  it('passes every text action in the word sheet', () => {
    const newId = ids();

    expect(timingDrift(words, editWordText(words, 'w2', 'tomorrow', newId))).toBeNull();
    expect(timingDrift(words, confirmWord(words, 'w2'))).toBeNull();
    expect(timingDrift(words, setEmphasis(words, 'w2', 'on'))).toBeNull();
    expect(timingDrift(words, setBreakAfter(words, 'w2', 'line'))).toBeNull();
  });

  it('passes a split, a merge and a delete, which divide time rather than invent it', () => {
    const newId = ids();

    expect(timingDrift(words, splitWord(words, 'w5', 3, newId))).toBeNull();
    expect(timingDrift(words, editWordText(words, 'w5', 'Kit Verify', newId))).toBeNull();
    expect(timingDrift(words, mergeWords(words, ['w3', 'w4']))).toBeNull();
    expect(timingDrift(words, deleteWord(words, 'w3'))).toBeNull();
  });

  it('catches a text edit that moved the word it edited', () => {
    const moved = words.map((entry) =>
      entry.id === 'w2' ? { ...entry, text: 'tomorrow', start: entry.start + 40 } : entry
    );

    expect(timingDrift(words, moved)).toBe('"tomorrow" moved from 400–800 to 440–800');
  });

  it('catches a text edit that moved a word it was not even about', () => {
    const moved = words.map((entry) =>
      entry.id === 'w4' ? { ...entry, end: entry.end - 10 } : entry
    );

    expect(timingDrift(words, moved)).toContain('moved from');
  });

  it('catches a split that hands time to a word beyond the span it divided', () => {
    const leaked = [
      ...words.slice(0, 4),
      word({ id: 'w5', text: 'Kit', start: 1600, end: 1800 }),
      word({ id: 'n1', text: 'Verify', start: 1800, end: 2400 }),
    ];

    expect(timingDrift(words, leaked)).toBe('the last word now ends at 2400, after 2000');
  });

  it('catches a merge that reached back before the first word', () => {
    const leaked = [word({ id: 'w1', text: 'Sotoday', start: -100, end: 800 }), ...words.slice(2)];
    expect(timingDrift(words, leaked)).toBe('the first word now starts at -100, before 0');
  });

  it('reports a nudge, which is why the editor only checks the text path', () => {
    // A nudge is allowed to move an edge. It is a timing action, so it does not
    // go through this check at all.
    const spaced = evenWords(['So', 'today', 'I'], 300, 100);
    const nudged = nudgeWord(spaced, 'w2', 'start', -50);

    expect(timingDrift(spaced, nudged)).toContain('moved from');
  });

  it('has nothing to say about an empty transcript', () => {
    expect(timingDrift([], words)).toBeNull();
    expect(timingDrift(words, [])).toBeNull();
  });
});
