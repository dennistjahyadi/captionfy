import { ids, project, word } from '../__fixtures__/project';
import {
  computeAutoEmphasis,
  EMPHASIS,
  emphasisedWordIds,
  EXCLUDED,
  isEmphasised,
  pickEmphasis,
  recomputeEmphasisLocal,
  scoreEmphasis,
  type EmphasisContext,
} from '../emphasis';
import { editWordText, mergeWords, setEmphasis, splitWord } from '../editing';
import type { FeatureSet, WordFeatures } from '../features';
import { projectUnits } from '../project';
import type { DictionaryEntry, Project, Word } from '../types';

/**
 * Features stated outright rather than derived from audio.
 *
 * Scoring is about the rules, not about the decoder. `features.test.ts` covers
 * the path from PCM to these numbers.
 */
function featureSet(
  entries: Record<string, Partial<WordFeatures>> = {},
  medianMsPerChar = 50
): FeatureSet {
  const byId = new Map<string, WordFeatures>();
  for (const [id, partial] of Object.entries(entries)) {
    byId.set(id, {
      loudnessDb: 0,
      msPerChar: medianMsPerChar,
      pauseBeforeMs: 0,
      pauseAfterMs: 0,
      ...partial,
    });
  }
  return { byId, speechMedian: 0.1, medianMsPerChar };
}

function context(
  entries: Record<string, Partial<WordFeatures>> = {},
  dictionary: DictionaryEntry[] = []
): EmphasisContext {
  return { features: featureSet(entries), dictionary };
}

const score = (words: Word[], ctx: EmphasisContext, id: string) =>
  scoreEmphasis(words, ctx.features, ctx.dictionary, ctx.options).get(id)!;

/** Words on a 400 ms grid, four to a display unit. */
function grid(texts: string[], step = 400): Word[] {
  return texts.map((text, index) =>
    word({ id: `w${index + 1}`, text, start: index * step, end: index * step + step })
  );
}

describe('hard exclusions', () => {
  it('never picks a stopword, however loud it was said', () => {
    const words = grid(['the', 'price']);
    const ctx = context({ w1: { loudnessDb: 24, pauseBeforeMs: 800, pauseAfterMs: 800 } });

    expect(score(words, ctx, 'w1')).toBe(EXCLUDED);
    expect(computeAutoEmphasis(project({ words }), ctx).autoEmphasis).not.toContain('w1');
  });

  it('bars fillers too, which are often the loudest thing in a clip', () => {
    const words = grid(['like', 'literally', 'just']);
    const ctx = context({
      w1: { loudnessDb: 20 },
      w2: { loudnessDb: 20 },
      w3: { loudnessDb: 20 },
    });
    expect(words.map((w) => score(words, ctx, w.id))).toEqual([EXCLUDED, EXCLUDED, EXCLUDED]);
  });

  it('never makes an unverified low-confidence word the loudest thing on screen', () => {
    const words = [
      word({ id: 'w1', text: 'Kitverify', start: 0, end: 600, conf: 0.2 }),
      word({ id: 'w2', text: 'works', start: 700, end: 1000 }),
    ];
    const ctx = context({ w1: { loudnessDb: 18, pauseAfterMs: 400 } });
    expect(score(words, ctx, 'w1')).toBe(EXCLUDED);
  });

  it('allows the same word once the user has confirmed it', () => {
    const words = [
      word({ id: 'w1', text: 'Kitverify', start: 0, end: 600, conf: 0.2, confirmed: true }),
      word({ id: 'w2', text: 'works', start: 700, end: 1000 }),
    ];
    const ctx = context({ w1: { loudnessDb: 18, pauseAfterMs: 400 } });
    expect(score(words, ctx, 'w1')).toBeGreaterThan(EMPHASIS.minScore);
    expect(computeAutoEmphasis(project({ words }), ctx).autoEmphasis).toEqual(['w1']);
  });
});

