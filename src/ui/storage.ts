/** Keeps the program (and a custom library) in the browser, so a reload does not lose the work. */
import { setupFromJson } from "../core/pageSetup";
import type { SavedProgram } from "../core/projectIo";
import { recall, remember } from "./files";
import { ui } from "./state";

const PROGRAM = "yoga.program", LIBRARY = "yoga.library";

export function autosave() {
  const { builder } = ui;
  remember(PROGRAM, JSON.stringify({ name: builder.name, ...builder.saved() }));
}

export const saveLibrary = (text: string | null) => remember(LIBRARY, text);
export const savedLibrary = () => recall(LIBRARY);

export function savedProgram(): { name: string; program: SavedProgram } | null {
  const text = recall(PROGRAM);
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    return { name: String(data.name ?? "Program"), program: { poses: data.poses ?? [], setup: setupFromJson(data.setup) } };
  } catch { return null; }
}
