/**
 * Undo and redo.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 *
 * Snapshots, not inverse operations. Every edit in this app produces a whole new
 * `Project` from the old one and shares the words it did not touch, so keeping
 * the old value costs a handful of pointers and is impossible to get wrong. An
 * inverse for merge, for a split that renumbered ids, and for an emphasis
 * recompute that moved a pick two lines away is three chances to restore
 * something subtly different from what was there.
 *
 * The depth is capped because a project is the user's work, not a version
 * control system, and an unbounded stack on a phone is a slow leak.
 */
import type { Project } from './types';

/** Undo steps kept. The oldest is dropped when the cap is reached. */
export const HISTORY_LIMIT = 100;

export interface Revision {
  /** What the action was, for the label on the undo control. */
  label: string;
  project: Project;
}

export interface History {
  past: Revision[];
  present: Project;
  /** Newest first, so redo takes the head. */
  future: Revision[];
}

export function createHistory(project: Project): History {
  return { past: [], present: project, future: [] };
}

/**
 * Records a change as one undoable step.
 *
 * An action that produced the same project it was given is not a step. Tapping
 * "Make normal" on a word that is already normal must not cost the user the undo
 * they were about to use.
 */
export function commit(history: History, next: Project, label: string): History {
  if (next === history.present) return history;

  const past = [...history.past, { label, project: history.present }];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    // Editing after an undo abandons what was undone. Keeping it would let the
    // user redo their way into a project that never existed.
    future: [],
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** What undoing would take back, for the control's accessibility label. */
export function undoLabel(history: History): string | null {
  return history.past[history.past.length - 1]?.label ?? null;
}

export function redoLabel(history: History): string | null {
  return history.future[0]?.label ?? null;
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;

  return {
    past: history.past.slice(0, -1),
    present: previous.project,
    future: [{ label: previous.label, project: history.present }, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;

  return {
    past: [...history.past, { label: next.label, project: history.present }],
    present: next.project,
    future: rest,
  };
}
