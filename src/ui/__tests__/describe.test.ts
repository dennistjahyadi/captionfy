import { evenWords, project } from '../../domain/__fixtures__/project';
import { describeProject, plural } from '../describe';

describe('plural', () => {
  it('says one word and two words', () => {
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(2, 'word')).toBe('2 words');
    expect(plural(0, 'word')).toBe('0 words');
  });

  it('takes an irregular plural when one is given', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
  });
});

describe('describeProject', () => {
  it('names a project by length, size and when it was made', () => {
    const described = describeProject(
      project({
        words: evenWords(['one']),
        durationMs: 53_000,
        createdAt: '2026-09-13T04:18:00.000Z',
      })
    );

    expect(described).toContain('0:53');
    expect(described).toContain('1 word');
    expect(described).toContain('Sep');
  });

  it('still says something about a project with an unreadable date', () => {
    const described = describeProject(project({ createdAt: 'not a date' }));
    expect(described).toContain('date unknown');
  });
});
