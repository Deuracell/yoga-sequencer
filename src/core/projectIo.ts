/** Reads a saved program back into the list of poses it contains. */
import { readNoteText } from "./notes";
import { makeSetup, setupFromJson, type PageSetup } from "./pageSetup";
import { METADATA_ID, SVG_NS, children, labelOf, parseSvg } from "./svgNames";

export interface SavedPose {
  groupId: string;
  label: string;
  above: string;
  below: string;
  spacing: number;
  breakAfter: boolean;
}

export interface SavedProgram {
  poses: SavedPose[];
  setup: PageSetup;
}

const SUFFIX = /-p\d+n\d+$/; // added to ids when a pictogram is placed on a page

/**
 * The poses are in program order. The page setup is A4 portrait at scale 1 when the file has none.
 *
 * Uses the embedded pose list when present; files saved without it (or re-saved by
 * Inkscape) fall back to the ids and labels of the placed groups and to the note texts.
 */
export function readProgram(text: string): SavedProgram {
  const root = parseSvg(text);
  const layer = children(root, "g").find((g) => g.getAttribute("id") === "layer1");
  if (!layer) throw new Error("not a sequence saved by this tool");
  const placed = children(layer, "g").map((g): [string, string] => [(g.getAttribute("id") ?? "").replace(SUFFIX, ""), labelOf(g)]);

  for (const node of Array.from(root.getElementsByTagNameNS(SVG_NS, "metadata"))) {
    if (node.getAttribute("id") !== METADATA_ID || !node.textContent) continue;
    const data = JSON.parse(node.textContent);
    const labels = new Map(placed);
    const notes: Record<string, unknown>[] = data.notes ?? [];
    const poses = (data.poses ?? []).map((groupId: string, i: number): SavedPose => ({
      groupId, label: labels.get(groupId) ?? "",
      above: String(notes[i]?.above ?? ""), below: String(notes[i]?.below ?? ""),
      spacing: Number(notes[i]?.spacing ?? 0), breakAfter: Boolean(notes[i]?.break ?? false),
    }));
    return { poses, setup: pageFrom(data.page) };
  }

  const texts = new Map<number, { above?: string; below?: string }>();
  for (const node of children(layer, "text")) {
    const index = node.getAttribute("data-note-index");
    if (index === null) continue;
    const where = labelOf(node).endsWith("above") ? "above" : "below";
    texts.set(Number(index), { ...texts.get(Number(index)), [where]: readNoteText(node) });
  }
  return {
    poses: placed.map(([groupId, label], i) => ({
      groupId, label, above: texts.get(i)?.above ?? "", below: texts.get(i)?.below ?? "", spacing: 0, breakAfter: false,
    })),
    setup: makeSetup(),
  };
}

function pageFrom(data: unknown): PageSetup {
  try {
    return setupFromJson(data as Record<string, unknown>);
  } catch {
    return makeSetup(); // a setup this version does not know
  }
}
