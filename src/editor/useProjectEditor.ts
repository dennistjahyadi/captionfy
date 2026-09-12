/**
 * The one way a project changes.
 *
 * Every edit goes through `edit`, which is what makes undo, the local emphasis
 * recompute and the save policy three lines of this file instead of three things
 * every screen has to remember. The domain functions it is handed are pure; this
 * is where their results become the project on disk.
 *
 * Writes are debounced because a text field produces an edit per keystroke, and
 * flushed when the app leaves the foreground or the screen unmounts, so the
 * worst a kill can cost is half a second of typing (invariant 3).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  recomputeEmphasisLocal,
  redo,
  redoLabel,
  timingDrift,
  timingSpill,
  undo,
  undoLabel,
  wordFeatures,
  type DictionaryEntry,
  type Project,
  type Word,
} from '../domain';
import { loadEnvelope, saveProject } from '../project/store';

/** How long after the last edit the project is written. */
export const SAVE_DEBOUNCE_MS = 500;

export interface ProjectEditor {
  project: Project;
  canUndo: boolean;
  canRedo: boolean;
  /** What the controls would take back, for their accessibility labels. */
  undoLabel: string | null;
  redoLabel: string | null;
  /**
   * One undoable step.
   *
   * `touched` is the words the action was aimed at. Emphasis is re-picked in
   * their display unit and one either side, and nowhere else, so correcting a
   * typo in the last line cannot move the big word in the first.
   */
  edit(label: string, change: (words: Word[]) => Word[], touched: string[]): void;
  /**
   * One undoable step that is allowed to move time.
   *
   * `moving` is the words whose start and end may change. Everything else about
   * every word, including the text of the ones that moved, has to come out the
   * other side untouched.
   */
  editTiming(label: string, change: (words: Word[]) => Word[], moving: string[]): void;
  /**
   * One undoable step against the project rather than its words.
   *
   * Shift-all is the only caller: the offset is a property of the project, which
   * is exactly what lets it be walked back and forth without rounding error
   * settling into real word timings.
   */
  editProject(label: string, change: (project: Project) => Project): void;
  /**
   * Changes how the captions look, everywhere in the timeline at once.
   *
   * Not an undo step, and applied to every snapshot undo could return to: a
   * style is a property of the project rather than a thing that happened to it,
   * and undoing a word edit that also changed the look back to the preset the
   * user had abandoned would be the app arguing with them.
   */
  restyle(change: (project: Project) => Project): void;
  /** The clip's energy envelope, read once, for the timing sheet's waveform. */
  envelope(): Float32Array | null;
  undo(): void;
  redo(): void;
}

