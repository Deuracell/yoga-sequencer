/** 2D affine transforms as SVG's [a b c d e f]. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `first` applied after `second` (SVG order: parent * child). */
export function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Uniform-scale equivalent: how much the matrix stretches lengths on average. */
export function meanScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

const TRANSFORM = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;

/** Parses an SVG transform attribute; an unreadable one counts as identity. */
export function parseTransform(text: string | null): Matrix {
  let result = IDENTITY;
  if (!text) return result;
  for (const match of text.matchAll(TRANSFORM)) {
    const v = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (v.some(Number.isNaN)) continue;
    result = multiply(result, single(match[1], v));
  }
  return result;
}

function single(kind: string, v: number[]): Matrix {
  switch (kind) {
    case "matrix":
      return v.length === 6 ? (v as Matrix) : IDENTITY;
    case "translate":
      return [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    case "scale":
      return [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    case "rotate": {
      const r = ((v[0] ?? 0) * Math.PI) / 180;
      const rotation: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      if (v.length < 3) return rotation;
      return multiply(multiply([1, 0, 0, 1, v[1], v[2]], rotation), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    case "skewX":
      return [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    case "skewY":
      return [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    default:
      return IDENTITY;
  }
}
