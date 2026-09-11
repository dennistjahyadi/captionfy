/**
 * Which word gets to be big.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * The apps winning on TikTok right now do not render uniform subtitles. One word
 * per line is large and set apart and the filler around it stays small, which is
 * what makes a caption read as edited rather than transcribed. They pick that
 * word with a language model in a data centre. We pick it from how the speaker
 * actually said it, on the phone, with no network: how loud, how held, what
 * pause came before it.
 *
 * Emphasis is data. Nothing here decides how it looks; each style does that.
 */
import { isLowConfidence, LOW_CONFIDENCE_THRESHOLD } from './confidence';
import type { FeatureSet } from './features';
import { letterCount } from './features';
import type { CaptionLine } from './lines';
import { isNumeric } from './numbers';
import { projectUnits } from './project';
import { isStopword } from './stopwords';
import { endsSentence, normalizeForMatch, splitAffixes } from './text';
import type { DictionaryEntry, Project, Word } from './types';

/**
 * Every weight and threshold the picker uses.
 *
 * Starting values chosen by argument, not measurement. They are all in one
 * object so a tuning pass against real clips is one diff.
 */
export const EMPHASIS = {
  /** Decibels above the speech median that earn one point. */
  loudnessDbPerPoint: 3,
  /** Most a loud word can earn. Shouting the whole line should not pick a winner. */
  loudnessCap: 2,
  /** How much slower than the clip's median a word must be to count as held. */
  heldRatio: 1.5,
  heldBonus: 0.8,
  /** A silence this long reads as the speaker setting the next word up. */
  pauseMs: 250,
  pauseBeforeBonus: 0.5,
  pauseAfterBonus: 0.3,
  /** Prices, counts and percentages are what a viewer stops scrolling for. */
  numberBonus: 1,
  /** A word the user cared enough about to spell themselves. */
  dictionaryBonus: 1,
  /** Capitalised mid-sentence: probably a name or a brand. */
  properNounBonus: 0.4,
  /** The word a sentence lands on. */
  clauseEndBonus: 0.3,
  shortWordLetters: 3,
  shortWordPenalty: -1,
  /** Below this, a display unit simply gets no emphasis. Uniform beats wrong. */
  minScore: 1.2,
  /** The opening of a clip is what decides whether it is watched at all. */
  hookWindowMs: 3000,
  /** How much the minimum relaxes for that opening unit. */
  hookRelaxation: 0.4,
  /** Start-to-start spacing between automatic picks. */
  minGapMs: 1500,
  /** Automatic picks per display unit. */
  maxPerUnit: 1,
  /** Words the engine was unsure of are never made the loudest thing on screen. */
  confidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
};

export type EmphasisOptions = typeof EMPHASIS;

/**
 * What scoring needs beyond the project itself.
 *
 * The envelope is not in the project (only its file path is), so it is handed in.
 * This is also what makes every function here pure and testable without audio.
 */
export interface EmphasisContext {
  features: FeatureSet;
  dictionary: DictionaryEntry[];
  options?: Partial<EmphasisOptions>;
}

/** A word excluded outright scores this, so it can never win any comparison. */
export const EXCLUDED = Number.NEGATIVE_INFINITY;

/**
 * How strongly each word argues to be the big one.
 *
 * Loudness below the median contributes nothing rather than counting against the
 * word: a quiet delivery is a style, not a reason to rule a word out, and the
 * stopword list already handles the words that genuinely never qualify.
 */
export function scoreEmphasis(
  words: Word[],
  features: FeatureSet,
  dict: DictionaryEntry[],
  opts: Partial<EmphasisOptions> = {}
): Map<string, number> {
  const config = { ...EMPHASIS, ...opts };
  const spellings = new Set(
    dict.map((entry) => normalizeForMatch(entry.spelling)).filter((spelling) => spelling !== '')
  );
  const scores = new Map<string, number>();

  words.forEach((word, index) => {
    const normalized = normalizeForMatch(word.text);

    if (isStopword(normalized) || isLowConfidence(word, config.confidenceThreshold)) {
      scores.set(word.id, EXCLUDED);
      return;
    }

    const feature = features.byId.get(word.id);
    let score = 0;

    if (feature) {
      if (feature.loudnessDb > 0) {
        score += Math.min(config.loudnessCap, feature.loudnessDb / config.loudnessDbPerPoint);
      }
      if (
        features.medianMsPerChar > 0 &&
        feature.msPerChar >= features.medianMsPerChar * config.heldRatio
      ) {
        score += config.heldBonus;
      }
      if (feature.pauseBeforeMs >= config.pauseMs) score += config.pauseBeforeBonus;
      if (feature.pauseAfterMs >= config.pauseMs) score += config.pauseAfterBonus;
    }

    const numeric = isNumeric(word.text);
    if (numeric) score += config.numberBonus;
    if (word.origin === 'dictionary' || spellings.has(normalized)) score += config.dictionaryBonus;
    if (isProperNoun(words, index)) score += config.properNounBonus;
    if (endsSentence(word.text)) score += config.clauseEndBonus;
    if (!numeric && letterCount(word.text) < config.shortWordLetters) {
      score += config.shortWordPenalty;
    }

    scores.set(word.id, score);
  });

  return scores;
}

/** Capitalised, and not merely the first word of a sentence. */
function isProperNoun(words: Word[], index: number): boolean {
  if (index === 0) return false;
  if (endsSentence(words[index - 1].text)) return false;
  const body = splitAffixes(words[index].text).body;
  return body !== '' && /^\p{Lu}/u.test(body);
}

/**
 * The words the automatic rule chooses, in transcript order.
 *
 * Overrides are not in the result. `autoEmphasis` records only what the rule
 * decided, so a user can clear an override and get the automatic answer back.
 */
