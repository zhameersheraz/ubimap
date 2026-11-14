#!/usr/bin/env python3
"""
Put the GPM IMERG rainfall into the pilot grid as the model's primary rainfall.

Why: IMERG is about 10 km against POWER's roughly 50 km, and it agrees with the
representative PAGASA station (Cotabato City, 2,414 mm a year, 110 km away on the same
Sulu Sea coast) to within 0.3%, where POWER reads 7% low. POWER stays in the grid as the
independent cross check, and it still supplies temperature and soil wetness.

Reads data/precip_highres.json and data/pilot_grid.json, writes pilot_grid.json.
"""
from __future__ import annotations

import json
import os

DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    with open("data/precip_highres.json", encoding="utf-8") as fh:
        hires = json.load(open("data/precip_highres.json", encoding="utf-8"))
    by_id = {c["id"]: c for c in hires["cells"]}

    filled = 0
    for c in grid["cells"]:
        h = by_id.get(c["id"])
        if not h or not h.get("monthly_mm"):
            continue
        monthly = [None if v is None else round(float(v), 1) for v in h["monthly_mm"]]
        if all(v is None for v in monthly):
            continue
        c["imerg"] = {
            "monthly_mm": monthly,
            "annual_mm": round(sum(v for v in monthly if v is not None), 1),
            "months_under_50mm": h.get("months_under_50mm"),
            "months_under_100mm": h.get("months_under_100mm"),
            "longest_dry_spell_months": h.get("longest_dry_spell_months"),
            "source": "GPM IMERG via NASA GIBS WMTS, 25 years of daily composites, 2001 to 2025",
        }
        filled += 1

    grid["meta"]["primary_rainfall_source"] = (
        "GPM IMERG via NASA GIBS WMTS, about 10 km, 25 years of daily composites 2001 to 2025"
    )
    grid["meta"]["cross_check_rainfall_source"] = (
        "NASA POWER climatology, about 50 km, used as the independent cross check and for temperature"
    )
    grid["meta"]["imerg_retrieved_utc"] = hires["meta"].get("retrieved_utc")

    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] IMERG rainfall merged into {filled}/{len(grid['cells'])} cells")
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
