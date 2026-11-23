/** Pointer interactions on the page: drag a shape to reorder or remove it, drag a box to select. */
import { $, svgEl } from "./dom";
import { dropTarget, outsidePage, toUser } from "./dropTarget";
import { changed, commit, select, ui } from "./state";

export const PAD = 3; // mm of hit area either side; stays under half the minimum gap

export function startDrag(e: PointerEvent, itemIndex: number) {
  e.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur(); // so the arrow and Delete keys reach the page, not a text box
  select(itemIndex);
  const svg = ui.svg!;
  const start = toUser(e);
  const source = svg.querySelector(`[data-index="${itemIndex}"]`);
  const overlay = svg.querySelector("#overlay")!;
  const offset = ui.page * ui.layout.pageStep;
  let ghost: SVGGElement | null = null, line: SVGRectElement | null = null, moved = false, drop: ReturnType<typeof dropTarget> | null = null;
  svg.setPointerCapture(e.pointerId);

  const overBin = (ev: { clientX: number; clientY: number }) =>
    !!document.elementFromPoint(ev.clientX, ev.clientY)?.closest("#bin");

  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
    const p = toUser(ev);
    if (!moved) {
      moved = true;
      document.body.classList.add("dragging", "removable"); // removable: the bin lights up
      ghost = svgEl("g", { opacity: ".6" });
      if (source) {
        const copy = source.cloneNode(true) as Element;
        copy.removeAttribute("data-index");
        ghost.append(copy);
        source.setAttribute("opacity", ".2");
      }
      ghost.style.pointerEvents = "none";
      overlay.append(ghost);
      line = svgEl("rect", { width: 0.8, fill: "#2f6fdb" });
      line.style.pointerEvents = "none";
      overlay.append(line);
    }
    ghost!.setAttribute("transform", `translate(${p.x - start.x},${p.y - start.y})`);
    const remove = overBin(ev) || outsidePage(p);
    $("preview").classList.toggle("outside", remove && !overBin(ev));
    $("bin").classList.toggle("hot", overBin(ev)); // only the bin itself is "hot"; off the page the preview is outlined
    line!.style.display = remove ? "none" : "";
    drop = dropTarget(p, itemIndex);
    line!.setAttribute("x", String(offset + drop.lineX - 0.4));
    line!.setAttribute("y", String(drop.row - 3 * ui.layout.scale));
    line!.setAttribute("height", String(36 * ui.layout.scale));
  };

  const finish = (ev: { clientX: number; clientY: number }, cancelled = false) => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", finish);
    svg.removeEventListener("pointercancel", cancel);
    svg.releasePointerCapture?.(e.pointerId);
    document.body.classList.remove("dragging", "removable");
    $("preview").classList.remove("outside");
    $("bin").classList.remove("hot");
    if (!moved) return;
    if (!cancelled && (overBin(ev) || outsidePage(toUser(ev)))) {
      select(null);
      commit(() => ui.builder.remove(itemIndex));
    } else if (!cancelled && drop && drop.to !== itemIndex) {
      select(drop.to);
      commit(() => ui.builder.move(itemIndex, drop!.to));
    } else changed();
  };
  const cancel = () => finish({ clientX: -1, clientY: -1 }, true);

  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", cancel);
}

/** Drag a box on empty page to select every shape it touches; Shift/Ctrl adds. A plain click deselects. */
export function startMarquee(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur();
  const svg = ui.svg!;
  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  const base = additive ? new Set(ui.picks) : new Set<number>();
  const start = toUser(e), offset = ui.page * ui.layout.pageStep;
  let box: SVGRectElement | null = null, hits = base;
  svg.setPointerCapture(e.pointerId);
  const touched = (r: { x: number; y: number; w: number; h: number }) => ui.layout.items.filter((a) => a.page === ui.page
    && offset + a.x - PAD < r.x + r.w && offset + a.x + a.w + PAD > r.x && a.top < r.y + r.h && a.top + a.h > r.y);

  const move = (ev: PointerEvent) => {
    if (!box && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
    const p = toUser(ev);
    const r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    if (!box) {
      box = svgEl("rect", { class: "marquee" });
      svg.querySelector("#overlay")!.append(box);
    }
    box.setAttribute("x", String(r.x)); box.setAttribute("y", String(r.y));
    box.setAttribute("width", String(r.w)); box.setAttribute("height", String(r.h));
    hits = new Set([...base, ...touched(r).map((a) => a.i)]);
    svg.querySelectorAll<SVGElement>(".hit").forEach((h) => h.classList.toggle("sel", hits.has(Number(h.dataset.i)))); // live preview
  };
  const finish = () => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", finish);
    svg.removeEventListener("pointercancel", finish);
    svg.releasePointerCapture?.(e.pointerId);
    if (!box) { if (!additive) select(null); return; }
    box.remove();
    const list = [...hits].sort((a, b) => a - b);
    select(list.length ? (ui.selected !== null && hits.has(ui.selected) ? ui.selected : list[list.length - 1]) : null, list);
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
}

