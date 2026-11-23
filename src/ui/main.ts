/** Entry point: loads the library, restores the last program, wires the interface. */
import "./styles.css";
import { ProgramBuilder } from "../core/program";
import { $ } from "./dom";
import { loadTiles, renderGrid } from "./gallery";
import { language, setLanguage } from "./language";
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
  const unverified = builder.names.toVerify().length;
  if (unverified) notes.push(`${unverified} pose names are marked “?” (best guesses, still to be verified in poses.json).`);
  if (builder.unnamed.length) notes.push(`No entry in poses.json for: ${builder.unnamed.join(", ")}`);
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

/** Fills the language chooser from the names file; does nothing useful for a library without one. */
function wireLanguage() {
  const select = $("lang") as HTMLSelectElement;
  const sanskrit = $("showSa") as HTMLInputElement;
  const refill = () => {
    const languages = ui.builder.names.languages;
    const codes = Object.keys(languages);
    select.replaceChildren(...codes.map((c) => new Option(languages[c], c)));
    if (!codes.includes(language().lang)) setLanguage({ lang: codes.includes("en") ? "en" : codes[0] });
    select.value = language().lang;
    sanskrit.checked = language().sanskrit;
    $("showSaLabel").hidden = language().lang === "sa";
    select.disabled = sanskrit.disabled = !codes.length;
  };
  select.onchange = () => { setLanguage({ lang: select.value }); refill(); renderGrid(); };
  sanskrit.onchange = () => { setLanguage({ sanskrit: sanskrit.checked }); renderGrid(); };
  onChange(refill); // a library swap can bring a different set of languages
  refill();
}

async function start() {
  const text = savedLibrary();
  let custom = text !== null;
  const bundled = await fetchBundled();
  try {
    ui.builder = custom ? new ProgramBuilder(text!) : new ProgramBuilder(bundled.svg, bundled.names);
  } catch (error) {
    if (!custom) throw error;
    custom = false; // a remembered library that no longer loads: fall back to the bundled one
    ui.builder = new ProgramBuilder(bundled.svg, bundled.names);
  }
  ui.customLibrary = custom;
  wireLanguage();

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
