import { project, word } from '../__fixtures__/project';
import { divideInterval, MIN_WORD_MS, nudgeWord, setWordTiming, shiftAll } from '../timing';

const three = [
  word({ id: 'w1', text: 'one', start: 0, end: 500 }),
  word({ id: 'w2', text: 'two', start: 600, end: 1000 }),
  word({ id: 'w3', text: 'three', start: 1100, end: 1600 }),
];

const at = (words: ReturnType<typeof word>[], id: string) => words.find((w) => w.id === id)!;

describe('nudgeWord', () => {
  it('moves an edge by the step', () => {
    expect(at(nudgeWord(three, 'w2', 'start', -50), 'w2')).toMatchObject({ start: 550, end: 1000 });
    expect(at(nudgeWord(three, 'w2', 'end', 50), 'w2')).toMatchObject({ start: 600, end: 1050 });
  });

  it('stops the start handle at the previous word', () => {
    expect(at(nudgeWord(three, 'w2', 'start', -5000), 'w2').start).toBe(500);
  });

  it('stops the end handle at the next word', () => {
    expect(at(nudgeWord(three, 'w2', 'end', 5000), 'w2').end).toBe(1100);
  });

  it('stops the first word at zero', () => {
    expect(at(nudgeWord(three, 'w1', 'start', -5000), 'w1').start).toBe(0);
  });

  it('leaves the last word unbounded on its right', () => {
    expect(at(nudgeWord(three, 'w3', 'end', 10_000), 'w3').end).toBe(11_600);
  });

  it('never shrinks a word below the minimum duration', () => {
    const squeezed = at(nudgeWord(three, 'w2', 'start', 5000), 'w2');
    expect(squeezed.end - squeezed.start).toBe(MIN_WORD_MS);
    expect(squeezed.end).toBe(1000);
  });

  it('never lets one edge push the other', () => {
    const squeezed = at(nudgeWord(three, 'w2', 'end', -5000), 'w2');
    expect(squeezed.start).toBe(600);
    expect(squeezed.end).toBe(600 + MIN_WORD_MS);
  });

  it('moves the whole word without changing its duration', () => {
    const moved = at(nudgeWord(three, 'w2', 'both', 50), 'w2');
    expect(moved).toMatchObject({ start: 650, end: 1050 });
  });

  it('stops a moved word against either neighbour', () => {
    expect(at(nudgeWord(three, 'w2', 'both', -5000), 'w2')).toMatchObject({ start: 500, end: 900 });
    expect(at(nudgeWord(three, 'w2', 'both', 5000), 'w2')).toMatchObject({ start: 700, end: 1100 });
  });

  it('rounds a fractional step, because the domain is integer milliseconds', () => {
    expect(at(nudgeWord(three, 'w2', 'start', -16.7), 'w2').start).toBe(583);
  });

  it('ignores an unknown id', () => {
    expect(nudgeWord(three, 'nope', 'start', 50)).toBe(three);
  });

  it('leaves neighbours untouched', () => {
    const next = nudgeWord(three, 'w2', 'start', -5000);
    expect(next[0]).toBe(three[0]);
    expect(next[2]).toBe(three[2]);
  });
});

describe('setWordTiming', () => {
  it('clamps both edges into the gap', () => {
    expect(at(setWordTiming(three, 'w2', -100, 9000), 'w2')).toMatchObject({ start: 500, end: 1100 });
  });

  it('keeps a word inside a gap narrower than the minimum duration', () => {
    const tight = [
      word({ id: 'a', text: 'a', start: 0, end: 500 }),
      word({ id: 'b', text: 'b', start: 500, end: 530 }),
      word({ id: 'c', text: 'c', start: 530, end: 900 }),
    ];
    const next = at(setWordTiming(tight, 'b', 400, 900), 'b');
    expect(next).toMatchObject({ start: 500, end: 530 });
  });

  it('returns the same array when nothing moves', () => {
    expect(setWordTiming(three, 'w2', 600, 1000)).toBe(three);
  });
});

describe('shiftAll', () => {
  it('changes only the offset', () => {
    const before = project();
    const after = shiftAll(before, 150);
    expect(after.globalOffsetMs).toBe(150);
    expect(after.words).toBe(before.words);
  });

  it('accumulates', () => {
    expect(shiftAll(shiftAll(project(), 150), -50).globalOffsetMs).toBe(100);
  });

  it('never lets the first word start before zero', () => {
    const before = project({ words: [word({ id: 'w1', text: 'hi', start: 200, end: 600 })] });
    expect(shiftAll(before, -5000).globalOffsetMs).toBe(-200);
  });

  it('holds at zero when the first word starts at zero', () => {
    expect(shiftAll(project(), -5000).globalOffsetMs).toBe(0);
  });

  it('returns the same project when the offset does not move', () => {
    const before = project();
    expect(shiftAll(before, 0)).toBe(before);
  });
});

describe('divideInterval', () => {
  it('gives the whole span to a single piece', () => {
    expect(divideInterval(100, 400, [5])).toEqual([{ start: 100, end: 400 }]);
  });

  it('ends the last piece exactly on the original end', () => {
    const pieces = divideInterval(0, 1000, [1, 1, 1]);
    expect(pieces[pieces.length - 1].end).toBe(1000);
    expect(pieces.map((p) => p.end - p.start)).toEqual([333, 334, 333]);
  });

  it('leaves no gaps between pieces', () => {
    const pieces = divideInterval(17, 983, [4, 9, 2, 7]);
    pieces.slice(1).forEach((piece, index) => expect(piece.start).toBe(pieces[index].end));
  });

  it('stays in order when the span is shorter than the piece count', () => {
    const pieces = divideInterval(0, 2, [1, 1, 1, 1]);
    expect(pieces.every((piece) => piece.end >= piece.start)).toBe(true);
    expect(pieces[pieces.length - 1].end).toBe(2);
  });

  it('splits evenly when every weight is zero', () => {
    expect(divideInterval(0, 100, [0, 0])).toEqual([
      { start: 0, end: 50 },
      { start: 50, end: 100 },
    ]);
  });
});
