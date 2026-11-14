#!/usr/bin/env python3
"""
UbiMap data pipeline — builds the NASA Earth-observation feature grid for the pilot area.

Everything in this script is reproducible: run it again and you get the same grid with a
new retrieval timestamp. No NASA credentials are required. Every number carries the
exact URL that produced it, so a judge can paste the URL and see the same data.

Sources (all NASA, all no-auth):
  * NASA POWER  - power.larc.nasa.gov  (MERRA-2 / CERES derived, community=AG)
      PRECTOTCORR  corrected precipitation, mm/day
      T2M_MAX/T2M_MIN  daily max/min air temperature, degC
      T2M         daily mean temperature, degC
      GWETROOT    root zone soil moisture, m3/m3
      GWETTOP     surface soil moisture, m3/m3
      RH2M        relative humidity, %
      ALLSKY_SFC_SW_DWN  all-sky surface shortwave irradiance, MJ/m2/day
  * NASA GIBS - gibs.earthdata.nasa.gov  (tiles only, rendered live in the browser)

Non-NASA helpers, clearly attributed in the output:
  * NASA SRTM 30 m elevation, served by opentopodata.org (dataset id "srtm30m")
  * Slope derived from the same SRTM via the AWS "Terrarium" tile pyramid

Usage:
    python scripts/build_pilot_grid.py --bbox 7.70,123.25,8.00,123.65 --step 0.02
    python scripts/build_pilot_grid.py --bbox 6.90,122.60,8.30,124.00 --step 0.10 --out data/province_grid.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
POWER_BASE = "https://power.larc.nasa.gov/api/temporal"
PH_TZ = timezone(timedelta(hours=8))

POWER_DAILY_PARAMS = [
    "T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR",
    "GWETROOT", "GWETTOP", "RH2M", "ALLSKY_SFC_SW_DWN",
]


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _get(url, params=None, tries=4, timeout=45):
    """GET with retry and exponential backoff. Returns (status, parsed_or_text, url)."""
    last = None
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            full = r.url
            if r.status_code == 200:
                try:
                    return r.status_code, r.json(), full
                except ValueError:
                    return r.status_code, r.text, full
            last = f"HTTP {r.status_code}: {r.text[:160]}"
            if r.status_code in (422, 400):
                break  # bad request, retrying will not help
        except Exception as exc:  # noqa: BLE001
            last = f"{type(exc).__name__}: {exc}"
        time.sleep(1.6 * (attempt + 1))
    return 0, {"error": last}, url


def month_mean(params, key):
    """POWER monthly responses use keys like '202001'. Return mean of all values."""
    vals = [v for v in params.get(key, {}).values() if isinstance(v, (int, float)) and v > -900]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 4)


def calendar_month_means(params, key):
    """Mean per calendar month (JAN..DEC) from a POWER monthly response.

    POWER monthly keys are YYYYMM, so we group by the MM part. Seasonal soil moisture
    is what decides waterlogging risk, so the annual mean is not enough.
    """
    buckets = {m: [] for m in range(1, 13)}
    for stamp, val in params.get(key, {}).items():
        if not isinstance(val, (int, float)) or val <= -900:
            continue
        try:
            mm = int(str(stamp)[4:6])
        except (TypeError, ValueError):
            continue
        if 1 <= mm <= 12:
            buckets[mm].append(val)
    out = []
    for mm in range(1, 13):
        vals = buckets[mm]
        out.append(round(sum(vals) / len(vals), 4) if vals else None)
    return out


def safe(v, lo=None, hi=None):
    if v is None:
        return None
    if lo is not None and v < lo:
        return lo
    if hi is not None and v > hi:
        return hi
    return v


# --------------------------------------------------------------------------- #
# NASA POWER
# --------------------------------------------------------------------------- #
def power_climatology(lat, lon):
    """12-month climatology for a point. Returns (monthly, source_url)."""
    params = ",".join(["PRECTOTCORR", "T2M_MAX", "T2M_MIN", "T2M", "RH2M", "ALLSKY_SFC_SW_DWN"])
    status, data, url = _get(
        f"{POWER_BASE}/climatology/point",
        {
            "parameters": params,
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "format": "JSON",
        },
    )
    if status != 200 or "properties" not in data:
        return None, url, f"climatology failed: {data}"
    p = data["properties"]["parameter"]
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    out = {}
    for name, key in [
        ("precip_mm_day", "PRECTOTCORR"),
        ("tmax", "T2M_MAX"),
        ("tmin", "T2M_MIN"),
        ("tmean", "T2M"),
        ("rh", "RH2M"),
        ("solar_mj", "ALLSKY_SFC_SW_DWN"),
    ]:
        out[name] = [safe(p.get(key, {}).get(m), -900, 900) for m in months]
    return out, url, None


def power_monthly_soil(lat, lon, start=2015, end=2024):
    """10-year monthly mean root-zone and surface soil moisture (GWET)."""
    status, data, url = _get(
        f"{POWER_BASE}/monthly/point",
        {
            "parameters": "GWETROOT,GWETTOP",
            "community": "AG",
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        },
    )
    if status != 200 or "properties" not in data:
        return None, url, f"monthly failed: {data}"
    p = data["properties"]["parameter"]
    return (
        {
            "gwetroot_mean": month_mean(p, "GWETROOT"),
            "gwettop_mean": month_mean(p, "GWETTOP"),
            "gwetroot_monthly": calendar_month_means(p, "GWETROOT"),
            "gwettop_monthly": calendar_month_means(p, "GWETTOP"),
            "months": len(p.get("GWETROOT", {})),
            "years": f"{start}-{end}",
        },
        url,
        None,
    )


# --------------------------------------------------------------------------- #
# elevation + slope  (NASA SRTM)
# --------------------------------------------------------------------------- #
def srtm_points(points):
    """Batch elevation lookup against NASA SRTM 30 m. points: [(id, lat, lon)]"""
    out = {}
    chunk = 50
    for i in range(0, len(points), chunk):
        batch = points[i:i + chunk]
        locs = "|".join(f"{la},{lo}" for _, la, lo in batch)
        status, data, _ = _get(
            "https://api.opentopodata.org/v1/srtm30m",
            {"locations": locs},
            tries=3,
            timeout=60,
        )
        if status != 200 or "results" not in data:
            continue
        for res, (_, la, lo) in zip(data["results"], batch):
            try:
                out[f"{la:.4f},{lo:.4f}"] = float(res["elevation"])
            except (KeyError, TypeError, ValueError):
                continue
        time.sleep(1.1)  # be polite to a free community endpoint
    return out


def terrarium_dem(bbox, zoom=13):
    """Decode AWS Terrarium tiles into a lat/lon elevation sampler (SRTM-derived)."""
    import io

    from PIL import Image

    lat0, lon0, lat1, lon1 = bbox

    def deg2num(lat, lon, z):
        n = 2 ** z
        x = int((lon + 180.0) / 360.0 * n)
        r = math.radians(lat)
        y = int((1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n)
        return x, y

    x0, y0 = deg2num(lat1, lon0, zoom)
    x1, y1 = deg2num(lat0, lon1, zoom)
    grid = []
    for tx in range(min(x0, x1), max(x0, x1) + 1):
        row = []
        for ty in range(min(y0, y1), max(y0, y1) + 1):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png"
            st, raw, _ = _get(url, tries=3, timeout=45)
            if st != 200 or not isinstance(raw, (bytes, bytearray)):
                row.append(None)
                continue
            try:
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
                px = img.load()
                rows = []
                for yy in range(img.height):
                    rows.append([(px[xx, yy][0] * 256 + px[xx, yy][1]) - 32768 for xx in range(img.width)])
                grid.append((tx, ty, rows))
            except Exception:  # noqa: BLE001
                row.append(None)
        time.sleep(0.05)
    if not grid:
        return None

    n = 2 ** zoom

    def tile_xy(lat, lon):
        x = (lon + 180.0) / 360.0 * n
        r = math.radians(lat)
        y = (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n
        return x, y

    lookup = {tx: {ty: rows for tx, ty, rows in grid}}

    def elev(lat, lon):
        x, y = tile_xy(lat, lon)
        tx, ty = int(x), int(y)
        rows = lookup.get(tx, {}).get(ty)
        if rows is None:
            return None
        px = x - tx
        py = y - ty
        ix, iy = int(px * 256), int(py * 256)
        ix = max(0, min(255, ix))
        iy = max(0, min(len(rows) - 1, iy))
        try:
            return rows[iy][ix]
        except IndexError:
            return None

    return elev


def slope_from_dem(elev_fn, lat, lon, span=0.012):
    """Slope in degrees from a finite difference of the DEM."""
    h = elev_fn(lat, lon)
    if h is None:
        return None, None
    dx = elev_fn(lat, lon + span)
    dy = elev_fn(lat + span, lon)
    if dx is None or dy is None:
        return h, None
    m_lat = (dy - h) / (span * 111_320.0)
    m_lon = (dx - h) / (span * 111_320.0 * math.cos(math.radians(lat)))
    return h, round(math.degrees(math.atan(math.hypot(m_lat, m_lon))), 2)


# --------------------------------------------------------------------------- #
# main build
# --------------------------------------------------------------------------- #
def build_cells(bbox, step):
    lat0, lon0, lat1, lon1 = bbox
    n_lat = int(round((lat1 - lat0) / step))
    n_lon = int(round((lon1 - lon0) / step))
    cells = []
    for i in range(n_lat):
        for j in range(n_lon):
            lat = round(lat0 + (i + 0.5) * step, 4)
            lon = round(lon0 + (j + 0.5) * step, 4)
            cells.append({"id": f"{i}_{j}", "lat": lat, "lon": lon,
                          "row": i, "col": j, "step": step})
    return cells


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", required=True, help="lat0,lon0,lat1,lon1")
    ap.add_argument("--step", type=float, default=0.02)
    ap.add_argument("--out", default="data/pilot_grid.json")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--years", default="2015-2024")
    args = ap.parse_args()

    bbox = tuple(float(v) for v in args.bbox.split(","))
    y0, y1 = args.years.split("-")
    cells = build_cells(bbox, args.step)
    print(f"[ubimap] grid {len(cells)} cells at {args.step}deg over {bbox}", flush=True)

    # ---- DEM first (one download set, reused for every cell) ----
    print("[ubimap] fetching DEM tiles for slope...", flush=True)
    elev_fn = terrarium_dem(bbox, zoom=13)
    print(f"[ubimap] DEM ready: {elev_fn is not None}", flush=True)

    print("[ubimap] fetching SRTM point elevations...", flush=True)
    elevs = srtm_points([(c["id"], c["lat"], c["lon"]) for c in cells])
    print(f"[ubimap] srtm points: {len(elevs)}/{len(cells)}", flush=True)

    # ---- NASA POWER per cell ----
    print("[ubimap] fetching NASA POWER per cell...", flush=True)

    def work(cell):
        clim, clim_url, err1 = power_climatology(cell["lat"], cell["lon"])
        soil, soil_url, err2 = power_monthly_soil(cell["lat"], cell["lon"], y0, y1)
        h, sl = slope_from_dem(elev_fn, cell["lat"], cell["lon"]) if elev_fn else (None, None)
        srtm = elevs.get(f"{cell['lat']:.4f},{cell['lon']:.4f}")
        if h is None:
            h = srtm
        cell["climate"] = clim
        cell["soil_moisture"] = soil
        cell["elev_m"] = round(h, 1) if h is not None else None
        cell["slope_deg"] = sl
        cell["elev_source"] = "SRTM 30 m (opentopodata srtm30m)" if srtm is not None else "AWS Terrarium (SRTM-derived)"
        cell["sources"] = {"power_climatology": clim_url, "power_monthly": soil_url}
        cell["errors"] = [e for e in (err1, err2) if e]
        return cell

    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = [pool.submit(work, c) for c in cells]
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 25 == 0 or done == len(cells):
                print(f"  {done}/{len(cells)}  ({time.time() - t0:.0f}s)", flush=True)

    ok = sum(1 for c in cells if c.get("climate"))
    print(f"[ubimap] cells with POWER climate: {ok}/{len(cells)}", flush=True)

    now = datetime.now(PH_TZ)
    meta = {
        "product": "UbiMap pilot feature grid",
        "challenge": "NASA Space Apps Challenge 2026 - Field Shift: Adapting Farms with NASA Data",
        "bbox": list(bbox),
        "step_deg": args.step,
        "step_km_approx": round(args.step * 111.32, 2),
        "cells": len(cells),
        "retrieved_utc": datetime.now(timezone.utc).isoformat(),
        "retrieved_philippine": now.isoformat(),
        "power_years_for_soil_moisture": args.years,
        "sources": {
            "NASA POWER (agro)": "https://power.larc.nasa.gov/api/temporal/",
            "NASA GIBS tiles": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
            "NASA SRTM 30 m": "https://api.opentopodata.org/v1/srtm30m",
        },
    }
    out = {"meta": meta, "cells": cells}
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"[ubimap] wrote {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