describe('signals', () => {
  const words = grid(['plain', 'plain', 'plain']);

  it('pays for loudness, capped so shouting cannot pick a winner on its own', () => {
    const ctx = context({ w1: { loudnessDb: 3 }, w2: { loudnessDb: 30 } });
    expect(score(words, ctx, 'w1')).toBeCloseTo(1);
    expect(score(words, ctx, 'w2')).toBeCloseTo(EMPHASIS.loudnessCap);
  });

  it('treats a quiet word as neutral rather than penalising it', () => {
    const ctx = context({ w1: { loudnessDb: -18 } });
    expect(score(words, ctx, 'w1')).toBe(0);
  });

  it('pays for a word held out', () => {
    const ctx = context({ w1: { msPerChar: 50 * EMPHASIS.heldRatio } });
    expect(score(words, ctx, 'w1')).toBeCloseTo(EMPHASIS.heldBonus);
  });

  it('pays more for the pause before a word than the pause after it', () => {
    const ctx = context({ w1: { pauseBeforeMs: 250 }, w2: { pauseAfterMs: 250 } });
    expect(score(words, ctx, 'w1')).toBeCloseTo(EMPHASIS.pauseBeforeBonus);
    expect(score(words, ctx, 'w2')).toBeCloseTo(EMPHASIS.pauseAfterBonus);
  });

  it('outscores a plain word for a number, written either way', () => {
    const numbers = grid(['plain', 'three', '$1,200', '40%']);
    const ctx = context();
    const plain = score(numbers, ctx, 'w1');
    expect(score(numbers, ctx, 'w2')).toBeGreaterThan(plain);
    expect(score(numbers, ctx, 'w3')).toBeGreaterThan(plain);
    expect(score(numbers, ctx, 'w4')).toBeGreaterThan(plain);
  });

  it('outscores a plain word for one the user spelled themselves', () => {
    const spelled = [
      word({ id: 'w1', text: 'platform', start: 0, end: 400 }),
      word({ id: 'w2', text: 'KitVerify', start: 400, end: 800, origin: 'dictionary' }),
      word({ id: 'w3', text: 'KitVerify', start: 800, end: 1200 }),
    ];
    const dict: DictionaryEntry[] = [
      { id: 'd1', spelling: 'KitVerify', heardAs: ['kit verify'], createdAt: '' },
    ];
    const ctx = context({}, dict);
    const plain = score(spelled, ctx, 'w1');
    // Both the replaced word and one the engine happened to get right. Each also
    // reads as a name, being capitalised mid-sentence.
    const expected = plain + EMPHASIS.dictionaryBonus + EMPHASIS.properNounBonus;
    expect(score(spelled, ctx, 'w2')).toBeCloseTo(expected);
    expect(score(spelled, ctx, 'w3')).toBeCloseTo(expected);
  });

  it('pays a little for a name, but not for the first word of a sentence', () => {
    const named = grid(['We', 'met', 'Thảo', 'yesterday.']);
    const ctx = context();
    expect(score(named, ctx, 'w1')).toBeLessThan(EMPHASIS.properNounBonus);
    expect(score(named, ctx, 'w3')).toBeCloseTo(EMPHASIS.properNounBonus);
  });

  it('pays for the word a sentence lands on', () => {
    const ending = grid(['runs', 'offline.']);
    expect(score(ending, context(), 'w2')).toBeCloseTo(EMPHASIS.clauseEndBonus);
  });

  it('penalises a very short word unless it is a figure', () => {
    const short = grid(['ox', 'up', 'to', '10']);
    const ctx = context();
    expect(score(short, ctx, 'w1')).toBeCloseTo(EMPHASIS.shortWordPenalty);
    expect(score(short, ctx, 'w4')).toBeCloseTo(EMPHASIS.numberBonus);
  });
});

