/** Tells carbon copies (same drawing, possibly moved) from genuinely different drawings. */
import type { Shape } from "./shapes";

const TOLERANCE = 0.02; // mm

type Points = [number, number][];
interface DrawnShape { segments: { kind: string; points: Points }[]; look: string }
export type Signature = DrawnShape[];

function pointsOf(s: Shape["segments"][number]): Points {
  switch (s.k) {
    case "M": case "L": return [[s.x, s.y]];
    case "Q": return [[s.x1, s.y1], [s.x, s.y]];
    case "C": return [[s.x1, s.y1], [s.x2, s.y2], [s.x, s.y]];
    default: return [];
  }
}

/** Absolute geometry and look of every shape, shifted so the drawing's top-left is the origin. */
export function drawingSignature(shapes: Shape[]): Signature {
  const drawn = shapes.map((shape) => ({
    segments: shape.segments.map((s) => ({ kind: s.k, points: pointsOf(s) })),
    look: shape.look,
  }));
  const all = drawn.flatMap((d) => d.segments.flatMap((s) => s.points));
  const ox = all.length ? Math.min(...all.map((p) => p[0])) : 0;
  const oy = all.length ? Math.min(...all.map((p) => p[1])) : 0;
  return drawn.map((d) => ({
    look: d.look,
    segments: d.segments.map((s) => ({ kind: s.kind, points: s.points.map(([x, y]): [number, number] => [x - ox, y - oy]) })),
  }));
}

export function sameDrawing(a: Signature, b: Signature): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].look !== b[i].look || a[i].segments.length !== b[i].segments.length) return false;
    for (let j = 0; j < a[i].segments.length; j++) {
      const sa = a[i].segments[j], sb = b[i].segments[j];
      if (sa.kind !== sb.kind || sa.points.length !== sb.points.length) return false;
      for (let k = 0; k < sa.points.length; k++) {
        if (Math.abs(sa.points[k][0] - sb.points[k][0]) > TOLERANCE
          || Math.abs(sa.points[k][1] - sb.points[k][1]) > TOLERANCE) return false;
      }
    }
  }
  return true;
}
