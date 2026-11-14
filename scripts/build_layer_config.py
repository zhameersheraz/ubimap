"""Build src/data/nasaLayers.json: the NASA GIBS layers UbiMap renders live in the browser.

For every candidate layer we pull the real time dimension out of the WMTS capabilities,
try the newest valid date, and keep the layer only if the tile actually downloads.
The output records the exact working time so the map never shows a broken layer.
"""
from __future__ import annotations

import json
import os
import re

import requests

H = {"User-Agent": "UbiMap/1.0 (NASA Space Apps 2026)"}
CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml"
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
TMS = "GoogleMapsCompatible_Level9"
# the pilot point, used to pick a tile that definitely covers the study area
PILOT_LAT = 7.8397
PILOT_LON = 123.4373

# GIBS does not publish every tile-matrix level for every layer. A request at a level the
# layer does not publish is a hard 400, so each layer records the one level that works.
# Confirmed by sweeping levels 3-11 against real tiles over Pagadian.
LEVEL_OVERRIDE = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": 9,
    "MODIS_Aqua_CorrectedReflectance_TrueColor": 9,
    "VIIRS_NOAA20_CorrectedReflectance_TrueColor": 9,
    "VIIRS_SNPP_CorrectedReflectance_TrueColor": 9,
    "MODIS_Terra_L3_NDVI_16Day": 9,
    "VIIRS_NOAA20_NDVI_8Day": 8,
    "SMAP_L3_Passive_Enhanced_Night_Soil_Moisture": 6,
    "IMERG_Precipitation_Rate": 6,
    "MODIS_Combined_Flood_1-Day": 9,
    "VIIRS_Combined_Flood_1-Day": 9,
    "SRTM_Color_Index": 9,
}

