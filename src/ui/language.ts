/** Which language the pose names are shown in, remembered between visits. */
import type { DisplayName } from "../core/poseNames";
import { recall, remember } from "./files";
import { ui } from "./state";

const KEY = "yoga.names";
interface Prefs { lang: string; sanskrit: boolean }

let prefs: Prefs = { lang: "en", sanskrit: true };
try { prefs = { ...prefs, ...JSON.parse(recall(KEY) ?? "{}") }; } catch { /* keep the defaults */ }

export const language = () => prefs;

export function setLanguage(change: Partial<Prefs>) {
  prefs = { ...prefs, ...change };
  remember(KEY, JSON.stringify(prefs));
}

/** The name to show for a pose, in the chosen language. */
export function displayName(groupId: string, label: string): DisplayName {
  return ui.builder.names.display(groupId, label, prefs.lang, prefs.sanskrit && prefs.lang !== "sa");
}
