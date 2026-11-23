/** Names of the poses in several languages, kept in poses.json beside the library SVG and keyed by group id. */

export interface PoseEntry {
  sa?: string; // Sanskrit; absent for exercises that have no traditional name
  en?: string;
  sv?: string;
  also?: string[]; // other names, searchable only
  aliases?: string[]; // earlier ids, so programs saved before a rename still open
  verify?: boolean; // the name is a best guess still to be checked
}

export interface PoseNameData {
  languages: Record<string, string>; // code -> label, in the order the UI offers them
  poses: Record<string, PoseEntry>;
}

export interface DisplayName {
  primary: string;
  sanskrit: string; // only when it differs from the primary and was asked for
  verify: boolean;
}

export const SANSKRIT = "sa";
const FALLBACKS = ["en", SANSKRIT];

export function parsePoseNames(text: string): PoseNameData {
  const data = JSON.parse(text);
  if (!data || typeof data.poses !== "object") throw new Error("poses.json has no \"poses\" table");
  return { languages: data.languages ?? { sa: "Sanskrit", en: "English" }, poses: data.poses };
}

export class NameBook {
  private readonly legacy = new Map<string, string>();

  constructor(readonly data: PoseNameData | null = null) {
    for (const [id, entry] of Object.entries(data?.poses ?? {})) {
      for (const alias of entry.aliases ?? []) this.legacy.set(alias, id);
    }
  }

  get languages(): Record<string, string> { return this.data?.languages ?? {}; }
  has(id: string): boolean { return !!this.data?.poses[id]; }

  /** The id a pose had before it was renamed, mapped to its current one (or the id itself, or null). */
  current(id: string): string | null {
    return this.has(id) ? id : this.legacy.get(id) ?? null;
  }

  /** What to show for a pose: the chosen language, falling back to English, Sanskrit, then the SVG label. */
  display(id: string, label: string, lang: string, withSanskrit: boolean): DisplayName {
    const entry = this.data?.poses[id];
    if (!entry) return { primary: label, sanskrit: "", verify: false };
    const pick = (e: Record<string, string | undefined>) =>
      [lang, ...FALLBACKS].map((l) => e[l]).find((v) => !!v);
    const primary = pick(entry as Record<string, string | undefined>) ?? label;
    return {
      primary,
      sanskrit: withSanskrit && entry.sa && entry.sa !== primary ? entry.sa : "",
      verify: !!entry.verify,
    };
  }

  /** Everything a filter box should match for a pose, lower-cased. */
  searchText(id: string, label: string): string {
    const e = this.data?.poses[id];
    if (!e) return label.toLowerCase();
    return [label, e.sa, e.en, e.sv, ...(e.also ?? [])]
      .filter(Boolean).join(" ").toLowerCase();
  }

  /** Poses marked as still to be checked. */
  toVerify(): string[] {
    return Object.entries(this.data?.poses ?? {}).filter(([, e]) => e.verify).map(([id]) => id);
  }
}
