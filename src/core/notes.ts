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

export interface TextLine { text: string; style?: string }

/** A multi-line, centred <text> whose block starts at `edge` and grows away from the shape; each line is its own tspan. */
export function textBlock(doc: Document, where: Where, lines: TextLine[], x: number, edge: number,
  size: number, leading: number, id: string, label: string, extra: Record<string, string> = {}): Element {
  // the block grows upwards from the edge (above) or downwards from it (below)
  const first = where === "above" ? edge - 0.8 * (size / FONT_SIZE) - (lines.length - 1) * leading : edge + size;
  const node = doc.createElementNS(SVG_NS, "text");
  node.setAttribute("id", id);
  node.setAttributeNS(INKSCAPE_NS, "inkscape:label", label);
  for (const [k, v] of Object.entries(extra)) node.setAttribute(k, v);
  node.setAttribute("x", x.toFixed(4));
  node.setAttribute("y", first.toFixed(4));
  node.setAttributeNS(XML_NS, "xml:space", "preserve");
  node.setAttribute("style", `font-size:${size.toFixed(3)}px;line-height:${(leading / size).toFixed(3)};`
    + "font-family:sans-serif;text-anchor:middle;text-align:center;fill:#000000;stroke:none");
  lines.forEach((line, n) => {
    const span = doc.createElementNS(SVG_NS, "tspan");
    span.setAttributeNS(SODIPODI_NS, "sodipodi:role", "line");
    span.setAttribute("x", x.toFixed(4));
    span.setAttribute("y", (first + n * leading).toFixed(4));
    span.setAttribute("id", `${id}-l${n}`);
    if (line.style) span.setAttribute("style", line.style);
    span.textContent = line.text || " ";
    node.appendChild(span);
  });
  return node;
}

/** The user's text note. `offset` pushes it further from the shape (to make room for a printed name). */
export function noteElement(doc: Document, p: Placement, where: Where, text: string, pageOffset: number,
  id: string, index: number, offset = 0): Element {
  const [centre, edge] = noteAnchor(p, where);
  return textBlock(doc, where, text.split("\n").map((t) => ({ text: t })), centre + pageOffset,
    where === "above" ? edge - offset : edge + offset, FONT_SIZE * p.scale, LINE_HEIGHT * p.scale, id, `Note ${where}`,
    { "data-note-index": String(index) });
}

/** Inverse of noteElement: the lines of a saved <text>, joined with newlines. */
export function readNoteText(node: Element): string {
  return Array.from(node.children)
    .filter((c) => c.localName === "tspan")
    .map((s) => { const t = s.textContent ?? ""; return t === " " ? "" : t; })
    .join("\n");
}
