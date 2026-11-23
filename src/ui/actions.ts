/** Edits to the program made on the current selection. */
import { commit, picked, pickedItems, select, ui } from "./state";

export const nudge = (delta: number) => commit(() => { ui.builder.adjustSpacing(picked(), delta); });
export const resetSpacing = () => commit(() => { ui.builder.resetSpacing(picked()); });

export function toggleBreak() {
  const items = pickedItems();
  commit(() => ui.builder.setBreak(picked(), !items.every((a) => a.brk))); // all broken already: clear them
}

/** Shift+Enter: a new row *before* the selection, which is a break after the shape in front of it. */
export function toggleBreakBefore() {
  const targets = picked().filter((i) => i > 0).map((i) => i - 1);
  if (!targets.length) return;
  const all = targets.every((i) => ui.builder.chosen[i].breakAfter);
  commit(() => ui.builder.setBreak(targets, !all)); // all broken already: clear them
}

/** Remove the forced break after one shape (from the marker at the end of its row). */
export const removeBreakAfter = (index: number) => commit(() => ui.builder.setBreak([index], false));

export function removeSelected() {
  const indices = picked();
  if (!indices.length) return;
  const left = ui.builder.chosen.length - indices.length;
  select(left ? Math.min(indices[0], left - 1) : null); // select the neighbour that takes its place
  commit(() => ui.builder.removeMany(indices));
}

export function moveSelected(step: number) {
  const from = ui.selected;
  const to = from === null ? -1 : from + step;
  if (from === null || to < 0 || to >= ui.builder.chosen.length) return;
  select(to);
  commit(() => ui.builder.move(from, to));
}

export const undo = () => commit(() => { ui.builder.undo(); });
export const redo = () => commit(() => { ui.builder.redo(); });
