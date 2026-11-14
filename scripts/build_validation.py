#!/usr/bin/env python3
"""
Build the validation dataset for UbiMap.

The model is validated against Philippine Statistics Authority (PSA) production data
for "Ubi [Greater yam]". For each province we pull the SAME NASA and ISRIC inputs the
pilot grid uses, sample several points inside the province, and let the JavaScript
engine score them. The correlation between model suitability and what farmers actually
plant is the evidence that the model means something.

Outputs data/validation_points.json, which scripts/validate_model.mjs then scores.

Usage:
    python scripts/build_validation.py
"""
from __future__ import annotations

import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
POWER_BASE = "https://power.larc.nasa.gov/api/temporal"
SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOIL_PROPS = ["phh2o", "clay", "sand", "silt", "soc", "bdod", "cec"]
PH_TZ = timezone(timedelta(hours=8))

# PSA 2025 production for "Ubi [Greater yam]" (PSA OpenSTAT table 0082E4EVCP3.px volume,
# 0112E4EAHM3.px area). These are the numbers the model is checked against.
PROVINCES = [
    # name,                  PSA 2025 volume MT, PSA 2025 area ha, lat, lon
    ("Bohol",                 3931.23,  297.03,  9.7500, 124.0500),
    ("Cagayan",               1009.90,  198.21, 17.3000, 121.5000),
    ("Quezon",                 848.89,  116.36, 14.0000, 121.5000),
    ("Lanao del Norte",        727.36,  327.62,  8.6000, 123.9000),
    ("Lanao del Sur",          435.27,   24.10,  7.9000, 124.0000),
    ("Leyte",                  388.64,  100.45, 11.0000, 124.5000),
    ("La Union",               310.96,   16.00, 16.3000, 120.5000),
    ("Laguna",                 291.00,  101.20, 14.2000, 121.3000),
    ("Negros Occidental",      271.00,   23.00, 10.5000, 122.8000),
    ("Nueva Vizcaya",          235.00,   35.00, 16.5000, 121.2000),
    ("Negros Oriental",        227.00,   38.00,  9.3000, 123.2000),
    ("Batangas",               203.00,   48.00, 13.8000, 121.1000),
    ("Cebu",                   185.00,   29.50, 10.3000, 123.9000),
    ("Davao del Sur",          173.70,   28.90,  7.1000, 125.4000),
    ("Zamboanga del Sur",       91.10,   36.00,  7.8397, 123.4373),
    ("Zamboanga Sibugay",       39.80,   20.10,  7.5000, 122.8000),
    ("Zamboanga del Norte",     15.20,    7.60,  8.0000, 123.0000),
    ("Sorsogon",                 3.00,    1.80, 12.8000, 124.0000),
]

# Provinces with no reported ube production in 2025: a useful negative control.
NO_PRODUCTION = [
    ("Basilan",   0.0, 0.0, 6.7000, 122.3000),
    ("Dinagat",   0.0, 0.0, 8.9000, 126.2000),
    ("Surigao del Norte", 0.0, 0.0, 9.2000, 125.5000),
    ("Apayao",    0.0, 0.0, 18.2000, 121.2000),
]

# offsets for the sample points inside each province
OFFSETS = [(0.0, 0.0), (0.35, 0.0), (-0.35, 0.0), (0.0, 0.40), (0.0, -0.40)]


def _get(url, params=None, tries=4, timeout=45):
    last = None
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 200:
                try:
                    return r.status_code, r.json(), r.url
                except ValueError:
                    return r.status_code, r.text, r.url
            last = f"HTTP {r.status_code}"
            if r.status_code in (400, 422):
                break
        except Exception as exc:  # noqa: BLE001
            last = f"{type(exc).__name__}"
        time.sleep(1.5 * (attempt + 1))
    return 0, {"error": last}, url


def calendar_month_means(params, key):
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


