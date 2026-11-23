/** Small dropdown menus and popovers: a button that shows or hides the panel beside it. */
let current: { button: HTMLElement; panel: HTMLElement } | null = null;

function close() {
  if (!current) return;
  current.panel.hidden = true;
  current.button.setAttribute("aria-expanded", "false");
  current = null;
}

export function wireMenu(button: HTMLElement, panel: HTMLElement) {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = current?.panel === panel;
    close();
    if (wasOpen) return;
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    current = { button, panel };
    panel.querySelector<HTMLElement>("select, input, button:not([hidden])")?.focus({ preventScroll: true });
  });
  // choosing a menu item closes the menu; a form panel (selects, checkboxes) stays open
  panel.addEventListener("click", (e) => {
    if ((e.target as Element).closest('[role="menuitem"]')) close();
  });
}

document.addEventListener("click", (e) => {
  if (current && !current.panel.contains(e.target as Node)) close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && current) { const { button } = current; close(); button.focus(); e.stopPropagation(); }
}, true);