describe('selection', () => {
  /** Two units of four, the second starting well past the gap threshold. */
  const words = [
    ...grid(['alpha', 'bravo', 'charlie', 'delta']),
    word({ id: 'w5', text: 'echo', start: 4000, end: 4400 }),
    word({ id: 'w6', text: 'foxtrot', start: 4400, end: 4800 }),
    word({ id: 'w7', text: 'golf', start: 4800, end: 5200 }),
    word({ id: 'w8', text: 'hotel', start: 5200, end: 5600 }),
  ];

  it('splits into the two units the test assumes', () => {
    expect(projectUnits(project({ words })).map((unit) => unit.words.length)).toEqual([4, 4]);
  });

  it('picks at most one word per display unit', () => {
    const ctx = context({
      w2: { loudnessDb: 30, pauseBeforeMs: 400 },
      w3: { loudnessDb: 30, pauseBeforeMs: 400 },
      w6: { loudnessDb: 30, pauseBeforeMs: 400 },
    });
    const picks = computeAutoEmphasis(project({ words }), ctx).autoEmphasis;
    expect(picks).toHaveLength(2);
    expect(picks.filter((id) => ['w2', 'w3'].includes(id))).toHaveLength(1);
  });

  it('picks nothing in a unit whose best candidate is too weak', () => {
    const ctx = context({ w6: { pauseBeforeMs: 400 } });
    // 0.5 for the pause is under the 1.2 minimum, so the unit stays uniform.
    expect(computeAutoEmphasis(project({ words }), ctx).autoEmphasis).toEqual([]);
  });

  it('keeps the higher score when two picks fall inside the spacing rule', () => {
    const tight = [
      ...grid(['alpha', 'bravo', 'charlie', 'delta']),
      word({ id: 'w5', text: 'echo', start: 1700, end: 2100 }),
      word({ id: 'w6', text: 'foxtrot', start: 2100, end: 2500 }),
    ];
    const ctx = context({
      w2: { loudnessDb: 9, pauseBeforeMs: 400 },
      w5: { loudnessDb: 30, pauseBeforeMs: 400, pauseAfterMs: 400 },
    });
    const picks = computeAutoEmphasis(project({ words: tight }), ctx).autoEmphasis;
    // 400 ms apart, so only one survives, and it is the stronger one.
    expect(picks).toEqual(['w5']);
  });

  it('enforces the spacing rule start to start', () => {
    expect(EMPHASIS.minGapMs).toBe(1500);
  });

  it('lets the opening unit through on a weaker candidate', () => {
    const ctx = context({ w2: { loudnessDb: 3, pauseBeforeMs: 400 }, w6: { loudnessDb: 3, pauseBeforeMs: 400 } });
    // Both score 1.5... so raise the bar until only the hook relaxation matters.
    const strict = { ...ctx, options: { minScore: 1.8 } };
    const picks = computeAutoEmphasis(project({ words }), strict).autoEmphasis;
    expect(picks).toEqual(['w2']);
  });

  it('does not relax the bar for a unit that starts after the opening window', () => {
    const late = [
      word({ id: 'w1', text: 'alpha', start: 9000, end: 9400 }),
      word({ id: 'w2', text: 'bravo', start: 9400, end: 9800 }),
    ];
    const ctx = {
      ...context({ w2: { loudnessDb: 3, pauseBeforeMs: 400 } }),
      options: { minScore: 1.8 },
    };
    expect(computeAutoEmphasis(project({ words: late }), ctx).autoEmphasis).toEqual([]);
  });

  it('is deterministic, ties going to the earlier word', () => {
    const ctx = context({
      w2: { loudnessDb: 12, pauseBeforeMs: 400 },
      w3: { loudnessDb: 12, pauseBeforeMs: 400 },
    });
    const once = computeAutoEmphasis(project({ words }), ctx).autoEmphasis;
    const twice = computeAutoEmphasis(project({ words }), ctx).autoEmphasis;
    expect(once).toEqual(twice);
    expect(once).toEqual(['w2']);
  });

  it('returns picks in transcript order', () => {
    const ctx = context({
      w3: { loudnessDb: 30, pauseBeforeMs: 400 },
      w6: { loudnessDb: 9, pauseBeforeMs: 400 },
    });
    const picks = pickEmphasis(
      project({ words }),
      scoreEmphasis(words, ctx.features, ctx.dictionary)
    );
    expect(picks).toEqual(['w3', 'w6']);
  });
});

describe('user overrides', () => {
  const base = [
    ...grid(['alpha', 'bravo', 'charlie', 'delta']),
    word({ id: 'w5', text: 'echo', start: 1600, end: 2000 }),
    word({ id: 'w6', text: 'foxtrot', start: 2000, end: 2400 }),
  ];

  it('emphasises an "on" word whatever the caps say', () => {
    const words = setEmphasis(setEmphasis(base, 'w1', 'on'), 'w2', 'on');
    const ready = project({ words });
    // 400 ms apart and in the same unit, which the automatic rule would forbid.
    expect(emphasisedWordIds(ready)).toEqual(new Set(['w1', 'w2']));
  });

  it('gives an "on" word its unit, so the rule does not add a second', () => {
    const words = setEmphasis(base, 'w1', 'on');
    const ctx = context({ w3: { loudnessDb: 30, pauseBeforeMs: 400 } });
    expect(computeAutoEmphasis(project({ words }), ctx).autoEmphasis).toEqual([]);
  });

  it('never picks an "off" word, however high it scores', () => {
    const words = setEmphasis(base, 'w2', 'off');
    const ctx = context({ w2: { loudnessDb: 30, pauseBeforeMs: 400, pauseAfterMs: 400 } });
    const ready = computeAutoEmphasis(project({ words }), ctx);
    expect(ready.autoEmphasis).not.toContain('w2');
    expect(emphasisedWordIds(ready).has('w2')).toBe(false);
  });

  it('lets "off" beat a pick the rule already made', () => {
    const ready = project({ words: setEmphasis(base, 'w2', 'off'), autoEmphasis: ['w2'] });
    expect(isEmphasised(ready, ready.words[1])).toBe(false);
  });

  it('hands the word back to the rule when the override is cleared', () => {
    const ready = project({ words: setEmphasis(base, 'w2', undefined), autoEmphasis: ['w2'] });
    expect(isEmphasised(ready, ready.words[1])).toBe(true);
  });

  it('survives a text edit', () => {
    const words = editWordText(setEmphasis(base, 'w2', 'on'), 'w2', 'Bravo', ids());
    expect(words[1].emphasis).toBe('on');
  });
});

