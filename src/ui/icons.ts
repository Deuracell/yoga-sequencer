/** Icons that change with state (the static ones live in index.html). */
const wrap = (shape: string) => `<svg class="ico" viewBox="0 0 24 24">${shape}</svg>`;

export const ICON_PORTRAIT = wrap('<rect x="7" y="3" width="10" height="18" rx="1.5"/>');
export const ICON_LANDSCAPE = wrap('<rect x="3" y="7" width="18" height="10" rx="1.5"/>');
