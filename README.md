# Yoga Sequencer

Build a printed yoga sequence from a library of stick-figure pictograms. A TypeScript port of the
Python `yoga_builder` app; it runs entirely in the browser, so it can be hosted as a GitHub Page.

## Using it

- Press **?** (or the help button) for the full list of shortcuts. The line under the preview shows what applies to the current selection.
- **Add poses** from the library on the left: click a tile to append it, or drag it onto the page to insert it.
- **Arrange** on the page preview: drag to reorder, drag to the bin (or off the page) to remove,
  box-select / Shift / Ctrl for several. `+` `−` change the space to the right of a shape (it stops
  where outlines would touch), `Enter` forces a new (centred) row, `1` / `2` add text above / below.
  Undo/redo with Ctrl+Z / Ctrl+Y.
- **Paper** size, orientation and scale (or Auto, which picks the largest readable scale for the fewest pages). The scale slider updates the page while you drag; hold Shift for ten times finer control.
- **Print options ▸ Pose names** puts each pose's name above or below its shape, in the language you choose, optionally with an italic Sanskrit line. Names are fitted to the room between neighbouring shapes (long ones wrap or shrink). A free-text note on the same side goes just beyond the name. The setting is saved with the sequence and is off by default.
- **Pose names** are shown in the library in your chosen language (see `public/poses.json`, keyed by the pose's group id in the SVG; poses without an entry fall back to their SVG label).
- **File ▸ Export SVG** downloads the whole sequence as one multi-page SVG (pages side by side, opens in
  Inkscape). It embeds the sequence, so **File ▸ Import SVG…** (or dropping the file on the page) restores it
  exactly, including files saved by the Python app. **File ▸ Export this page** saves just the page shown. **File ▸ Clear sequence…** empties it (undoable).
- **Print / PDF** prints every page at its real paper size; choose “Save as PDF” in the print dialog
  for a PDF. The dotted guide lines can be left out.
- The sequence is remembered in the browser (localStorage) between visits.
- **Library ⋯ ▸ Load library SVG…** swaps in your own library. It needs the same layout as `public/Yoga_source.svg`:
  poses are groups directly under `layer1` (labelled with the pose name), and a group labelled
  `Referenssträck` holds the triplets of reference lines the poses are drawn against.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (vitest)
npm run build      # type-check and build into dist/
```

`src/core` is the framework-free port of the Python package (geometry, catalog, layout, SVG
writing/reading, the `ProgramBuilder`); `src/ui` is the browser interface. Dependencies only point
downwards: `ui → core`.

`tests/golden.test.ts` checks the port against numbers produced by the original Python code
(`tests/fixtures/make_golden.py`).

## Deploying to GitHub Pages

In the repository settings, set **Pages → Source** to **GitHub Actions**. Every push to `main` then
builds and publishes `dist/` (see `.github/workflows/deploy.yml`). All asset URLs are relative, so it
works under `https://<user>.github.io/<repo>/`.

## Differences from the Python app

- No files on disk: the bundled library is read-only (the Python app edited the source SVG in place to
  delete duplicate drawings and add anchor points; here duplicates are simply ignored and missing
  anchors are assumed from the nearest row).
- Outlines used for tucking neighbouring poses together are traced in true page coordinates. The Python
  version traced circles/ellipses/rects in their untransformed local coordinates, which gave wrong
  outlines for most poses, so spacing near those can differ slightly (the TypeScript behaviour is the intended one).
