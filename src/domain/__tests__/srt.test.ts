import { displayUnits } from '../lines';
import { srtTime, toSrt } from '../srt';
import { evenWords, word } from '../__fixtures__/project';

const style = { maxWordsPerLine: 4 };

describe('srtTime', () => {
  it('is always hours, minutes, seconds and three milliseconds', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(1234)).toBe('00:00:01,234');
    expect(srtTime(61_050)).toBe('00:01:01,050');
    expect(srtTime(3_723_004)).toBe('01:02:03,004');
  });

  it('reads zero rather than a negative time', () => {
    expect(srtTime(-400)).toBe('00:00:00,000');
  });
});

describe('toSrt', () => {
  const lines = displayUnits(evenWords(['So', 'today', 'I', 'tried', 'KitVerify']), style);

  it('numbers the cues from one and separates them with a blank line', () => {
    const srt = toSrt(lines);

    expect(srt).toContain('1\n00:00:00,000 --> ');
    expect(srt.split('\n\n')).toHaveLength(lines.length);
    expect(srt.startsWith('1\n')).toBe(true);
  });

  it('says what the viewer sees, one cue per line on screen', () => {
    expect(toSrt(lines)).toContain('So today I tried');
  });

  it('holds a cue until its line leaves the screen', () => {
    const held = displayUnits([word({ id: 'w1', text: 'Hi', start: 0, end: 400 })], style);

    // The last line of a clip holds for `LINE_HOLD_MS` rather than vanishing on
    // its final word, and the file has to say the same.
    expect(toSrt(held)).toContain('00:00:00,000 --> 00:00:01,000');
  });

  it('moves with the caption offset, because the video does not', () => {
    expect(toSrt(lines, 500)).toContain('00:00:00,500 --> ');
  });

  it('never starts a cue before the video does', () => {
    expect(toSrt(lines, -5000)).toContain('1\n00:00:00,000 --> ');
  });

  it('uppercases when the style does, so the file matches the burn-in', () => {
    expect(toSrt(lines, 0, { uppercase: true })).toContain('SO TODAY I TRIED');
  });

  it('has nothing to say about a transcript with no words', () => {
    expect(toSrt([])).toBe('');
  });

  it('never writes a cue that ends before it starts', () => {
    const odd = [
      { index: 0, words: [word({ id: 'w1', text: 'Hi', start: 400, end: 500 })], startMs: 400, endMs: 500, visibleUntilMs: 300 },
    ];

    expect(toSrt(odd)).toContain('00:00:00,400 --> 00:00:00,401');
  });
});
