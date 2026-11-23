/** Pose-name text blocks printed above or below a shape, fitted to the room the shape has. */
import type { DisplayName } from "./poseNames";

const FONT_SIZE = 3.0; // mm, a little smaller than the free-text notes
const LEADING = 1.25; // line height as a multiple of the font size
const CHAR_WIDTH = 0.58; // average glyph width as a multiple of the font size (bold sans-serif, a safe estimate)
const MIN_SHRINK = 0.6; // a long single word may shrink the block to this fraction before it is left to overflow

export interface NameLine { text: string; style: string }

export interface NameBlock {
  lines: NameLine[];
  size: number; // mm
  leading: number; // mm
  height: number; // mm
}

/** Greedy word wrap on an estimated character count. */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && (current + " " + word).length > maxChars) { lines.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * The name (and optionally the Sanskrit line) as wrapped lines that fit `width` mm.
 * A word too long for the width shrinks the whole block, down to a limit, so neighbours' names do not collide.
 */
export function nameBlock(name: DisplayName, width: number, scale: number): NameBlock | null {
  if (!name.primary) return null;
  const texts: [string, string][] = [[name.primary, "font-weight:bold"]];
  if (name.sanskrit) texts.push([name.sanskrit, "font-style:italic"]);

  const base = FONT_SIZE * scale;
  const longest = Math.max(...texts.flatMap(([t]) => t.split(/\s+/).map((w) => w.length)));
  const charsAt = (size: number) => Math.max(1, Math.floor(width / (size * CHAR_WIDTH)));
  const size = longest > charsAt(base) ? Math.max(base * MIN_SHRINK, (width / (longest * CHAR_WIDTH))) : base;

  const lines = texts.flatMap(([text, style]) => wrapWords(text, charsAt(size)).map((t) => ({ text: t, style })));
  const leading = size * LEADING;
  return { lines, size, leading, height: lines.length * leading };
}
