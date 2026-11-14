#!/usr/bin/env python3
"""
Fill the grid cells whose SoilGrids point query comes back empty.

These are not fetch failures. SoilGrids returns a layers array with no values when the
queried point falls on a pixel the product has no data for, which over this grid means
the sea and a few other spots. The centre of such a cell may be water while the rest of
the cell is good farmland, so instead of giving up we sample a small set of points
inside the cell and take the first one that has soil.

Each cell records the point that was actually sampled, so the provenance panel can show
that the value came from a real sample inside the cell and not from its centre.
"""
from __future__ import annotations

import json
import os
import time

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]

# sample points inside a cell, as fractions of the cell size
OFFSETS = [
    (0.0, 0.0),
    (0.0, 0.25), (0.0, -0.25), (0.25, 0.0), (-0.25, 0.0),
    (0.25, 0.25), (-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25),
    (0.0, 0.4), (0.4, 0.0), (0.0, -0.4), (-0.4, 0.0),
]


def nprops(s):
    return len([k for k in (s or {}) if not k.startswith("_")])


def fetch(lat, lon, depth, tries=3):
    for attempt in range(tries):
        try:
            r = requests.get(
                SOIL_URL,
                params={"lon": lon, "lat": lat, "property": PROPS, "depth": depth, "value": "mean"},
                headers=UA, timeout=60,
            )
            if r.status_code == 200:
                layers = r.json().get("properties", {}).get("layers", [])
                out = {}
                for lay in layers:
                    depths = lay.get("depths", [])
                    if not depths:
                        continue
                    mean = depths[0].get("values", {}).get("mean")
                    if mean is None:
                        continue
                    d_factor = lay.get("unit_measure", {}).get("d_factor", 1) or 1
                    out[lay["name"]] = round(mean / d_factor, 3)
                if nprops(out) >= 3:
                    out["_depth"] = layers[0].get("depths", [{}])[0].get("label", depth)
                    return out, r.url
                return None, r.url
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2.0 + 2.0 * attempt)
    return None, SOIL_URL


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]
    step = grid["meta"].get("step_deg", 0.02)

    targets = [c for c in cells if nprops(c.get("soil")) < 3]
    print(f"[ubimap] {len(targets)} cells have no usable soil", flush=True)

    done = 0
    for c in targets:
        for dlat, dlon in OFFSETS:
            lat = round(c["lat"] + dlat * step, 4)
            lon = round(c["lon"] + dlon * step, 4)
            for depth in ("0-5cm", "0-30cm"):
                soil, url = fetch(lat, lon, depth)
                if soil:
                    c["soil"] = soil
                    c["soil_sample_point"] = {"lat": lat, "lon": lon}
                    c.setdefault("sources", {})["soilgrids"] = url
                    break
            if nprops(c.get("soil")) >= 3:
                break
        done += 1
        if done % 10 == 0:
            print(f"  {done}/{len(targets)}", flush=True)

    ok = sum(1 for c in cells if nprops(c.get("soil")) >= 3)
    print(f"[ubimap] usable soil on {ok}/{len(cells)} cells", flush=True)
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
