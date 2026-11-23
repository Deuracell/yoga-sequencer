/** Text notes above and below a pictogram: where they go and how they are drawn. */
import type { Placement } from "./layout";
import { INKSCAPE_NS, SODIPODI_NS, SVG_NS, XML_NS } from "./svgNames";

const FONT_SIZE = 3.4; // mm
const LINE_HEIGHT = 4.4;
const GAP = 2.0; // between the drawn pose (or its triplet) and the text block
export const WHERE = ["above", "below"] as const;
export type Where = (typeof WHERE)[number];

/** Top and bottom of what occupies the slot: its triplet, or the drawing if that sticks out. */
export function extent(p: Placement): [number, number] {
  return [Math.min(p.top, p.y), Math.max(p.top + p.height, p.bottom)];
}

/** [centre x, edge y] in page coordinates; the edge is the block's bottom (above) or top (below). */
export function noteAnchor(p: Placement, where: Where): [number, number] {
  const [low, high] = extent(p);
  const gap = GAP * p.scale;
  return [p.x + p.width / 2, where === "above" ? low - gap : high + gap];
}

export function noteElement(doc: Document, p: Placement, where: Where, text: string, pageOffset: number,
  id: string, index: number): Element {
  const [centre, edge] = noteAnchor(p, where);
  const lines = text.split("\n");
  const size = FONT_SIZE * p.scale, leading = LINE_HEIGHT * p.scale;
  // the block grows upwards from the edge (above) or downwards from it (below)
  const first = where === "above" ? edge - 0.8 * p.scale - (lines.length - 1) * leading : edge + size;
  const x = centre + pageOffset;
  const node = doc.createElementNS(SVG_NS, "text");
  node.setAttribute("id", id);
  node.setAttributeNS(INKSCAPE_NS, "inkscape:label", `Note ${where}`);
  node.setAttribute("data-note-index", String(index));
  node.setAttribute("x", x.toFixed(4));
  node.setAttribute("y", first.toFixed(4));
  node.setAttributeNS(XML_NS, "xml:space", "preserve");
  node.setAttribute("style", `font-size:${size.toFixed(3)}px;line-height:${(LINE_HEIGHT / FONT_SIZE).toFixed(3)};`
    + "font-family:sans-serif;text-anchor:middle;text-align:center;fill:#000000;stroke:none");
  lines.forEach((line, n) => {
    const span = doc.createElementNS(SVG_NS, "tspan");
    span.setAttributeNS(SODIPODI_NS, "sodipodi:role", "line");
    span.setAttribute("x", x.toFixed(4));
    span.setAttribute("y", (first + n * leading).toFixed(4));
    span.setAttribute("id", `${id}-l${n}`);
    span.textContent = line || " ";
    node.appendChild(span);
  });
  return node;
}

/** Inverse of noteElement: the lines of a saved <text>, joined with newlines. */
export function readNoteText(node: Element): string {
  return Array.from(node.children)
    .filter((c) => c.localName === "tspan")
    .map((s) => { const t = s.textContent ?? ""; return t === " " ? "" : t; })
    .join("\n");
}
