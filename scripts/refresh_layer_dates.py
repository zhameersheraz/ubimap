#!/usr/bin/env python3
"""
Refresh the NASA GIBS layer list: query the live WMTS capabilities for the
newest date of every layer, and rewrite the tile URL to the date-less form.

The date-less form is the important part. GIBS resolves it to whatever the
newest available image is, so the map keeps serving fresh NASA imagery for the
whole day without a rebuild. The date is still reported in the interface, it
is just read live instead of being frozen at build time.

Run:  python scripts/refresh_layer_dates.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYERS = os.path.join(ROOT, "src", "data", "nasaLayers.json")
CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml"

UA = "UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8", "replace")


def live_dates(caps: str) -> dict[str, str]:
    """Newest date per layer, from the Time dimension values.

    A GIBS time value is a range: start/end/period, for example
    2025-11-10/2026-11-15/P1D. The newest usable stamp is the END of the
    last range, not the start.
    """
    out: dict[str, str] = {}
    # each <Layer> block ends with </Layer>
    for block in re.findall(r"<Layer>(.*?)</Layer>", caps, re.S):
        m = re.search(r"<ows:Identifier>([^<]+)</ows:Identifier>", block)
        if not m:
            continue
        ident = m.group(1)
        vals = re.findall(r"<Value>([^<]+)</Value>", block)
        ends: list[str] = []
        for v in vals:
            parts = v.split("/")
            if len(parts) >= 2 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[1]):
                ends.append(parts[1])
            elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                ends.append(v)
        if ends:
            out[ident] = max(ends)
    return out


def main() -> int:
    print("[layers] fetching live GIBS capabilities")
    caps = fetch(CAPS)
    dates = live_dates(caps)
    print(f"[layers] parsed {len(dates)} layer dates from capabilities")

    with open(LAYERS, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    for ident, layer in data["layers"].items():
        live = dates.get(ident)
        if not live:
            # static layer, no Time dimension (SRTM)
            layer["time"] = ""
            print(f"[layers] {ident}: static, left alone")
            continue

        layer["time"] = live
        # rewrite the dated URL to the date-less form
        new_url = re.sub(
            r"/(default)/[0-9]{4}-[0-9]{2}-[0-9]{2}(/)",
            r"/\1\2",
            layer["url"],
        )
        if new_url != layer["url"]:
            layer["url"] = new_url
        print(f"[layers] {ident}: latest {live}, url now date-less")

    data["_live_dates_checked_utc"] = ""
    with open(LAYERS, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"[layers] wrote {LAYERS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
