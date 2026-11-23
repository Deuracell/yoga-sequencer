/** Undo and redo stacks of program snapshots. */
const LIMIT = 200;

export class History<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  constructor(private readonly limit = LIMIT) {}

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** A change was made: `before` is how things were. Anything that could be redone is gone. */
  record(before: T) {
    this.undoStack.push(before);
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit);
    this.redoStack = [];
  }

  /** The snapshot to go back to, or null; `current` becomes redoable. */
  undo(current: T): T | null {
    const back = this.undoStack.pop();
    if (back === undefined) return null;
    this.redoStack.push(current);
    return back;
  }

  redo(current: T): T | null {
    const forward = this.redoStack.pop();
    if (forward === undefined) return null;
    this.undoStack.push(current);
    return forward;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
