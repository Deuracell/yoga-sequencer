/** The pose library: filterable tiles, click to append, drag onto the page to insert. */
import { thumbnailSvg } from "../core/thumbnails";
import { $, svgEl } from "./dom";
import { dropTarget, toUser } from "./dropTarget";
import { commit, select, ui } from "./state";

interface Tile { name: string; svg: string }
let tiles: Tile[] = [];
let suppressClick = false;

export function loadTiles() {
  const { builder } = ui;
  tiles = [...builder.catalog.values()].map((p, i) => ({ name: p.name, svg: thumbnailSvg(builder.sourceGroup(p.groupId)!, p, i) }));
}

export function renderGrid() {
  const q = ($("q") as HTMLInputElement).value.trim().toLowerCase();
  const grid = $("grid");
  grid.replaceChildren();
  for (const item of tiles) {
    if (q && !item.name.toLowerCase().includes(q)) continue;
    const b = document.createElement("button");
    b.className = "tile";
    b.title = `Add ${item.name}`;
    const inner = document.createElement("div");
    inner.className = "in";
    inner.innerHTML = item.svg;
    const label = document.createElement("span");
    label.textContent = item.name;
    inner.append(label);
    b.append(inner);
    b.onclick = () => { if (!suppressClick) commit(() => ui.builder.add(item.name)); };
    b.onpointerdown = (e) => startLibraryDrag(e, item, b);
    grid.append(b);
  }
  if (!grid.children.length) {
    const none = document.createElement("div");
    none.className = "muted";
    none.textContent = tiles.length ? "No pose matches the filter." : "The library has no poses.";
    grid.append(none);
  }
}

function startLibraryDrag(e: PointerEvent, item: Tile, tile: HTMLElement) {
  if (e.button !== 0) return;
  const origin = { x: e.clientX, y: e.clientY };
  let ghost: HTMLElement | null = null, line: SVGRectElement | null = null, drop: ReturnType<typeof dropTarget> | null = null, moved = false;
  tile.setPointerCapture(e.pointerId);

  const inPreview = (ev: { clientX: number; clientY: number }) => {
    const r = $("preview").getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  };
  const hideLine = () => { line?.remove(); line = null; drop = null; };

  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 6) return;
    if (!moved) {
      moved = true;
      document.body.classList.add("dragging");
      ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.innerHTML = item.svg;
      document.body.append(ghost);
    }
    ghost!.style.left = `${ev.clientX}px`;
    ghost!.style.top = `${ev.clientY}px`;
    if (!ui.svg || !inPreview(ev)) { hideLine(); return; }
    drop = dropTarget(toUser(ev), -1);
    if (!line) {
      line = svgEl("rect", { width: 0.8, height: 36 * ui.layout.scale, fill: "#2f6fdb" });
      line.style.pointerEvents = "none";
      ui.svg.querySelector("#overlay")!.append(line);
    }
    line.setAttribute("x", String(ui.page * ui.layout.pageStep + drop.lineX - 0.4));
    line.setAttribute("y", String(drop.row - 3 * ui.layout.scale));
  };

  const finish = (ev: { clientX: number; clientY: number }) => {
    tile.removeEventListener("pointermove", move);
    tile.removeEventListener("pointerup", finish);
    tile.removeEventListener("pointercancel", abort);
    tile.releasePointerCapture?.(e.pointerId);
    document.body.classList.remove("dragging");
    ghost?.remove();
    if (!moved) return;
    suppressClick = true; // the click that follows a drag must not add the shape a second time
    setTimeout(() => { suppressClick = false; }, 0);
    const target = drop && inPreview(ev) ? drop : null;
    line?.remove();
    if (target) {
      select(target.to);
      commit(() => ui.builder.insert(item.name, target.to));
    }
  };
  const abort = () => { drop = null; finish({ clientX: -1, clientY: -1 }); };

  tile.addEventListener("pointermove", move);
  tile.addEventListener("pointerup", finish);
  tile.addEventListener("pointercancel", abort);
}

