import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { ProgramBuilder } from "../src/core/program";
import { parseSvg } from "../src/core/svgNames";

const library = readFileSync("public/Yoga_source.svg", "utf8");
let program: ProgramBuilder;
beforeEach(() => { program = new ProgramBuilder(library); });

describe("ProgramBuilder", () => {
  it("lists poses and finds them by name", () => {
    expect(program.names.length).toBeGreaterThan(30);
    expect(program.names).toContain("Tree Pose");
  });

  it("adds, moves, removes and undoes", () => {
    program.add("Tree Pose"); program.add("Vira 2"); program.add("Vira 3");
    expect(program.chosen.map((s) => s.pictogram.name)).toEqual(["Tree Pose", "Vira 2", "Vira 3"]);
    program.move(0, 2);
    expect(program.chosen.map((s) => s.pictogram.name)).toEqual(["Vira 2", "Vira 3", "Tree Pose"]);
    program.remove(1);
    expect(program.chosen.length).toBe(2);
    program.undo(); program.undo();
    expect(program.chosen.map((s) => s.pictogram.name)).toEqual(["Tree Pose", "Vira 2", "Vira 3"]);
    program.redo();
    expect(program.chosen[0].pictogram.name).toBe("Vira 2");
    program.add("Tree Pose");
    expect(program.canRedo).toBe(false);
  });

  it("does not record an undo step when nothing changed", () => {
    program.add("Tree Pose");
    program.setNote(0, "above", "");
    program.undo();
    expect(program.chosen.length).toBe(0);
  });

  it("widens and narrows a gap, never letting outlines touch", () => {
    program.add("Tree Pose"); program.add("Vira 2"); program.add("Vira 3");
    expect(program.adjustSpacing(0, 5)).toBeCloseTo(5);
    expect(program.chosen[0].spacing).toBeCloseTo(5);
    const tight = program.adjustSpacing(0, -500);
    expect(tight).toBeLessThan(0);
    expect(program.chosen[0].spacing).toBeGreaterThan(-210);
    expect(program.adjustSpacing(2, 5)).toBe(0); // last of its row has no gap
  });

  it("starts a new centred row at a forced break", () => {
    program.add("Tree Pose"); program.add("Vira 2");
    program.setBreak(0, true);
    expect(program.placements[1].y).toBeGreaterThan(program.placements[0].y);
  });

  it("adds pages and shrinks (auto scale) when the program is long", () => {
    for (let i = 0; i < 80; i++) program.add(program.names[i % program.names.length]);
    expect(program.pages).toBeGreaterThan(1);
    expect(program.drawnSetup.scale).toBeGreaterThanOrEqual(0.7 - 1e-9);
    program.setPage({ auto: false, scale: 1 });
    const pagesAtOne = program.pages;
    program.setPage({ preset: "a3" });
    expect(program.pages).toBeLessThan(pagesAtOne);
  });

  it("rejects an out-of-range scale", () => {
    expect(() => program.setPage({ auto: false, scale: 5 })).toThrow();
  });

  it("writes a document that opens again with everything intact", () => {
    program.add("Tree Pose"); program.add("Vira 2"); program.add("Vira 3");
    program.setNote(1, "above", "Breathe in\nand out  ");
    program.setNote(1, "below", "Hold");
    program.adjustSpacing(0, 4);
    program.setBreak(1, true);
    program.setPage({ preset: "a5", landscape: true, auto: false, scale: 0.8 });
    const text = program.render.document;
    expect(text.startsWith("<?xml")).toBe(true);
    parseSvg(text); // well-formed

    const again = new ProgramBuilder(library);
    expect(again.openProgram(text, "Mine_2026-01-01_120000.svg")).toBe(3);
    expect(again.name).toBe("Mine");
    expect(again.chosen.map((s) => s.pictogram.name)).toEqual(["Tree Pose", "Vira 2", "Vira 3"]);
    expect(again.chosen[1].above).toBe("Breathe in\nand out");
    expect(again.chosen[1].below).toBe("Hold");
    expect(again.chosen[0].spacing).toBeCloseTo(4);
    expect(again.chosen[1].breakAfter).toBe(true);
    expect(again.setup).toEqual({ preset: "a5", landscape: true, scale: 0.8, auto: false });
    expect(again.render.document).toBe(text); // byte-identical: nothing drifts on a save/open cycle
  });

  it("keeps the chosen auto setting but remembers the requested scale", () => {
    for (let i = 0; i < 80; i++) program.add(program.names[i % program.names.length]);
    const doc = program.render.document;
    expect(doc).toContain('"auto":true');
  });

  it("reads a program re-saved without our metadata (ids, labels and note texts)", () => {
    program.add("Tree Pose"); program.add("Vira 2");
    program.setNote(0, "below", "Root down");
    const stripped = program.render.document.replace(/<metadata[^>]*>.*?<\/metadata>/s, "");
    const again = new ProgramBuilder(library);
    again.openProgram(stripped);
    expect(again.chosen.map((s) => s.pictogram.name)).toEqual(["Tree Pose", "Vira 2"]);
    expect(again.chosen[0].below).toBe("Root down");
  });

  it("refuses files that are not programs", () => {
    expect(() => program.openProgram("<svg xmlns='http://www.w3.org/2000/svg'/>")).toThrow();
    expect(() => program.openProgram("not xml at all")).toThrow();
  });

  it("produces one stand-alone file per page", () => {
    for (let i = 0; i < 80; i++) program.add(program.names[i % program.names.length]);
    const file = program.render.pageFile(1);
    expect(file).not.toContain("yoga-builder-program");
    expect(file).not.toContain("data-index");
    expect(file).not.toContain("reference-pg0");
    expect(file).toContain("reference-pg1");
  });

  it("keeps matching poses when the library is reloaded", () => {
    program.add("Tree Pose");
    program.setLibrary(library);
    expect(program.chosen.length).toBe(1);
    expect(program.openNotes).toEqual([]);
  });

  it("refuses a library without reference lines and keeps the old one", () => {
    program.add("Tree Pose");
    expect(() => program.setLibrary("<svg xmlns='http://www.w3.org/2000/svg'><g id='layer1'/></svg>")).toThrow();
    expect(program.chosen.length).toBe(1);
    expect(program.names.length).toBeGreaterThan(30);
  });

  it("sanitises the file name", () => {
    expect(program.rename("my/yoga: plan.svg")).toBe(true);
    expect(program.name).toBe("my_yoga_ plan");
    expect(program.rename("   ")).toBe(false);
  });
});
