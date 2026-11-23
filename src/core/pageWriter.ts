/** Writes placed pictograms into a copy of the source SVG: one multi-page document, plus per-page views. */
import type { Placement } from "./layout";
import { nameBlock } from "./labels";
import { noteAnchor, noteElement, textBlock, WHERE, type Where } from "./notes";
import type { NameBook } from "./poseNames";
import { LINES_PER_ROW, buildRuling, pageHeight, pageWidth, type PageSetup } from "./pageSetup";
import type { Slot } from "./slot";
import { INKSCAPE_NS, METADATA_ID, REFERENCE_LABEL, SODIPODI_NS, SVG_NS, children, labelOf } from "./svgNames";

const PAGE_GAP = 20; // mm between pages side by side on the canvas
const GROUPMODE = "groupmode";
const LINE_STYLE = "opacity:0.2;fill:none;stroke:#000000;stroke-width:0.5;stroke-linecap:round;"
  + "stroke-linejoin:round;stroke-dasharray:1, 1;stroke-dashoffset:0;stroke-opacity:1";

export const pageStep = (setup: PageSetup) => pageWidth(setup) + PAGE_GAP;

export interface RenderedDocument {
  /** The whole program as one SVG file (pages side by side on the canvas), for saving. */
  document: string;
  pages: number;
  /** A standalone SVG element showing one page; shapes carry data-index for the preview. */
  pageView(page: number, withGuides?: boolean, onlyThisPage?: boolean): SVGSVGElement;
  /** One page as a stand-alone SVG file (nothing of the other pages, and no data for reopening). */
  pageFile(page: number): string;
}

/** The poses and notes embedded in every saved program, so it can be opened again. */
function metadataElement(doc: Document, slots: Slot[], record: PageSetup): Element {
  const node = doc.createElementNS(SVG_NS, "metadata");
  node.setAttribute("id", METADATA_ID);
  node.textContent = JSON.stringify({
    poses: slots.map((s) => s.pictogram.groupId),
    notes: slots.map((s) => ({ above: s.above, below: s.below, spacing: s.spacing, break: s.breakAfter })),
    page: { preset: record.preset, landscape: record.landscape, scale: record.scale, auto: record.auto, labels: record.labels },
  });
  return node;
}

function layerWithId(root: Element, id: string): Element {
  const layer = children(root, "g").find((g) => g.getAttribute("id") === id
    && (id !== "layer1" || g.getAttributeNS(INKSCAPE_NS, GROUPMODE) === "layer"));
  if (!layer) throw new Error(`source SVG has no ${id}`);
  return layer;
}

function suffixIds(element: Element, suffix: string) {
  for (const node of [element, ...Array.from(element.querySelectorAll("*"))]) {
    const id = node.getAttribute("id");
    if (id) node.setAttribute("id", id + suffix);
  }
}

/** A copy of `group` scaled about its anchor and moved so the anchor lands on (x, y). */
function placedGroup(group: Element, p: Placement, x: number, suffix: string): Element {
  const clone = group.cloneNode(true) as Element;
  const old = clone.getAttribute("transform");
  clone.setAttribute("transform", `translate(${x.toFixed(5)},${p.y.toFixed(5)}) scale(${p.scale.toFixed(5)}) `
    + `translate(${(-p.pictogram.anchorX).toFixed(5)},${(-p.pictogram.anchorY).toFixed(5)})${old ? " " + old : ""}`);
  suffixIds(clone, suffix);
  return clone;
}

/** The triplets of dashed lines for one page, drawn from the page setup (not copied from the source). */
function referenceLines(doc: Document, setup: PageSetup, page: number, offset: number): Element {
  const ruling = buildRuling(setup);
  const group = doc.createElementNS(SVG_NS, "g");
  group.setAttribute("id", `reference-pg${page}`);
  group.setAttributeNS(INKSCAPE_NS, "inkscape:label", REFERENCE_LABEL);
  ruling.rows.forEach((row, n) => {
    for (let k = 0; k < LINES_PER_ROW; k++) {
      const y = row.top + k * ruling.lineSpacing;
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("id", `line-pg${page}r${n}l${k}`);
      path.setAttributeNS(INKSCAPE_NS, "inkscape:label", String(k + 1));
      path.setAttribute("style", LINE_STYLE);
      path.setAttribute("d", `M ${(offset + ruling.left).toFixed(4)},${y.toFixed(4)} H ${(offset + ruling.right).toFixed(4)}`);
      group.appendChild(path);
    }
  });
  return group;
}

/** Declare Inkscape pages (1.2+) side by side. */
function addPages(root: Element, pages: number, setup: PageSetup) {
  const view = Array.from(root.getElementsByTagNameNS(SODIPODI_NS, "namedview"))[0];
  if (!view) return;
  for (const old of Array.from(view.getElementsByTagNameNS(INKSCAPE_NS, "page"))) old.remove();
  for (let page = 0; page < pages; page++) {
    const el = root.ownerDocument.createElementNS(INKSCAPE_NS, "inkscape:page");
    el.setAttribute("id", `page${page + 1}`);
    el.setAttribute("x", String(page * pageStep(setup)));
    el.setAttribute("y", "0");
    el.setAttribute("width", String(pageWidth(setup)));
    el.setAttribute("height", String(pageHeight(setup)));
    view.appendChild(el);
  }
}

