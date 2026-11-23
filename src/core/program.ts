/** The pictogram program being built: poses, notes, spacing, page setup, undo, and the rendered pages. */
import { loadCatalog, type Catalog, type Pictogram } from "./catalog";
import { History } from "./history";
import { EPSILON, layoutRows, slacks, type Placement } from "./layout";
import { WHERE, type Where } from "./notes";
import { AUTO_MAX_SCALE, AUTO_MIN_SCALE, AUTO_STEP, buildRuling, makeSetup, type PageRuling, type PageSetup } from "./pageSetup";
import { renderDocument, type RenderedDocument } from "./pageWriter";
import { readProgram, type SavedProgram } from "./projectIo";
import { loadRuling } from "./reference";
import { copySlot, newSlot, type Slot } from "./slot";
import { parseSvg } from "./svgNames";

const MAX_SPACING = 60.0; // mm of extra gap per shape
const MIN_SPACING = -210.0; // mm: far more than any row can squeeze, so the overlap check is what stops it

const keyOf = (slots: Slot[]) => JSON.stringify(
  slots.map((s) => [s.pictogram.groupId, s.above, s.below, s.spacing, s.breakAfter]));

const asList = (indices: number | number[]) => (Array.isArray(indices) ? indices : [indices]);

export class ProgramBuilder {
  private source!: Element;
  catalog = new Map<string, Pictogram>();
  droppedCopies: Catalog["droppedCopies"] = [];
  withoutAnchor: string[] = [];
  warnings: string[] = []; // label clashes found in the library
  openNotes: string[] = []; // problems met while opening a saved program or reloading the library
  name = "Program";
  chosen: Slot[] = [];
  setup: PageSetup = makeSetup();
  ruling!: PageRuling;
  placements: Placement[] = [];
  readonly history = new History<Slot[]>();
  private rendered: RenderedDocument | null = null;
  private drawn: PageSetup = this.setup;

  constructor(librarySvg: string, readonly gap = 8.0) {
    this.setLibrary(librarySvg);
  }

  /** (Re)read a library SVG: ruling, pictograms, carbon copies and name warnings. Throws, changing nothing, if unusable. */
  setLibrary(text: string) {
    const source = parseSvg(text);
    const found = loadCatalog(source, loadRuling(source));
    this.source = source;
    this.catalog = new Map(found.pictograms.map((p) => [p.name, p]));
    this.droppedCopies = found.droppedCopies;
    this.withoutAnchor = found.withoutAnchor;
    this.warnings = found.nameWarnings;
    const lost: string[] = [];
    this.chosen = this.chosen.flatMap((slot) => {
      const pictogram = this.resolveSaved(slot.pictogram.groupId, slot.pictogram.name.split(" #")[0]);
      if (!pictogram) { lost.push(slot.pictogram.name); return []; }
      return [{ ...slot, pictogram }];
    });
    this.openNotes = lost.length ? [`No longer in the library, removed from the program: ${lost.join(", ")}`] : [];
    this.history.clear(); // old snapshots may refer to poses that just changed or went away
    this.refresh();
  }

  get names(): string[] { return [...this.catalog.keys()]; }
  get canUndo(): boolean { return this.history.canUndo; }
  get canRedo(): boolean { return this.history.canRedo; }
  get pages(): number { return Math.max(0, ...this.placements.map((p) => p.page)) + 1; }
  /** The setup actually drawn: the same as `setup` unless the scale is automatic. */
  get drawnSetup(): PageSetup { return this.drawn; }
  get librarySource(): Element { return this.source; }

  /** The group in the library for a pictogram, for thumbnails. */
  sourceGroup(groupId: string): Element | null {
    return Array.from(this.source.querySelectorAll("g")).find((g) => g.getAttribute("id") === groupId) ?? null;
  }

  private snapshot(): Slot[] { return this.chosen.map(copySlot); }

  /** Run `change`; if it altered the program, remember how it was and redraw. */
  private edit<T>(change: () => T): T {
    const before = this.snapshot();
    const result = change();
    if (keyOf(this.chosen) !== keyOf(before)) {
      this.history.record(before);
      this.refresh();
    }
    return result;
  }

  private restore(snapshot: Slot[] | null): boolean {
    if (!snapshot) return false;
    this.chosen = snapshot;
    this.refresh();
    return true;
  }

  undo(): boolean { return this.restore(this.history.undo(this.snapshot())); }
  redo(): boolean { return this.restore(this.history.redo(this.snapshot())); }

