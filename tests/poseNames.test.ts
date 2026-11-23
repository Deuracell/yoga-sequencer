import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NameBook, parsePoseNames } from "../src/core/poseNames";
import { ProgramBuilder } from "../src/core/program";

const library = readFileSync("public/Yoga_source.svg", "utf8");
const names = new NameBook(parsePoseNames(readFileSync("public/poses.json", "utf8")));
const golden = JSON.parse(readFileSync("tests/fixtures/golden.json", "utf8"));

describe("pose names", () => {
  const program = new ProgramBuilder(library, names);

  it("covers every pose in the library, and nothing else", () => {
    expect(program.unnamed).toEqual([]);
    const ids = new Set(program.catalog.size ? [...program.catalog.values()].map((p) => p.groupId) : []);
    for (const id of Object.keys(names.data!.poses)) expect(ids.has(id), `${id} is not in the SVG`).toBe(true);
  });

  it("keeps the four bridge drawings apart without number suffixes or warnings", () => {
    expect(program.warnings).toEqual([]);
    expect(names.display("setu-bandha-sarvangasana-ankles", "x", "en", true))
      .toMatchObject({ primary: "Bridge pose", variant: "holding the ankles", sanskrit: "Setu Bandha Sarvangasana" });
  });

  it("falls back from the chosen language to English, Sanskrit and the label", () => {
    expect(names.display("balasana", "x", "sv", true).primary).toBe("Barnets ställning");
    expect(names.display("balasana", "x", "xx", false).primary).toBe("Child's pose");
    expect(names.display("kneeling-twist", "x", "sa", true).primary).toBe("Kneeling spinal twist"); // no Sanskrit name
    expect(names.display("not-in-book", "Old label", "sv", true).primary).toBe("Old label");
  });

  it("hides the Sanskrit line when it equals the shown name or is switched off", () => {
    expect(names.display("balasana", "x", "sa", true).sanskrit).toBe("");
    expect(names.display("balasana", "x", "en", false).sanskrit).toBe("");
  });

  it("finds a pose by any of its names", () => {
    const find = (q: string) => names.searchText("supta-kapotasana", "Reclining Pigeon Pose").includes(q);
    expect(find("sucirandhrasana")).toBe(true);
    expect(find("liggande duva")).toBe(true);
    expect(find("kapotasana")).toBe(true);
  });

  it("opens programs saved with the old group ids (as the Python app wrote them)", () => {
    const saved = new ProgramBuilder(library, names);
    saved.add("Tree Pose");
    const legacyId = golden.pictograms.find((p: { name: string }) => p.name === "Tree Pose").id;
    const text = saved.render.document.replace('"poses":["vrksasana"]', `"poses":["${legacyId}"]`);
    expect(text).toContain(`"${legacyId}"`);
    const again = new ProgramBuilder(library, names);
    again.openProgram(text);
    expect(again.chosen.map((s) => s.pictogram.groupId)).toEqual(["vrksasana"]);
  });

  it("keeps the old behaviour (labels, numbered clashes) for a library without names", () => {
    const plain = new ProgramBuilder(library);
    expect(plain.warnings.length).toBe(1);
    expect(plain.poseNames).toContain("Setu Bandha Sarvangasana #1");
  });
});
