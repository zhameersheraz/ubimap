#!/usr/bin/env python3
"""Fetch soil for the cells a judge is most likely to look at: the demo point and around it."""
from __future__ import annotations

import json
import os
import time

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]
DEMO = (7.8397, 123.4373)


def nprops(s):
    return len([k for k in (s or {}) if not k.startswith("_")])


def fetch(lat, lon, depth, tries=6):
    for attempt in range(tries):
        try:
            r = requests.get(
                SOIL_URL,
                params={"lon": lon, "lat": lat, "property": PROPS, "depth": depth, "value": "mean"},
                headers=UA, timeout=70,
            )
            if r.status_code == 200:
                layers = r.json().get("properties", {}).get("layers", [])
                out = {}
                for lay in layers:
                    d_factor = lay.get("unit_measure", {}).get("d_factor", 1) or 1
                    depths = lay.get("depths", [])
                    if not depths:
                        continue
                    mean = depths[0].get("values", {}).get("mean")
                    if mean is None:
                        continue
                    out[lay["name"]] = round(mean / d_factor, 3)
                if nprops(out) >= 3:
                    out["_depth"] = layers[0].get("depths", [{}])[0].get("label", depth)
                    return out, r.url
        except Exception:  # noqa: BLE001
            pass
        time.sleep(3.0 + 3.0 * attempt)
    return None, SOIL_URL


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]

    # the demo point first, then the cells nearest to it
    def dist(c):
        return (c["lat"] - DEMO[0]) ** 2 + (c["lon"] - DEMO[1]) ** 2

    targets = [c for c in cells if nprops(c.get("soil")) < 3]
    targets.sort(key=dist)

    print(f"[ubimap] fetching soil for {len(targets)} priority cells", flush=True)
    done = 0
    for c in targets:
        for depth in ("0-5cm", "0-30cm"):
            soil, url = fetch(c["lat"], c["lon"], depth)
            if soil:
                c["soil"] = soil
                c.setdefault("sources", {})["soilgrids"] = url
                break
        done += 1
        if done % 5 == 0:
            print(f"  {done}/{len(targets)}", flush=True)

    ok = sum(1 for c in cells if nprops(c.get("soil")) >= 3)
    print(f"[ubimap] usable soil on {ok}/{len(cells)} cells", flush=True)
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