  add(name: string) { this.insert(name, this.chosen.length); }

  /** Put a new pictogram into the program so that it ends up at `index`. */
  insert(name: string, index: number) {
    const pictogram = this.catalog.get(name);
    if (!pictogram) return;
    this.edit(() => { this.chosen.splice(Math.max(0, Math.min(index, this.chosen.length)), 0, newSlot(pictogram)); });
  }

  /** True for the last shape of its row, which has no gap to its right. */
  isLastInRow(index: number): boolean {
    const here = this.placements[index], next = this.placements[index + 1];
    return !next || next.page !== here.page || next.y !== here.y;
  }

  /** The least room left between neighbouring outlines in the program, negative when they would touch. */
  private tightest(): number {
    const values = slacks(this.chosen, this.ruling, this.gap).filter((g): g is number => g !== null);
    return values.length ? Math.min(...values) : 0;
  }

  /**
   * Widen (+) or narrow (-) the gap to the right of each pictogram in `indices` by the same amount.
   * Shapes that are last in their row have no right neighbour and are skipped. Narrowing stops
   * where the first pair of outlines would touch: the amount is cut back for all of them together,
   * so they always change by the same distance. The other gaps of a justified row give way.
   * Returns the amount actually applied (0 when nothing could change).
   */
  adjustSpacing(indices: number | number[], delta: number): number {
    const chosen = [...new Set(asList(indices).filter((i) => i >= 0 && i < this.chosen.length && !this.isLastInRow(i)))]
      .sort((a, b) => a - b);
    if (!chosen.length || !delta) return 0;
    const slots = chosen.map((i) => this.chosen[i]);
    const before = slots.map((s) => s.spacing);
    // the amount that keeps every spacing within its bounds
    delta = Math.max(MIN_SPACING - Math.min(...before), Math.min(MAX_SPACING - Math.max(...before), delta));
    const floor = Math.min(0, this.tightest()); // shapes already overlapping are not made worse
    const apply = (amount: number) => slots.forEach((slot, i) => { slot.spacing = before[i] + amount; });
    const fits = (amount: number) => { apply(amount); return this.tightest() >= floor - EPSILON; };

    let amount: number;
    try {
      if (fits(delta)) amount = delta;
      else { // bisect for the largest share of the change that still leaves no overlap
        let low = 0, high = delta;
        for (let n = 0; n < 40; n++) {
          const middle = (low + high) / 2;
          if (fits(middle)) low = middle; else high = middle;
        }
        amount = low;
      }
    } finally {
      apply(0);
    }
    if (Math.abs(amount) < EPSILON) return 0;
    this.edit(() => apply(amount));
    return amount;
  }

  resetSpacing(indices: number | number[]): boolean {
    const chosen = [...new Set(asList(indices))].filter((i) => i >= 0 && i < this.chosen.length && this.chosen[i].spacing);
    if (!chosen.length) return false;
    this.edit(() => chosen.forEach((i) => { this.chosen[i].spacing = 0; }));
    return true;
  }

  /** Force (or stop forcing) a new row after each pictogram in `indices`, as one undo step. */
  setBreak(indices: number | number[], value: boolean) {
    const chosen = [...new Set(asList(indices))].filter((i) => i >= 0 && i < this.chosen.length);
    this.edit(() => chosen.forEach((i) => { this.chosen[i].breakAfter = value; }));
  }

  private pagesAt(scale: number): number {
    const placements = layoutRows(this.chosen, buildRuling({ ...this.setup, scale }), this.gap);
    return Math.max(0, ...placements.map((p) => p.page)) + 1;
  }

  /** The setup to draw with: for auto scale, the largest scale in range that needs the fewest pages. */
  private drawnSetup_(): PageSetup {
    if (!this.setup.auto) return this.setup;
    const target = this.pagesAt(AUTO_MIN_SCALE); // the fewest pages the readable range can reach
    const steps = Math.round((AUTO_MAX_SCALE - AUTO_MIN_SCALE) / AUTO_STEP);
    for (let n = 0; n <= steps; n++) {
      const scale = Math.round((AUTO_MAX_SCALE - n * AUTO_STEP) * 1e4) / 1e4;
      if (scale <= AUTO_MIN_SCALE || this.pagesAt(scale) === target) return { ...this.setup, scale: Math.max(scale, AUTO_MIN_SCALE) };
    }
    return { ...this.setup, scale: AUTO_MIN_SCALE };
  }

