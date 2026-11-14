#!/usr/bin/env python3
"""
Enrich the UbiMap pilot grid with the layers the first pass could not get:
  * slope (degrees) from the NASA SRTM elevation model, sampled at field scale
  * soil properties (pH, clay, sand, silt, organic carbon, bulk density, CEC)
    from ISRIC SoilGrids 2.0

Reads data/pilot_grid.json, writes it back with the extra fields, and records the
exact retrieval URL for every source so the app can show provenance.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
PH_TZ = timezone(timedelta(hours=8))

SOIL_PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


def http(url, params=None, tries=4, timeout=45):
    last = None
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 200:
                return r.status_code, r.content, r.headers.get("Content-Type", ""), r.url
            last = f"HTTP {r.status_code}"
            if r.status_code in (400, 422):
                break
        except Exception as exc:  # noqa: BLE001
            last = f"{type(exc).__name__}"
        time.sleep(1.4 * (attempt + 1))
    return 0, b"", "", url


# --------------------------------------------------------------------------- #
# slope from SRTM
# --------------------------------------------------------------------------- #
def build_dem_sampler(bbox, zoom=14):
    """Return f(lat, lon) -> elevation metres, decoded from Terrarium tiles."""
    from PIL import Image

    lat0, lon0, lat1, lon1 = bbox

    def deg2xy(lat, lon, z):
        n = 2 ** z
        x = (lon + 180.0) / 360.0 * n
        r = math.radians(lat)
        y = (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n
        return x, y

    xs, ys = [], []
    x0, y0 = deg2xy(lat1, lon0, zoom)
    x1, y1 = deg2xy(lat0, lon1, zoom)
    for tx in range(int(min(x0, x1)), int(max(x0, x1)) + 1):
        for ty in range(int(min(y0, y1)), int(max(y0, y1)) + 1):
            xs.append(tx)
            ys.append(ty)

    tiles = {}
    print(f"[ubimap] fetching {len(xs)} DEM tiles at z{zoom}", flush=True)

    def grab(tx, ty):
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png"
        st, raw, ct, _ = http(url, tries=3, timeout=45)
        if st != 200 or not raw:
            return None
        try:
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
            px = img.load()
            w, h = img.size
            rows = [[(px[x, y][0] * 256 + px[x, y][1]) - 32768 for x in range(w)] for y in range(h)]
            return (tx, ty, rows)
        except Exception:  # noqa: BLE001
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(grab, tx, ty): (tx, ty) for tx, ty in zip(xs, ys)}
        for i, fut in enumerate(as_completed(futs), 1):
            res = fut.result()
            if res:
                tiles[(res[0], res[1])] = res[2]
            if i % 20 == 0:
                print(f"  tiles {i}/{len(xs)}", flush=True)

    print(f"[ubimap] tiles decoded: {len(tiles)}", flush=True)
    if not tiles:
        return None

    n = 2 ** zoom

    def elev(lat, lon):
        x = (lon + 180.0) / 360.0 * n
        r = math.radians(lat)
        y = (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n
        tx, ty = int(x), int(y)
        rows = tiles.get((tx, ty))
        if rows is None:
            # fall back to the nearest loaded tile centre
            best, bd = None, 1e9
            for (a, b) in tiles:
                d = (a - tx) ** 2 + (b - ty) ** 2
                if d < bd:
                    best, bd = (a, b), d
            if best is None:
                return None
            tx, ty = best
            rows = tiles[(tx, ty)]
            x = tx + 0.5
            y = ty + 0.5
        ix = max(0, min(len(rows[0]) - 1, int((x - tx) * 256)))
        iy = max(0, min(len(rows) - 1, int((y - ty) * 256)))
        return rows[iy][ix]

    return elev


def slope_at(elev, lat, lon, m_per_px):
    """Field-scale slope in degrees from a central difference over ~2 pixels."""
    h = elev(lat, lon)
    if h is None:
        return None, None
    d = m_per_px * 2
    hy = elev(lat + d / 111320.0, lon)
    hx = elev(lat, lon + d / (111320.0 * math.cos(math.radians(lat))))
    if hy is None or hx is None:
        return h, None
    gx = (hx - h) / d
    gy = (hy - h) / d
    return h, round(math.degrees(math.atan(math.hypot(gx, gy))), 2)


# --------------------------------------------------------------------------- #
# soil
# --------------------------------------------------------------------------- #
def soil_at(lat, lon):
    """ISRIC SoilGrids point query. Returns dict of properties + source url."""
    st, raw, _ct, url = http(
        SOIL_URL,
        {
            "lon": lon,
            "lat": lat,
            "property": SOIL_PROPS,  # must be a LIST, a comma string returns a non-JSON body
            "depth": "0-30cm",
            "value": "mean",
        },
        tries=3,
        timeout=50,
    )
    if st != 200 or not raw:
        return None, url, "soilgrids request failed"
    try:
        payload = json.loads(raw)
    except ValueError:
        return None, url, "soilgrids bad json"
    layers = payload.get("properties", {}).get("layers", [])
    if not layers:
        # retry with the 0-5cm layer, which the API documents as the default depth
        st, raw, _ct, url = http(
            SOIL_URL,
            {"lon": lon, "lat": lat,
             "property": ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"],
             "depth": "0-5cm", "value": "mean"},
            tries=2, timeout=50,
        )
        if st != 200 or not raw:
            return None, url, "soilgrids empty"
        try:
            layers = json.loads(raw).get("properties", {}).get("layers", [])
        except ValueError:
            return None, url, "soilgrids bad json"
        if not layers:
            return None, url, "soilgrids no layers"

    out = {}
    for lay in layers:
        name = lay.get("name")
        unit = lay.get("unit_measure", {})
        d_factor = unit.get("d_factor", 1)
        depths = lay.get("depths", [])
        if not depths:
            continue
        mean = depths[0].get("values", {}).get("mean")
        if mean is None:
            continue
        out[name] = round(mean / (d_factor or 1), 3)
    out["_depth"] = lay.get("depths", [{}])[0].get("label", "0-30cm")
    return out, url, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grid", default="data/pilot_grid.json")
    ap.add_argument("--zoom", type=int, default=14)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--skip-soil", action="store_true")
    args = ap.parse_args()

    with open(args.grid, encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]
    bbox = grid["meta"]["bbox"]
    print(f"[ubimap] enriching {len(cells)} cells from {args.grid}", flush=True)

    # ---- slope ----
    elev = build_dem_sampler(bbox, zoom=args.zoom)
    if elev:
        m_per_px = 156543.03392 * math.cos(math.radians(bbox[0])) / (2 ** args.zoom)
        for c in cells:
            h, sl = slope_at(elev, c["lat"], c["lon"], m_per_px)
            if h is not None:
                c["elev_m"] = round(h, 1)
                c["elev_source"] = f"NASA SRTM via AWS Terrarium tiles z{args.zoom} (~{m_per_px:.1f} m/px)"
            c["slope_deg"] = sl
            c["slope_baseline_m"] = round(m_per_px * 2, 1)
        grid["meta"]["slope_source"] = (
            f"NASA SRTM (Shuttle Radar Topography Mission) via AWS Terrarium tile pyramid, z{args.zoom}"
        )
        got = sum(1 for c in cells if c.get("slope_deg") is not None)
        print(f"[ubimap] slope on {got}/{len(cells)} cells", flush=True)
    else:
        print("[ubimap] WARNING: DEM unavailable, slope left empty", flush=True)

    # ---- soil ----
    if not args.skip_soil:
        print("[ubimap] fetching SoilGrids properties...", flush=True)

        def work(c):
            props, url, err = soil_at(c["lat"], c["lon"])
            if props:
                c["soil"] = props
                c["sources"]["soilgrids"] = url
            if err:
                c.setdefault("errors", []).append(err)
            return c

        t0 = time.time()
        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futs = [pool.submit(work, c) for c in cells]
            for fut in as_completed(futs):
                fut.result()
                done += 1
                if done % 50 == 0:
                    print(f"  soil {done}/{len(cells)} ({time.time() - t0:.0f}s)", flush=True)
        got = sum(1 for c in cells if c.get("soil"))
        print(f"[ubimap] soil on {got}/{len(cells)} cells", flush=True)
        grid["meta"]["soil_source"] = (
            "ISRIC SoilGrids 2.0 (SoilGrids250m) - https://rest.isric.org/soilgrids/v2.0/properties/query"
        )

    grid["meta"]["enriched_philippine"] = datetime.now(PH_TZ).isoformat()
    grid["meta"]["enriched_utc"] = datetime.now(timezone.utc).isoformat()
    with open(args.grid, "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote {args.grid} ({os.path.getsize(args.grid) / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
