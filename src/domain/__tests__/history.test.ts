import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  HISTORY_LIMIT,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from '../history';
import { evenWords, project } from '../__fixtures__/project';

const base = project({ words: evenWords(['one', 'two', 'three']) });

/** A change that is a genuinely new project, as every editing function returns. */
function renamed(from: typeof base, text: string) {
  return { ...from, words: [{ ...from.words[0], text }, ...from.words.slice(1)] };
}

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createHistory(base);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe(base);
  });

  it('takes one step back and one step forward', () => {
    const edited = renamed(base, 'ONE');
    const history = commit(createHistory(base), edited, 'Edit');

    expect(history.present).toBe(edited);
    expect(canUndo(history)).toBe(true);

    const back = undo(history);
    expect(back.present).toBe(base);
    expect(canRedo(back)).toBe(true);

    expect(redo(back).present).toBe(edited);
  });

  it('walks back through several edits in order', () => {
    const first = renamed(base, 'a');
    const second = renamed(first, 'b');
    const history = commit(commit(createHistory(base), first, 'Edit'), second, 'Edit');

    const once = undo(history);
    expect(once.present).toBe(first);
    expect(undo(once).present).toBe(base);
  });

  it('does not record an action that changed nothing', () => {
    const history = commit(createHistory(base), base, 'Make normal');
    expect(canUndo(history)).toBe(false);
  });

  it('drops what was undone as soon as something else is edited', () => {
    const first = renamed(base, 'a');
    const other = renamed(base, 'z');

    const undone = undo(commit(createHistory(base), first, 'Edit'));
    const diverged = commit(undone, other, 'Edit');

    expect(canRedo(diverged)).toBe(false);
    expect(diverged.present).toBe(other);
    // The step back is still there: it is the future that was abandoned.
    expect(undo(diverged).present).toBe(base);
  });

  it('names what each control would do', () => {
    const history = commit(createHistory(base), renamed(base, 'a'), 'Edit word');
    expect(undoLabel(history)).toBe('Edit word');
    expect(redoLabel(history)).toBeNull();

    expect(redoLabel(undo(history))).toBe('Edit word');
  });

  it('has no label when there is nothing to undo', () => {
    expect(undoLabel(createHistory(base))).toBeNull();
  });

  it('keeps the cap and forgets the oldest step', () => {
    let history = createHistory(base);
    let current = base;

    for (let step = 0; step < HISTORY_LIMIT + 10; step += 1) {
      current = renamed(current, `step ${step}`);
      history = commit(history, current, `Edit ${step}`);
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0].label).toBe('Edit 10');
  });

  it('ignores undo at the beginning and redo at the end', () => {
    const history = createHistory(base);
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('returns to exactly the project it was given, not a copy of it', () => {
    // Word identity is what the transcript's scroll position and the emphasis
    // picks are keyed on, so an undo that rebuilt the words would be a different
    // project wearing the same text.
    const history = commit(createHistory(base), renamed(base, 'a'), 'Edit');
    expect(undo(history).present.words[1]).toBe(base.words[1]);
  });
});
