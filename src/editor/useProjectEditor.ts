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

  return {
    project: history.present,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel: undoLabel(history),
    redoLabel: redoLabel(history),
    edit,
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
