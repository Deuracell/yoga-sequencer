// Compares the TypeScript port against numbers produced by the original Python app
// (tests/fixtures/make_golden.py) on the same library file.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/core/catalog";
import { layoutRows, slacks } from "../src/core/layout";
import { buildRuling, makeSetup } from "../src/core/pageSetup";
import { loadRuling } from "../src/core/reference";
import { newSlot } from "../src/core/slot";
import { parseSvg } from "../src/core/svgNames";

const golden = JSON.parse(readFileSync("tests/fixtures/golden.json", "utf8"));
const root = parseSvg(readFileSync("public/Yoga_source.svg", "utf8"));
const ruling = loadRuling(root);
const catalog = loadCatalog(root, ruling);

describe("catalog matches the Python app", () => {
  it("reads the same reference lines", () => {
    expect(ruling.left).toBeCloseTo(golden.ruling.left, 3);
    expect(ruling.right).toBeCloseTo(golden.ruling.right, 3);
    expect(ruling.rows.map((r) => [r.top, r.bottom])).toEqual(
      golden.ruling.rows.map((r: number[]) => [expect.closeTo(r[0], 3), expect.closeTo(r[1], 3)]));
  });

  it("finds the same poses in the same order", () => {
    expect(catalog.pictograms.map((p) => p.name)).toEqual(golden.pictograms.map((p: { name: string }) => p.name));
    expect(catalog.droppedCopies.length).toBe(golden.dropped.length);
    expect(catalog.nameWarnings).toEqual(golden.warnings);
  });

  it("measures every pose the same", () => {
    golden.pictograms.forEach((g: Record<string, number | string | boolean>, i: number) => {
      const p = catalog.pictograms[i];
      for (const [mine, theirs] of [[p.width, g.w], [p.height, g.h], [p.top, g.top], [p.anchorX, g.ax], [p.anchorY, g.ay]]) {
        expect(mine, `${p.name}`).toBeCloseTo(theirs as number, 2);
      }
      expect(p.hasAnchor).toBe(g.hasAnchor);
    });
  });

  it("traces the same outlines (where the Python one is sane)", () => {
    golden.pictograms.forEach((g: { name: string; slices: number; sliceSum: number; clean: boolean }, i: number) => {
      const outline = catalog.pictograms[i].silhouette;
      // always inside its own box: the Python app gets this wrong for some transformed shapes
      for (const [left, right] of outline.values()) {
        expect(left, g.name).toBeGreaterThanOrEqual(-1);
        expect(right, g.name).toBeLessThanOrEqual(catalog.pictograms[i].width + 1);
      }
      if (!g.clean) return;
      expect(Math.abs(outline.size - g.slices), g.name).toBeLessThanOrEqual(2);
      const sum = [...outline.values()].reduce((s, [l, r]) => s + l + r, 0);
      expect(Math.abs(sum - g.sliceSum) / Math.max(1, Math.abs(g.sliceSum)), g.name).toBeLessThan(0.03);
    });
  });
});

describe("layout matches the Python app", () => {
  const slots = catalog.pictograms.filter((p) => golden.cleanNames.includes(p.name)).map(newSlot);
  slots[2].spacing = 5;
  slots[4].breakAfter = true;
  slots[6].spacing = -4;
  const setups = { a4: makeSetup("a4", false, 1.0, false), a5l: makeSetup("a5", true, 0.8, false) };

  for (const [key, setup] of Object.entries(setups)) {
    it(`places shapes like Python on ${key}`, () => {
      const placements = layoutRows(slots, buildRuling(setup), 8.0);
      const expected = golden.layouts[key].pl as number[][];
      expect(placements.length).toBe(expected.length);
      placements.forEach((p, i) => {
        expect(p.page, `#${i} page`).toBe(expected[i][0]);
        expect(p.x, `#${i} ${p.pictogram.name} x`).toBeCloseTo(expected[i][1], 1);
        expect(p.y).toBeCloseTo(expected[i][2], 3);
        expect(p.top, `#${i} top`).toBeCloseTo(expected[i][3], 2);
      });
    });

    it(`has the same slack on ${key}`, () => {
      const mine = slacks(slots, buildRuling(setup), 8.0);
      const expected = golden.layouts[key].slacks as (number | null)[];
      mine.forEach((s, i) => {
        if (expected[i] === null) expect(s).toBeNull();
        else expect(s as number, `#${i}`).toBeCloseTo(expected[i] as number, 1);
      });
    });
  }
});
