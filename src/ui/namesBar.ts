/** The "print pose names" setting: above, below or off, in which language, with or without a Sanskrit line. */
import type { NamesWhere } from "../core/labelSetup";
import { $ } from "./dom";
import { language } from "./language";
import { commit, ui } from "./state";

const where = () => $("namesWhere") as HTMLSelectElement;
const lang = () => $("namesLang") as HTMLSelectElement;
const sanskrit = () => $("namesSa") as HTMLInputElement;

export function renderNamesBar() {
  const { labels } = ui.builder.setup;
  const languages = ui.builder.names.languages;
  const codes = Object.keys(languages);
  if (lang().options.length !== codes.length || codes.some((c, i) => lang().options[i].value !== c)) {
    lang().replaceChildren(...codes.map((c) => new Option(languages[c], c)));
  }
  where().value = labels.where;
  lang().value = codes.includes(labels.lang) ? labels.lang : (codes.includes("en") ? "en" : codes[0] ?? "");
  sanskrit().checked = labels.sanskrit;
  lang().disabled = sanskrit().disabled = labels.where === "off" || !codes.length;
  $("namesSaLabel").hidden = labels.lang === "sa";
  $("namesBtn").textContent = `Names: ${{ off: "Off", above: "Above", below: "Below" }[labels.where]} ▾`;
}

export function wireNamesBar() {
  const set = (change: Parameters<typeof ui.builder.setPage>[0]) => commit(() => ui.builder.setPage(change));
  where().onchange = () => {
    const turningOn = ui.builder.setup.labels.where === "off" && where().value !== "off";
    // the first time names are switched on they start out in the language the library is shown in
    set({ labels: { where: where().value as NamesWhere, ...(turningOn ? { lang: language().lang, sanskrit: language().sanskrit } : {}) } });
  };
  lang().onchange = () => set({ labels: { lang: lang().value } });
  sanskrit().onchange = () => set({ labels: { sanskrit: sanskrit().checked } });
}
