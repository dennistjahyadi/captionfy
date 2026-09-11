import { evenWords, project, word } from '../__fixtures__/project';
import { activeWordAt, LINE_HOLD_MS, MAX_WORDS_PER_LINE, segmentLines } from '../lines';

const texts = (lines: ReturnType<typeof segmentLines>) =>
  lines.map((line) => line.words.map((w) => w.text).join(' '));

describe('segmentLines', () => {
  it('caps a line at the word limit', () => {
    const words = evenWords(['one', 'two', 'three', 'four', 'five', 'six']);
    expect(texts(segmentLines(words))).toEqual(['one two three four', 'five six']);
    expect(MAX_WORDS_PER_LINE).toBe(4);
  });

  it('breaks on a pause long enough to read as one', () => {
    const words = [
      word({ id: 'w1', text: 'so', start: 0, end: 200 }),
      word({ id: 'w2', text: 'today', start: 700, end: 1000 }),
    ];
    expect(texts(segmentLines(words))).toEqual(['so', 'today']);
  });

  it('keeps words together across a gap below the threshold', () => {
    const words = [
      word({ id: 'w1', text: 'so', start: 0, end: 200 }),
      word({ id: 'w2', text: 'today', start: 500, end: 800 }),
    ];
    expect(texts(segmentLines(words))).toEqual(['so today']);
  });

  it('breaks after a sentence ends, quotes included', () => {
    const words = evenWords(['done."', 'Next', 'up']);
    expect(texts(segmentLines(words))).toEqual(['done."', 'Next up']);
  });

  it('does not break after a comma', () => {
    const words = evenWords(['so,', 'today']);
    expect(texts(segmentLines(words))).toEqual(['so, today']);
  });

  it('forces a break where the user asked for one', () => {
    const words = evenWords(['one', 'two', 'three']);
    words[0].breakAfter = 'line';
    expect(texts(segmentLines(words))).toEqual(['one', 'two three']);
  });

  it('suppresses an automatic break where the user asked to keep words together', () => {
    const words = [
      word({ id: 'w1', text: 'New', start: 0, end: 200, breakAfter: 'none' }),
      word({ id: 'w2', text: 'York', start: 900, end: 1200 }),
    ];
    expect(texts(segmentLines(words))).toEqual(['New York']);
  });

  it('still applies the word cap under a suppressed break', () => {
    const words = evenWords(['one', 'two', 'three', 'four', 'five']);
    words.forEach((w) => (w.breakAfter = 'none'));
    expect(texts(segmentLines(words))).toEqual(['one two three four', 'five']);
  });

  it('honours a tighter word limit from the style', () => {
    const words = evenWords(['one', 'two', 'three']);
    expect(texts(segmentLines(words, { maxWordsPerLine: 2 }))).toEqual(['one two', 'three']);
  });

  it('returns nothing for no words', () => {
    expect(segmentLines([])).toEqual([]);
  });

  it('holds a line until the next one starts', () => {
    const words = [
      word({ id: 'w1', text: 'one', start: 0, end: 200 }),
      word({ id: 'w2', text: 'two', start: 800, end: 1000 }),
    ];
    expect(segmentLines(words)[0].visibleUntilMs).toBe(800);
  });

  it('caps the hold on the last line so it does not sit there forever', () => {
    const words = [word({ id: 'w1', text: 'one', start: 0, end: 200 })];
    expect(segmentLines(words)[0].visibleUntilMs).toBe(200 + LINE_HOLD_MS);
  });
});

describe('activeWordAt', () => {
  const words = [
    word({ id: 'w1', text: 'one', start: 0, end: 400 }),
    word({ id: 'w2', text: 'two', start: 400, end: 800 }),
    word({ id: 'w3', text: 'three', start: 2000, end: 2400 }),
  ];

  it('finds the word under the playhead', () => {
    const found = activeWordAt(project({ words }), 500);
    expect(found.word?.id).toBe('w2');
    expect(found.wordIndex).toBe(1);
  });

  it('keeps the line up but highlights nothing in a gap inside it', () => {
    const spaced = [
      word({ id: 'a', text: 'one', start: 0, end: 200 }),
      word({ id: 'b', text: 'two', start: 300, end: 500 }),
    ];
    const found = activeWordAt(project({ words: spaced }), 250);
    expect(found.line?.index).toBe(0);
    expect(found.word).toBeNull();
    expect(found.wordIndex).toBe(-1);
  });

  it('shows nothing before the first word', () => {
    expect(activeWordAt(project({ words }), -1).line).toBeNull();
  });

  it('shows nothing once the last line has held its time out', () => {
    expect(activeWordAt(project({ words }), 2400 + LINE_HOLD_MS).line).toBeNull();
  });

  it('applies a positive offset, so the caption arrives later', () => {
    const shifted = project({ words, globalOffsetMs: 150 });
    expect(activeWordAt(shifted, 500).word?.id).toBe('w1');
    expect(activeWordAt(shifted, 550).word?.id).toBe('w2');
  });

  it('applies a negative offset, so the caption arrives earlier', () => {
    const shifted = project({ words, globalOffsetMs: -150 });
    expect(activeWordAt(shifted, 300).word?.id).toBe('w2');
  });

  it('leaves the returned times in the words own clock', () => {
    const shifted = project({ words, globalOffsetMs: 150 });
    expect(activeWordAt(shifted, 550).line?.startMs).toBe(0);
  });

  it('finds the second line', () => {
    expect(activeWordAt(project({ words }), 2100).word?.id).toBe('w3');
  });
});
