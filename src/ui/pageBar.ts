/** Paper size, orientation and scale. Not part of Undo; change it back to undo it. */
import { AUTO_MIN_SCALE, MAX_SCALE, MIN_SCALE, PRESETS } from "../core/pageSetup";
import { $ } from "./dom";
import { commit, ui } from "./state";

const input = (id: string) => $(id) as HTMLInputElement;

export function renderPageBar() {
  const { setup, drawnSetup, ruling, pages } = ui.builder;
  const paper = $("paper") as HTMLSelectElement;
  paper.value = setup.preset;
  $("orient").textContent = setup.landscape ? "▭ Landscape" : "▯ Portrait";
  const shown = setup.auto ? drawnSetup.scale : setup.scale; // auto shows the scale it chose
  input("auto").checked = setup.auto;
  input("scale").disabled = input("scaleNum").disabled = setup.auto;
  if (document.activeElement !== input("scaleNum")) input("scaleNum").value = String(+shown.toFixed(2));
  input("scale").value = String(shown);
  const atMin = setup.auto && drawnSetup.scale <= AUTO_MIN_SCALE + 1e-6 && pages > 1;
  $("fit").textContent = `${ruling.rows.length} row${ruling.rows.length === 1 ? "" : "s"}/page`
    + (atMin ? " · at minimum scale, pages added" : "");
}

export function wirePageBar() {
  const paper = $("paper") as HTMLSelectElement;
  for (const [key, [label]] of Object.entries(PRESETS)) paper.add(new Option(label, key));
  for (const id of ["scale", "scaleNum"]) { input(id).min = String(MIN_SCALE); input(id).max = String(MAX_SCALE); }

  const set = (change: Parameters<typeof ui.builder.setPage>[0]) => commit(() => ui.builder.setPage(change));
  paper.onchange = () => set({ preset: paper.value });
  input("auto").onchange = () => set({ auto: input("auto").checked });
  $("orient").onclick = () => set({ landscape: !ui.builder.setup.landscape });
  input("scale").oninput = () => { input("scaleNum").value = input("scale").value; };
  input("scale").onchange = () => set({ scale: +input("scale").value });
  input("scaleNum").onchange = () => set({ scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, +input("scaleNum").value || 1)) });
  input("scaleNum").onkeydown = (e) => { if (e.key === "Enter") input("scaleNum").blur(); };
}
