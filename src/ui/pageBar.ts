/** Paper size, orientation and scale. Not part of Undo; change it back to undo it. */
import { AUTO_MIN_SCALE, MAX_SCALE, MIN_SCALE, PRESETS } from "../core/pageSetup";
import { $ } from "./dom";
import { ICON_LANDSCAPE, ICON_PORTRAIT } from "./icons";
import { commit, ui } from "./state";

const input = (id: string) => $(id) as HTMLInputElement;

export function renderPageBar() {
  const { setup, drawnSetup, ruling, pages } = ui.builder;
  const paper = $("paper") as HTMLSelectElement;
  paper.value = setup.preset;
  $("orient").innerHTML = setup.landscape ? ICON_LANDSCAPE : ICON_PORTRAIT;
  $("orient").title = setup.landscape ? "Landscape (click for portrait)" : "Portrait (click for landscape)";
  const shown = setup.auto ? drawnSetup.scale : setup.scale; // auto shows the scale it chose
  input("auto").checked = setup.auto;
  input("scale").disabled = input("scaleNum").disabled = setup.auto;
  if (document.activeElement !== input("scaleNum")) input("scaleNum").value = String(+shown.toFixed(2));
  if (document.activeElement !== input("scale")) input("scale").value = String(shown); // not under the user's thumb
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
  // The page follows the slider while it is dragged: at most one redraw per animation frame.
  // Holding Shift while dragging moves the value ten times slower, for fine adjustment.
  let frame = 0;
  const applySlider = () => { frame = 0; set({ scale: +input("scale").value }); };
  input("scale").step = "0.01";
  input("scale").oninput = () => {
    input("scaleNum").value = input("scale").value;
    if (!frame) frame = requestAnimationFrame(applySlider);
  };
  wireFineSlider(input("scale"), 10);
  input("scale").onchange = () => { // released: make sure the final position is what is drawn
    if (frame) cancelAnimationFrame(frame);
    applySlider();
  };
  input("scaleNum").onchange = () => set({ scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, +input("scaleNum").value || 1)) });
  input("scaleNum").onkeydown = (e) => { if (e.key === "Enter") input("scaleNum").blur(); };
}

/**
 * Takes over dragging a range input so that Shift makes it move `slowBy` times slower.
 * The value is re-based whenever Shift is pressed or released, so it never jumps.
 * Clicking the track and the arrow keys keep working as usual.
 */
function wireFineSlider(slider: HTMLInputElement, slowBy: number) {
  slider.addEventListener("pointerdown", (down) => {
    if (down.button !== 0 || slider.disabled) return;
    const thumb = 16; // px: the track is inset by about half a thumb at each end
    const rect = slider.getBoundingClientRect();
    const min = +slider.min, max = +slider.max, step = +slider.step || 0.01;
    const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
    const perPixel = (max - min) / Math.max(1, rect.width - thumb);
    down.preventDefault(); // we move the thumb ourselves
    slider.focus();
    slider.setPointerCapture(down.pointerId);
    // a plain click jumps to where it was made; a Shift-click starts from the current value
    let value = down.shiftKey ? +slider.value : clamp(min + (down.clientX - rect.left - thumb / 2) * perPixel);
    let baseX = down.clientX, slow = down.shiftKey;
    const set = (v: number) => { slider.value = String(v); slider.dispatchEvent(new Event("input", { bubbles: true })); };
    if (!down.shiftKey) set(value);

    const move = (ev: PointerEvent) => {
      if (ev.shiftKey !== slow) { slow = ev.shiftKey; baseX = ev.clientX; value = +slider.value; } // re-base on a change
      const next = clamp(value + (ev.clientX - baseX) * perPixel / (slow ? slowBy : 1));
      if (next !== +slider.value) set(next);
    };
    const up = () => {
      slider.removeEventListener("pointermove", move);
      slider.removeEventListener("pointerup", up);
      slider.removeEventListener("pointercancel", up);
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    };
    slider.addEventListener("pointermove", move);
    slider.addEventListener("pointerup", up);
    slider.addEventListener("pointercancel", up);
  });
}
