import json, sys
sys.path[:0] = ["/media/deuracell/Linux-Data/himlavalv/Deurousi/Yoga-program/app", "/media/deuracell/Linux-Data/himlavalv/Deurousi/Yoga-program/app/vendor"]
sys.dont_write_bytecode = True
from dataclasses import replace
from yoga_builder.catalog import load_catalog
from yoga_builder.reference import load_ruling
from yoga_builder.layout import layout_rows, slacks
from yoga_builder.page_setup import PageSetup, build_ruling
from yoga_builder.slot import Slot
src = sys.argv[1]
ruling = load_ruling(src)
cat = load_catalog(src, ruling)
out = {"ruling": {"left": ruling.left, "right": ruling.right, "rows": [[r.top, r.bottom] for r in ruling.rows]},
       "pictograms": [], "dropped": [[n, g] for n, g in cat.dropped_copies], "warnings": cat.name_warnings}
for p in cat.pictograms:
    out["pictograms"].append({"name": p.name, "id": p.group_id, "w": p.width, "h": p.height, "top": p.top,
        "ax": p.anchor_x, "ay": p.anchor_y, "hasAnchor": p.has_anchor,
        "slices": len(p.silhouette), "sliceSum": sum(l + r for l, r in p.silhouette.values()),
        # The Python outline is traced in untransformed local coordinates for shapes svgelements cannot
        # bake a transform into (rotated ellipses ...), which gives impossible values. Mark those poses.
        "clean": all(-1 <= l and r <= p.width + 1 for l, r in p.silhouette.values())})
pics = [p for p in cat.pictograms if all(-1 <= l and r <= p.width + 1 for l, r in p.silhouette.values())]
out["cleanNames"] = [p.name for p in pics]
slots = [Slot(p) for p in pics]
print(len(slots), "clean poses")
for i, (k, v) in enumerate([(2, "s"), (4, "b"), (6, "s")]):
    if k < len(slots): (setattr(slots[k], "spacing", 5.0 if i != 2 else -4.0) if v == "s" else setattr(slots[k], "break_after", True))
layouts = {}
for key, setup in {"a4": PageSetup("a4", False, 1.0, False), "a5l": PageSetup("a5", True, 0.8, False)}.items():
    rl = build_ruling(setup)
    pl = layout_rows(slots, rl, 8.0)
    layouts[key] = {"pl": [[p.page, p.x, p.y, p.top, p.scale] for p in pl],
                    "slacks": [s for s in slacks(slots, rl, 8.0)]}
out["layouts"] = layouts
json.dump(out, open(sys.argv[2], "w"))
print(len(pics), "pictograms;", len(cat.dropped_copies), "dropped;", len(cat.name_warnings), "warnings")
