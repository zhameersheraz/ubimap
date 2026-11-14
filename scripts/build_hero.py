#!/usr/bin/env python3
"""
Build the hero plate: a real NASA image of the Zamboanga peninsula around Pagadian.

The plate is stitched from live NASA GIBS tiles at 250 m and 375 m, so it is the actual
satellite view of the pilot area, not an illustration. It is used as the hero image of
the app and as the social preview image.
"""
from __future__ import annotations

import io
import math
import os

import requests
from PIL import Image

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026)"}
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
LAT, LON = 7.8397, 123.4373
LEVEL = 9
N = 2 ** LEVEL

# layer id, tile matrix level, extension, tile date
SOURCES = [
    ("MODIS_Terra_CorrectedReflectance_TrueColor", 9, "jpg", "2026-11-14"),
    ("VIIRS_NOAA20_CorrectedReflectance_TrueColor", 9, "jpg", "2026-11-14"),
    ("VIIRS_SNPP_CorrectedReflectance_TrueColor", 9, "jpg", "2026-11-02"),
]


def deg2xy(lat, lon, level=LEVEL):
    n = 2 ** level
    x = int((lon + 180.0) / 360.0 * n)
    r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n)
    return x, y


def fetch_tile(layer, level, ext, date, x, y):
    url = (f"{BASE}/{layer}/default/{date}/GoogleMapsCompatible_Level{level}"
           f"/{level}/{y}/{x}.{ext}")
    try:
        r = requests.get(url, headers=UA, timeout=40)
        if r.status_code == 200 and len(r.content) > 2000:
            return Image.open(io.BytesIO(r.content)).convert("RGB"), url
    except Exception:  # noqa: BLE001
        pass
    return None, url


def stitch(layer, level, ext, date, cols=3, rows=3):
    cx, cy = deg2xy(LAT, LON, level)
    x0 = cx - cols // 2
    y0 = cy - rows // 2
    canvas = Image.new("RGB", (256 * cols, 256 * rows), (10, 16, 26))
    got = 0
    last_url = None
    for j in range(rows):
        for i in range(cols):
            img, url = fetch_tile(layer, level, ext, date, x0 + i, y0 + j)
            last_url = last_url or url
            if img:
                canvas.paste(img, (i * 256, j * 256))
                got += 1
    return canvas, got, last_url


def main():
    out_dir = os.path.join("public")
    os.makedirs(out_dir, exist_ok=True)
    report = []

    for layer, level, ext, date in SOURCES:
        canvas, got, url = stitch(layer, level, ext, date)
        if got < 4:
            print(f"[hero] {layer}: only {got} tiles, skipped")
            continue
        name = f"hero-{layer.lower()}.jpg"
        path = os.path.join(out_dir, name)
        canvas.save(path, quality=88, optimize=True)
        report.append((layer, date, got, name, os.path.getsize(path) // 1024, url))
        print(f"[hero] {layer} {date}: {got} tiles -> {name} ({os.path.getsize(path) // 1024} KB)")

    # the primary plate, plus a wide crop for the app hero
    if report:
        primary_name = report[0][3]
        canvas = Image.open(os.path.join(out_dir, primary_name)).convert("RGB")
        canvas.save(os.path.join(out_dir, "hero-plate.jpg"), quality=90, optimize=True)
        # 16:9 wide crop centred on Pagadian
        w, h = canvas.size
        crop_w = int(h * 16 / 9)
        if crop_w <= w:
            left = int((w - crop_w) / 2)
            canvas.crop((left, 0, left + crop_w, h)).save(
                os.path.join(out_dir, "hero-wide.jpg"), quality=88, optimize=True)
        print("[hero] wrote hero-plate.jpg and hero-wide.jpg")

    with open(os.path.join(out_dir, "hero-sources.txt"), "w", encoding="utf-8") as fh:
        for layer, date, got, name, kb, url in report:
            fh.write(f"{name}\t{layer}\t{date}\t{url}\n")


if __name__ == "__main__":
    main()
