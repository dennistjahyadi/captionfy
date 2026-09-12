import { formatClock, formatPrecise } from '../time';

describe('formatClock', () => {
  it('pads the seconds and counts minutes', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9_400)).toBe('0:09');
    expect(formatClock(63_000)).toBe('1:03');
    expect(formatClock(600_000)).toBe('10:00');
  });

  it('never shows a second that has not started', () => {
    expect(formatClock(1_999)).toBe('0:01');
  });

  it('reads zero rather than a negative time', () => {
    expect(formatClock(-500)).toBe('0:00');
  });
});

describe('formatPrecise', () => {
  it('carries hundredths, which is where a timing mistake shows', () => {
    expect(formatPrecise(12_400)).toBe('0:12.40');
    expect(formatPrecise(13_050)).toBe('0:13.05');
    expect(formatPrecise(0)).toBe('0:00.00');
  });
});
