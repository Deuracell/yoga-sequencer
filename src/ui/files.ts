/** Saving and opening files in the browser: downloads, file pickers, remembered state. */
export function download(name: string, text: string, type = "image/svg+xml") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Program.svg -> Program_2026-10-26_143005.svg */
export function stamped(name: string, suffix = ""): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${name}${suffix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.svg`;
}

export function readFile(file: File): Promise<string> {
  return file.text();
}

export function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage blocked or full: the app still works, it just forgets */ }
}

export function recall(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
