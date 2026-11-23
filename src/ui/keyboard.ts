/** Keyboard shortcuts for the page: selection, nudging, notes, undo, and type-to-filter. */
import { moveSelected, nudge, redo, removeSelected, toggleBreak, undo } from "./actions";
import { $, isTextField } from "./dom";
import { renderGrid } from "./gallery";
import { openHelp } from "./help";
import { openNote } from "./noteBox";
import { select, ui } from "./state";

export function wireKeyboard() {
  const q = $("q") as HTMLInputElement;

  document.addEventListener("keydown", (e) => { // ? opens the help
    if (e.key === "?" && !isTextField(e.target) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openHelp(); }
  });

  document.addEventListener("keydown", (e) => { // Ctrl/Cmd+A selects every shape
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !isTextField(e.target) && ui.builder.chosen.length) {
      e.preventDefault();
      select(ui.selected ?? 0, ui.builder.chosen.map((_, i) => i));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (ui.selected === null || isTextField(e.target)) return;
    const step = ui.picks.size > 1 ? 0 : ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number>)[e.key]; // one shape at a time
    if (step) { e.preventDefault(); moveSelected(step); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
    else if (["+", "=", "-", "_"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      nudge(e.key === "+" || e.key === "=" ? 1 : -1); // mm right of the shape
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleBreak(); }
    else if ((e.key === "1" || e.key === "2") && ui.picks.size === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openNote(e.key === "1" ? "above" : "below");
    } else if (e.key === "Escape") select(null);
  });

  // Ctrl+Z / Cmd+Z undo, Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y redo; text boxes keep their own undo.
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextField(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
  });

  q.oninput = renderGrid;
  q.onkeydown = (e) => {
    if (e.key === "Escape") { // clear the filter and give the keyboard back to the page (arrows, Delete ...)
      e.preventDefault();
      q.value = "";
      renderGrid();
      q.blur();
      return;
    }
    if (e.key !== "Enter") return;
    $("grid").querySelector<HTMLElement>(".tile")?.click();
  };

  // Typing a letter anywhere on the page goes straight into the filter box; no need to click it first.
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.key.length !== 1 || !/\p{L}/u.test(e.key)) return;
    if (isTextField(e.target) || (e.target as HTMLElement).isContentEditable) return;
    q.focus(); // the keystroke then lands in the box as usual
  });
}
