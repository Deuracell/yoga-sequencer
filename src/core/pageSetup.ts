/** Paper size, orientation and scale, and the triplets of reference lines they give. */
import { DEFAULT_LABELS, labelsFromJson, type LabelSetup } from "./labelSetup";

// name: [label, short side mm, long side mm]
export const PRESETS: Record<string, [string, number, number]> = {
  a5: ["A5", 148.0, 210.0],
  a4: ["A4", 210.0, 297.0],
  a3: ["A3", 297.0, 420.0],
  "ansi-a": ["Letter (ANSI A)", 215.9, 279.4],
  "ansi-b": ["Tabloid (ANSI B)", 279.4, 431.8],
};
export const DEFAULT_PRESET = "a4";
export const MIN_SCALE = 0.3, MAX_SCALE = 2.0;
// Auto scale: never enlarges, and never shrinks below what stays readable (the notes are 3.4 mm, about 9.6 pt,
// at scale 1, so 0.7 is about 6.7 pt). Past that, more pages are added at this scale.
export const AUTO_MIN_SCALE = 0.7, AUTO_MAX_SCALE = 1.0, AUTO_STEP = 0.01;

const SIDE_MARGIN = 12.5; // mm, left and right
const TOP_MARGIN = 21.2; // mm, to the first line of the first triplet
const BOTTOM_MARGIN = 20.0; // mm kept free under the last triplet
export const LINE_SPACING = 15.0; // mm between the lines of a triplet, at scale 1
const ROW_PITCH = 55.0; // mm from one triplet's top line to the next one's, at scale 1; the room between holds text
export const LINES_PER_ROW = 3;

export interface PageSetup {
  readonly preset: string;
  readonly landscape: boolean;
  /** Everything drawn on the page (shapes, lines, text, default gaps) is scaled by this. */
  readonly scale: number;
  /** Pick the scale from the program (the largest that needs the fewest pages) instead. */
  readonly auto: boolean;
  /** Whether pose names are printed with the shapes. */
  readonly labels: LabelSetup;
}

export function makeSetup(preset = DEFAULT_PRESET, landscape = false, scale = 1.0, auto = true,
  labels: LabelSetup = DEFAULT_LABELS): PageSetup {
  if (!(preset in PRESETS)) throw new Error(`unknown paper size '${preset}'`);
  if (!(scale >= MIN_SCALE && scale <= MAX_SCALE)) throw new Error(`scale must be between ${MIN_SCALE} and ${MAX_SCALE}`);
  return { preset, landscape, scale, auto, labels };
}

export const pageWidth = (s: PageSetup) => (s.landscape ? PRESETS[s.preset][2] : PRESETS[s.preset][1]);
export const pageHeight = (s: PageSetup) => (s.landscape ? PRESETS[s.preset][1] : PRESETS[s.preset][2]);

/** Reads a saved setup; files from before auto-scale keep their scale. */
export function setupFromJson(data: Record<string, unknown> | null | undefined): PageSetup {
  const d = data ?? {};
  return makeSetup(String(d.preset ?? DEFAULT_PRESET), Boolean(d.landscape), Number(d.scale ?? 1.0), Boolean(d.auto ?? false),
    labelsFromJson(d.labels));
}

export interface Row { top: number; bottom: number }

/** Where rows go on one page: what the layout needs to know about the paper. */
export interface PageRuling {
  left: number;
  right: number;
  rows: Row[];
  scale: number;
  pageWidth: number;
  pageHeight: number;
  width: number;
  lineSpacing: number;
}

/** As many triplets as fit under each other, evenly spaced; at least one. */
export function buildRuling(setup: PageSetup): PageRuling {
  const scale = setup.scale;
  const height = LINE_SPACING * (LINES_PER_ROW - 1) * scale;
  const count = Math.max(1,
    Math.floor((pageHeight(setup) - TOP_MARGIN - BOTTOM_MARGIN - height) / (ROW_PITCH * scale)) + 1);
  const rows: Row[] = [];
  for (let n = 0; n < count; n++) {
    const top = TOP_MARGIN + n * ROW_PITCH * scale;
    rows.push({ top, bottom: top + height });
  }
  const right = pageWidth(setup) - SIDE_MARGIN;
  return {
    left: SIDE_MARGIN, right, rows, scale, pageWidth: pageWidth(setup), pageHeight: pageHeight(setup),
    width: right - SIDE_MARGIN, lineSpacing: LINE_SPACING * scale,
  };
}
