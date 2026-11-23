/** The one-line hint under the preview: what you can do with the current selection. */
import { $ } from "./dom";
import { ui } from "./state";

export function renderHint() {
  const many = ui.picks.size;
  let text: string;
  if (!ui.builder.chosen.length) text = "Click a pose on the left to add it, or drag it onto the page. Press ? for help.";
  else if (!many) text = "Click a shape to select it · drag to reorder · drag a box to select several · ? for help";
  else if (many === 1) text = "1 / 2 add text · + − space · Enter new row after (Shift+Enter before) · Delete · Esc";
  else text = `${many} selected · + − space · Enter new row after (Shift+Enter before) · Delete · Esc`;
  $("hint").textContent = text;
}
