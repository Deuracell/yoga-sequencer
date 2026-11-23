/** The page preview: draws the current page, its hit boxes, and the buttons on the selected shape. */
import { nudge, removeBreakAfter, removeSelected, resetSpacing, toggleBreak } from "./actions";
import { $, svgEl } from "./dom";
import { PAD, startDrag, startMarquee } from "./dragShape";
import { layoutInfo, type LayoutItem } from "./layoutInfo";
import { extendSelection, onSelection, pickedItems, ui } from "./state";

export function renderPreview() {
  const { builder } = ui;
  ui.layout = layoutInfo(builder);
  ui.page = Math.max(0, Math.min(ui.page, builder.pages - 1));
  const current = ui.layout.items.find((it) => it.i === ui.selected);
  if (current) ui.page = current.page; // follow the selected shape onto its page
  $("pageLabel").textContent = `${ui.page + 1} / ${builder.pages}`;
  ($("prev") as HTMLButtonElement).disabled = ui.page <= 0;
  ($("next") as HTMLButtonElement).disabled = ui.page >= builder.pages - 1;

  const svg = builder.render.pageView(ui.page);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  const host = $("preview");
  host.replaceChildren(document.importNode(svg, true));
  ui.svg = host.querySelector("svg");
  ui.svg!.addEventListener("pointerdown", (e) => {
    if (!(e.target as Element).closest(".hit, .btn")) startMarquee(e);
  });
  addOverlay();
}

function addOverlay() {
  const svg = ui.svg!;
  const overlay = svgEl("g", { id: "overlay" });
  svg.append(overlay);
  const offset = ui.page * ui.layout.pageStep;
  for (const it of ui.layout.items) {
    if (it.page !== ui.page) continue;
    const r = svgEl("rect", {
      class: ui.picks.has(it.i) ? "hit sel" : "hit", x: offset + it.x - PAD, y: it.top, width: it.w + 2 * PAD, height: it.h,
    });
    r.dataset.i = String(it.i);
    r.addEventListener("pointerdown", (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); extendSelection(e, it.i); }
      else startDrag(e, it.i);
    });
    overlay.append(r);
    if (it.brk) overlay.append(breakMarker(it, offset));
  }
  drawButtons();
}

/**
 * The line break after a shape that ends its row on purpose, as a small button at the end of the row
 * (preview only, not in the file). Clicking it removes the break.
 */
function breakMarker(it: LayoutItem, offset: number): SVGGElement {
  const px = ui.svg!.getScreenCTM()?.a || 1;
  const size = 16 / px; // mm, about 16 px on screen
  const x = Math.min(offset + it.x + it.w + 1.5, offset + ui.layout.pageWidth - size - 0.5);
  const group = svgEl("g", { class: "btn brk", transform: `translate(${x},${it.y - size / 2})` });
  const box = svgEl("rect", { width: size, height: size, rx: size * 0.2 });
  const text = svgEl("text", { x: size / 2, y: size * 0.74, "font-size": size * 0.75 });
  text.textContent = "\u21B5";
  const tip = svgEl("title");
  tip.textContent = "Line break here (Enter). Click to remove it.";
  group.append(tip, box, text);
  group.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); });
  group.addEventListener("click", (e) => { e.stopPropagation(); removeBreakAfter(it.i); });
  return group;
}

function syncSelection() {
  ui.svg?.querySelectorAll<SVGElement>(".hit").forEach((r) => r.classList.toggle("sel", ui.picks.has(Number(r.dataset.i))));
  drawButtons();
}
onSelection(syncSelection);

/**
 * + / - / reset / break / delete above the top-right corner of the selected shape's hit box (centred on the
 * shape instead when the row of buttons is wider than the shape), each about 20 px wide on screen, their
 * bottom edge 5 px above the top line of the triplet, or 5 px above the hit box when the drawing rises above it.
 */
function drawButtons() {
  const svg = ui.svg;
  svg?.querySelector("#buttons")?.remove();
  const it = ui.layout.items.find((a) => a.i === ui.selected && a.page === ui.page);
  if (!it || !svg) return;
  const px = svg.getScreenCTM()?.a || 1; // screen pixels per mm
  const size = 20 / px; // mm
  const step = size * 1.12;
  const hitLeft = ui.page * ui.layout.pageStep + it.x - PAD, hitWidth = it.w + 2 * PAD;
  const risesAbove = it.top < it.y - 0.01; // it.y is the triplet's top line, it.top the hit box's top
  const top = (risesAbove ? it.top : it.y) - 5 / px - size;
  const group = svgEl("g", { id: "buttons" });
  const many = ui.picks.size > 1, items = pickedItems();
  const each = many ? ` on all ${ui.picks.size} selected shapes` : "";
  const noGap = items.every((a) => a.last), noChange = items.every((a) => !a.spacing);
  const broken = items.every((a) => a.brk);
  const defs: [string, string, () => void, boolean, string?][] = [
    ["+", `Widen the space to the right${each} (+)`, () => nudge(1), noGap],
    ["−", `Narrow the space to the right${each} (−); stops where outlines touch`, () => nudge(-1), noGap],
    ["↺", many ? "Reset the space to the right on all selected shapes"
      : `Reset the space to the right (now ${it.spacing >= 0 ? "+" : ""}${it.spacing.toFixed(1)} mm)`, resetSpacing, noChange],
    ["↵", broken ? `Remove the line break after ${many ? "these shapes" : "this shape"} (Enter)` : `Start a new row after ${many ? "these shapes" : "this shape"} (Enter; Shift+Enter starts one before)`,
      toggleBreak, false, broken ? "on" : ""],
    ["×", many ? `Delete the ${ui.picks.size} selected shapes (Delete)` : "Delete this shape (Delete)", removeSelected, false, "del"],
  ];
  // Right-aligned with the hit box, unless the row is wider than the drawn shape: then centred on the shape.
  const rowWidth = (defs.length - 1) * step + size;
  const rowLeft = rowWidth > it.w ? hitLeft + hitWidth / 2 - rowWidth / 2 : hitLeft + hitWidth - rowWidth;
  defs.forEach(([label, title, action, disabled, kind], n) => {
    const b = svgEl("g", { class: ["btn", kind, disabled ? "off" : ""].filter(Boolean).join(" "), transform: `translate(${rowLeft + n * step},${top})` });
    const box = svgEl("rect", { width: size, height: size, rx: size * 0.2 });
    const text = svgEl("text", { x: size / 2, y: size * 0.72, "font-size": size * 0.75 });
    text.textContent = label;
    const tip = svgEl("title");
    tip.textContent = disabled ? `${title} - nothing to change here` : title;
    b.append(tip, box, text);
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); });
    b.addEventListener("click", (e) => { e.stopPropagation(); if (!disabled) action(); });
    group.append(b);
  });
  svg.querySelector("#overlay")!.append(group);
}

