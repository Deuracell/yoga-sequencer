/** XML names shared by everything that reads or writes the SVG. */
export const SVG_NS = "http://www.w3.org/2000/svg";
export const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";
export const SODIPODI_NS = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd";
export const XML_NS = "http://www.w3.org/XML/1998/namespace";

export const REFERENCE_LABEL = "Referenssträck";
export const METADATA_ID = "yoga-builder-program";

export const labelOf = (el: Element): string => el.getAttributeNS(INKSCAPE_NS, "label") ?? "";

/** Direct child elements in the SVG namespace with the given local name. */
export function children(parent: Element, name?: string): Element[] {
  return Array.from(parent.children).filter(
    (c) => c.namespaceURI === SVG_NS && (name === undefined || c.localName === name));
}

export function parseSvg(text: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const error = doc.querySelector("parsererror");
  if (error || doc.documentElement.localName !== "svg") throw new Error("not a readable SVG file");
  return doc.documentElement as unknown as SVGSVGElement;
}
