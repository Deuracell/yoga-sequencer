/** A pictogram's outline as left/right extents per thin horizontal slice, and how close two may sit. */
import type { Segment } from "./segments";
import type { Shape } from "./shapes";

export type Silhouette = Map<number, [number, number]>;

const SLICE = 0.5; // mm of height per slice
const STEP = 0.2; // mm between sample points along a straight line
const CURVE_STEPS = 40;

/** Sample points along every segment of one shape's outline. */
function* points(segments: Segment[]): Generator<[number, number]> {
  let cx = 0, cy = 0, sx = 0, sy = 0;
  for (const s of segments) {
    if (s.k === "M") { cx = sx = s.x; cy = sy = s.y; continue; }
    if (s.k === "L" || s.k === "Z") {
      const ex = s.k === "Z" ? sx : s.x, ey = s.k === "Z" ? sy : s.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(ex - cx, ey - cy) / STEP));
      for (let n = 0; n <= steps; n++) yield [cx + ((ex - cx) * n) / steps, cy + ((ey - cy) * n) / steps];
      cx = ex; cy = ey;
    } else if (s.k === "Q") {
      for (let n = 0; n <= CURVE_STEPS; n++) {
        const t = n / CURVE_STEPS, u = 1 - t;
        yield [u * u * cx + 2 * u * t * s.x1 + t * t * s.x, u * u * cy + 2 * u * t * s.y1 + t * t * s.y];
      }
      cx = s.x; cy = s.y;
    } else {
      for (let n = 0; n <= CURVE_STEPS; n++) {
        const t = n / CURVE_STEPS, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        yield [a * cx + b * s.x1 + c * s.x2 + d * s.x, a * cy + b * s.y1 + c * s.y2 + d * s.y];
      }
      cx = s.x; cy = s.y;
    }
  }
}

/** {slice: (leftmost, rightmost)} with x measured from `left` and slices from `anchorY`, all in mm. */
export function outline(shapes: Shape[], left: number, anchorY: number): Silhouette {
  const spans: Silhouette = new Map();
  for (const shape of shapes) {
    for (const [px, py] of points(shape.segments)) {
      const key = Math.floor((py - anchorY) / SLICE);
      const x = px - left;
      const span = spans.get(key);
      spans.set(key, span ? [Math.min(span[0], x), Math.max(span[1], x)] : [x, x]);
    }
  }
  return spans;
}

/**
 * How far the right pictogram's box may overlap the left one's before their outlines touch.
 * Both sit on the same row, so slices line up; only a horizontal slide matters.
 * Never more than the narrower box, so shapes cannot pass through each other.
 */
export function room(left: Silhouette, leftWidth: number, right: Silhouette, rightWidth: number): number {
  let best = Math.min(leftWidth, rightWidth);
  for (const [key, [, far]] of left) {
    const other = right.get(key);
    if (other) best = Math.min(best, leftWidth - far + other[0]);
  }
  return Math.max(0, best);
}
