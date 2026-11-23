/** Printing: every page becomes a real-size sheet; the browser's print dialog also offers "Save as PDF". */
import { pageHeight, pageWidth } from "../core/pageSetup";
import { $ } from "./dom";
import { ui } from "./state";

let pageRule: HTMLStyleElement | null = null;

export function printProgram() {
  const { builder } = ui;
  const setup = builder.drawnSetup;
  const w = pageWidth(setup), h = pageHeight(setup);
  const guides = ($("printGuides") as HTMLInputElement).checked;
  const root = $("printRoot");
  root.replaceChildren();
  for (let page = 0; page < builder.pages; page++) {
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.style.width = `${w}mm`;
    sheet.style.height = `${h}mm`;
    const svg = document.importNode(builder.render.pageView(page, guides), true);
    svg.setAttribute("width", `${w}mm`);
    svg.setAttribute("height", `${h}mm`);
    svg.querySelectorAll("[data-index]").forEach((el) => el.removeAttribute("data-index"));
    sheet.append(svg);
    root.append(sheet);
  }
  // the paper size and orientation of the program, so the dialog starts with the right one
  pageRule ??= document.head.appendChild(document.createElement("style"));
  pageRule.textContent = `@page { size: ${w}mm ${h}mm; margin: 0; }`;
  const done = () => { root.replaceChildren(); pageRule?.remove(); pageRule = null; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
