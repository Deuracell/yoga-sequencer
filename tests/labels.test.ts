import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nameBlock, wrapWords } from "../src/core/labels";
import { NameBook, parsePoseNames } from "../src/core/poseNames";
import { ProgramBuilder } from "../src/core/program";
import { parseSvg } from "../src/core/svgNames";

const library = readFileSync("public/Yoga_source.svg", "utf8");
const names = new NameBook(parsePoseNames(readFileSync("public/poses.json", "utf8")));
const build = () => { const p = new ProgramBuilder(library, names); p.add("Tree Pose"); p.add("Vira 2"); return p; };
const texts = (svg: string, kind: string) =>
  Array.from(parseSvg(svg).querySelectorAll("text")).filter((t) => (t.getAttribute("id") ?? "").startsWith(kind));
const content = (el: Element) => Array.from(el.querySelectorAll("tspan")).map((t) => t.textContent);

describe("printed pose names", () => {
  it("are off by default and leave the document free of name elements", () => {
    expect(texts(build().render.document, "name-")).toHaveLength(0);
  });

  it("print the chosen language above the shapes, with an italic Sanskrit line", () => {
    const p = build();
    p.setPage({ labels: { where: "above", lang: "sv", sanskrit: true } });
    const found = texts(p.render.document, "name-above");
    expect(found).toHaveLength(2);
    expect(content(found[0])).toEqual(["Trädet", "Vrksasana"]);
    expect(found[0].querySelectorAll("tspan")[1].getAttribute("style")).toContain("italic");
    expect(texts(p.render.document, "name-below")).toHaveLength(0);
  });

  it("go below, without a Sanskrit line, and in Sanskrit only", () => {
    const p = build();
    p.setPage({ labels: { where: "below", lang: "en", sanskrit: false } });
    expect(content(texts(p.render.document, "name-below")[0])).toEqual(["Tree pose"]);
    p.setPage({ labels: { lang: "sa" } });
    expect(content(texts(p.render.document, "name-below")[1])).toEqual(["Virabhadrasana II"]);
  });

  it("put a user note beyond the name on the same side, and leave the other side alone", () => {
    const p = build();
    p.setNote(0, "above", "Root down");
    p.setNote(0, "below", "Hold");
    const plain = parseSvg(p.render.document);
    const y = (doc: Element, id: string) => Number(doc.querySelector(`[id^="${id}"]`)!.getAttribute("y"));
    const noteAbove = y(plain, "note-above-p0n0"), noteBelow = y(plain, "note-below-p0n0");
    p.setPage({ labels: { where: "above", lang: "en", sanskrit: true } });
    const named = parseSvg(p.render.document);
    expect(y(named, "note-above-p0n0")).toBeLessThan(noteAbove); // pushed up, away from the shape
    expect(y(named, "note-above-p0n0")).toBeLessThan(y(named, "name-above-p0n0"));
    expect(y(named, "note-below-p0n0")).toBe(noteBelow);
  });

  it("are remembered by a saved program and never mistaken for notes", () => {
    const p = build();
    p.setPage({ labels: { where: "above", lang: "sv", sanskrit: false } });
    const text = p.render.document;
    const again = new ProgramBuilder(library, names);
    again.openProgram(text);
    expect(again.setup.labels).toEqual({ where: "above", lang: "sv", sanskrit: false });
    expect(again.chosen.every((s) => !s.above && !s.below)).toBe(true);
    expect(again.render.document).toBe(text);
    // re-saved without our metadata: the name texts carry no note index, so they do not turn into notes
    const stripped = text.replace(/<metadata[^>]*>.*?<\/metadata>/s, "");
    const fallback = new ProgramBuilder(library, names);
    fallback.openProgram(stripped);
    expect(fallback.chosen.every((s) => !s.above && !s.below)).toBe(true);
  });

  it("read files from before the setting existed as 'off'", () => {
    const p = build();
    const old = p.render.document.replace(/,"labels":\{[^}]*\}/, "");
    expect(old).not.toContain("labels");
    const again = new ProgramBuilder(library, names);
    again.openProgram(old);
    expect(again.setup.labels.where).toBe("off");
  });

  it("wrap on words and shrink a long word rather than collide with the neighbour", () => {
    expect(wrapWords("Reclining hand-to-big-toe pose", 14)).toEqual(["Reclining", "hand-to-big-toe", "pose"]);
    const narrow = nameBlock({ primary: "Utthita Ashwa Sanchalananasana", sanskrit: "", verify: false }, 20, 1)!;
    const wide = nameBlock({ primary: "Utthita Ashwa Sanchalananasana", sanskrit: "", verify: false }, 80, 1)!;
    expect(wide.lines).toHaveLength(1);
    expect(narrow.lines.length).toBeGreaterThan(1);
    expect(narrow.size).toBeLessThan(wide.size); // "Sanchalananasana" does not fit 20 mm at full size
    expect(narrow.size).toBeGreaterThanOrEqual(wide.size * 0.6 - 1e-9);
  });

  it("falls back to the SVG label for a library without names", () => {
    const plain = new ProgramBuilder(library);
    plain.add("Tree Pose");
    plain.setPage({ labels: { where: "above" } });
    expect(content(texts(plain.render.document, "name-above")[0])).toEqual(["Tree Pose"]);
  });
});
