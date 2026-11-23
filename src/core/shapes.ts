/** Turns drawable SVG elements into absolute-coordinate segments, with their look. */
import { IDENTITY, meanScale, multiply, parseTransform, type Matrix } from "./matrix";
import { parsePath } from "./pathData";
import { transformSegments, type Segment } from "./segments";
import { SVG_NS, labelOf } from "./svgNames";

export const SHAPE_TAGS = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const KAPPA = 0.5522847498307936;

export interface Shape {
  element: Element;
  segments: Segment[]; // absolute (page) coordinates
  look: string; // stroke, fill and width, for telling carbon copies from different drawings
  isAnchor: boolean;
}

export function isAnchorElement(el: Element): boolean {
  return labelOf(el) === "Anchor" || (el.getAttribute("id") ?? "").includes("_anchor");
}

const num = (el: Element, name: string, fallback = 0) => {
  const value = parseFloat(el.getAttribute(name) ?? "");
  return Number.isFinite(value) ? value : fallback;
};

function ellipse(cx: number, cy: number, rx: number, ry: number): Segment[] {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return [
    { k: "M", x: cx + rx, y: cy },
    { k: "C", x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { k: "C", x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { k: "C", x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { k: "C", x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { k: "Z" },
  ];
}

function polyline(points: string | null, close: boolean): Segment[] {
  const v = (points ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) out.push({ k: i ? "L" : "M", x: v[i], y: v[i + 1] });
  if (close && out.length) out.push({ k: "Z" });
  return out;
}

/** The element's outline in its own coordinates, or null when it is not a shape (or has no size). */
export function localSegments(el: Element): Segment[] | null {
  switch (el.localName) {
    case "path":
      try { return parsePath(el.getAttribute("d") ?? ""); } catch { return null; }
    case "circle": {
      const r = num(el, "r");
      return r > 0 ? ellipse(num(el, "cx"), num(el, "cy"), r, r) : null;
    }
    case "ellipse": {
      const rx = num(el, "rx"), ry = num(el, "ry");
      return rx > 0 && ry > 0 ? ellipse(num(el, "cx"), num(el, "cy"), rx, ry) : null;
    }
    case "rect": {
      const x = num(el, "x"), y = num(el, "y"), w = num(el, "width"), h = num(el, "height");
      if (w <= 0 || h <= 0) return null;
      return [{ k: "M", x, y }, { k: "L", x: x + w, y }, { k: "L", x: x + w, y: y + h }, { k: "L", x, y: y + h }, { k: "Z" }];
    }
    case "line":
      return [{ k: "M", x: num(el, "x1"), y: num(el, "y1") }, { k: "L", x: num(el, "x2"), y: num(el, "y2") }];
    case "polyline":
      return polyline(el.getAttribute("points"), false);
    case "polygon":
      return polyline(el.getAttribute("points"), true);
    default:
      return null;
  }
}

/** One style property of an element: the style attribute wins over the presentation attribute. */
function ownProperty(el: Element, name: string): string | null {
  const style = el.getAttribute("style");
  if (style) {
    for (const part of style.split(";")) {
      const at = part.indexOf(":");
      if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
    }
  }
  return el.getAttribute(name);
}

/** Inherited property value, looking up through the ancestors. */
function property(el: Element, name: string): string | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const value = ownProperty(node, name);
    if (value !== null && value !== "inherit") return value;
  }
  return null;
}

function colour(text: string | null, fallback: string): string {
  if (text === null) return fallback;
  const value = text.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/.exec(value);
  if (rgb) return "#" + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return value;
}

function look(el: Element, m: Matrix): string {
  const width = parseFloat(property(el, "stroke-width") ?? "1") * meanScale(m);
  return [colour(property(el, "stroke"), "none"), colour(property(el, "fill"), "#000000"),
    (Number.isFinite(width) ? width : 0).toFixed(3)].join("|");
}

/** Absolute transform of an element: every ancestor's transform and its own, root first. */
export function absoluteTransform(el: Element): Matrix {
  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) chain.unshift(node);
  return chain.reduce((m, node) => multiply(m, parseTransform(node.getAttribute("transform"))), IDENTITY);
}

export function shapeOf(el: Element, m: Matrix): Shape | null {
  if (!SHAPE_TAGS.has(el.localName)) return null;
  const local = localSegments(el);
  if (!local || !local.length) return null;
  return { element: el, segments: transformSegments(local, m), look: look(el, m), isAnchor: isAnchorElement(el) };
}

/** Every drawable shape below `group` (anchors included), with absolute geometry. */
export function shapesIn(group: Element): Shape[] {
  const out: Shape[] = [];
  const walk = (el: Element, m: Matrix) => {
    for (const child of Array.from(el.children)) {
      if (child.namespaceURI !== SVG_NS) continue;
      const cm = multiply(m, parseTransform(child.getAttribute("transform")));
      if (child.localName === "g") walk(child, cm);
      else {
        const shape = shapeOf(child, cm);
        if (shape) out.push(shape);
      }
    }
  };
  walk(group, absoluteTransform(group));
  return out;
}

