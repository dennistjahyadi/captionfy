import { ids, word } from '../__fixtures__/project';
import { MIN_WORD_MS } from '../timing';
import { appendWords, toWords } from '../transcript';

describe('toWords', () => {
  const asr = [
    { text: 'So', t0Ms: 0, t1Ms: 400, conf: 0.98 },
    { text: 'kitvery', t0Ms: 400.4, t1Ms: 999.6 },
  ];

  it('starts asrText equal to the text, so a correction can seed the dictionary', () => {
    expect(toWords(asr, ids()).map((w) => w.asrText)).toEqual(['So', 'kitvery']);
  });

  it('marks every word as untouched engine output', () => {
    expect(toWords(asr, ids()).every((w) => w.origin === 'asr')).toBe(true);
  });

  it('rounds to integer milliseconds at the boundary', () => {
    expect(toWords(asr, ids())[1]).toMatchObject({ start: 400, end: 1000 });
  });

  it('carries confidence through, and its absence too', () => {
    const words = toWords(asr, ids());
    expect(words[0].conf).toBe(0.98);
    expect(words[1].conf).toBeUndefined();
  });

  it('gives every word an id', () => {
    expect(toWords(asr, ids()).map((w) => w.id)).toEqual(['n1', 'n2']);
  });
});

describe('appendWords', () => {
  const existing = [word({ id: 'w1', text: 'one', start: 0, end: 600 })];

  it('appends a chunk that starts after the last word', () => {
    const incoming = [word({ id: 'w2', text: 'two', start: 700, end: 900 })];
    expect(appendWords(existing, incoming)).toEqual([...existing, ...incoming]);
  });

  it('closes an overlap at the seam between padded chunks', () => {
    const incoming = [word({ id: 'w2', text: 'two', start: 550, end: 900 })];
    const next = appendWords(existing, incoming);
    expect(next[0].end).toBe(550);
    expect(next[1]).toBe(incoming[0]);
  });

  it('never pulls the previous word below the minimum duration', () => {
    const incoming = [word({ id: 'w2', text: 'two', start: 10, end: 900 })];
    expect(appendWords(existing, incoming)[0].end).toBe(MIN_WORD_MS);
  });

  it('is a no-op for an empty chunk', () => {
    expect(appendWords(existing, [])).toBe(existing);
  });

  it('handles the first chunk of a project', () => {
    const incoming = [word({ id: 'w1', text: 'one', start: 0, end: 600 })];
    expect(appendWords([], incoming)).toBe(incoming);
  });
});
