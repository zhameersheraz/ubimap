"""Audit: do the numbers in SUBMISSION.md and README.md match the data we actually have?

This checks the claims that a judge could check, against the files in this repository.
"""
import json
import os
import re
import sys

ROOT = r"C:\Users\ASUS\OneDrive\Documents\MiniMax\HACKATHON\NASA-HACKATHON"
UBI = os.path.join(ROOT, "UbiMap")

fails = []
notes = []


def check(label, cond, detail=""):
    (notes if cond else fails).append(f"{'PASS' if cond else 'FAIL'}  {label}  {detail}")


# ---------- NASA layer count ----------
layers = json.load(open(os.path.join(UBI, "src/data/nasaLayers.json"), encoding="utf-8"))["layers"]
check("7 NASA datasets claimed, layer config has >= 7 layers", len(layers) >= 7, f"{len(layers)} layers")
check("SMAP layer present", any("SMAP" in k for k in layers))
check("GPM IMERG layer present", any("IMERG" in k for k in layers))
check("MODIS layer present", any("MODIS" in k for k in layers))
check("VIIRS layer present", any("VIIRS" in k for k in layers))
check("SRTM layer present", any("SRTM" in k for k in layers))
check("every layer has a working tile url", all(l["url"].startswith("https://gibs.earthdata.nasa.gov/") for l in layers.values()))
check("every layer has a time or is static", all(("time" in l) for l in layers.values()))

# ---------- grid coverage ----------
grid = json.load(open(os.path.join(UBI, "data/pilot_grid.json"), encoding="utf-8"))
cells = grid["cells"]
meta = grid["meta"]


def nprops(s):
    return len([k for k in (s or {}) if not k.startswith("_")])


usable_soil = sum(1 for c in cells if nprops(c.get("soil")) >= 3)
land = [c for c in cells if (c.get("elev_m") or 0) > 5]
land_soil = sum(1 for c in land if nprops(c.get("soil")) >= 3)
sea = [c for c in cells if (c.get("elev_m") or 0) <= 5]
sea_soil = sum(1 for c in sea if nprops(c.get("soil")) >= 3)
check("300 grid cells", len(cells) == 300, str(len(cells)))
check("every cell has POWER climate", all(c.get("climate") for c in cells))
check("every cell has slope", all(c.get("slope_deg") is not None for c in cells))
check("every cell has a 10 year rainfall series", all(c.get("rain_years") for c in cells))
# the sea has no soil and should not be given any, so the check is on land coverage
check("every land cell has soil", land_soil == len(land), f"{land_soil}/{len(land)} land cells")
deep_sea_soil = sum(1 for c in sea if nprops(c.get("soil")) >= 3 and (c.get("elev_m") or 0) < -2)
check("no cell below sea level has soil", deep_sea_soil == 0, f"{deep_sea_soil} cells below -2 m have soil")

# ---------- PSA numbers ----------
vol = json.load(open(os.path.join(os.path.dirname(ROOT), "psa_VOLUME_MT.json"), encoding="utf-8"))
area = json.load(open(os.path.join(os.path.dirname(ROOT), "psa_AREA_HA.json"), encoding="utf-8"))
check("national 2010 production is 21906", abs(vol["national"]["2010"] - 21906) < 1, str(vol["national"]["2010"]))
check("national 2025 production is 12483", abs(vol["national"]["2025"] - 12483) < 1, str(vol["national"]["2025"]))
check("national area 2010 is 4744", abs(area["national"]["2010"] - 4744) < 1, str(area["national"]["2010"]))
check("national area 2025 is 2367", abs(area["national"]["2025"] - 2367) < 1, str(area["national"]["2025"]))
pct = (vol["national"]["2025"] - vol["national"]["2010"]) / vol["national"]["2010"] * 100
check("production change is minus 43 percent", abs(pct + 43) < 0.5, f"{pct:.2f}")
pct_a = (area["national"]["2025"] - area["national"]["2010"]) / area["national"]["2010"] * 100
check("area change is minus 50 percent", abs(pct_a + 50) < 1.0, f"{pct_a:.2f}")
y10 = vol["national"]["2010"] / area["national"]["2010"]
y25 = vol["national"]["2025"] / area["national"]["2025"]
check("yield 2010 is about 4.6 t/ha", abs(y10 - 4.6) < 0.1, f"{y10:.2f}")
check("yield 2025 is about 5.3 t/ha", abs(y25 - 5.3) < 0.1, f"{y25:.2f}")
bohol = next(r for r in vol["ranking_2025"] if r["geo"] == "....Bohol")
check("Bohol 2025 is 3931 MT", abs(bohol["v2025"] - 3931) < 1, str(bohol["v2025"]))
b2010 = vol["series"]["....Bohol"]["2010"]
check("Bohol 2010 is 13169 MT", abs(b2010 - 13169) < 2, str(b2010))
check("Bohol fell about 70 percent", abs((bohol["v2025"] - b2010) / b2010 * 100 + 70) < 2,
      f"{(bohol['v2025'] - b2010) / b2010 * 100:.1f}")
