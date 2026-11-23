/** The help dialog: opened by its button or the ? key. */
import { $ } from "./dom";

export function openHelp() {
  const dialog = $("help") as HTMLDialogElement;
  if (!dialog.open) dialog.showModal();
}

export function wireHelp() {
  const dialog = $("help") as HTMLDialogElement;
  $("helpBtn").onclick = openHelp;
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // a click on the backdrop
}
