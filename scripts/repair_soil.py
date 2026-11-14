#!/usr/bin/env python3
"""Repair grid cells whose soil object is empty or only carries a depth label.

The SoilGrids API sometimes answers with a layers array that has no values. The first
pass wrote those as a soil object containing only _depth, which made the cell look like
it had soil when it did not. This script finds every cell whose soil object carries no
actual property values and re-fetches it, and it also upgrades the depth from 0-30 cm to
0-5 cm where the topsoil is what matters for a surface crop.
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOIL_PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]


def has_values(soil):
    return bool(soil) and len([k for k in soil if not k.startswith("_")]) >= 3


def soil_at(lat, lon, depth, tries=5):
    for attempt in range(tries):
        try:
            r = requests.get(
                SOIL_URL,
                params={"lon": lon, "lat": lat, "property": SOIL_PROPS,
                        "depth": depth, "value": "mean"},
                headers=UA, timeout=60,
            )
            if r.status_code == 200:
                layers = r.json().get("properties", {}).get("layers", [])
                if layers:
                    out = {}
                    for lay in layers:
                        unit = lay.get("unit_measure", {})
                        d_factor = unit.get("d_factor", 1) or 1
                        depths = lay.get("depths", [])
                        if not depths:
                            continue
                        mean = depths[0].get("values", {}).get("mean")
                        if mean is None:
                            continue
                        out[lay["name"]] = round(mean / d_factor, 3)
                    if has_values(out):
                        out["_depth"] = layers[0].get("depths", [{}])[0].get("label", depth)
                        return out, r.url
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2.0 + 2.5 * attempt)
    return None, SOIL_URL


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]
    broken = [c for c in cells if not has_values(c.get("soil"))]
    print(f"[ubimap] {len(broken)} of {len(cells)} cells have no usable soil", flush=True)

    def work(c):
        for depth in ("0-5cm", "0-30cm"):
            soil, url = soil_at(c["lat"], c["lon"], depth)
            if soil:
                c["soil"] = soil
                c.setdefault("sources", {})["soilgrids"] = url
                return c
        return c

    if broken:
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = [pool.submit(work, c) for c in broken]
            for fut in as_completed(futs):
                fut.result()

    ok = sum(1 for c in cells if has_values(c.get("soil")))
    print(f"[ubimap] usable soil on {ok}/{len(cells)} cells", flush=True)
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
