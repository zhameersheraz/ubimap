# UbiMap

**Satellite-guided ube rotation planning for smallholder farmers in Zamboanga del Sur, Philippines.**

NASA Space Apps Challenge 2026 &middot; Challenge: *Field Shift: Adapting Farms with NASA Data*

UbiMap answers one question for a farmer in plain Bisaya: **can my field grow ube, which
rotation fits it, and when should I plant?** It combines NASA Earth observations with
local soil information, crop characteristics and the farmer's own priorities, then
compares at least three rotation strategies including the one the farmer already uses.

---

## The problem

The Philippines is a traditional home of ube (*Dioscorea alata*) yet the crop is in
long decline. Philippine Statistics Authority OpenSTAT data for "Ubi [Greater yam]":

| Year | National production | Area harvested | Yield |
|---|---|---|---|
| 2010 | 21,906 MT | 4,744 ha | 4.6 t/ha |
| 2025 | 12,483 MT | 2,367 ha | 5.3 t/ha |

Production is down **43%** and the area planted is down **50%**. Yields went up, so the
crop is not failing agronomically, it is being abandoned. Bohol, the traditional ube
heartland, fell from 13,169 MT to 3,931 MT in the same period, a 70% collapse.

The project started from the belief that the country imports ube from Vietnam, Taiwan
and China while farmers grow it locally. We checked that against the trade record and it
is partly wrong, so we corrected it before building on it:

* The Philippines exported a record **1,694 MT worth $3.25 million in 2025** and imported
  **54 tonnes** of frozen ube, essentially all from Vietnam with a rounding error's worth
  from Japan. It is a **net exporter of ube by roughly 30 to 1**.
* **Taiwan and China are not import sources.** The Philippine import record by origin
  country for HS 071430 lists exactly two suppliers, Vietnam and Japan. China is an
  export market and a fast-scaling competitor, not a supplier.
* Fresh whole yam imports are prohibited and the Bureau of Plant Industry says none are
  authorised. The real constraint is domestic planting material: the Department of
  Agriculture indefinitely suspended fresh tuber exports in September 2026 to protect
  next season's seed stocks.

The problem UbiMap addresses is therefore not an import gap. It is that a crop worth
real money is being abandoned, the area planted has halved in fifteen years, the seed
stock is the bottleneck, and the farmers being asked to grow it have never been shown
evidence that their own land can carry it.

Meanwhile most upland farmers in the pilot area are locked into low value, soil
depleting rotations: corn after corn, or cassava monoculture. Nobody has ever shown
them evidence that their own land could carry ube, or how to fit it into what they
already plant.

UbiMap does exactly that, and it says what it does not know.

---

## What it does

1. **Pin your field.** Tap the map or use GPS. The app resolves a 0.02 degree NASA POWER
   grid cell (about 2.2 km) around the pin and pulls every factor from there.
2. **Tell it about your farm.** Current crop, and four priority sliders: more income,
   save water, healthier soil, less work.
3. **Get a Farm Card.** A ube readiness score out of 100 with the top three reasons and
   the top three concerns, each one naming the dataset and the value behind it.
4. **Compare rotations.** At least three strategies including the existing one. Each card
   carries the five things the challenge asks for: why it is suggested, what evidence
   supports it, what benefits it brings, where the information gaps are, and what risks
   need local review. Every score is a transparent rule, not a black box.
5. **Plan the season.** A twelve month calendar built from the local rainfall record,
   with the ube planting window, the harvest window, the bare field periods, and the
   heat and heavy rain months flagged.
6. **Test a what-if.** Move the rainfall and temperature sliders and watch every score
   respond.
7. **Check the sources.** Every dataset, its resolution, its retrieval time and a link
   that reopens the original data.

The interface runs in **Bisaya, Filipino and English**, and is phone first.

---

## NASA data used

| Dataset | What it provides | How it is used |
|---|---|---|
| **NASA POWER** | Monthly rainfall, temperature, humidity, solar radiation and MERRA-2 root zone wetness | The climate record behind every score, 2015 to 2024 plus climatology |
| **NASA SRTM** | Elevation and slope | Erosion risk, drainage rating, the 3D terrain |
| **NASA GIBS - MODIS** | True colour (Terra, Aqua), NDVI, land surface temperature, flood extent | Live map layers, rendered straight from NASA in the browser |
| **NASA GIBS - VIIRS** | True colour, NDVI, flood extent | Live map layers, higher detail than MODIS |
| **NASA GIBS - SMAP** | L3 passive enhanced night soil moisture | Live map layer, the satellite half of the satellite versus ground comparison |
| **NASA GIBS - GPM IMERG** | Global precipitation | Live map layer |
| **NASA CMR** | Collection metadata and concept ids | Provenance, proving which collection each layer belongs to |