/**
 * The printed name of the shape at `index`, fitted to the room between its neighbours' midpoints.
 * `reach` is how far from the shape the block extends (so a note can start beyond it).
 */
function nameElements(doc: Document, placements: Placement[], index: number, names: NameBook, setup: PageSetup,
  pageOffset: number, id: string): { element: Element; reach: number } | null {
  const where = setup.labels.where as Where;
  const p = placements[index];
  const display = names.display(p.pictogram.groupId, p.pictogram.name, setup.labels.lang,
    setup.labels.sanskrit && setup.labels.lang !== "sa");
  const sameRow = (q?: Placement) => q && q.page === p.page && q.y === p.y ? q : undefined;
  const prev = sameRow(placements[index - 1]), next = sameRow(placements[index + 1]);
  const room = 8 * p.scale; // what a row end may use beyond its shape
  const left = prev ? (prev.x + prev.width + p.x) / 2 : p.x - room;
  const right = next ? (p.x + p.width + next.x) / 2 : p.x + p.width + room;
  const centre = p.x + p.width / 2;
  const width = Math.max(p.width, 2 * Math.min(centre - left, right - centre));
  const block = nameBlock(display, width, p.scale);
  if (!block) return null;
  const [x, edge] = noteAnchor(p, where);
  const element = textBlock(doc, where, block.lines, x + pageOffset, edge, block.size, block.leading, id, `Name ${where}`);
  return { element, reach: block.height + 1.2 * p.scale };
}

const serialize = (root: Element) => `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(root)}`;

/**
 * `drawn` is what is drawn (with the scale actually used); `record` is what the file remembers
 * for reopening (the same, unless the scale was chosen automatically).
 */
export function renderDocument(source: Element, placements: Placement[], drawn: PageSetup, record: PageSetup = drawn,
  names: NameBook): RenderedDocument {
  const step = pageStep(drawn);
  const pages = Math.max(0, ...placements.map((p) => p.page)) + 1;
  const root = source.cloneNode(true) as Element;
  const doc = root.ownerDocument;
  root.setAttribute("width", `${pageWidth(drawn)}mm`);
  root.setAttribute("height", `${pageHeight(drawn)}mm`);
  root.setAttribute("viewBox", `0 0 ${pageWidth(drawn)} ${pageHeight(drawn)}`);

  const layer = layerWithId(root, "layer1");
  const sources = new Map(children(layer, "g").map((g) => [g.getAttribute("id")!, g]));
  layer.replaceChildren();
  const reference = layerWithId(root, "layer2");
  // the source's own lines only served to draw the pictograms against
  for (const old of children(reference, "g").filter((g) => labelOf(g) === REFERENCE_LABEL)) old.remove();

  const groups: Element[] = [];
  for (let page = 0; page < pages; page++) {
    reference.appendChild(referenceLines(doc, drawn, page, page * step));
    let n = 0; // numbers the shapes within their page
    placements.forEach((placed, index) => {
      if (placed.page !== page) return;
      const group = placedGroup(sources.get(placed.pictogram.groupId)!, placed, placed.x + page * step, `-p${page}n${n}`);
      layer.appendChild(group);
      groups.push(group);
      for (const where of WHERE) {
        const text = placed.slot[where];
        const name = where === drawn.labels.where ? nameElements(doc, placements, index, names, drawn, page * step, `name-${where}-p${page}n${n}`) : null;
        if (name) layer.appendChild(name.element);
        // a note on the same side as the printed name goes just beyond it
        if (text) layer.appendChild(noteElement(doc, placed, where, text, page * step, `note-${where}-p${page}n${n}`, index, name?.reach ?? 0));
      }
      n++;
    });
  }
  if (pages > 1) addPages(root, pages, drawn);
  root.appendChild(metadataElement(doc, placements.map((p) => p.slot), record));
  const document = serialize(root);

  // from here on only the views are affected: lets the browser find each shape
  groups.forEach((group, index) => group.setAttribute("data-index", String(index))); // pages are in placement order

  /** Remove everything that belongs to the other pages, which sit beside this one on the canvas. */
  const dropOtherPages = (view: Element, page: number) => {
    const onPage = (id: string | null, pattern: RegExp) => { const m = pattern.exec(id ?? ""); return !m || Number(m[1]) === page; };
    for (const el of children(layerWithId(view, "layer1"))) if (!onPage(el.getAttribute("id"), /-p(\d+)n\d+$/)) el.remove();
    for (const el of children(layerWithId(view, "layer2"))) if (!onPage(el.getAttribute("id"), /^reference-pg(\d+)$/)) el.remove();
  };

  const pageView = (page: number, withGuides = true, onlyThisPage = false): SVGSVGElement => {
    const view = root.cloneNode(true) as unknown as SVGSVGElement;
    if (onlyThisPage) dropOtherPages(view, page);
    view.setAttribute("viewBox", `${page * step} 0 ${pageWidth(drawn)} ${pageHeight(drawn)}`);
    if (!withGuides) {
      for (const g of Array.from(view.querySelectorAll("g"))) if (labelOf(g) === REFERENCE_LABEL) g.remove();
    }
    return view;
  };

  return {
    document, pages, pageView,
    pageFile(page) {
      const view = pageView(page, true, true);
      view.querySelectorAll("[data-index]").forEach((el) => el.removeAttribute("data-index"));
      view.querySelectorAll("metadata, page").forEach((el) => el.remove());
      return serialize(view);
    },
  };
}

