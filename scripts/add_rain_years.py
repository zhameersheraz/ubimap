#!/usr/bin/env python3
"""
Add the multi-year rainfall record to every pilot grid cell.

The climate endpoint gives a climatological average, which hides how much a real year
can differ. Judges expect to see a range, not a single number. This pulls the NASA
POWER monthly precipitation for 2015 to 2024, turns it into an annual total per year,
and stores the series plus the min, median and max on each cell.

Reads data/pilot_grid.json, writes it back.
"""
from __future__ import annotations

import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import requests

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"}
URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PH_TZ = timezone(timedelta(hours=8))


def annual_series(lat, lon, start=2015, end=2024):
    """Annual precipitation totals in mm, one entry per year."""
    for attempt in range(4):
        try:
            r = requests.get(
                URL,
                params={
                    "parameters": "PRECTOTCORR",
                    "community": "AG",
                    "longitude": lon,
                    "latitude": lat,
                    "start": start,
                    "end": end,
                    "format": "JSON",
                },
                headers=UA, timeout=45,
            )
            if r.status_code != 200:
                time.sleep(1.4 * (attempt + 1))
                continue
            p = r.json()["properties"]["parameter"]["PRECTOTCORR"]
            by_year = {}
            for stamp, val in p.items():
                if not isinstance(val, (int, float)) or val <= -900:
                    continue
                try:
                    year = int(str(stamp)[:4])
                    mm = int(str(stamp)[4:6])
                except (TypeError, ValueError):
                    continue
                by_year.setdefault(year, {})[mm] = val
            out = {}
            for year, months in by_year.items():
                if len(months) < 11:
                    continue
                out[str(year)] = round(sum(months.values()) * 30.4375, 1)
            return out, r.url
        except Exception:  # noqa: BLE001
            time.sleep(1.4 * (attempt + 1))
    return None, URL


def main():
    with open("data/pilot_grid.json", encoding="utf-8") as fh:
        grid = json.load(fh)
    cells = grid["cells"]
    print(f"[ubimap] adding multi-year rainfall to {len(cells)} cells", flush=True)

    def work(cell):
        series, url = annual_series(cell["lat"], cell["lon"])
        if series:
            vals = list(series.values())
            cell["rain_years"] = {
                "series": series,
                "min": round(min(vals), 1),
                "median": round(statistics.median(vals), 1),
                "max": round(max(vals), 1),
                "years": len(vals),
            }
            cell.setdefault("sources", {})["power_monthly_rain"] = url
        return cell

    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(work, c) for c in cells]
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(cells)} ({time.time() - t0:.0f}s)", flush=True)

    got = sum(1 for c in cells if c.get("rain_years"))
    print(f"[ubimap] rainfall series on {got}/{len(cells)} cells", flush=True)

    grid["meta"]["rain_years_range"] = "2015-2024"
    grid["meta"]["rain_years_philippine"] = datetime.now(PH_TZ).isoformat()
    with open("data/pilot_grid.json", "w", encoding="utf-8") as fh:
        json.dump(grid, fh, separators=(",", ":"))
    print(f"[ubimap] wrote data/pilot_grid.json ({os.path.getsize('data/pilot_grid.json') / 1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