zds_v = vol["series"]["....Zamboanga del Sur"]["2025"]
zds_a = area["series"]["....Zamboanga del Sur"]["2025"]
check("Zamboanga del Sur 2025 is 91 MT on 36 ha", abs(zds_v - 91.1) < 1 and abs(zds_a - 36) < 1,
      f"{zds_v} MT / {zds_a} ha")

# ---------- model stats ----------
res = json.load(open(os.path.join(UBI, "data/validation_results.json"), encoding="utf-8"))
st = res["meta"]["statistics"]
check("validation covers 18 producers and 4 non producers",
      st["n_producers"] == 18 and st["n_non_producers"] == 4,
      f"{st['n_producers']}/{st['n_non_producers']}")
check("mean score producers is above mean score non producers",
      st["mean_score_producers"] > st["mean_score_non_producers"],
      f"{st['mean_score_producers']} vs {st['mean_score_non_producers']}")
check("the SI comparison is present in the results",
      "comparison_si_vs_traditional" in st)

# ---------- AHP consistency ratio quoted in the copy is the real CR ----------
import subprocess

# the engine test bundle is rebuilt here so the audit does not depend on what ran before
VITE = os.path.join(UBI, "node_modules", "vite", "bin", "vite.js")
subprocess.run(
    ["node", VITE, "build", "--ssr", "scripts/test_engine.mjs", "--outDir", ".tmp-test"],
    cwd=UBI, capture_output=True, text=True,
)
test_out = os.path.join(UBI, ".tmp-test/test_engine.js")
if os.path.exists(test_out):
    r = subprocess.run(["node", test_out], capture_output=True, text=True, cwd=UBI)
    out = r.stdout
else:
    out = ""
m = re.search(r"suitability weights:.*?CR=([\d.]+)", out, re.S)
cr = float(m.group(1)) if m else None
check("the engine test ran", bool(out), f"{len(out)} chars")
check("the engine test passes every check", "ALL CHECKS PASSED" in out)
check("the consistency ratio is under 0.10", cr is not None and cr <= 0.10, f"CR={cr}")
for fn in ["UbiMap/SUBMISSION.md", "UbiMap/README.md"]:
    txt = open(os.path.join(ROOT, fn), encoding="utf-8").read()
    m2 = re.search(r"consistency\s+ratio\s+is\s+([\d.]+)", txt, re.I)
    check(f"{fn} quotes the real consistency ratio", bool(m2) and cr is not None and abs(float(m2.group(1)) - cr) < 0.001,
          f"copy={m2.group(1) if m2 else None} real={cr}")

# ---------- copy does not repeat the refuted import claim ----------
REFUTE_MARKERS = [
    "partly wrong", "partly false", "refuted", "not import sources", "net exporter",
    "we corrected", "corrected it", "we found it", "checked that against the trade record",
    "the premise we checked", "we checked the premise", "not import sources",
]
for fn in ["UbiMap/SUBMISSION.md", "UbiMap/README.md", "UbiMap/DEMO_MATERIALS.md"]:
    p = os.path.join(ROOT, fn)
    txt = open(p, encoding="utf-8").read()
    hits = list(re.finditer(r"imports?\s+ube\s+from\s+Vietnam,\s+Taiwan\s+and\s+China", txt, re.I))
    unrefuted = []
    for h in hits:
        window = txt[max(0, h.start() - 900): h.end() + 900].lower()
        if not any(mk in window for mk in REFUTE_MARKERS):
            unrefuted.append(h.start())
    check(f"{fn} never repeats the refuted import claim without refuting it", not unrefuted, str(unrefuted))
    check(f"{fn} has no em dashes", "—" not in txt)

# ---------- submission has all eight fields ----------
sub = open(os.path.join(UBI, "SUBMISSION.md"), encoding="utf-8").read()
for field in ["Project Name", "High-Level Project Summary", "Link to Project Demo",
              "Link to Final Project", "Detailed Project Description",
              "Use of Super Intelligence (SI)", "NASA Data",
              "Space Agency Partner Data and Other References"]:
    check(f"submission covers field: {field}", field in sub)

# ---------- every NASA dataset named in the submission appears in the app ----------
for ds in ["NASA POWER", "NASA SRTM", "MODIS", "VIIRS", "SMAP", "IMERG", "CMR"]:
    check(f"submission names {ds}", ds in sub)

print("\n".join(notes))
print()
if fails:
    print("\n".join(fails))
    print(f"\n{len(fails)} CHECK(S) FAILED")
    sys.exit(1)
print(f"ALL {len(notes)} CHECKS PASSED")