export function pickEmphasis(
  project: Project,
  scores: Map<string, number>,
  opts: Partial<EmphasisOptions> = {}
): string[] {
  const config = { ...EMPHASIS, ...opts };
  const units = projectUnits(project);
  return select(
    units,
    scores,
    config,
    units.map((unit) => unit.index),
    []
  );
}

/** The first pass, run once when a transcript becomes ready. */
export function computeAutoEmphasis(project: Project, context: EmphasisContext): Project {
  const scores = scoreEmphasis(project.words, context.features, context.dictionary, context.options);
  return { ...project, autoEmphasis: pickEmphasis(project, scores, context.options) };
}

/**
 * Re-picks around an edit and nowhere else.
 *
 * A user fixing a typo in the last line must not watch the emphasis jump around
 * in the first line. Only the display unit the edit landed in, plus one either
 * side, is reconsidered; every other pick is left exactly as it was. Picks just
 * outside the window still block a new one inside it, so the spacing rule holds
 * across the seam.
 */
export function recomputeEmphasisLocal(
  project: Project,
  changedWordIds: string[],
  context: EmphasisContext
): Project {
  const units = projectUnits(project);
  const alive = new Set(project.words.map((word) => word.id));
  // A word that was merged or deleted takes its pick with it.
  const surviving = project.autoEmphasis.filter((id) => alive.has(id));

  const changed = new Set(changedWordIds);
  const touched = units
    .filter((unit) => unit.words.some((word) => changed.has(word.id)))
    .map((unit) => unit.index);

  if (touched.length === 0) {
    return surviving.length === project.autoEmphasis.length
      ? project
      : { ...project, autoEmphasis: surviving };
  }

  const from = Math.max(0, Math.min(...touched) - 1);
  const to = Math.min(units.length - 1, Math.max(...touched) + 1);
  const window: number[] = [];
  for (let index = from; index <= to; index += 1) window.push(index);

  const inWindow = new Set(
    units.slice(from, to + 1).flatMap((unit) => unit.words.map((word) => word.id))
  );
  const kept = surviving.filter((id) => !inWindow.has(id));

  const scores = scoreEmphasis(project.words, context.features, context.dictionary, context.options);
  const config = { ...EMPHASIS, ...context.options };
  const fixed = kept
    .map((id) => project.words.find((word) => word.id === id))
    .filter((word): word is Word => word !== undefined);

  const picked = select(units, scores, config, window, fixed);
  const chosen = new Set([...kept, ...picked]);

  return { ...project, autoEmphasis: project.words.filter((w) => chosen.has(w.id)).map((w) => w.id) };
}

/**
 * One pick per unit, spaced out, best score wins a clash.
 *
 * `unitIndices` is what may be reconsidered and `fixed` is what already stands
 * outside it. Running the whole clip is the same call with every index and
 * nothing fixed, so the first pass and a local re-pick cannot drift apart.
 */
function select(
  units: CaptionLine[],
  scores: Map<string, number>,
  config: EmphasisOptions,
  unitIndices: number[],
  fixed: Word[]
): string[] {
  // The opening unit is allowed a weaker candidate. The first seconds of a clip
  // decide whether the rest is watched.
  const hookIndex = units.findIndex((unit) => unit.startMs <= config.hookWindowMs);

  const candidates: Word[] = [];

  for (const index of unitIndices) {
    const unit = units[index];
    if (!unit) continue;
    // An explicit "make big" already owns this unit's one slot.
    if (unit.words.some((word) => word.emphasis === 'on')) continue;

    const best = bestIn(unit.words, scores);
    if (!best) continue;

    const minimum =
      index === hookIndex ? config.minScore - config.hookRelaxation : config.minScore;
    if ((scores.get(best.id) ?? EXCLUDED) < minimum) continue;

    candidates.push(best);
  }

  // Highest score first so a clash is resolved by keeping the better word;
  // an earlier start breaks a tie, which is what makes the result deterministic.
  const ordered = [...candidates].sort(
    (a, b) => (scores.get(b.id) ?? EXCLUDED) - (scores.get(a.id) ?? EXCLUDED) || a.start - b.start
  );

  const accepted: Word[] = [...fixed];
  const picked: Word[] = [];

  for (const candidate of ordered) {
    const clashes = accepted.some(
      (other) => Math.abs(other.start - candidate.start) < config.minGapMs
    );
    if (clashes) continue;
    accepted.push(candidate);
    picked.push(candidate);
  }

  return picked.sort((a, b) => a.start - b.start).map((word) => word.id);
}

function bestIn(words: Word[], scores: Map<string, number>): Word | null {
  let best: Word | null = null;

  for (const word of words) {
    if (word.emphasis === 'off') continue;
    const score = scores.get(word.id) ?? EXCLUDED;
    if (score === EXCLUDED) continue;
    const bestScore = best ? (scores.get(best.id) ?? EXCLUDED) : EXCLUDED;
    // Ties go to the earlier word, and `words` is already in transcript order.
    if (best === null || score > bestScore) best = word;
  }

  return best;
}

/** `on` and `off` win; otherwise the automatic pick decides. */
export function isEmphasised(project: Project, word: Word): boolean {
  if (word.emphasis === 'on') return true;
  if (word.emphasis === 'off') return false;
  return project.autoEmphasis.includes(word.id);
}

/** Every word that renders big, overrides folded in. The layout reads this. */
export function emphasisedWordIds(project: Project): Set<string> {
  const auto = new Set(project.autoEmphasis);
  const ids = new Set<string>();

  for (const word of project.words) {
    if (word.emphasis === 'on' || (word.emphasis === undefined && auto.has(word.id))) {
      ids.add(word.id);
    }
  }

  return ids;
}
