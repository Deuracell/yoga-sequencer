/** Switching between the bundled pose library and one loaded from the user's own SVG. */
import { $ } from "./dom";
import { readFile } from "./files";
import { loadTiles, renderGrid } from "./gallery";
import { saveLibrary } from "./storage";
import { commit, select, ui } from "./state";

export const BUNDLED = `${import.meta.env.BASE_URL}Yoga_source.svg`;
let bundledText = "";

export async function fetchBundled(): Promise<string> {
  if (!bundledText) {
    const response = await fetch(BUNDLED);
    if (!response.ok) throw new Error(`could not load the bundled library (${response.status})`);
    bundledText = await response.text();
  }
  return bundledText;
}

export function useLibrary(text: string, custom: boolean) {
  commit(() => { select(null); ui.builder.setLibrary(text); });
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
    useLibrary(await fetchBundled(), false);
    saveLibrary(null);
  };
}
