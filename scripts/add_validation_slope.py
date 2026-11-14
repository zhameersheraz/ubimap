#!/usr/bin/env python3
"""
Add elevation and a local slope estimate to every validation point.

The validation points are spread across the whole Philippines, so building a full DEM
for them is wasteful. Instead each point gets its elevation plus four neighbours about
550 m away, and the slope is the gradient through those five points. It is the same
quantity the pilot grid uses, computed at a coarser footprint.

Reads data/validation_points.json, writes it back.
"""
from __future__ import annotations

import json
import math
import os
import time

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
URL = "https://api.opentopodata.org/v1/srtm30m"
OFFSET_DEG = 0.005  # about 555 m


def fetch_elevations(locs):
    """locs: list of (lat, lon). Returns list of elevations in the same order."""
    for attempt in range(4):
        try:
            r = requests.get(
                URL,
                params={"locations": "|".join(f"{la},{lo}" for la, lo in locs)},
                headers=UA, timeout=90,
            )
            if r.status_code == 200:
                data = r.json()
                out = []
                for res in data.get("results", []):
                    try:
                        out.append(float(res["elevation"]))
                    except (KeyError, TypeError, ValueError):
                        out.append(None)
                return out
        except Exception:  # noqa: BLE001
            pass
        time.sleep(2.0 * (attempt + 1))
    return [None] * len(locs)


def main():
    with open("data/validation_points.json", encoding="utf-8") as fh:
        payload = json.load(fh)
    points = payload["points"]
    print(f"[ubimap] adding slope to {len(points)} validation points", flush=True)

    # build the flat list of locations to request, then batch them
    locs = []
    index = []
    for i, p in enumerate(points):
        la, lo = p["lat"], p["lon"]
        group = [
            (la, lo),
            (la + OFFSET_DEG, lo),
            (la - OFFSET_DEG, lo),
            (la, lo + OFFSET_DEG),
            (la, lo - OFFSET_DEG),
        ]
        locs.extend(group)
        index.append((i, group))

    elevs = []
    B = 50
    for s in range(0, len(locs), B):
        chunk = locs[s:s + B]
        elevs.extend(fetch_elevations(chunk))
        print(f"  elevations {min(s + B, len(locs))}/{len(locs)}", flush=True)
        time.sleep(1.1)

    ok = 0
    for i, group in index:
        vals = elevs[i * 5:(i + 1) * 5]
        if vals[0] is None:
            continue
        points[i]["elev_m"] = round(vals[0], 1)
        c, n, s_, e, w = vals
        if None in (n, s_, e, w):
            points[i]["slope_deg"] = None
            continue
        d_lat = OFFSET_DEG * 111320.0
        d_lon = OFFSET_DEG * 111320.0 * math.cos(math.radians(points[i]["lat"]))
        gy = (n - s_) / (2 * d_lat)
        gx = (e - w) / (2 * d_lon)
        points[i]["slope_deg"] = round(math.degrees(math.atan(math.hypot(gx, gy))), 2)
        ok += 1

    payload["meta"]["slope_source"] = (
        "NASA SRTM 30 m via opentopodata srtm30m, five point gradient over about 555 m"
    )
    with open("data/validation_points.json", "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    print(f"[ubimap] slope on {ok}/{len(points)} points", flush=True)
    print(f"[ubimap] wrote data/validation_points.json ({os.path.getsize('data/validation_points.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