describe('split and merge inheritance', () => {
  const base = grid(['alpha', 'kitverify', 'charlie']);

  it('gives both halves of a split the same override', () => {
    const next = splitWord(setEmphasis(base, 'w2', 'on'), 'w2', 3, ids());
    expect(next.map((w) => w.emphasis)).toEqual([undefined, 'on', 'on', undefined]);
  });

  it('keeps "on" through a merge if any piece had it', () => {
    const next = mergeWords(setEmphasis(base, 'w2', 'on'), ['w1', 'w2']);
    expect(next[0].emphasis).toBe('on');
  });

  it('keeps "off" through a merge only when every piece had it', () => {
    const allOff = setEmphasis(setEmphasis(base, 'w1', 'off'), 'w2', 'off');
    expect(mergeWords(allOff, ['w1', 'w2'])[0].emphasis).toBe('off');
  });

  it('hands a mixed merge back to the rule', () => {
    const mixed = setEmphasis(base, 'w1', 'off');
    expect(mergeWords(mixed, ['w1', 'w2'])[0].emphasis).toBeUndefined();
  });
});

describe('stability', () => {
  /** Six units of three words, 1.2 s each, far enough apart to each hold a pick. */
  const words = Array.from({ length: 18 }, (_, index) =>
    word({
      id: `w${index + 1}`,
      text: index % 3 === 1 ? `subject${index}` : `filler${index}`,
      start: index * 400,
      end: index * 400 + 400,
    })
  );

  const ctx = context(
    Object.fromEntries(
      words.map((w, index) => [w.id, index % 3 === 1 ? { loudnessDb: 30, pauseBeforeMs: 400 } : {}])
    )
  );

  const ready: Project = computeAutoEmphasis(project({ words }), ctx);

  it('picks one word in most units to begin with', () => {
    expect(ready.autoEmphasis.length).toBeGreaterThan(2);
  });

  it('leaves every unit outside the edit alone', () => {
    const units = projectUnits(ready);
    // Unit 4 of six, comfortably away from both ends.
    const edited = units[4].words[0];
    const changed: Project = {
      ...ready,
      words: editWordText(ready.words, edited.id, 'Rewritten', ids()),
    };
    const after = recomputeEmphasisLocal(changed, [edited.id], ctx);

    const picksPerUnit = (p: Project) =>
      projectUnits(p).map((unit) =>
        unit.words.filter((w) => p.autoEmphasis.includes(w.id)).map((w) => w.id)
      );

    const before = picksPerUnit(ready);
    const now = picksPerUnit(after);
    expect(now).toHaveLength(before.length);

    before.forEach((picks, index) => {
      if (index >= 3 && index <= 5) return;
      expect(now[index]).toEqual(picks);
    });
  });

  it('drops the pick a deleted word took with it', () => {
    const picked = ready.autoEmphasis[0];
    const changed: Project = {
      ...ready,
      words: ready.words.filter((w) => w.id !== picked),
    };
    const after = recomputeEmphasisLocal(changed, [picked], ctx);
    expect(after.autoEmphasis).not.toContain(picked);
  });

  it('leaves the project untouched when the edit reaches no unit', () => {
    expect(recomputeEmphasisLocal(ready, ['nothing-like-this'], ctx)).toBe(ready);
  });

  it('holds the spacing rule across the edge of the window', () => {
    const after = recomputeEmphasisLocal(ready, [ready.words[12].id], ctx);
    const starts = after.autoEmphasis
      .map((id) => after.words.find((w) => w.id === id)!.start)
      .sort((a, b) => a - b);
    starts.slice(1).forEach((start, index) => {
      expect(start - starts[index]).toBeGreaterThanOrEqual(EMPHASIS.minGapMs);
    });
  });
});
