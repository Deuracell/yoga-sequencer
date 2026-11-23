/** Text above (where = 'above') or below the selected shape, in a floating multi-line box. */
import type { Where } from "../core/notes";
import { commit, ui } from "./state";

export function openNote(where: Where) {
  const it = ui.layout.items.find((a) => a.i === ui.selected);
  const svg = ui.svg;
  if (!it || it.page !== ui.page || !svg) return;
  const pt = svg.createSVGPoint();
  pt.x = ui.page * ui.layout.pageStep + it.cx;
  pt.y = where === "above" ? it.aboveEdge : it.belowEdge;
  const at = pt.matrixTransform(svg.getScreenCTM()!);
  const box = document.createElement("textarea");
  const width = 220;
  box.className = "note-box";
  box.rows = 3;
  box.value = it[where];
  box.placeholder = `Text ${where} the shape\nEnter: new line · Ctrl+Enter: save · Esc: cancel`;
  box.style.width = `${width}px`;
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, at.x - width / 2))}px`;
  if (where === "above") box.style.bottom = `${window.innerHeight - at.y}px`;
  else box.style.top = `${at.y}px`;
  document.body.append(box);
  box.focus();

  let done = false;
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    const text = box.value;
    box.remove();
    if (save && text !== it[where]) commit(() => ui.builder.setNote(it.i, where, text));
  };
  box.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(true); }
  };
  box.onblur = () => finish(true);
}
