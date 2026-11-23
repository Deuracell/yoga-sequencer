/** File name, undo/redo/clear, import, export, print and page navigation. */
import { redo, undo } from "./actions";
import { $ } from "./dom";
import { download, readFile, stamped } from "./files";
import { printProgram } from "./print";
import { changed, commit, select, ui } from "./state";

const button = (id: string) => $(id) as HTMLButtonElement;

export function renderToolbar() {
  const { builder } = ui;
  button("undo").disabled = !builder.canUndo;
  button("redo").disabled = !builder.canRedo;
  button("clear").disabled = !builder.chosen.length;
  const name = $("fname") as HTMLInputElement;
  if (document.activeElement !== name) name.value = builder.name;
  for (const id of ["save", "savePage", "print"]) button(id).disabled = !builder.chosen.length;
}

/** Open the text of a saved program, after asking if it would replace work. Returns an error message or null. */
export function importProgram(text: string, fileName: string): string | null {
  const { builder } = ui;
  if (builder.chosen.length && !confirm(`Replace the current program with ${fileName}?\n\nExport the current one first if you want to keep it.`)) return null;
  try {
    select(null);
    commit(() => { builder.openProgram(text, fileName); ui.page = 0; });
    return null;
  } catch {
    return `${fileName} is not a program saved by this tool.`;
  }
}

export function wireToolbar(onError: (message: string) => void) {
  const name = $("fname") as HTMLInputElement;
  name.onchange = () => commit(() => { ui.builder.rename(name.value); });
  name.onkeydown = (e) => { if (e.key === "Enter") name.blur(); };

  button("undo").onclick = undo;
  button("redo").onclick = redo;
  button("clear").onclick = () => {
    const n = ui.builder.chosen.length;
    if (!n) return;
    if (!confirm(`Remove all ${n} shape${n === 1 ? "" : "s"} from the program?\n\nYou can bring them back with Undo (Ctrl+Z).`)) return;
    select(null);
    commit(() => ui.builder.clear());
  };

  const file = $("file") as HTMLInputElement;
  button("open").onclick = () => file.click();
  file.onchange = async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    const error = importProgram(await readFile(chosen), chosen.name);
    if (error) onError(error);
  };

  button("save").onclick = () => {
    download(stamped(ui.builder.name), ui.builder.render.document);
    $("out").textContent = `Downloaded ${ui.builder.name}.svg (the whole program, ${ui.builder.pages} page${ui.builder.pages === 1 ? "" : "s"}).`;
  };
  button("savePage").onclick = () => {
    const page = ui.page;
    download(stamped(ui.builder.name, `_page${page + 1}`), ui.builder.render.pageFile(page));
    $("out").textContent = `Downloaded page ${page + 1} as its own SVG.`;
  };
  button("print").onclick = printProgram;

  button("prev").onclick = () => { ui.page = Math.max(0, ui.page - 1); changed(); };
  button("next").onclick = () => { ui.page = Math.min(ui.builder.pages - 1, ui.page + 1); changed(); };

  // Dropping an SVG anywhere on the page opens it as a program.
  const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  document.addEventListener("dragover", (e) => { if (hasFile(e)) { e.preventDefault(); document.body.classList.add("dropping"); } });
  document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dropping"); });
  document.addEventListener("drop", async (e) => {
    document.body.classList.remove("dropping");
    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;
    e.preventDefault();
    const error = importProgram(await readFile(dropped), dropped.name);
    if (error) onError(error);
  });
}
