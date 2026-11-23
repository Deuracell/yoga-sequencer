/** Edits to the program made on the current selection. */
import { commit, picked, pickedItems, select, ui } from "./state";

export const nudge = (delta: number) => commit(() => { ui.builder.adjustSpacing(picked(), delta); });
export const resetSpacing = () => commit(() => { ui.builder.resetSpacing(picked()); });

export function toggleBreak() {
  const items = pickedItems();
  commit(() => ui.builder.setBreak(picked(), !items.every((a) => a.brk))); // all broken already: clear them
}

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