  /** Change paper size, orientation or scale; the program flows onto the new page. Not part of undo. */
  setPage(change: { preset?: string; landscape?: boolean; scale?: number; auto?: boolean }) {
    const c = this.setup;
    this.setup = makeSetup(change.preset ?? c.preset, change.landscape ?? c.landscape,
      change.scale === undefined ? c.scale : Math.round(change.scale * 1000) / 1000, change.auto ?? c.auto);
    this.refresh();
  }

  /** Set the text above or below the pictogram at `index`; empty text removes it. */
  setNote(index: number, where: Where, text: string) {
    if (!WHERE.includes(where) || index < 0 || index >= this.chosen.length) return;
    const clean = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").replace(/^\n+|\n+$/g, "");
    this.edit(() => { this.chosen[index][where] = clean; });
  }

  remove(index: number) { this.removeMany([index]); }

  removeMany(indices: number[]) {
    const wanted = [...new Set(indices.filter((i) => i >= 0 && i < this.chosen.length))].sort((a, b) => b - a);
    if (wanted.length) this.edit(() => wanted.forEach((i) => this.chosen.splice(i, 1)));
  }

  /** Take the pictogram at `source` out and reinsert it so it ends up at `target`. */
  move(source: number, target: number) {
    const count = this.chosen.length;
    if (source >= 0 && source < count && target >= 0 && target < count && source !== target) {
      this.edit(() => { this.chosen.splice(target, 0, this.chosen.splice(source, 1)[0]); });
    }
  }

  clear() { this.edit(() => { this.chosen = []; }); }

  /** The catalog pictogram a saved group came from: by id, else by its label. */
  private resolveSaved(groupId: string, label: string): Pictogram | null {
    const all = [...this.catalog.values()];
    const byId = all.find((p) => p.groupId === groupId);
    if (byId) return byId;
    const sameLabel = all.filter((p) => label && (p.name === label || p.name.startsWith(`${label} #`)));
    return sameLabel.length === 1 ? sameLabel[0] : null;
  }

  /** Replace the current program with a saved one. */
  load(saved: SavedProgram, fileName = "program") {
    const chosen: Slot[] = [], missing: string[] = [];
    for (const pose of saved.poses) {
      const pictogram = this.resolveSaved(pose.groupId, pose.label);
      if (pictogram) chosen.push({ pictogram, above: pose.above, below: pose.below, spacing: pose.spacing, breakAfter: pose.breakAfter });
      else missing.push(pose.label || pose.groupId);
    }
    this.openNotes = missing.length
      ? [`Could not match ${missing.length} saved pose(s) to the library and left them out: ${missing.join(", ")}`] : [];
    this.name = fileName.replace(/\.svg$/i, "").replace(/_\d{4}-\d{2}-\d{2}_\d{6}(-\d+)?$/, "") || "Program";
    this.chosen = chosen;
    this.setup = saved.setup;
    this.history.clear(); // a freshly opened program starts with a clean history
    this.refresh();
    return chosen.length;
  }

  /** Open the text of a program SVG saved by this tool. Throws if it is not one. */
  openProgram(text: string, fileName = "program"): number {
    return this.load(readProgram(text), fileName);
  }

  /** What to keep to rebuild this program later. */
  saved(): SavedProgram {
    return {
      poses: this.chosen.map((s) => ({
        groupId: s.pictogram.groupId, label: s.pictogram.name, above: s.above, below: s.below,
        spacing: s.spacing, breakAfter: s.breakAfter,
      })),
      setup: this.setup,
    };
  }

  /** Give the program a new file name. */
  rename(name: string): boolean {
    const clean = name.trim().replace(/[^\p{L}\p{N}_\-. ]+/gu, "_").replace(/^[ .]+|[ .]+$/g, "")
      .replace(/\.svg$/i, "").replace(/^[ .]+|[ .]+$/g, "");
    if (!clean || clean === this.name) return false;
    this.name = clean;
    return true;
  }

  private refresh() {
    this.drawn = this.drawnSetup_();
    this.ruling = buildRuling(this.drawn);
    this.placements = layoutRows(this.chosen, this.ruling, this.gap);
    this.rendered = null;
  }

  /** The drawn pages, built on first use after each change. */
  get render(): RenderedDocument {
    this.rendered ??= renderDocument(this.source, this.placements, this.drawn, this.setup);
    return this.rendered;
  }
}
