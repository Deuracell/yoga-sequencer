/** The "print pose names" setting of a program: where the names go and in which language. */

export type NamesWhere = "off" | "above" | "below";

export interface LabelSetup {
  readonly where: NamesWhere;
  readonly lang: string; // language code from poses.json; "sa" for Sanskrit only
  readonly sanskrit: boolean; // add the Sanskrit name as a second, italic line
}

export const DEFAULT_LABELS: LabelSetup = { where: "off", lang: "en", sanskrit: true };

/** Reads a saved setting; anything unreadable (or from before the feature existed) means "off". */
export function labelsFromJson(data: unknown): LabelSetup {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const where: NamesWhere = d.where === "above" || d.where === "below" ? d.where : "off";
  return { where, lang: typeof d.lang === "string" && d.lang ? d.lang : DEFAULT_LABELS.lang, sanskrit: d.sanskrit !== false };
}
