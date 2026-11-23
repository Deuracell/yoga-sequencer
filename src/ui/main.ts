/** Entry point: loads the library, restores the last program, wires the interface. */
import "./styles.css";
import { ProgramBuilder } from "../core/program";
import { $ } from "./dom";
import { loadTiles, renderGrid } from "./gallery";
import { language, setLanguage } from "./language";
import { wireKeyboard } from "./keyboard";
import { fetchBundled, wireLibrary } from "./library";
import { renderNamesBar, wireNamesBar } from "./namesBar";
import { renderPageBar, wirePageBar } from "./pageBar";
import { renderPreview } from "./preview";
import { autosave, savedLibrary, savedProgram } from "./storage";
import { onChange, onSelection, ui } from "./state";
import { wireSplitter } from "./splitter";
import { renderToolbar, wireToolbar } from "./toolbar";
import { wireHelp } from "./help";
import { renderHint } from "./hint";
import { wireMenu } from "./menu";
import { clearMessage, renderWarnings, showMessage, wireWarnings } from "./warnings";

function render() {
  renderToolbar();
  renderPageBar();
  renderNamesBar();
  renderWarnings();
  renderPreview();
  renderHint();
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
  wireNamesBar();
  wireToolbar(showMessage);
  wireLibrary(showMessage);
  wireKeyboard();
  wireSplitter();
  wireHelp();
  wireWarnings();
  for (const [button, panel] of [["fileBtn", "#fileBtn + .menu"], ["libMore", "#libMore + .menu"], ["namesBtn", "#printOpts"]]) {
    wireMenu($(button), document.querySelector<HTMLElement>(panel)!);
  }
  onSelection(renderHint);
  onChange(() => { clearMessage(); render(); });
  loadTiles();
  renderGrid();
  render();
}

start().catch((error) => {
  $("warn").hidden = false;
  $("warnToggle").textContent = "⚠ could not start";
  $("warnList").hidden = false;
  $("warnList").textContent = (error as Error).message;
});
