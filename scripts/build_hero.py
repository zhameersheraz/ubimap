#!/usr/bin/env python3
"""
Build the hero plate: a real NASA image of the Zamboanga peninsula around Pagadian.

The plate is stitched from live NASA GIBS tiles, so it is the actual satellite view of
the pilot area, not an illustration. It is used as the hero image of the app and as the
social preview image.

The frame and the date were chosen by eye from a contact sheet of the available dates,
see scripts/_hero_candidates.py. The crop is centred on Pagadian City, so the city, the
agricultural plain and the coast are all legible, with the Sulu Sea along one edge. The
earlier build framed so much open water that the subject was a thin strip.

MODIS Terra true colour at 250 m is the finest true colour product GIBS serves for this
region. Landsat WELD goes deeper but only reaches 2001, so it cannot stand as a picture
of today's fields.
"""
from __future__ import annotations

import io
import json
import math
import os
import re
import sys
import urllib.request

from PIL import Image

UA = {"User-Agent": "UbiMap/1.0 (NASA Space Apps Challenge 2026)"}
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The pilot area. Pagadian City is on the north-west coast of the Zamboanga peninsula.
LAT, LON = 7.8397, 123.4373

LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor"
EXT = "jpg"
LEVEL = 9

# The chosen frame and pass. 2026-04-30 is the clearest recent pass over Pagadian: the
# city, the farmland and the coast all read, and the cloud band sits offshore rather
# than over the pilot area.
PLATE_DATE = "2026-04-30"
COLS, ROWS = 2, 2
EAST, SOUTH = 0, 0


def deg2xy(lat, lon, level):
    n = 2 ** level
    x = int((lon + 180.0) / 360.0 * n)
    r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n)
    return x, y


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def fetch_caps() -> str:
    return fetch(CAPS).decode("utf-8", "replace")


def latest_date(caps: str, ident: str) -> str:
    """Newest usable date for a layer, from the WMTS Time dimension.

    A GIBS time value is a range, start/end/period. The newest usable stamp is the END
    of the last range, not the start.
    """
    idx = caps.find(f"<ows:Identifier>{ident}</ows:Identifier>")
    if idx < 0:
        return ""
    seg = caps[idx : idx + 4000]
    ends = []
    for v in re.findall(r"<Value>([^<]+)</Value>", seg):
        parts = v.split("/")
        if len(parts) >= 2 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[1]):
            ends.append(parts[1])
    return max(ends) if ends else ""


def stitch(date: str, cols: int, rows: int, east: int, south: int):
    """Stitch a window of GIBS tiles around the pilot area.

    The dated form is used, because the plate is a fixed image and the date has to be
    the one that was actually inspected and approved.
    """
    cx, cy = deg2xy(LAT, LON, LEVEL)
    x0, y0 = cx - cols // 2 + east, cy - rows // 2 + south
    canvas = Image.new("RGB", (256 * cols, 256 * rows), (10, 16, 26))
    got = 0
    last_url = ""
    for j in range(rows):
        for i in range(cols):
            url = (f"{BASE}/{LAYER}/default/{date}/GoogleMapsCompatible_Level{LEVEL}"
                   f"/{LEVEL}/{y0 + j}/{x0 + i}.{EXT}")
            last_url = last_url or url
            try:
                data = fetch(url)
                if len(data) > 1500:
                    canvas.paste(Image.open(io.BytesIO(data)).convert("RGB"), (i * 256, j * 256))
                    got += 1
            except Exception:  # noqa: BLE001
                pass
    return canvas, got, last_url


def save_crops(canvas: Image.Image, out_dir: str) -> None:
    """The wide banner and the plate the app header shows.

    The app header crops the plate with object-fit: cover at a wide aspect, so the
    subject is placed in the middle of the frame here and the crop is not left to
    happen by accident.
    """
    w, h = canvas.size

    # 16:9 wide banner for social previews
    crop_w = int(h * 16 / 9)
    if crop_w <= w:
        left = int((w - crop_w) / 2)
        banner = canvas.crop((left, 0, left + crop_w, h))
    else:
        banner = canvas
    banner.save(os.path.join(out_dir, "hero-wide.jpg"), quality=88, optimize=True)

    # the plate, taller so it reads on a phone
    plate_w = int(h * 3 / 2)
    if plate_w <= w:
        left = int((w - plate_w) / 2)
        plate = canvas.crop((left, 0, left + plate_w, h))
    else:
        plate = banner
    plate.save(os.path.join(out_dir, "hero-plate.jpg"), quality=90, optimize=True)


def main() -> None:
    out_dir = os.path.join(ROOT, "public")
    os.makedirs(out_dir, exist_ok=True)

    print(f"[hero] fetching {LAYER} for {PLATE_DATE}")
    canvas, got, url = stitch(PLATE_DATE, COLS, ROWS, EAST, SOUTH)
    if got < 4:
        print(f"[hero] only {got} tiles, keeping the existing images")
        sys.exit(1)

    per_layer = os.path.join(out_dir, f"hero-{LAYER.lower()}.jpg")
    canvas.save(per_layer, quality=88, optimize=True)
    save_crops(canvas, out_dir)
    print(f"[hero] wrote hero-plate.jpg, hero-wide.jpg and {os.path.basename(per_layer)}")

    # the newest date GIBS has for this layer, so the map and the plate can be compared
    caps = fetch_caps()
    newest = latest_date(caps, LAYER)
    print(f"[hero] newest available pass for this layer: {newest}")

    with open(os.path.join(out_dir, "hero-sources.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"hero-plate.jpg\t{LAYER}\t{PLATE_DATE}\tlevel {LEVEL}\t{url}\n")
        fh.write(f"hero-wide.jpg\t{LAYER}\t{PLATE_DATE}\tlevel {LEVEL}\t{url}\n")
        fh.write(f"{os.path.basename(per_layer)}\t{LAYER}\t{PLATE_DATE}\tlevel {LEVEL}\t{url}\n")
        fh.write(f"#\n# layer\t{LAYER}\n")
        fh.write(f"# plate pass\t{PLATE_DATE}\n")
        fh.write(f"# newest pass GIBS had when this was built\t{newest}\n")
        fh.write(f"# window\t{COLS}x{ROWS} tiles at level {LEVEL}\n")
        fh.write(f"# pilot area\t{LAT} N, {LON} E\n")

    # the caption in the app reads these, so it can never drift from the image
    caption = {
        "plate_date": PLATE_DATE,
        "plate_layer": "MODIS Terra true colour",
        "plate_resolution": "250 m",
        "plate_lat": f"{LAT} N",
        "plate_lon": f"{LON} E",
        "plate_source": "NASA EOSDIS GIBS",
        "note": "Written by scripts/build_hero.py so the hero caption always matches the image that is actually deployed.",
    }
    with open(os.path.join(ROOT, "src", "data", "heroPlate.json"), "w", encoding="utf-8") as fh:
        json.dump(caption, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("[hero] wrote src/data/heroPlate.json for the caption")


if __name__ == "__main__":
    main()
