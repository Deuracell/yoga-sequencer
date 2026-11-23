/** Where would a shape dropped at a point land? Shared by dragging a shape and dragging a library tile. */
import { ui } from "./state";

export interface Drop { to: number; row: number; lineX: number }

/** `to` is the final index once `from` is taken out of the list (-1 when it is a new shape). */
export function dropTarget(p: { x: number; y: number }, from: number): Drop {
  const { layout, page } = ui;
  const px = p.x - page * layout.pageStep;
  const items = layout.items.filter((a) => a.page === page);
  if (!items.length) return { to: ui.builder.chosen.length, row: layout.rows[0], lineX: layout.left };
  const rows = [...new Set(items.map((a) => a.y))].sort((a, b) => a - b);
  const distance = (y: number) => Math.abs(y + layout.lineSpacing - p.y);
  const row = rows.reduce((best, y) => (distance(y) < distance(best) ? y : best), rows[0]);
  const inRow = items.filter((a) => a.y === row && a.i !== from).sort((a, b) => a.x - b.x);
  const adjust = (i: number) => (from >= 0 && i > from ? i - 1 : i);
  const next = inRow.find((a) => a.x + a.w / 2 > px);
  if (next) {
    const prev = inRow[inRow.indexOf(next) - 1];
    return { to: adjust(next.i), row, lineX: prev ? (prev.x + prev.w + next.x) / 2 : next.x - 3 };
  }
  if (inRow.length) {
    const last = inRow[inRow.length - 1];
    return { to: adjust(last.i) + 1, row, lineX: last.x + last.w + 3 };
  }
  return { to: from, row, lineX: layout.left };
}

export function toUser(e: { clientX: number; clientY: number }): DOMPoint {
  const svg = ui.svg!;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

export function outsidePage(p: { x: number; y: number }): boolean {
  const x = p.x - ui.page * ui.layout.pageStep;
  return x < 0 || x > ui.layout.pageWidth || p.y < 0 || p.y > ui.layout.pageHeight;
}