**Partner and reference data:** ISRIC SoilGrids 2.0 for soil pH, texture, organic carbon
and bulk density. ESA/ECMWF ERA5 and Copernicus Sentinel-2 are named in the challenge
resources and are used for comparison.

No NASA account is needed, nothing is paid for, and no information about a farmer's
field is sent anywhere. Every number is baked into the app, so it works with no network
at all.

---

## The model

A ube suitability score is a weighted overlay of six factors: rainfall pattern, root
zone wetness, temperature and heat stress, slope, soil pH, and soil texture and
drainage. The weights come from the Analytic Hierarchy Process, and the pairwise
judgement matrix and the consistency ratio are both published in the app. The
consistency ratio is 0.034 against a limit of 0.10, so the weights are internally
consistent. The model is deliberately rule based rather than a black box, because a
farmer has to be able to ask why a number came out the way it did, and an extension
worker has to be able to argue with the rule.

Rotation scoring uses the same idea: eight dimensions (water fit, soil cover, nitrogen
balance, erosion protection, pest cycle break, income potential, climate risk, labour),
each scored by named rules, then blended with the farmer's own priorities. The five
elements the challenge requires for every strategy, why it is suggested, evidence,
benefits, information gaps, and risks needing local review, are the labels on the screen.

The agronomic thresholds are not guesses. They come from the DA Regional Field Office 02
*Ubi Production Guide* (a rainfall floor of 1,300 mm a year, an optimum of 25 to 30
degrees C, planting from March to May, harvest from late November to February, a 10 to
11 month cycle, and no nitrogen fixation), from FAO EcoCrop for *Dioscorea alata* (pH 5.5
to 6.5), and from the IPPC yam anthracnose advisory for the rotation rules. Each one
carries its source in `src/data/agronomy.json`, and the ones that are still team working
values are marked `verified: false` rather than quietly hidden.

We also compared the rule based model against a machine learned alternative under leave
one province out cross validation, because the challenge invites exactly that
comparison. The numbers are in `data/validation_results.json`. Neither approach
predicts provincial yield from these gridded inputs, and the explainable one is the one
that ships, because an extension worker can argue with it and a farmer can read it.

---

## Validation, including the part that did not work

UbiMap was checked against real Philippine statistics, and the result is reported as it
came out. See `data/validation_results.json` and the *Model validation* panel in the app.

* The model was scored at 110 points across 18 ube-producing provinces and 4 provinces
  with no reported ube production, then compared with PSA 2025 production and yield.
* **The first version did not work.** Its correlation with real provincial yield was
  essentially zero, r = +0.00, and with production volume r = +0.21. It did put the
  provinces with no ube production at the bottom of the ranking, so it was not
  nonsense, but it was not good enough.
* Diagnosing that pointed at the rainfall. Ube needs a dry maturation window (plant
  March to May, lift late November to February), and the number of months under 50 mm of
  rain is the observable with the strongest relationship to real provincial yield:
  r = +0.36 for NASA POWER and r = +0.30 for GPM IMERG. But POWER works on a roughly
  50 km grid, and at that resolution the Philippine dry season is smoothed away.
* So we rebuilt the model's rainfall from a second, independent NASA product. We
  reconstructed a 25 year monthly climatology for every grid cell from **GPM IMERG at
  about 10 km**, by decoding 9,124 daily NASA GIBS tiles through the official GIBS colour
  map, and verified the method against the half hourly IMERG layer.
* **It changed the model.** On the same 18 provinces, the correlation with real yield went
  from r = +0.00 to **r = +0.32**, and with production volume from r = +0.21 to
  **r = +0.48**. The separation got wider too: mean score 68.1 for provinces that grow
  ube against 63.5 for the ones that do not.
* We checked the rainfall against the ground as well. PAGASA's Cotabato City station, 110
  km away on the same Sulu Sea coast, records 2,414.3 mm a year. IMERG reads 2,421.9 mm
  at Pagadian, within 0.3%, while POWER reads 2,246 mm, about 7% low. The finer product
  is the more accurate one, and the accuracy is why the model works.
