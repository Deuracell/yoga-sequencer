/** Switching between the bundled pose library and one loaded from the user's own SVG. */
import { NameBook, parsePoseNames } from "../core/poseNames";
import { $ } from "./dom";
import { readFile } from "./files";
import { loadTiles, renderGrid } from "./gallery";
import { saveLibrary } from "./storage";
import { commit, select, ui } from "./state";

const BASE = import.meta.env.BASE_URL;
let bundled: { svg: string; names: NameBook } | null = null;

async function get(file: string): Promise<Response> {
  const response = await fetch(`${BASE}${file}`);
  if (!response.ok) throw new Error(`could not load ${file} (${response.status})`);
  return response;
}

/** The bundled pose library and its names. A missing or broken names file only costs the translations. */
export async function fetchBundled(): Promise<{ svg: string; names: NameBook }> {
  if (!bundled) {
    const svg = await (await get("Yoga_source.svg")).text();
    let names = new NameBook();
    try { names = new NameBook(parsePoseNames(await (await get("poses.json")).text())); } catch { /* labels are used instead */ }
    bundled = { svg, names };
  }
  return bundled;
}

export async function useBundledLibrary() {
  const { svg, names } = await fetchBundled();
  useLibrary(svg, false, names);
}

/** A custom library has no names file, so its poses are shown under their SVG labels. */
export function useLibrary(text: string, custom: boolean, names = new NameBook()) {
  commit(() => { select(null); ui.builder.setLibrary(text, names); });
  ui.customLibrary = custom;
  loadTiles();
  renderGrid();
}

export function wireLibrary(onError: (message: string) => void) {
  const file = $("libFile") as HTMLInputElement;
  $("libLoad").onclick = () => file.click();
  file.onchange = async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    try {
      const text = await readFile(chosen);
      useLibrary(text, true);
      saveLibrary(text);
    } catch (error) {
      onError(`Could not use ${chosen.name} as a library: ${(error as Error).message}`);
    }
  };
  $("libReset").onclick = async () => {
    await useBundledLibrary();
    saveLibrary(null);
  };
}
