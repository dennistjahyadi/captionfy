import { ids, project, word } from '../__fixtures__/project';
import {
  clearLineFlag,
  isLowConfidence,
  lineFlagsFor,
  lowConfidenceCount,
  lowConfidenceLines,
  lowConfidenceWords,
  LOW_CONFIDENCE_THRESHOLD,
  nextLowConfidenceWordId,
} from '../confidence';
import { applyDictionary } from '../dictionary';
import { confirmWord, editWordText } from '../editing';

const words = [
  word({ id: 'w1', text: 'so', start: 0, end: 200, conf: 0.95 }),
  word({ id: 'w2', text: 'kitvery', start: 200, end: 600, conf: 0.22 }),
  word({ id: 'w3', text: 'app', start: 2000, end: 2300, conf: 0.41 }),
  word({ id: 'w4', text: 'yes', start: 2300, end: 2600 }),
];

describe('isLowConfidence', () => {
  it('flags engine output below the threshold', () => {
    expect(isLowConfidence(words[1])).toBe(true);
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.6);
  });

  it('leaves a confident word alone', () => {
    expect(isLowConfidence(words[0])).toBe(false);
  });

  it('says nothing about a word with no probability at all', () => {
    expect(isLowConfidence(words[3])).toBe(false);
  });

  it('is cleared by editing the word', () => {
    const next = editWordText(words, 'w2', 'KitVerify', ids());
    expect(isLowConfidence(next[1])).toBe(false);
  });

  it('is cleared by confirming the word, without losing the probability', () => {
    const next = confirmWord(words, 'w2');
    expect(isLowConfidence(next[1])).toBe(false);
    expect(next[1].conf).toBe(0.22);
  });

  it('is cleared by a dictionary replacement', () => {
    const next = applyDictionary(words, [
      { id: 'd1', spelling: 'KitVerify', heardAs: ['kitvery'], createdAt: '' },
    ]);
    expect(isLowConfidence(next[1])).toBe(false);
  });
});

describe('project-level queries', () => {
  const flagged = project({ words });

  it('lists every word worth checking', () => {
    expect(lowConfidenceWords(flagged).map((w) => w.id)).toEqual(['w2', 'w3']);
    expect(lowConfidenceCount(flagged)).toBe(2);
  });

  it('respects a caller threshold', () => {
    expect(lowConfidenceWords(flagged, 0.3).map((w) => w.id)).toEqual(['w2']);
  });

  it('marks the lines those words sit in', () => {
    expect(lowConfidenceLines(flagged).map((line) => line.index)).toEqual([0, 1]);
  });

  it('also marks a line the transcription pass flagged on its own', () => {
    const clean = project({
      words: [word({ id: 'w1', text: 'so', start: 0, end: 200, conf: 0.95 })],
      lineFlags: [{ lineStartWordId: 'w1', lowConfidence: true }],
    });
    expect(lowConfidenceLines(clean)).toHaveLength(1);
  });
});

describe('the "N to check" chip', () => {
  const flagged = project({ words });

  it('starts at the first word worth checking', () => {
    expect(nextLowConfidenceWordId(flagged)).toBe('w2');
  });

  it('walks forward through the transcript', () => {
    expect(nextLowConfidenceWordId(flagged, 'w2')).toBe('w3');
  });

  it('wraps back to the start', () => {
    expect(nextLowConfidenceWordId(flagged, 'w3')).toBe('w2');
  });

  it('has nothing to go to when nothing is flagged', () => {
    expect(nextLowConfidenceWordId(project({ words: [words[0]] }))).toBeNull();
  });
});

describe('line flags', () => {
  it('keys a flag on the word the line starts with', () => {
    expect(lineFlagsFor(words)).toEqual([
      { lineStartWordId: 'w1', lowConfidence: true },
      { lineStartWordId: 'w3', lowConfidence: true },
    ]);
  });

  it('clears one flag and leaves the rest', () => {
    expect(clearLineFlag(lineFlagsFor(words), 'w1')).toEqual([
      { lineStartWordId: 'w3', lowConfidence: true },
    ]);
  });
});