* The finer product was not enough on its own. Months under 50 mm correlate with yield at
  r = +0.30 by themselves, and a relative dryness index turned out to be worse, not
  better. The model works because six factors are combined.
* The honest conclusion, stated in the app: **a gridded Earth observation model can
  screen land for a conversation with a farmer, and it cannot predict yield.** r = +0.32
  is a real signal and a modest one. Yield also depends on whether ube is the main crop
  or an intercrop, on the quality of the planting material, and on access to a buyer.
  There is also no PAGASA station at Pagadian itself, and the nearest representative one
  is 110 km away. **That gap is what an in-situ node would close.**
* The honest conclusion, stated in the app: **a gridded Earth observation model can
  screen land for a conversation with a farmer, and it cannot predict yield.** Yield is
  set by things satellites cannot see: whether ube is the main crop or an intercrop, the
  quality of the planting material, and access to a buyer.

A tool that reports its own validation failure, explains the cause, and states the
conditions under which it should not be used is more useful to a farmer than a tool that
shows a confident number.

---

## Satellite versus ground

This is the honest limitation of the whole project, and the brief asks about it directly.

* **SMAP L3 pixels are about 36 km across.** NASA POWER works near 50 km. A farm is a
  small part of one pixel, so the satellite number is an average over a region, not a
  reading of your plot.
* **A ground sensor covers about one square metre.** One point, every fifteen minutes.
* **Put them together and they check each other.** Where the ground reading agrees with
  the satellite reading, the field is behaving like its neighbourhood. Where it does
  not, the difference points to something local: a wet corner, a blocked drain, a patch
  of compacted soil.

**No node has been deployed yet, so this build shows no ground measurements.** The
firmware is written and ready to flash, the build sheet is in `firmware/ubisense/`, and
we would rather show an empty chart with an honest label than a chart full of invented
numbers.

---

## Running it

```bash
npm install
npm run dev        # development server on http://localhost:5173
npm run build      # production build into dist/
npm run serve      # zero dependency Node server for dist/ plus a NASA POWER proxy
```

The static build in `dist/` is the whole app. It has no server dependency, so it can be
hosted on GitHub Pages, Netlify or any static host at no cost.

### Rebuilding the data

```bash
python scripts/build_pilot_grid.py --bbox 7.70,123.25,8.00,123.65 --step 0.02
python scripts/enrich_grid.py --grid data/pilot_grid.json --zoom 14
python scripts/add_rain_years.py
python scripts/build_layer_config.py
```

### Re-running the validation

```bash
python scripts/build_validation.py
python scripts/add_validation_slope.py
npx vite build --ssr scripts/validate_model.mjs --outDir .tmp-test
node .tmp-test/validate_model.js
```

### Testing the engine

```bash
npx vite build --ssr scripts/test_engine.mjs --outDir .tmp-test
node .tmp-test/test_engine.js
```

---

## Project layout

```
UbiMap/
  src/
    engine/        the model: AHP weights, suitability, rotation scoring, grid access
    data/          agronomy thresholds with citations, verified NASA layer config
    components/    map, panels, farm card
    i18n/          Bisaya, Filipino, English strings
  scripts/         the reproducible data pipeline and the validation harness
  server/          zero dependency Node server, static plus NASA POWER proxy
  firmware/        UbiSense ESP32 firmware
  data/            the precomputed grids, all regenerable from the scripts
  research_notes/  the research that produced the thresholds and the sources
```

---

## The people who need to check this

UbiMap supports farmer judgement. It does not replace it, and it does not replace the
municipal agriculturist or the DA extension worker. The agronomic thresholds in
`src/data/agronomy.json` carry their sources and are marked where they are still team
estimates rather than verified values. Every score in the app names the dataset and the
raw value behind it, so an expert can argue with the number instead of trusting it.

NASA and the NASA Space Agency Partners do not endorse this project.

## Licence and data use

The code in this repository is released for the NASA Space Apps Challenge. NASA data
remain under their own terms: NASA data are generally not copyrighted and may be reused
for any purpose, but each data set has its own citation and acknowledgement
requirements, and NASA does not endorse non US Government websites. ISRIC SoilGrids is
CC BY 4.0. Please cite the sources shown in the app's *Sources* panel.