# layer id -> presentation metadata
CANDIDATES = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": {
        "label_en": "MODIS Terra - true colour", "label_bis": "MODIS Terra - tinag nga kulay",
        "mission": "MODIS (Terra)", "kind": "imagery",
        "what_en": "What the land looked like on that day. Brown patches are bare soil, green is growing crop.",
        "what_bis": "Unsa ang nakita sa yuta nga adlawa nga adla. Ang maputi nga bahin mao ang bare soil, ang green mao ang naka-grow nga crop.",
        "latency_en": "1 to 2 days", "resolution": "250 m", "period": "daily",
    },
    "MODIS_Aqua_CorrectedReflectance_TrueColor": {
        "label_en": "MODIS Aqua - true colour", "label_bis": "MODIS Aqua - tinag nga kulay",
        "mission": "MODIS (Aqua)", "kind": "imagery",
        "what_en": "The afternoon pass of the same sensor, useful when the morning pass is cloudy.",
        "what_bis": "Same sensor sa hapon, gamit kung naa kabisan sa uma.",
        "latency_en": "1 to 2 days", "resolution": "250 m", "period": "daily",
    },
    "VIIRS_NOAA20_CorrectedReflectance_TrueColor": {
        "label_en": "VIIRS NOAA-20 - true colour", "label_bis": "VIIRS NOAA-20 - tinag nga kulay",
        "mission": "VIIRS", "kind": "imagery",
        "what_en": "Higher detail than MODIS, so individual field boundaries start to show.",
        "what_bis": "Mas detalyado kay sa MODIS, makita na ang tagsa nga uma.",
        "latency_en": "1 to 2 days", "resolution": "375 m", "period": "daily",
    },
    "VIIRS_SNPP_CorrectedReflectance_TrueColor": {
        "label_en": "VIIRS Suomi NPP - true colour", "label_bis": "VIIRS Suomi NPP - tinag nga kulay",
        "mission": "VIIRS", "kind": "imagery",
        "what_en": "The older VIIRS platform, kept as a backup when the newer one has a gap.",
        "what_bis": "Daan na VIIRS, gamit kung adlaw sa mga bag-o.",
        "latency_en": "2 to 3 days", "resolution": "375 m", "period": "daily",
    },
    "MODIS_Terra_L3_NDVI_16Day": {
        "label_en": "MODIS NDVI - vegetation vigor", "label_bis": "MODIS NDVI - kusang sa tanom",
        "mission": "MODIS (Terra)", "kind": "index",
        "what_en": "Greenness index. Low values mean bare ground or a stressed crop, high values mean a healthy canopy.",
        "what_bis": "Index sa pagkagreen. Makatikang ka value = bare ground o stressed crop, taas = maayo nga canopy.",
        "latency_en": "8 to 16 days", "resolution": "250 m", "period": "16 day",
    },
    "VIIRS_NOAA20_NDVI_8Day": {
        "label_en": "VIIRS NDVI - vegetation vigor", "label_bis": "VIIRS NDVI - kusang sa tanom",
        "mission": "VIIRS", "kind": "index",
        "what_en": "The 8 day greenness index from VIIRS, which updates twice as often as the MODIS 16 day product.",
        "what_bis": "Ang 8 ka adlaw nga index sa pagkagreen gikan sa VIIRS, duha ka dagli kaysa sa MODIS nga 16 ka adlaw.",
        "latency_en": "8 days", "resolution": "500 m", "period": "8 day",
    },
    "IMERG_Precipitation_Rate": {
        "label_en": "GPM IMERG - rainfall", "label_bis": "GPM IMERG - pagkakasulo sa ulan",
        "mission": "GPM (Core Observatory)", "kind": "index",
        "what_en": "Rainfall from the International Precipitation Working Group, measured from space. This is the same product you see on NASA Worldview.",
        "what_bis": "Pagkakasulo sa ulan gikan sa International Precipitation Working Group, sukato gikan sa space. Same product sa NASA Worldview.",
        "latency_en": "about 1 day", "resolution": "10 km", "period": "daily",
    },
    "MODIS_Combined_Flood_1-Day": {
        "label_en": "MODIS flood extent", "label_bis": "MODIS flood extent",
        "mission": "MODIS", "kind": "index",
        "what_en": "Where water is standing on the surface. Ube tubers rot in standing water, so this is the risk to watch.",
        "what_bis": " Asa may tubig nga nakatumpag. Matur ug ube sa tuyub nga tubig, kaya ini ang risk nga tan-awon.",
        "latency_en": "1 to 2 days", "resolution": "250 m", "period": "daily",
    },
    "VIIRS_Combined_Flood_1-Day": {
        "label_en": "VIIRS flood extent", "label_bis": "VIIRS flood extent",
        "mission": "VIIRS", "kind": "index",
        "what_en": "The same flood product from VIIRS, which fills some of the gaps in the MODIS series.",
        "what_bis": "Same flood product gikan sa VIIRS, nga nagpuno sa pipila nga gap sa MODIS series.",
        "latency_en": "1 to 2 days", "resolution": "375 m", "period": "daily",
    },
    "SMAP_L3_Passive_Enhanced_Night_Soil_Moisture": {
        "label_en": "SMAP soil moisture", "label_bis": "SMAP soil moisture",
        "mission": "SMAP", "kind": "index",
        "what_en": "Surface soil moisture from the L-band radar, on the night pass. Each pixel covers about 36 km, so it tells you about a region, not about one farm.",
        "what_bis": "Surface soil moisture gikan sa L-band radar, sa gab-i nga pass. Usa ka pixel mga 36 km, so regional lang, dili usa ka uma.",
        "latency_en": "2 to 3 days", "resolution": "36 km", "period": "daily",
    },
    "GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI": {
        "label_en": "GRACE water storage", "label_bis": "GRACE water storage",
        "mission": "GRACE / GRACE-FO", "kind": "index",
        "what_en": "Total water stored in the land system, including groundwater. Each mascon is about 300 km, so use it for the trend, not for one field.",
        "what_bis": "Kinatibuk-ang tubig sa yuta, kasama ang groundwater. Usa ka mascon mga 300 km, so alang sa trend.",
        "latency_en": "1 to 2 months", "resolution": "300 km", "period": "monthly",
    },
    "BlueMarble_ShadedRelief": {
        "label_en": "Shaded relief basemap", "label_bis": "Shaded relief basemap",
        "mission": "NASA Blue Marble / SRTM", "kind": "basemap",
        "what_en": "The background map. The shading shows the hills, which is where runoff and erosion risk come from.",
        "what_bis": "Ang background nga mapa. Ang shadow nga mapa nga pundok, asa gikan ang runoff ug erosion risk.",
        "latency_en": "static", "resolution": "500 m", "period": "static",
    },
    "SRTM_Color_Index": {
        "label_en": "SRTM elevation", "label_bis": "SRTM elevation",
        "mission": "SRTM", "kind": "index",
        "what_en": "Elevation colour scale. Steep ground is where soil washes away once the ube rows are dug.",
        "what_bis": "Skala sa kataas. Mas maangkop nga yuta mao ang naaay og namuyag.",
        "latency_en": "static", "resolution": "30 m", "period": "static",
    },
}

TILE = BASE + "/{layer}/default/{time}/{tms}/{z}/{y}/{x}.{ext}"
TILE_STATIC = BASE + "/{layer}/default/{tms}/{z}/{y}/{x}.{ext}"
# a tile that definitely covers Pagadian at z9
TEST_TILE = {"z": 9, "x": 431, "y": 244}


def build_url(layer, time, ext, tms_override=None, **extra):
    """Fill layer/time/tms/ext, leaving {z}/{y}/{x} as MapLibre placeholders."""
    tmpl = TILE if time else TILE_STATIC
    url = (tmpl.replace("{layer}", layer)
               .replace("{time}", time or "")
               .replace("{tms}", tms_override or TMS)
               .replace("{ext}", ext))
    for k, v in extra.items():
        url = url.replace("{" + k + "}", str(v))
    return url


