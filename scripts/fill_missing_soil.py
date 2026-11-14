#!/usr/bin/env python3
"""Fill in the grid cells whose SoilGrids pull failed the first time.

The SoilGrids REST endpoint is slow and occasionally drops a request. This retries only
the cells that came back empty, so the pipeline stays cheap to re-run.
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


def soil_at(lat, lon, tries=5):
    for attempt in range(tries):
        try:
            r = requests.get(
                SOIL_URL,
                params={"lon": lon, "lat": lat, "property": SOIL_PROPS,
                        "depth": "0-30cm", "value": "mean"},
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
                    # a soil object with only a depth label carries no information,
                    # so it must not count as a successful pull
                    if len([k for k in out if not k.startswith("_")]) >= 3:
                        out["_depth"] = layers[0].get("depths", [{}])[0].get("label", "0-30cm")
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
    missing = [c for c in cells if not c.get("soil")]
    print(f"[ubimap] {len(missing)} of {len(cells)} cells are missing soil", flush=True)
    if not missing:
        print("[ubimap] nothing to do")
        return

    def work(c):
        soil, url = soil_at(c["lat"], c["lon"])
        if soil:
            c["soil"] = soil
            c.setdefault("sources", {})["soilgrids"] = url
        return c

    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(work, c) for c in missing]
        for fut in as_completed(futs):
            fut.result()

    still = sum(1 for c in cells if not c.get("soil"))
    print(f"[ubimap] soil still missing on {still}/{len(cells)} cells", flush=True)
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
