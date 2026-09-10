import { mergeTokensIntoWords, offsetWords, type TokenSegment } from '../words';

const token = (text: string, t0Ms: number, t1Ms: number): TokenSegment => ({ text, t0Ms, t1Ms });

describe('mergeTokensIntoWords', () => {
  it('returns nothing for no tokens', () => {
    expect(mergeTokensIntoWords([])).toEqual([]);
  });

  it('keeps space-prefixed tokens as separate words', () => {
    const words = mergeTokensIntoWords([token(' hello', 0, 300), token(' world', 320, 700)]);

    expect(words).toEqual([
      { text: 'hello', t0Ms: 0, t1Ms: 300 },
      { text: 'world', t0Ms: 320, t1Ms: 700 },
    ]);
  });

  it('joins sub-word tokens into one word spanning all of them', () => {
    const words = mergeTokensIntoWords([
      token(' recog', 100, 260),
      token('ni', 260, 380),
      token('tion', 380, 540),
    ]);

    expect(words).toEqual([{ text: 'recognition', t0Ms: 100, t1Ms: 540 }]);
  });

  it('attaches punctuation to the word before it', () => {
    const words = mergeTokensIntoWords([
      token(' okay', 0, 200),
      token(',', 200, 210),
      token(' so', 250, 400),
      token('.', 400, 410),
    ]);

    expect(words.map((word) => word.text)).toEqual(['okay,', 'so.']);
    expect(words[0].t1Ms).toBe(210);
  });

  it('drops whitespace-only tokens without breaking the word they sit inside', () => {
    const words = mergeTokensIntoWords([
      token(' under', 0, 200),
      token(' ', 200, 200),
      token('stand', 200, 400),
    ]);

    expect(words).toEqual([{ text: 'understand', t0Ms: 0, t1Ms: 400 }]);
  });

  it('opens a word when the first token has no leading space', () => {
    const words = mergeTokensIntoWords([token('Hello', 40, 300), token(' there', 300, 600)]);

    expect(words.map((word) => word.text)).toEqual(['Hello', 'there']);
  });

  it('never lets a word end before it starts', () => {
    const words = mergeTokensIntoWords([token(' glitch', 900, 850)]);

    expect(words).toEqual([{ text: 'glitch', t0Ms: 900, t1Ms: 900 }]);
  });

  it('keeps non-speech markers so hallucinations stay visible in the transcript', () => {
    const words = mergeTokensIntoWords([token(' [BLANK_AUDIO]', 0, 2000)]);

    expect(words.map((word) => word.text)).toEqual(['[BLANK_AUDIO]']);
  });

  it('does not mutate the tokens it was given', () => {
    const tokens = [token(' re', 0, 100), token('do', 100, 200)];
    mergeTokensIntoWords(tokens);

    expect(tokens).toEqual([token(' re', 0, 100), token('do', 100, 200)]);
  });
});

describe('offsetWords', () => {
  it('shifts every word onto the clip timeline', () => {
    const words = offsetWords([{ text: 'hi', t0Ms: 10, t1Ms: 200 }], 4500);

    expect(words).toEqual([{ text: 'hi', t0Ms: 4510, t1Ms: 4700 }]);
  });

  it('leaves the input untouched', () => {
    const original = [{ text: 'hi', t0Ms: 10, t1Ms: 200 }];
    offsetWords(original, 1000);

    expect(original).toEqual([{ text: 'hi', t0Ms: 10, t1Ms: 200 }]);
  });
});
