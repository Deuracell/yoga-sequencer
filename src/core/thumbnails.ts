/** Standalone inline-SVG thumbnails for each pictogram. */
import type { Pictogram } from "./catalog";
import { SVG_NS } from "./svgNames";

const PADDING = 1.5; // mm around the drawing

function clean(element: Element, suffix: string) {
  for (const node of [element, ...Array.from(element.querySelectorAll("*"))]) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.namespaceURI) node.removeAttributeNode(attr); // inkscape / sodipodi metadata
    }
    const id = node.getAttribute("id");
    if (id) node.setAttribute("id", id + suffix);
  }
  for (const node of Array.from(element.querySelectorAll("*"))) {
    if ((node.getAttribute("id") ?? "").includes("_anchor")) node.remove();
  }
}

export function thumbnailSvg(group: Element, p: Pictogram, index: number): string {
  const box = [p.anchorX - PADDING, p.top - PADDING, p.width + 2 * PADDING, p.height + 2 * PADDING];
  const svg = group.ownerDocument.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", box.map((v) => v.toFixed(3)).join(" "));
  const copy = group.cloneNode(true) as Element;
  clean(copy, `-t${index}`);
  svg.appendChild(copy);
  return new XMLSerializer().serializeToString(svg);
}
