/** Path segments in absolute coordinates, reduced to the few kinds the geometry code handles. */
import { apply, type Matrix } from "./matrix";

export type Segment =
  | { k: "M"; x: number; y: number }
  | { k: "L"; x: number; y: number }
  | { k: "Q"; x1: number; y1: number; x: number; y: number }
  | { k: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { k: "Z" };

export function transformSegments(segments: Segment[], m: Matrix): Segment[] {
  return segments.map((s): Segment => {
    switch (s.k) {
      case "M":
      case "L": {
        const [x, y] = apply(m, s.x, s.y);
        return { k: s.k, x, y };
      }
      case "Q": {
        const [x1, y1] = apply(m, s.x1, s.y1);
        const [x, y] = apply(m, s.x, s.y);
        return { k: "Q", x1, y1, x, y };
      }
      case "C": {
        const [x1, y1] = apply(m, s.x1, s.y1);
        const [x2, y2] = apply(m, s.x2, s.y2);
        const [x, y] = apply(m, s.x, s.y);
        return { k: "C", x1, y1, x2, y2, x, y };
      }
      default:
        return s;
    }
  });
}

export type Box = [number, number, number, number]; // x0, y0, x1, y1

/** Parameter values in (0,1) where a cubic's derivative along one axis is zero. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** Exact geometric bounding box (no stroke), or null for a path with nothing to draw. */
export function boundingBox(segments: Segment[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let cx = 0, cy = 0, startX = 0, startY = 0, drew = false;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    drew = true;
  };
  for (const s of segments) {
    switch (s.k) {
      case "M":
        cx = startX = s.x; cy = startY = s.y;
        break;
      case "L":
        add(cx, cy); add(s.x, s.y);
        cx = s.x; cy = s.y;
        break;
      case "Q": {
        // elevate to a cubic so one routine covers both
        const c1x = cx + (2 / 3) * (s.x1 - cx), c1y = cy + (2 / 3) * (s.y1 - cy);
        const c2x = s.x + (2 / 3) * (s.x1 - s.x), c2y = s.y + (2 / 3) * (s.y1 - s.y);
        addCubic(add, cx, cy, c1x, c1y, c2x, c2y, s.x, s.y);
        cx = s.x; cy = s.y;
        break;
      }
      case "C":
        addCubic(add, cx, cy, s.x1, s.y1, s.x2, s.y2, s.x, s.y);
        cx = s.x; cy = s.y;
        break;
      case "Z":
        if (cx !== startX || cy !== startY) { add(cx, cy); add(startX, startY); }
        cx = startX; cy = startY;
        break;
    }
  }
  return drew ? [x0, y0, x1, y1] : null;
}

function addCubic(add: (x: number, y: number) => void,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  add(x0, y0); add(x3, y3);
  for (const t of cubicExtrema(x0, x1, x2, x3)) add(cubicAt(x0, x1, x2, x3, t), cubicAt(y0, y1, y2, y3, t));
  for (const t of cubicExtrema(y0, y1, y2, y3)) add(cubicAt(x0, x1, x2, x3, t), cubicAt(y0, y1, y2, y3, t));
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3])),
  ];
}
