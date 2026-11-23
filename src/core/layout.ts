/** Pure layout: pictogram widths in, x positions per triplet row out. */
import type { Pictogram } from "./catalog";
import type { PageRuling } from "./pageSetup";
import type { Slot } from "./slot";

export const CLEARANCE = 0.5; // mm kept between two outlines at scale 1 (about a line's width)
export const EPSILON = 1e-6;

export interface Placement {
  slot: Slot;
  page: number;
  x: number; // left edge, mm
  y: number; // top line of the triplet, mm
  bottom: number; // third line of the triplet, mm
  scale: number;
  pictogram: Pictogram;
  width: number;
  height: number;
  /** Where the drawing's top edge lands: its anchor sits on the triplet's top line. */
  top: number;
}

export function makePlacement(slot: Slot, page: number, x: number, y: number, bottom: number, scale: number): Placement {
  const p = slot.pictogram;
  return {
    slot, page, x, y, bottom, scale, pictogram: p,
    width: p.width * scale, height: p.height * scale, top: y + (p.top - p.anchorY) * scale,
  };
}

const widthOf = (item: Slot, ruling: PageRuling) => item.pictogram.width * ruling.scale;

/** The least gap (box edge to box edge) at which the outlines of two neighbours do not touch.
 *  Negative when one may tuck into the other's concave side. */
export function floorBetween(left: Slot, right: Slot, ruling: PageRuling): number {
  return (CLEARANCE - left.pictogram.roomBefore(right.pictogram)) * ruling.scale;
}

/** Smallest gap to the right of `item`: the default plus its own adjustment, never into the neighbour. */
function gapAfter(item: Slot, following: Slot, ruling: PageRuling, minGap: number): number {
  return Math.max(floorBetween(item, following, ruling), minGap * ruling.scale + item.spacing);
}

interface Row { items: Slot[]; forced: boolean } // `forced` rows ended early at a line break, which centres them

function splitRows(items: Slot[], ruling: PageRuling, minGap: number): Row[] {
  const rows: Row[] = [];
  let current: Slot[] = [];
  let used = 0;
  const span = ruling.width;
  const close = (forced: boolean) => { rows.push({ items: current, forced }); current = []; used = 0; };

  items.forEach((item, n) => {
    let needed = widthOf(item, ruling) + (current.length ? gapAfter(current[current.length - 1], item, ruling, minGap) : 0);
    if (current.length && used + needed > span) {
      close(false);
      needed = widthOf(item, ruling);
    }
    current.push(item);
    used += needed;
    if (item.breakAfter) {
      const next = items[n + 1];
      // a break on a row that was full anyway changes nothing: the row stays justified
      const fits = !next || used + widthOf(next, ruling) + gapAfter(item, next, ruling, minGap) <= span;
      close(fits);
    }
  });
  if (current.length) close(false);
  return rows;
}

/** Raw gap after each shape but the last; a squeezed gap may come out below its floor (outlines touch). */
function rowGaps(row: Slot[], ruling: PageRuling, minGap: number, justify: boolean): number[] {
  if (justify && row.length > 1) {
    // every gap is the same base amount plus its own adjustment, so the row still ends on the right line
    const free = ruling.width - row.reduce((sum, p) => sum + widthOf(p, ruling), 0);
    const base = (free - row.slice(0, -1).reduce((sum, p) => sum + p.spacing, 0)) / (row.length - 1);
    return row.slice(0, -1).map((p) => base + p.spacing);
  }
  return row.slice(0, -1).map((p) => minGap * ruling.scale + p.spacing);
}

/** [(row, gaps, forced)] for the whole program; the last unforced row stays left-aligned. */
function arranged(items: Slot[], ruling: PageRuling, minGap: number) {
  const rows = splitRows(items, ruling, minGap);
  return rows.map((row, index) => ({
    row: row.items,
    gaps: rowGaps(row.items, ruling, minGap, index < rows.length - 1 && !row.forced),
    forced: row.forced,
  }));
}

/** Per shape, how far its gap to the right is above its floor (null for the last of a row).
 *  Negative where outlines would touch or cross. */
export function slacks(items: Slot[], ruling: PageRuling, minGap = 8.0): (number | null)[] {
  const result: (number | null)[] = [];
  for (const { row, gaps } of arranged(items, ruling, minGap)) {
    row.forEach((item, i) => result.push(i < row.length - 1 ? gaps[i] - floorBetween(item, row[i + 1], ruling) : null));
  }
  return result;
}

/**
 * Fill rows left to right; a row followed by another is justified evenly.
 * A row ended by a forced line break is centred instead. The last row stays left-aligned so
 * more pictograms can still be appended. Outlines never touch, whatever the spacing.
 */
export function layoutRows(items: Slot[], ruling: PageRuling, minGap = 8.0): Placement[] {
  const placements: Placement[] = [];
  arranged(items, ruling, minGap).forEach(({ row, gaps: rawGaps, forced }, index) => {
    const page = Math.floor(index / ruling.rows.length);
    const line = ruling.rows[index % ruling.rows.length];
    const gaps = rawGaps.map((g, i) => Math.max(floorBetween(row[i], row[i + 1], ruling), g));
    let x = ruling.left;
    if (forced) {
      x += (ruling.width - row.reduce((s, p) => s + widthOf(p, ruling), 0) - gaps.reduce((s, g) => s + g, 0)) / 2;
    }
    row.forEach((item, n) => {
      placements.push(makePlacement(item, page, x, line.top, line.bottom, ruling.scale));
      x += widthOf(item, ruling) + (n < gaps.length ? gaps[n] : 0);
    });
  });
  return placements;
}
