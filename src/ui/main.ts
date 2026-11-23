/** Entry point: loads the library, restores the last program, wires the interface. */
import "./styles.css";
import { ProgramBuilder } from "../core/program";
import { $ } from "./dom";
import { loadTiles, renderGrid } from "./gallery";
import { wireKeyboard } from "./keyboard";
import { fetchBundled, wireLibrary } from "./library";
import { renderPageBar, wirePageBar } from "./pageBar";
import { renderPreview } from "./preview";
import { autosave, savedLibrary, savedProgram } from "./storage";
import { onChange, ui } from "./state";
import { wireSplitter } from "./splitter";
import { renderToolbar, wireToolbar } from "./toolbar";

let extraNotes: string[] = [];

function showMessage(message: string) {
  extraNotes = [message];
  renderWarnings();
}

function renderWarnings() {
  const { builder } = ui;
  const notes = [...extraNotes, ...builder.warnings, ...builder.openNotes].map((w) => `⚠ ${w}`);
  if (ui.customLibrary && builder.droppedCopies.length) notes.push(`Ignored ${builder.droppedCopies.length} duplicate drawings in the library.`);
  if (ui.customLibrary && builder.withoutAnchor.length) {
    notes.push(`${builder.withoutAnchor.length} pose(s) have no anchor point; their height is guessed from the nearest row.`);
  }
  const warn = $("warn");
  warn.hidden = !notes.length;
  warn.replaceChildren(...notes.flatMap((n, i) => [...(i ? [document.createElement("br")] : []), document.createTextNode(n)]));
  $("libReset").hidden = !ui.customLibrary;
  $("libInfo").textContent = `${builder.catalog.size} poses · ${ui.customLibrary ? "your library" : "bundled library"}`;
}

function render() {
  renderToolbar();
  renderPageBar();
  renderWarnings();
  renderPreview();
  autosave();
}

async function start() {
  let text = savedLibrary();
  let custom = text !== null;
  try {
    ui.builder = new ProgramBuilder(text ?? await fetchBundled());
  } catch (error) {
    if (!custom) throw error;
    custom = false; // a remembered library that no longer loads: fall back to the bundled one
    ui.builder = new ProgramBuilder(await fetchBundled());
  }
  ui.customLibrary = custom;

  const saved = savedProgram();
  if (saved) {
    try { ui.builder.load(saved.program, saved.name); } catch { /* an unreadable remembered program is simply dropped */ }
  }

  wirePageBar();
  wireToolbar(showMessage);
  wireLibrary(showMessage);
  wireKeyboard();
  wireSplitter();
  onChange(() => { extraNotes = []; render(); });
  loadTiles();
  renderGrid();
  render();
}

start().catch((error) => {
  const warn = $("warn");
  warn.hidden = false;
  warn.textContent = `Could not start: ${(error as Error).message}`;
});
