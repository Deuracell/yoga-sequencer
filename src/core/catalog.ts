/** Finds the pictograms in the source SVG and measures them against the reference lines. */
import { drawingSignature, sameDrawing, type Signature } from "./duplicates";
import { loadRuling, type Ruling } from "./reference";
import { boundingBox, unionBox } from "./segments";
import { outline, room, type Silhouette } from "./silhouette";
import { shapesIn } from "./shapes";
import { children, labelOf } from "./svgNames";

// Parts of other pictograms (heads, arrows), not poses of their own.
const PART_LABELS = ["Huvud", "Pil"];

export class Pictogram {
  private readonly rooms = new Map<string, number>(); // cache, by neighbour's group id

  constructor(
    readonly name: string, // unique, shown to the user
    readonly groupId: string,
    readonly width: number, // mm, geometric extent
    readonly height: number,
    readonly top: number, // mm, absolute top edge
    readonly anchorX: number, // left edge, absolute mm
    readonly anchorY: number, // absolute y the pictogram is aligned by
    readonly hasAnchor: boolean, // whether the source holds an invisible anchor circle
    readonly silhouette: Silhouette,
  ) {}

  withName(name: string): Pictogram {
    return new Pictogram(name, this.groupId, this.width, this.height, this.top, this.anchorX, this.anchorY,
      this.hasAnchor, this.silhouette);
  }

  /** How far `other`, drawn to the right of this pictogram, may overlap its box before the outlines touch. */
  roomBefore(other: Pictogram): number {
    let value = this.rooms.get(other.groupId);
    if (value === undefined) {
      value = this.silhouette.size && other.silhouette.size
        ? room(this.silhouette, this.width, other.silhouette, other.width) : 0;
      this.rooms.set(other.groupId, value);
    }
    return value;
  }
}

export interface Catalog {
  pictograms: Pictogram[];
  droppedCopies: { name: string; groupId: string }[]; // carbon copies left out
  nameWarnings: string[]; // one sentence per label shared by different drawings
  withoutAnchor: string[]; // poses whose height was guessed from the nearest row
}

interface Entry { groupId: string; pictogram: Pictogram; signature: Signature }

const isPose = (label: string) => !!label && !PART_LABELS.some((p) => label.startsWith(p));

/** The pictogram groups: direct children of the first layer, in document order. */
function topLevelGroups(root: Element): Element[] {
  const layers = children(root, "g");
  const layer = layers.find((g) => g.getAttribute("id") === "layer1") ?? layers[0];
  return layer ? children(layer, "g").filter((g) => g.getAttribute("id")) : [];
}

function measure(group: Element, ruling: Ruling): Entry | null {
  const all = shapesIn(group);
  const shapes = all.filter((s) => !s.isAnchor); // the invisible anchors would stretch the box
  const box = unionBox(shapes.map((s) => boundingBox(s.segments)).filter((b) => b !== null));
  if (!box) return null;
  const [x0, y0, x1, y1] = box;
  const anchorBox = all.filter((s) => s.isAnchor).map((s) => boundingBox(s.segments)).find((b) => b);
  // The anchor decides the height: it is what gets aligned to the top line of the target row.
  // Without one, assume the pose stands in the triplet its bottom edge is in.
  const anchorY = anchorBox ? (anchorBox[1] + anchorBox[3]) / 2 : ruling.nearestRow(y1).top;
  const groupId = group.getAttribute("id")!;
  return {
    groupId,
    signature: drawingSignature(shapes),
    pictogram: new Pictogram("", groupId, x1 - x0, y1 - y0, y0, x0, anchorY, !!anchorBox,
      outline(shapes, x0, anchorY)),
  };
}

/** Split same-label entries into clusters of carbon copies, keeping document order. */
function distinctDrawings(entries: Entry[]): Entry[][] {
  const clusters: Entry[][] = [];
  for (const entry of entries) {
    const home = clusters.find((c) => sameDrawing(c[0].signature, entry.signature));
    if (home) home.push(entry); else clusters.push([entry]);
  }
  return clusters;
}

/**
 * Poses in document order. Carbon copies are dropped; a label that names different
 * drawings is kept, numbered ' #n', and reported in `nameWarnings`.
 */
export function loadCatalog(root: Element, ruling: Ruling = loadRuling(root)): Catalog {
  const byLabel = new Map<string, Entry[]>();
  const order = new Map<string, number>();
  topLevelGroups(root).forEach((group, index) => {
    const label = labelOf(group);
    if (!isPose(label)) return;
    const entry = measure(group, ruling);
    if (!entry) return;
    order.set(entry.groupId, index);
    byLabel.set(label, [...(byLabel.get(label) ?? []), entry]);
  });

  const result: Catalog = { pictograms: [], droppedCopies: [], nameWarnings: [], withoutAnchor: [] };
  for (const [label, entries] of byLabel) {
    const clusters = distinctDrawings(entries);
    if (clusters.length > 1) {
      const ids = clusters.map((c) => c[0].groupId).join(", ");
      result.nameWarnings.push(`'${label}' names ${clusters.length} different drawings (${ids}); `
        + `numbered #1-#${clusters.length}. Give them distinct labels in the SVG.`);
    }
    clusters.forEach((cluster, n) => {
      const name = clusters.length > 1 ? `${label} #${n + 1}` : label;
      result.pictograms.push(cluster[0].pictogram.withName(name));
      if (!cluster[0].pictogram.hasAnchor) result.withoutAnchor.push(name);
      for (const copy of cluster.slice(1)) result.droppedCopies.push({ name, groupId: copy.groupId });
    });
  }
  result.pictograms.sort((a, b) => order.get(a.groupId)! - order.get(b.groupId)!);
  return result;
}
