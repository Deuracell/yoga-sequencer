/** Notes about the library and the open program, folded into a one-line badge that expands on click. */
import { $ } from "./dom";
import { ui } from "./state";

let expanded = false;
let extra: string[] = [];

function setExpanded(value: boolean) {
  expanded = value;
  $("warnList").hidden = !expanded;
  $("warnToggle").setAttribute("aria-expanded", String(expanded));
}

/** A message from an action that failed; shown expanded until the next change. */
export function showMessage(message: string) {
  extra = [message];
  setExpanded(true);
  renderWarnings();
}

export function clearMessage() { extra = []; }

export function wireWarnings() {
  $("warnToggle").onclick = () => setExpanded(!expanded);
}

export function renderWarnings() {
  const { builder } = ui;
  const notes = [...extra, ...builder.warnings, ...builder.openNotes];
  const unverified = builder.names.toVerify().length;
  if (unverified) notes.push(`${unverified} pose names are marked “?” (best guesses, still to be verified in poses.json).`);
  if (builder.unnamed.length) notes.push(`No entry in poses.json for: ${builder.unnamed.join(", ")}`);
  if (ui.customLibrary && builder.droppedCopies.length) notes.push(`Ignored ${builder.droppedCopies.length} duplicate drawings in the library.`);
  if (ui.customLibrary && builder.withoutAnchor.length) {
    notes.push(`${builder.withoutAnchor.length} pose(s) have no anchor point; their height is guessed from the nearest row.`);
  }
  $("warn").hidden = !notes.length;
  $("warnToggle").textContent = `⚠ ${notes.length} note${notes.length === 1 ? "" : "s"} ${expanded ? "▴" : "▾"}`;
  $("warnList").replaceChildren(...notes.flatMap((n, i) => [...(i ? [document.createElement("br")] : []), document.createTextNode(n)]));
  $("libReset").hidden = !ui.customLibrary;
  $("libInfo").textContent = `${builder.catalog.size} poses · ${ui.customLibrary ? "your library" : "bundled library"}`;
}
