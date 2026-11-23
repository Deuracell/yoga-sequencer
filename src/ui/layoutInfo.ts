/** Hit boxes and note anchors for every placed pictogram, in page-local mm: what the preview overlay needs. */
import { noteAnchor } from "../core/notes";
import { pageStep } from "../core/pageWriter";
import type { ProgramBuilder } from "../core/program";

export interface LayoutItem {
  i: number; page: number; x: number; y: number; w: number;
  top: number; h: number; cx: number; aboveEdge: number; belowEdge: number;
  above: string; below: string; spacing: number; brk: boolean; last: boolean;
}

export interface LayoutInfo {
  pageStep: number; pageWidth: number; pageHeight: number; scale: number; lineSpacing: number;
  rows: number[]; left: number; items: LayoutItem[];
}

export const emptyLayout = (): LayoutInfo => ({
  pageStep: 230, pageWidth: 210, pageHeight: 297, scale: 1, lineSpacing: 15, rows: [21.2], left: 12.5, items: [],
});

export function layoutInfo(builder: ProgramBuilder): LayoutInfo {
  const ruling = builder.ruling;
  const bottoms = new Map(ruling.rows.map((r) => [r.top, r.bottom]));
  const items = builder.placements.map((p, i): LayoutItem => {
    // the hit area spans the whole triplet, and more if the drawing sticks out of it
    const hitTop = Math.min(p.top, p.y);
    const hitBottom = Math.max(p.top + p.height, bottoms.get(p.y)!);
    const [cx, aboveEdge] = noteAnchor(p, "above");
    return {
      i, page: p.page, x: p.x, y: p.y, w: p.width, top: hitTop, h: hitBottom - hitTop,
      cx, aboveEdge, belowEdge: noteAnchor(p, "below")[1],
      above: p.slot.above, below: p.slot.below, spacing: p.slot.spacing, brk: p.slot.breakAfter,
      last: builder.isLastInRow(i),
    };
  });
  return {
    pageStep: pageStep(builder.drawnSetup), pageWidth: ruling.pageWidth, pageHeight: ruling.pageHeight,
    scale: ruling.scale, lineSpacing: ruling.lineSpacing, rows: ruling.rows.map((r) => r.top), left: ruling.left, items,
  };
}
