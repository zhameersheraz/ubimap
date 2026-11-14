#!/usr/bin/env python3
"""
Fill the soil gaps for the grid cells that are actually on land.

Most of the cells with no SoilGrids data are the Sulu Sea at zero elevation, so they
genuinely have no soil and the app shows them as missing, which is correct. This script
targets only the land cells and samples several points inside each one.

Reads data/pilot_grid.json, writes it back.
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]
OFFSETS = [
    (0.0, 0.0), (0.0, 0.3), (0.0, -0.3), (0.3, 0.0), (-0.3, 0.0),
    (0.3, 0.3), (-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3),
]


def nprops(s):
    return len([k for k in (s or {}) if not k.startswith("_")])


def fetch(lat, lon, depth):
    try:
        r = requests.get(
            SOIL_URL,
            params={"lon": lon, "lat": lat, "property": PROPS, "depth": depth, "value": "mean"},
            headers=UA, timeout=35,
        )
        if r.status_code != 200:
            return None
        out = {}
        for lay in r.json().get("properties", {}).get("layers", []):
            depths = lay.get("depths", [])
            if not depths:
                continue
            mean = depths[0].get("values", {}).get("mean")
            if mean is None:
                continue
            d_factor = lay.get("unit_measure", {}).get("d_factor", 1) or 1
            out[lay["name"]] = round(mean / d_factor, 3)
        if nprops(out) >= 3:
            out["_depth"] = layers_depth_label(out)
            return out
    except Exception:  # noqa: BLE001
        pass
    return None


def layers_depth_label(out):
    return out.get("_depth", "0-30cm")


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]
    step = grid["meta"].get("step_deg", 0.02)

    # land cells only: elevation above 5 m
    targets = [c for c in cells if nprops(c.get("soil")) < 3 and (c.get("elev_m") or 0) > 5]
    print(f"[ubimap] {len(targets)} land cells without soil", flush=True)

    def work(c):
        for dlat, dlon in OFFSETS:
            lat = round(c["lat"] + dlat * step, 4)
            lon = round(c["lon"] + dlon * step, 4)
            for depth in ("0-5cm", "0-30cm"):
                soil = fetch(lat, lon, depth)
                if soil:
                    soil["_depth"] = depth
                    c["soil"] = soil
                    c["soil_sample_point"] = {"lat": lat, "lon": lon}
                    return c
            time.sleep(0.4)
        return c

    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(work, c) for c in targets]
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 5 == 0:
                print(f"  {done}/{len(targets)}", flush=True)

    ok = sum(1 for c in cells if nprops(c.get("soil")) >= 3)
    land_total = sum(1 for c in cells if (c.get("elev_m") or 0) > 5)
    land_ok = sum(1 for c in cells if nprops(c.get("soil")) >= 3 and (c.get("elev_m") or 0) > 5)
    print(f"[ubimap] usable soil on {ok}/{len(cells)} cells, and {land_ok}/{land_total} of the land cells", flush=True)
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
