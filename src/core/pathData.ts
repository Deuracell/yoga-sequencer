/** Parses SVG path data ("d") into absolute segments; arcs become cubic Béziers. */
import type { Segment } from "./segments";

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

class Reader {
  pos = 0;
  constructor(readonly text: string) {}

  skipSeparators() {
    while (this.pos < this.text.length && /[\s,]/.test(this.text[this.pos])) this.pos++;
  }

  atCommand(): string | null {
    this.skipSeparators();
    const c = this.text[this.pos];
    return c && /[a-zA-Z]/.test(c) ? c : null;
  }

  atEnd(): boolean {
    this.skipSeparators();
    return this.pos >= this.text.length;
  }

  number(): number {
    this.skipSeparators();
    NUMBER.lastIndex = this.pos;
    const match = NUMBER.exec(this.text);
    if (!match) throw new Error(`bad path data near "${this.text.slice(this.pos, this.pos + 12)}"`);
    this.pos = NUMBER.lastIndex;
    return Number(match[0]);
  }

  flag(): number {
    this.skipSeparators();
    const c = this.text[this.pos];
    if (c !== "0" && c !== "1") throw new Error("bad arc flag in path data");
    this.pos++;
    return Number(c);
  }
}

export function parsePath(d: string): Segment[] {
  const out: Segment[] = [];
  const r = new Reader(d);
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let command = "";
  let prevCubic = null as [number, number] | null; // last cubic control point, for S
  let prevQuad = null as [number, number] | null; // last quad control point, for T

  while (!r.atEnd()) {
    const next = r.atCommand();
    if (next) {
      command = next;
      r.pos++;
    } else if (!command || command === "z" || command === "Z") {
      throw new Error("path data has a number without a command");
    }
    const rel = command === command.toLowerCase();
    const lower = command.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    let cubic = null as [number, number] | null;
    let quad = null as [number, number] | null;

    if (lower === "z") {
      out.push({ k: "Z" });
      cx = sx; cy = sy;
    } else if (lower === "m") {
      const x = r.number() + ox, y = r.number() + oy;
      out.push({ k: "M", x, y });
      cx = sx = x; cy = sy = y;
      command = rel ? "l" : "L"; // further pairs are implicit lineto
    } else if (lower === "l" || lower === "h" || lower === "v") {
      const x = lower === "v" ? cx : r.number() + ox;
      const y = lower === "h" ? cy : r.number() + oy;
      out.push({ k: "L", x, y });
      cx = x; cy = y;
    } else if (lower === "c") {
      const x1 = r.number() + ox, y1 = r.number() + oy, x2 = r.number() + ox, y2 = r.number() + oy;
      const x = r.number() + ox, y = r.number() + oy;
      out.push({ k: "C", x1, y1, x2, y2, x, y });
      cubic = [x2, y2];
      cx = x; cy = y;
    } else if (lower === "s") {
      const [x1, y1]: [number, number] = prevCubic ? [2 * cx - prevCubic[0], 2 * cy - prevCubic[1]] : [cx, cy];
      const x2 = r.number() + ox, y2 = r.number() + oy, x = r.number() + ox, y = r.number() + oy;
      out.push({ k: "C", x1, y1, x2, y2, x, y });
      cubic = [x2, y2];
      cx = x; cy = y;
    } else if (lower === "q") {
      const x1 = r.number() + ox, y1 = r.number() + oy, x = r.number() + ox, y = r.number() + oy;
      out.push({ k: "Q", x1, y1, x, y });
      quad = [x1, y1];
      cx = x; cy = y;
    } else if (lower === "t") {
      const [x1, y1]: [number, number] = prevQuad ? [2 * cx - prevQuad[0], 2 * cy - prevQuad[1]] : [cx, cy];
      const x = r.number() + ox, y = r.number() + oy;
      out.push({ k: "Q", x1, y1, x, y });
      quad = [x1, y1];
      cx = x; cy = y;
    } else if (lower === "a") {
      const rx = r.number(), ry = r.number(), rot = r.number();
      const large = r.flag(), sweep = r.flag();
      const x = r.number() + ox, y = r.number() + oy;
      out.push(...arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y));
      cx = x; cy = y;
    } else {
      throw new Error(`unknown path command "${command}"`);
    }
    prevCubic = cubic;
    prevQuad = quad;
    if (!(lower in ARGS)) break;
  }
  return out;
}

/** Endpoint arc → cubic Béziers (SVG implementation notes, F.6). */
export function arcToCubics(x0: number, y0: number, rxIn: number, ryIn: number, rotation: number,
  large: number, sweep: number, x: number, y: number): Segment[] {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if ((x0 === x && y0 === y)) return [];
  if (rx === 0 || ry === 0) return [{ k: "L", x, y }];
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy, y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: Segment[] = [];
  let t = theta1;
  const point = (a: number): [number, number] => [
    cx + rx * Math.cos(a) * cosPhi - ry * Math.sin(a) * sinPhi,
    cy + rx * Math.cos(a) * sinPhi + ry * Math.sin(a) * cosPhi];
  const deriv = (a: number): [number, number] => [
    -rx * Math.sin(a) * cosPhi - ry * Math.cos(a) * sinPhi,
    -rx * Math.sin(a) * sinPhi + ry * Math.cos(a) * cosPhi];
  for (let i = 0; i < count; i++) {
    const a0 = t, a1 = t + step;
    const [px0, py0] = point(a0), [dx0, dy0] = deriv(a0);
    const [px1, py1] = i === count - 1 ? [x, y] : point(a1), [dx1, dy1] = deriv(a1);
    out.push({ k: "C", x1: px0 + k * dx0, y1: py0 + k * dy0, x2: px1 - k * dx1, y2: py1 - k * dy1, x: px1, y: py1 });
    t = a1;
  }
  return out;
}
