/** What the interface shares: the program, the selection, the page shown, and change notification. */
import { ProgramBuilder } from "../core/program";
import { emptyLayout, type LayoutInfo } from "./layoutInfo";

export interface Ui {
  builder: ProgramBuilder;
  page: number;
  selected: number | null; // the shape the buttons hang on (the one clicked last)
  picks: Set<number>; // every selected shape
  svg: SVGSVGElement | null; // the page currently shown
  layout: LayoutInfo;
  customLibrary: boolean;
}

export const ui = {
  page: 0, selected: null, picks: new Set<number>(), svg: null, layout: emptyLayout(), customLibrary: false,
} as Ui;

type Listener = () => void;
const changeListeners: Listener[] = [];
const selectionListeners: Listener[] = [];

/** `render` runs after every change to the program or page setup. */
export const onChange = (fn: Listener) => { changeListeners.push(fn); };
/** Runs after the selection alone changed. */
export const onSelection = (fn: Listener) => { selectionListeners.push(fn); };

export const builder = () => ui.builder;

function prune() {
  const count = ui.builder.chosen.length;
  ui.picks = new Set([...ui.picks].filter((i) => i < count));
  if (ui.selected !== null && ui.selected >= count) ui.selected = ui.picks.size ? [...ui.picks].pop()! : null;
}

/** Apply a change to the program, then redraw everything. */
export function commit(change?: () => void) {
  change?.();
  prune();
  changed();
}

/** Redraw without changing the program (page switch, library swap ...). */
export function changed() {
  for (const fn of changeListeners) fn();
}

export function select(index: number | null, extra?: Iterable<number>) {
  ui.selected = index;
  ui.picks = new Set(extra ?? (index === null ? [] : [index]));
  for (const fn of selectionListeners) fn();
}

export const picked = () => [...ui.picks].sort((a, b) => a - b);
export const pickedItems = () => ui.layout.items.filter((a) => ui.picks.has(a.i));

/** Shift+click selects the range from the last clicked shape, Ctrl/Cmd+click adds or removes one. */
export function extendSelection(e: { shiftKey: boolean }, index: number) {
  if (e.shiftKey && ui.selected !== null) {
    const range = new Set(ui.picks);
    for (let i = Math.min(ui.selected, index); i <= Math.max(ui.selected, index); i++) range.add(i);
    select(index, range);
  } else {
    const next = new Set(ui.picks);
    if (next.has(index)) next.delete(index); else next.add(index);
    select(next.size ? (next.has(index) ? index : [...next].pop()!) : null, next);
  }
}
