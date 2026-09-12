/**
 * The caption domain model.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Every time in here is an integer count of milliseconds from the start of the
 * source video. whisper.cpp reports centiseconds and video players deal in
 * seconds; both convert at their own boundary and nothing inside the domain ever
 * sees a fractional time.
 */
import type { StyleOverrides } from './style';

/** Integer milliseconds. */
export type Ms = number;

/**
 * Where a word's current text came from.
 *
 * `asr` is untouched engine output, `edited` is the user's own typing, and
 * `dictionary` is an automatic replacement. The distinction is load-bearing:
 * the dictionary never overwrites a word the user typed themselves, and only
 * `asr` words can be flagged as low confidence.
 */
export type WordOrigin = 'asr' | 'edited' | 'dictionary';

export interface Word {
  id: string;
  /** What is displayed and exported. */
  text: string;
  /** What the engine originally heard. Never mutated, so a correction can seed the dictionary. */
  asrText: string;
  start: Ms;
  end: Ms;
  /** Engine confidence, 0..1. Undefined when the engine gave no per-token probability. */
  conf?: number;
  origin: WordOrigin;
  /**
   * Manual line-break control. `line` forces a break after this word, `none`
   * forbids the automatic ones, `auto` (the default) leaves it to `segmentLines`.
   */
  breakAfter?: 'auto' | 'line' | 'none';
  /**
   * Set by the "Looks right" action. Clears the low-confidence mark without
   * touching `conf`, so the engine's own signal survives for later tuning.
   *
   * Not in the original spec. It is here because confirming a word and editing a
   * word have to clear the same flag, and editing clears it through `origin`.
   */
  confirmed?: boolean;
  /**
   * The user's own answer to "should this word be big".
   *
   * Undefined means they have not said, and the automatic rule decides. An
   * override is never overwritten by a recompute.
   */
  emphasis?: 'on' | 'off';
}

export type ProjectStatus = 'extracting' | 'transcribing' | 'ready' | 'exporting' | 'failed';

/**
 * A line the engine itself was unsure about, keyed by the word the line starts on.
 *
 * Keyed by word id rather than line index because line indices move every time a
 * word is split, merged or deleted, and a flag that moves is worse than no flag.
 */
export interface LineFlag {
  lineStartWordId: string;
  lowConfidence: boolean;
}

export interface Project {
  id: string;
  sourceUri: string;
  durationMs: Ms;
  createdAt: string;
  status: ProjectStatus;
  progress: { processedMs: Ms; totalMs: Ms };
  words: Word[];
  lineFlags: LineFlag[];
  /**
   * "Shift all captions", applied at render time rather than baked into the words.
   *
   * Keeping it separate is what lets the user walk the offset back and forth
   * without every pass accumulating rounding error into real word timings.
   */
  globalOffsetMs: Ms;
  /**
   * Words the automatic rule chose to emphasise, frozen once the transcript is
   * ready and only ever re-picked around an edit.
   *
   * Frozen because a user correcting a typo in the last line would otherwise
   * watch the big words move in the first line. Overrides are not in here; they
   * live on the word.
   */
  autoEmphasis: string[];
  styleId: string;
  styleOverrides: StyleOverrides;
  /**
   * RMS energy per 10 ms frame, computed once from the PCM that ASR decoded.
   *
   * One computation, two uses: the emphasis rule reads how loudly each word was
   * said, and the timing sheet draws its waveform from the same numbers.
   */
  energyEnvelopeUri?: string;
}

export interface DictionaryEntry {
  id: string;
  /** How the word should be written: "KitVerify". */
  spelling: string;
  /** How the engine mishears it: ["kit very by", "kit verify"]. Lowercase, may be multi-word. */
  heardAs: string[];
  createdAt: string;
}

/** Creates ids for words the domain has to invent. Injected so tests stay deterministic. */
export type IdFactory = () => string;