def pull_point(lat, lon):
    """Pull the same NASA POWER + SoilGrids inputs the pilot grid uses."""
    clim_params = "PRECTOTCORR,T2M_MAX,T2M_MIN,T2M,RH2M,ALLSKY_SFC_SW_DWN"
    st, data, clim_url = _get(
        f"{POWER_BASE}/climatology/point",
        {"parameters": clim_params, "community": "AG", "longitude": lon,
         "latitude": lat, "format": "JSON"},
    )
    climate = None
    if st == 200 and "properties" in data:
        p = data["properties"]["parameter"]
        months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        climate = {
            "precip_mm_day": [p.get("PRECTOTCORR", {}).get(m) for m in months],
            "tmax": [p.get("T2M_MAX", {}).get(m) for m in months],
            "tmin": [p.get("T2M_MIN", {}).get(m) for m in months],
            "tmean": [p.get("T2M", {}).get(m) for m in months],
            "rh": [p.get("RH2M", {}).get(m) for m in months],
            "solar_mj": [p.get("ALLSKY_SFC_SW_DWN", {}).get(m) for m in months],
        }

    st, data, soil_url = _get(
        f"{POWER_BASE}/monthly/point",
        {"parameters": "GWETROOT,GWETTOP", "community": "AG", "longitude": lon,
         "latitude": lat, "start": 2015, "end": 2024, "format": "JSON"},
    )
    soil_moisture = None
    if st == 200 and "properties" in data:
        p = data["properties"]["parameter"]
        soil_moisture = {
            "gwetroot_mean": None,
            "gwettop_mean": None,
            "gwetroot_monthly": calendar_month_means(p, "GWETROOT"),
            "gwettop_monthly": calendar_month_means(p, "GWETTOP"),
            "months": len(p.get("GWETROOT", {})),
        }

    st, data, soilgrids_url = _get(
        SOIL_URL,
        {"lon": lon, "lat": lat, "property": SOIL_PROPS, "depth": "0-30cm", "value": "mean"},
        tries=3, timeout=50,
    )
    soil = None
    if st == 200 and "properties" in data:
        layers = data["properties"].get("layers", [])
        if layers:
            soil = {}
            for lay in layers:
                unit = lay.get("unit_measure", {})
                d_factor = unit.get("d_factor", 1) or 1
                depths = lay.get("depths", [])
                if not depths:
                    continue
                mean = depths[0].get("values", {}).get("mean")
                if mean is None:
                    continue
                soil[lay["name"]] = round(mean / d_factor, 3)
            if soil:
                soil["_depth"] = layers[0].get("depths", [{}])[0].get("label", "0-30cm")

    return {
        "lat": lat, "lon": lon,
        "climate": climate,
        "soil_moisture": soil_moisture,
        "soil": soil,
        "elev_m": None, "slope_deg": None,
        "sources": {"power_climatology": clim_url, "power_monthly": soil_url, "soilgrids": soilgrids_url},
    }


def main():
    jobs = []
    for group, table in (("producers", PROVINCES), ("non_producers", NO_PRODUCTION)):
        for name, vol, area, lat, lon in table:
            for dlat, dlon in OFFSETS:
                jobs.append((group, name, vol, area, round(lat + dlat, 4), round(lon + dlon, 4)))

    print(f"[ubimap] pulling {len(jobs)} validation points", flush=True)
    results = []
    t0 = time.time()
    done = 0

    def work(job):
        group, name, vol, area, lat, lon = job
        p = pull_point(lat, lon)
        p.update({"group": group, "province": name, "psa_volume_mt": vol, "psa_area_ha": area})
        return p

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(work, j) for j in jobs]
        for fut in as_completed(futs):
            results.append(fut.result())
            done += 1
            if done % 20 == 0:
                print(f"  {done}/{len(jobs)} ({time.time() - t0:.0f}s)", flush=True)

    ok = sum(1 for r in results if r.get("climate"))
    soilok = sum(1 for r in results if r.get("soil"))
    print(f"[ubimap] climate on {ok}/{len(results)}, soil on {soilok}/{len(results)}", flush=True)

    payload = {
        "meta": {
            "purpose": "Validation of the UbiMap suitability model against PSA production statistics for Ubi [Greater yam]",
            "psa_source": "Philippine Statistics Authority OpenSTAT, crops production tables 0082E4EVCP3.px (volume) and 0112E4EAHM3.px (area), 2025 annual",
            "psa_api": "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/",
            "retrieved_utc": datetime.now(timezone.utc).isoformat(),
            "retrieved_philippine": datetime.now(PH_TZ).isoformat(),
            "points": len(results),
            "note": "One row per sampled point inside each province. The engine scores every point, then the province score is the mean.",
        },
        "points": results,
    }
    os.makedirs("data", exist_ok=True)
    with open("data/validation_points.json", "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/validation_points.json ({os.path.getsize('data/validation_points.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