export function useProjectEditor(
  initial: Project,
  dictionary: DictionaryEntry[] = []
): ProjectEditor {
  const [history, setHistory] = useState(() => createHistory(initial));

  // The updater needs the current value without the callbacks depending on it,
  // or every edit would rebuild the sheet that called it.
  const latest = useRef(history);
  latest.current = history;

  const envelope = useEnvelope(initial.id);
  const save = useDebouncedSave();

  const replace = useCallback(
    (next: typeof history, immediate: boolean) => {
      setHistory(next);
      save(next.present, immediate);
    },
    [save]
  );

  const edit = useCallback<ProjectEditor['edit']>(
    (label, change, touched) => {
      const current = latest.current;
      const words = change(current.present.words);
      // A no-op action is not an undo step, and not a write either.
      if (words === current.present.words) return;

      // Invariant 1, checked here on the real transcript rather than only in a
      // test on a fixture. Every action that reaches this function is a text
      // action, and no text action may move a word in time. A failure is a bug
      // in the domain, so it says so and refuses to write it to disk.
      const drift = timingDrift(current.present.words, words);
      if (drift) {
        Alert.alert('That edit moved the timing', `${label}: ${drift}. The edit was not applied.`);
        return;
      }

      const edited: Project = { ...current.present, words };
      replace(commit(current, withLocalEmphasis(edited, touched, dictionary, envelope()), label), false);
    },
    [dictionary, envelope, replace]
  );

  const editTiming = useCallback<ProjectEditor['editTiming']>(
    (label, change, moving) => {
      const current = latest.current;
      const words = change(current.present.words);
      if (words === current.present.words) return;

      // The mirror of the check in `edit`, for the one kind of action that may
      // move time. What is proved here is that it moved only what it named: no
      // other word shifted, no text came through this path, and no caption was
      // left running into its neighbour.
      const spill = timingSpill(current.present.words, words, moving);
      if (spill) {
        Alert.alert('That timing change reached too far', `${label}: ${spill}. It was not applied.`);
        return;
      }

      // Emphasis is not re-picked. A word said loudly is said loudly whatever its
      // boundaries are, and a recompute here would move a big word two lines away
      // while the user was listening to a handle.
      replace(commit(current, { ...current.present, words }, label), false);
    },
    [replace]
  );

  const editProject = useCallback<ProjectEditor['editProject']>(
    (label, change) => {
      const current = latest.current;
      const next = change(current.present);
      if (next === current.present) return;

      // Nothing that goes through this path has any business touching a word.
      // Shift-all moving a single word time would be invariant 1 broken by the
      // one action in the app that never needs to.
      if (next.words !== current.present.words) {
        Alert.alert('That change touched the words', `${label} moves the offset only. It was not applied.`);
        return;
      }

      replace(commit(current, next, label), false);
    },
    [replace]
  );

  const restyle = useCallback<ProjectEditor['restyle']>(
    (change) => {
      const current = latest.current;
      const present = change(current.present);
      if (present === current.present) return;

      setHistory({
        past: current.past.map((step) => ({ ...step, project: change(step.project) })),
        present,
        future: current.future.map((step) => ({ ...step, project: change(step.project) })),
      });
      // Written at once rather than debounced: a style change is one deliberate
      // tap, not a stream of keystrokes.
      save(present, true);
    },
    [save]
  );

  return {
    project: history.present,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel: undoLabel(history),
    redoLabel: redoLabel(history),
    edit,
    editTiming,
    editProject,
    restyle,
    envelope,
    // Undo and redo are deliberate, so they are written at once rather than
    // debounced behind whatever the user does next.
    undo: useCallback(() => replace(undo(latest.current), true), [replace]),
    redo: useCallback(() => replace(redo(latest.current), true), [replace]),
  };
}

/**
 * Re-picks emphasis around an edit.
 *
 * Without an envelope there is nothing to read loudness from, so the picks are
 * left exactly as they were. A project transcribed before the envelope existed
 * keeps its emphasis rather than losing it to a silent recompute.
 */
function withLocalEmphasis(
  project: Project,
  touched: string[],
  dictionary: DictionaryEntry[],
  envelope: Float32Array | null
): Project {
  if (!envelope) return project;

  return recomputeEmphasisLocal(project, touched, {
    features: wordFeatures(envelope, project.words),
    dictionary,
  });
}

/** Reads `envelope.f32` once, on the first edit that needs it. */
function useEnvelope(projectId: string): () => Float32Array | null {
  const cached = useRef<Float32Array | null | undefined>(undefined);

  useEffect(() => {
    cached.current = undefined;
  }, [projectId]);

  return useCallback(() => {
    if (cached.current === undefined) cached.current = loadEnvelope(projectId);
    return cached.current;
  }, [projectId]);
}

function useDebouncedSave(): (project: Project, immediate: boolean) => void {
  const pending = useRef<Project | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const project = pending.current;
    pending.current = null;
    if (project) saveProject(project);
  }, []);

  useEffect(() => {
    // Leaving the app is the one moment a debounce cannot be allowed to lose,
    // because the process may not be there when the timer fires.
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') flush();
    });

    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return useCallback(
    (project, immediate) => {
      pending.current = project;
      if (immediate) {
        flush();
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );
}
