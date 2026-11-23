/** Reads the triplets of reference lines from the source SVG. */
import { boundingBox } from "./segments";
import { shapesIn } from "./shapes";
import { REFERENCE_LABEL, labelOf } from "./svgNames";

export const LINES_PER_ROW = 3;

export interface Row {
  top: number; // y of the top line, mm
  bottom: number; // y of the third line, mm
}

export class Ruling {
  constructor(readonly left: number, readonly right: number, readonly rows: Row[]) {}

  get width(): number {
    return this.right - this.left;
  }

  /** The row whose lines are closest to y (centre of the triplet). */
  nearestRow(y: number): Row {
    return this.rows.reduce((best, r) =>
      Math.abs((r.top + r.bottom) / 2 - y) < Math.abs((best.top + best.bottom) / 2 - y) ? r : best);
  }
}

export function loadRuling(root: Element): Ruling {
  const group = Array.from(root.querySelectorAll("g")).find((g) => labelOf(g) === REFERENCE_LABEL);
  if (!group) throw new Error(`no group labelled '${REFERENCE_LABEL}' in the library SVG`);
  const lines: { y: number; x0: number; x1: number }[] = [];
  for (const shape of shapesIn(group)) {
    const box = boundingBox(shape.segments);
    if (box) lines.push({ y: (box[1] + box[3]) / 2, x0: box[0], x1: box[2] });
  }
  const ys = [...new Set(lines.map((l) => Math.round(l.y * 1000) / 1000))].sort((a, b) => a - b);
  if (!ys.length || ys.length % LINES_PER_ROW) {
    throw new Error(`expected reference lines in groups of ${LINES_PER_ROW}, found ${ys.length}`);
  }
  const rows: Row[] = [];
  for (let i = 0; i < ys.length; i += LINES_PER_ROW) rows.push({ top: ys[i], bottom: ys[i + LINES_PER_ROW - 1] });
  return new Ruling(Math.min(...lines.map((l) => l.x0)), Math.max(...lines.map((l) => l.x1)), rows);
}
