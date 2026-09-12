import {
  confirmWord,
  deleteWord,
  editWordText,
  mergeWords,
  setBreakAfter,
  setEmphasis,
  splitWord,
} from '../editing';
import { timingDrift, timingSpill } from '../invariants';
import { nudgeWord, setWordTiming } from '../timing';
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

describe('timingSpill', () => {
  const spaced = evenWords(['So', 'today', 'I', 'tried', 'KitVerify'], 300, 100);

  it('passes every move the timing sheet can make to the word it is about', () => {
    expect(timingSpill(spaced, nudgeWord(spaced, 'w2', 'start', -50), ['w2'])).toBeNull();
    expect(timingSpill(spaced, nudgeWord(spaced, 'w2', 'end', 50), ['w2'])).toBeNull();
    expect(timingSpill(spaced, nudgeWord(spaced, 'w2', 'both', -80), ['w2'])).toBeNull();
    expect(timingSpill(spaced, setWordTiming(spaced, 'w2', 420, 690), ['w2'])).toBeNull();
  });

  it('passes a move that clamped against a neighbour rather than pushing it', () => {
    const squeezed = nudgeWord(spaced, 'w2', 'start', -5000);

    expect(squeezed[1].start).toBe(spaced[0].end);
    expect(timingSpill(spaced, squeezed, ['w2'])).toBeNull();
  });

  it('catches a word the action was not aimed at', () => {
    const pushed = spaced.map((entry) =>
      entry.id === 'w3' ? { ...entry, start: entry.start - 40 } : entry
    );

    expect(timingSpill(spaced, pushed, ['w2'])).toBe('"I" moved from 800–1100 to 760–1100');
  });

  it('catches text arriving through the timing path', () => {
    const retyped = spaced.map((entry) =>
      entry.id === 'w2' ? { ...entry, text: 'tomorrow' } : entry
    );

    expect(timingSpill(spaced, retyped, ['w2'])).toBe('"today" became "tomorrow"');
  });

  it('catches a word count that changed, which no timing action may do', () => {
    expect(timingSpill(spaced, spaced.slice(1), ['w2'])).toBe('the word count changed from 5 to 4');
  });

  it('catches an overlap the action introduced', () => {
    const overrun = spaced.map((entry) =>
      entry.id === 'w2' ? { ...entry, end: entry.end + 300 } : entry
    );

    expect(timingSpill(spaced, overrun, ['w2'])).toBe('"today" now runs into "I"');
  });

  it('leaves an overlap that was already in the transcript alone', () => {
    const crossed = [
      word({ id: 'w1', text: 'So', start: 0, end: 500 }),
      word({ id: 'w2', text: 'today', start: 400, end: 900 }),
    ];
    const nudged = crossed.map((entry) =>
      entry.id === 'w2' ? { ...entry, end: entry.end + 50 } : entry
    );

    expect(timingSpill(crossed, nudged, ['w2'])).toBeNull();
  });

  it('catches a word squeezed out of existence', () => {
    const flattened = spaced.map((entry) =>
      entry.id === 'w2' ? { ...entry, end: entry.start } : entry
    );

    expect(timingSpill(spaced, flattened, ['w2'])).toBe('"today" has no length left');
  });

  it('has nothing to say about an action that changed nothing', () => {
    expect(timingSpill(spaced, spaced, ['w2'])).toBeNull();
  });
});
