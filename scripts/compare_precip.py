"""Cross-check NASA POWER against GPM IMERG over the pilot grid.

Two independent NASA precipitation products at two different resolutions:
  NASA POWER   about 50 km, MERRA-2 derived
  GPM IMERG    about 10 km, 25 years of daily composites from NASA GIBS

If they agree, the rainfall the model uses is not an artefact of one product's grid.
If they disagree, that is a finding and it must be reported.

Usage: python scripts/compare_precip.py
"""
from __future__ import annotations

import json
import os

DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def pearson(xs, ys):
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    return num / (dx * dy) ** 0.5 if dx and dy else None


def main():
    grid = json.load(open("data/pilot_grid.json", encoding="utf-8"))
    hires = json.load(open("data/precip_highres.json", encoding="utf-8"))
    by_id = {c["id"]: c for c in hires["cells"]}

    rows = []
    for c in grid["cells"]:
        h = by_id.get(c["id"])
        if not h or not c.get("climate"):
            continue
        p_mm = [
            (c["climate"]["precip_mm_day"][i] or 0) * DAYS[i] if c["climate"]["precip_mm_day"][i] is not None else None
            for i in range(12)
        ]
        i_mm = h.get("monthly_mm")
        if not i_mm or any(v is None for v in p_mm) or any(v is None for v in i_mm):
            continue
        rows.append({
            "id": c["id"],
            "lat": c["lat"],
            "lon": c["lon"],
            "power_annual": round(sum(p_mm), 1),
            "imerg_annual": round(sum(i_mm), 1),
            "power_dry50": sum(1 for v in p_mm if v < 50),
            "imerg_dry50": sum(1 for v in i_mm if v < 50),
            "power_dry100": sum(1 for v in p_mm if v < 100),
            "imerg_dry100": sum(1 for v in i_mm if v < 100),
            "power_wettest": max(p_mm),
            "imerg_wettest": max(i_mm),
            "power_driest": min(p_mm),
            "imerg_driest": min(i_mm),
        })

    n = len(rows)
    diffs = [abs(r["power_annual"] - r["imerg_annual"]) for r in rows]
    pcts = [(r["power_annual"] - r["imerg_annual"]) / r["imerg_annual"] * 100 for r in rows]
    r_annual = pearson([r["power_annual"] for r in rows], [r["imerg_annual"] for r in rows])
    r_driest = pearson([r["power_driest"] for r in rows], [r["imerg_driest"] for r in rows])
    agree_dry50 = sum(1 for r in rows if (r["power_dry50"] > 0) == (r["imerg_dry50"] > 0))
    agree_dry100 = sum(1 for r in rows if (r["power_dry100"] > 0) == (r["imerg_dry100"] > 0))
    dry50_both = sum(1 for r in rows if r["power_dry50"] > 0 and r["imerg_dry50"] > 0)

    print("=" * 84)
    print("NASA POWER versus GPM IMERG over the pilot grid")
    print("=" * 84)
    print(f"  cells compared                     : {n}")
    print(f"  Pearson r, annual total            : {r_annual:.3f}")
    print(f"  Pearson r, driest month            : {r_driest:.3f}")
    print(f"  mean absolute annual difference    : {sum(diffs) / n:.0f} mm")
    print(f"  mean signed difference             : {sum(pcts) / n:+.1f} percent (POWER minus IMERG)")
    print(f"  cells where both see a dry month < 50 mm : {dry50_both}")
    print(f"  cells where they agree on having a sub 50 mm month : {agree_dry50}/{n}")
    print(f"  cells where they agree on having a sub 100 mm month : {agree_dry100}/{n}")
    print()
    print("  ten largest differences:")
    for r in sorted(rows, key=lambda x: -abs(x["power_annual"] - x["imerg_annual"]))[:10]:
        print(f"    {r['id']} ({r['lat']}, {r['lon']})  POWER {r['power_annual']:>7.0f}  IMERG {r['imerg_annual']:>7.0f}"
              f"  diff {r['power_annual'] - r['imerg_annual']:>+7.0f}   dry<50 POWER {r['power_dry50']} IMERG {r['imerg_dry50']}")
    print()
    print("  the demo cell and its neighbours:")
    for r in sorted(rows, key=lambda x: (x["lat"] - 7.8397) ** 2 + (x["lon"] - 123.4373) ** 2)[:5]:
        print(f"    {r['id']} ({r['lat']}, {r['lon']})  POWER {r['power_annual']:>7.0f} mm  IMERG {r['imerg_annual']:>7.0f} mm"
              f"   months<100mm: POWER {r['power_dry100']}  IMERG {r['imerg_dry100']}")
    print()

    out = {
        "meta": {
            "purpose": "Cross-check of NASA POWER against GPM IMERG over the UbiMap pilot grid",
            "power_source": "NASA POWER climatology (MERRA-2 derived, about 50 km)",
            "imerg_source": hires["meta"]["source"],
            "imerg_period": hires["meta"]["period"],
            "imerg_resolution_km": hires["meta"]["resolution_km"],
        },
        "statistics": {
            "cells_compared": n,
            "pearson_r_annual": round(r_annual, 4),
            "pearson_r_driest_month": round(r_driest, 4),
            "mean_absolute_annual_difference_mm": round(sum(diffs) / n, 1),
            "mean_signed_difference_percent": round(sum(pcts) / n, 2),
            "cells_agreeing_on_a_sub50mm_month": agree_dry50,
            "cells_agreeing_on_a_sub100mm_month": agree_dry100,
            "cells_with_a_sub50mm_month_in_both": dry50_both,
        },
        "cells": rows,
    }
    with open("data/precip_crosscheck.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print("  wrote data/precip_crosscheck.json")


if __name__ == "__main__":
    main()