def time_candidates(layer_xml):
    """Return valid single time strings for a layer, newest first.

    GIBS stores each time as a range: start/end/period, e.g. 2025-11-10/2026-11-14/P1D.
    Every day inside that range is a valid tile time, so the newest usable stamp is the
    END of the last range, not its start.
    """
    ends, starts = [], []
    has_dim = False
    for dim in re.findall(r"<Dimension[^>]*>(.*?)</Dimension>", layer_xml, re.S):
        for val in re.findall(r"<Value>(.*?)</Value>", dim):
            has_dim = True
            parts = val.split("/")
            start = parts[0]
            end = parts[1] if len(parts) > 1 and parts[1] else parts[0]
            ends.append(end)
            starts.append(start)
    if not has_dim:
        return []
    # ranges are listed oldest first, so reverse to get newest first
    ordered = []
    for e, s in zip(reversed(ends), reversed(starts)):
        ordered.append(e)
        if s != e:
            ordered.append(s)
    seen, uniq = set(), []
    for s in ordered:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq


def tile_matrix_set(layer_xml):
    """Each layer declares its own TileMatrixSet; using the wrong one is a hard 400."""
    m = re.search(r"<TileMatrixSetLink>(.*?)</TileMatrixSetLink>", layer_xml, re.S)
    if m:
        t = re.search(r"<TileMatrixSet>(.*?)</TileMatrixSet>", m.group(1))
        if t:
            return t.group(1).strip()
    return None


def tile_matrix_limits(layer_xml, tms):
    """Max zoom available for this layer, read from the global TileMatrix list."""
    blocks = re.findall(r"<TileMatrixSet[^>]*>(.*?)</TileMatrixSet>", layer_xml, re.S)
    for b in blocks:
        ident = re.search(r"<Identifier>(.*?)</Identifier>", b)
        if not ident or ident.group(1).strip() != tms:
            continue
        zms = re.findall(r"<TileMatrix>.*?<Identifier>(\d+)</Identifier>", b, re.S)
        if zms:
            return max(int(z) for z in zms)
    return 9


def test_tile_for(lat, lon, z):
    """The tile index that covers the pilot point at a given zoom."""
    import math

    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n)
    return {"z": z, "x": x, "y": y}


def main():
    caps = requests.get(CAPS, headers=H, timeout=90).text
    layers = {}
    for lay in re.findall(r"<Layer>(.*?)</Layer>", caps, re.S):
        m = re.search(r"<ows:Identifier>(.*?)</ows:Identifier>", lay)
        if m:
            layers[m.group(1)] = lay

    result = {}
    for lid, meta in CANDIDATES.items():
        lay = layers.get(lid)
        if not lay:
            print(f"[skip] {lid}: not in capabilities")
            continue
        fmt = re.search(r"<Format>(.*?)</Format>", lay)
        ext = "jpg" if (fmt and "jpeg" in fmt.group(1)) else "png"
        tms = tile_matrix_set(lay) or TMS
        level = LEVEL_OVERRIDE.get(lid)
        maxzoom = level if level else tile_matrix_limits(lay, tms)
        # test at the level this layer actually publishes
        test = test_tile_for(PILOT_LAT, PILOT_LON, maxzoom)
        cands = time_candidates(lay)
        working = None
        used_time = cands[0] if cands else ""
        for t in cands[:8]:
            url = build_url(lid, t, ext, tms_override=tms, **test)
            try:
                r = requests.get(url, headers=H, timeout=30)
                if r.status_code == 200 and len(r.content) > 500:
                    working = t
                    used_time = t
                    break
            except Exception:  # noqa: BLE001
                continue
        if working is None and not cands:
            for ext_try in (ext, "jpg", "png"):
                url = build_url(lid, "", ext_try, tms_override=tms, **test)
                try:
                    r = requests.get(url, headers=H, timeout=30)
                    if r.status_code == 200 and len(r.content) > 500:
                        working, used_time, ext = "", "", ext_try
                        break
                except Exception:  # noqa: BLE001
                    continue
        if working is None:
            print(f"[skip] {lid}: no working time (tms={tms} zmax={maxzoom}, tried {cands[:8]})")
            continue
        result[lid] = {
            **meta,
            "id": lid,
            "url": build_url(lid, used_time, ext, tms_override=tms),
            "time": used_time,
            "tile_matrix_set": tms,
            "maxzoom": maxzoom,
            "available_times": cands[:40],
            "attribution": f"NASA EOSDIS GIBS / {meta['mission']}",
            "source_page": f"https://worldview.earthdata.nasa.gov/?layer={lid}",
        }
        print(f"[ok]   {lid}  time={working}")

    payload = {
        "_README": "NASA GIBS layers rendered live in the UbiMap browser map. Each entry was verified to return a real image at the stated time. Source: NASA EOSDIS GIBS WMTS, https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
        "_verified_utc": "2026-11-14",
        "_tile_matrix_set": TMS,
        "layers": result,
    }
    os.makedirs("src/data", exist_ok=True)
    with open("src/data/nasaLayers.json", "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print(f"\nwrote src/data/nasaLayers.json with {len(result)} verified layers")


if __name__ == "__main__":
    main()
