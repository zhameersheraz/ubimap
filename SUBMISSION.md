# UbiMap - NASA Space Apps Challenge 2026 submission copy

Challenge: **Field Shift: Adapting Farms with NASA Data**
Event: **Universal Event (virtual)**
Submission deadline: **Sunday 15 November 2026, 11:59 PM in the Team Owner's local time (Philippines, UTC+8)**

Every field below is written to paste directly into the project page. The page must be in
**English**. Only the demo video may be in Bisaya, and then only with English subtitles.

Placeholders you must fill in before submitting:

| Placeholder | What to put |
|---|---|
| `https://ubimap.pages.dev` | Your deployed demo link. This is the Cloudflare Pages build, and it is the one to give the judges, because it also runs the NASA POWER proxy, so the live NASA button in the app really works |
| `https://github.com/zhameersheraz/ubimap` | Your public GitHub repository link |
| `[VIDEO_URL]` | Link to the 30 second demo video |
| `[DECK_URL]` | Link to the 7 slide deck, if you use slides instead of a video. It is already built and hosted: `https://ubimap.pages.dev/ubimap-deck.pdf` (also at `https://zhameersheraz.github.io/ubimap/ubimap-deck.pdf`) |
| `[TEAM_MEMBERS]` | Team names and roles, max 6 members, all registered for the Universal Event |
| `[MAILBOX]` | The mailbox that receives NASA emails, in case the organisers need to reach you. Use `zhameersheraztampugao@gmail.com` |

---

## 1. Project Name

**UbiMap: Satellite-guided ube rotation planning for Filipino farmers**

---

## 2. High-Level Project Summary

**What we developed.** UbiMap is a phone-first web app that answers one question for a
smallholder farmer in Zamboanga del Sur, Philippines: *can my field grow ube, which
rotation fits it best, and when should I plant?* The farmer pins their field on a map,
says what they plant now and what matters most to them, and receives a one page Farm Card
with a ube readiness score out of 100, the reasons behind it, and a side by side
comparison of four crop rotation strategies, including the one they already use.

**How it addresses the challenge.** It combines NASA Earth observations with local soil
information, crop characteristics and farmer priorities, exactly as the challenge asks.
Seven NASA datasets are used: NASA POWER for the climate record, NASA SRTM for elevation
and slope, and live NASA GIBS layers for MODIS and VIIRS true colour, MODIS and VIIRS
NDVI, SMAP soil moisture, GPM IMERG rainfall and MODIS and VIIRS flood extent. The
rotation comparison states, for every strategy, why it is suggested, what evidence
supports it, what benefits it brings, where the information gaps are, and what risks need
local review by a farmer or an extension worker.

**Why it is important.** Ube is a traditional Philippine crop that is being abandoned.
Philippine Statistics Authority OpenSTAT data for "Ubi [Greater yam]" show national
production falling from 21,906 metric tons in 2010 to 12,483 metric tons in 2025, a 43%
drop, with the area harvested halving from 4,744 to 2,367 hectares. Yields actually rose
over the same period, so the crop is not failing agronomically, it is being walked away
from. Bohol, the traditional heartland, fell 70% in the same period. Most upland farmers
in the pilot area are locked into low value, soil depleting rotations such as corn after
corn, and nobody has shown them evidence that their own land could carry a higher value
crop or how to fit one into what they already plant.

We also checked the premise this project started from, that the country imports ube from
Vietnam, Taiwan and China while farmers grow it locally, and we found it partly wrong.
The Philippines grows about 12,500 metric tons of ube a year and exported a record 1,694
tonnes worth $3.25 million in 2025, so it is a **net exporter of ube by roughly 30 to 1**.
It does import small volumes of **frozen** ube, 54 tonnes in 2025, essentially all from
Vietnam with a rounding error's worth from Japan, because local supply cannot keep pace
with demand for processed ube. Fresh whole yam imports are prohibited and the Bureau of
Plant Industry says none are authorised. **Taiwan and China are not import sources.**
China is an export market for the Philippines and a fast-scaling competitor, not a
supplier. The real bottleneck is domestic planting material: the Department of
Agriculture indefinitely suspended fresh tuber exports in September 2026 to protect next
season's seed stocks. That correction changed the problem we built for, and we say so
here rather than repeat a claim a judge would find to be false.

UbiMap is designed to support a farmer's judgement, never to replace it. Every score in
the app names the dataset and the raw value behind it, the agronomic thresholds carry their
sources, and every screen carries a reminder to consult a local agriculturist.

---

## 3. Link to Project Demo

`[VIDEO_URL]`

*(A video of 30 seconds or less. The guide states: "Projects that exceed these limits will
not be eligible for Global Judging.")*

Or, if you prefer a slide deck:

`https://ubimap.pages.dev/ubimap-deck.pdf`

*(Seven slides, English, with the team name, the four member names and the challenge on
the title slide. The deck is built from `deck/index.html` and hosted with the app, so the
link is already live. Mirror: `https://zhameersheraz.github.io/ubimap/ubimap-deck.pdf`.)*

*(Seven slides maximum, including the title and introduction slides, in English.)*

---

## 4. Link to Final Project

`https://ubimap.pages.dev`

The live app, in three languages: Bisaya, Filipino and English. It opens in English so any
judge can read it immediately, and the Language toggle switches it to Bisaya or Filipino
for the pilot farmers in Pagadian. It also has a light and a dark theme.

The "Check live with NASA POWER" button in the app calls the NASA POWER API through a
Cloudflare Pages Function, so the numbers on that panel come from NASA live, during the
demo, rather than from a file baked in at build time.

`https://github.com/zhameersheraz/ubimap`

The complete source code, the reproducible data pipeline that builds every number in the
app, the validation harness, and the ESP32 firmware for the field sensor.

---

## 5. Detailed Project Description

### The premise we checked, and the correction

The project started from the team manager's observation, made in Cebuano, that the
Philippines has a shortage of ube and imports it from Vietnam, Taiwan and China while
local farmers are not growing it. We treated that as a hypothesis and checked it against
the trade record before building anything on top of it.

| Part of the original claim | What the record shows |
|---|---|
| The Philippines imports ube | True, but only **frozen or processed** forms: 54,064.97 kg in 2025, down 28.2% from 75,299.89 kg in 2024, and 10,482 kg in the first four months of 2026 |
| From Vietnam | True, and effectively the whole number: 53,943.5 kg in 2025, 99.8% of the total |
| From Japan | True, and the original claim omitted it: Japan is the other source named |
| From Taiwan | **Refuted.** The Philippine import record by origin country for HS 071430 lists exactly two suppliers, Vietnam and Japan. Taiwan does not appear |
| From China | **Refuted, and probably backwards.** China appears in the Philippine trade record as an export market and as a fast-scaling international competitor, not as a supplier |
| While farmers grow it locally | True: 12,483.31 MT from 2,367.08 ha in 2025 |
| The implied framing that the country depends on imports | **Misleading.** Imports are about 0.4% of domestic production and about 3.2% of exports. The Philippines is a net exporter of ube by roughly 30 to 1 in volume: 1,694 MT exported against 54 MT imported in 2025 |

Fresh whole yam imports are prohibited, and the Bureau of Plant Industry states that no
importation of ube from any country is authorised. The real constraint is domestic
planting material: the Department of Agriculture indefinitely suspended fresh tuber and
propagative material exports in September 2026 to protect next season's seed stocks.

So the problem UbiMap actually addresses is not an import gap. It is that a crop worth
real money is being abandoned, the area planted has halved in fifteen years, the seed
stock is the bottleneck, and the farmers who are being asked to grow it have never been
shown evidence that their own land can carry it or how to fit it into what they already
plant. That is the problem we built for, and it is the one the app's evidence supports.

### What it does

A farmer opens UbiMap on a basic Android phone, taps their field on a map or uses GPS,
and the app resolves a 0.02 degree NASA POWER grid cell (about 2.2 km) around that point.
The farmer then chooses their current crop and moves four priority sliders: more income,
save water, healthier soil, less work. The result is a Farm Card that can be saved,
shared or printed, containing a ube readiness score, the three strongest reasons and the
three biggest concerns, a twelve month planting calendar, and a comparison of four
rotation strategies.

The interface is in English by default, because the NASA judges are international, with
Bisaya and Filipino one tap away for the farmers in Pagadian City. It has a light and a
dark theme, and the choice is remembered. It works with no network at all, because every
NASA number it needs is baked into the application.

### How it works

**Data acquisition.** A Python pipeline builds a 300 cell grid over Pagadian City and
neighbouring Zamboanga del Sur at 0.02 degree spacing. For every cell it pulls the NASA
POWER climatology (monthly rainfall, maximum and minimum temperature, humidity, solar
radiation), the NASA POWER monthly root zone and surface soil wetness for 2015 to 2024,
the annual rainfall record for the same ten years, elevation and slope from NASA SRTM,
and soil pH, texture, organic carbon, bulk density and cation exchange capacity from
ISRIC SoilGrids 2.0. Every fetch is stored with the exact URL that produced it, so any
number in the app can be traced back to its source and re-fetched by a judge. A second
script walks the live NASA GIBS capabilities document, tests each candidate layer, and
keeps only the ones that actually return an image at a known valid date. Eleven layers
survived that test, including seven that are current to 14 November 2026.

**Harmonising the resolutions.** This is the hard part and the app is honest about it.
SMAP L3 pixels are about 36 km across, NASA POWER works on roughly a 50 km grid, MODIS is
250 m, Landsat and Sentinel-2 are 10 to 30 m, and a farm is a small part of the smallest
one of those. The approach is to harmonise on the coarsest common denominator for the
numerical model (the POWER grid) and to use the finer products for what they are good
at: live visual layers in the browser, where a farmer can see the actual field, and
SRTM at 30 m for slope, which is what sets the erosion risk. The app states the
resolution of every layer on screen rather than pretending the grid is finer than it is.

**The model.** A ube suitability score is a weighted overlay of six factors: rainfall
pattern, root zone wetness, temperature and heat stress, slope, soil pH, and soil texture
and drainage. The weights come from the Analytic Hierarchy Process, and the pairwise
judgement matrix and the consistency ratio are published in the app. The consistency
ratio is 0.034 against a limit of 0.10, so the weights are internally consistent. The
model is deliberately rule based rather than a black box, because a farmer has to be able
to ask why a number came out the way it did and an extension worker has to be able to
argue with the rule.

Rotation scoring uses the same idea: eight dimensions (water fit, soil cover, nitrogen
balance, erosion protection, pest cycle break, income potential, climate risk, labour),
each scored by named rules, then blended with the farmer's own priorities. The five
elements the challenge requires for every strategy, why it is suggested, evidence,
benefits, information gaps, and risks needing local review, are the labels on the screen.

**Satellite versus ground.** This is the honest limitation of the whole project and the
brief asks about it directly, so the app answers it with numbers rather than adjectives.
One SMAP pixel is about 36 km across; one sensor node covers about one square metre. Put
them together and they check each other: where the ground reading agrees with the
satellite reading the field behaves like its neighbourhood, and where it does not, the
difference points to something local such as a wet corner, a blocked drain or a patch of
compacted soil. The ESP32 firmware for the node is written and ready to flash, reading a
capacitive soil moisture probe and a DS18B20 soil temperature probe every fifteen
minutes and posting to the collector. **No node has been deployed in the field yet, so
this build shows no ground measurements.** We would rather show an empty chart with an
honest label than a chart full of invented numbers, and the app says so.

**Validation, including the part that did not work.** We checked the model against real
Philippine statistics rather than against our own expectations. The model was scored at
110 points across 18 ube producing provinces and 4 provinces with no reported ube
production, then compared with PSA 2025 production and yield.

The first version of the model did not work, and finding out why is the story we want
to tell. Scored against PSA 2025 data, its correlation with real provincial yield was
essentially zero, r = +0.00, and with production volume r = +0.21. The model placed the
provinces with no ube production at the bottom of the ranking, so it was not nonsense,
but it was not good enough to tell a farmer anything.

Diagnosing that failure pointed at one thing: the rainfall. **Ube needs a dry maturation
window**, because the DA guide plants from March to May and lifts the tubers from late
November to February, so the tuber bulks and cures in the dry season. The number of
months under 50 mm of rain is the observable with the strongest relationship to real
provincial yield, r = +0.36 for NASA POWER and r = +0.30 for GPM IMERG. But POWER works
on a roughly 50 km grid, and at that resolution the Philippine dry season is smoothed
away.

So we built a second, independent NASA precipitation product and rebuilt the model's
rainfall from it. We reconstructed a 25 year monthly climatology for every grid cell
from **GPM IMERG at about 10 km**, by decoding 9,124 daily NASA GIBS tiles through the
official GIBS colour map, and verified the method against the half hourly IMERG layer
(the daily composite is the mean of the 48 half hourly rates, confirmed numerically).

**It changed the model.** On the same 18 provinces, the correlation with real provincial
yield went from r = +0.00 to **r = +0.32**, and the correlation with production volume
from r = +0.21 to **r = +0.48**. The mean score for provinces that actually grow ube
rose from 66.9 to 68.1 against 63.5 for the ones that do not, so the separation got
wider too. We also checked the rainfall against the ground. PAGASA's Cotabato City
station, 110 kilometres away on the same Sulu Sea coast, records 2,414.3 mm a year;
IMERG reads 2,421.9 mm at Pagadian, which is within 0.3%, while POWER reads 2,246 mm,
about 7% low. The finer product is the more accurate one, and the accuracy is why the
model works.

We also checked whether the finer product was enough on its own, and it was not. Months
under 50 mm correlate with yield at r = +0.30 on their own, and a relative dryness index
turned out to be worse, not better. The model only works because six factors are
combined. That is why we did not replace the model with a single clever indicator.

The honest conclusion, now stated in the app, is that **UbiMap is a screening tool for a
conversation with a farmer, not a yield predictor.** r = +0.32 is a real signal and it
is a modest one. Yield also depends on whether ube is the main crop or an intercrop, on
the quality of the planting material, and on access to a buyer, and none of that is in
the satellite record. What the model does well is narrow the conversation: it shows a
farmer where ube is plausible, which rotation differs from what they farm now, and
which month in the year is the risk. It also shows where it does not know, because there
is no PAGASA station at Pagadian itself and the nearest representative one is 110
kilometres away. **That gap is exactly what an in-situ node would close**, and it is the
reason the sensor is in the project rather than an afterthought.

### What we hope to achieve

UbiMap is also the system component of an undergraduate thesis on satellite guided crop
rotation planning for ube in Zamboanga del Sur. The immediate goal is narrower than the
ambition: a farmer in Pagadian sees evidence that their own land could carry a higher
value crop, sees how it fits into the rotation they already farm, and sees the one
thing that would sink it, which here is the absence of a reliable dry maturation window.
Beyond the farm, the province wide map gives municipal agriculturists a way to target
training and planting material where the land will actually carry the crop, and it gives
cooperatives and local government a data backed picture of where local ube supply could
grow instead of being imported.

### Tools, languages, hardware and software

* **Frontend:** React 19, Vite 7, MapLibre GL JS, plain CSS, no UI framework. Three
  languages maintained by hand in one strings file.
* **Backend and data pipeline:** Python 3.13 with requests, Pillow and NumPy for the
  DEM decoding. A zero dependency Node server serves the built application and proxies
  the NASA POWER API, because that API does not send CORS headers.
* **Model:** JavaScript modules for the AHP weighting, the suitability overlay, the
  rotation scoring and the planting calendar, with a headless test harness
  (`scripts/test_engine.mjs`) that checks the consistency ratios, the grid coverage, the
  score spread and the scenario behaviour.
* **Hardware:** the UbiSense field sensor, an ESP32 with a capacitive soil moisture probe
  and a DS18B20 soil temperature probe, running from a 18650 cell and a small solar panel.
  Firmware, wiring diagram and build sheet are in `firmware/ubisense/`.
* **Design:** the phone first layout, the gauge, the score bars and the plain language
  cards were built in the open source UbiMap project files with the assistance of an AI
  coding assistant, as described in `docs/AI_USE.md`.

### Things we deliberately did not do

* We did not use Google Earth Engine. It needs an approved Cloud Project and OAuth, which
  was not achievable unattended inside the challenge window, and a model that cannot be
  re-run by the team afterwards is not a model a farmer can be shown.
* We did not use a black box machine learning suitability model. Every threshold in
  `src/data/agronomy.json` carries its source, and the ones that are still team
  estimates are marked as such.
* We did not fabricate ground sensor data.

---

## 6. Use of Super Intelligence (SI)

Yes. AI coding assistants were used in the development of UbiMap, and the project
repository discloses this in `docs/AI_USE.md` and in the module headers of the files
involved.

* **The idea was not AI generated.** It came from the project manager, who raised it in
  Cebuano at the team meeting: that the Philippines has a shortage of ube and imports it
  from Vietnam, Taiwan and China while local farmers are not growing it, and that a tool
  should unlock the perspective that their own land could grow it. That is recorded in
  the project file `PM's idea` and in the project plan.
* **Where SI was used:** to draft and refactor React components and the CSS, to write and
  review the Python data pipeline and the Node server, to generate the Bisaya, Filipino
  and English interface strings, to generate the ESP32 firmware, and to review the model
  code for errors. The agronomic thresholds themselves were not accepted from an AI
  assistant: they were taken from published Philippine sources and from Philippine
  Statistics Authority data, and the sources are recorded in `src/data/agronomy.json` and
  in `research_notes/UBE_AGRONOMY_AND_PH_DATA.md`.
* **Where SI was not used:** the suitability model, the AHP weighting, the rotation
  scoring and the validation are our own. The scores are produced by named rules with a
  published consistency ratio, not by a trained model, and every one of them can be traced
  to a dataset and a threshold.
* **SI versus traditional statistics.** A NASA Space Apps Collaborator noted that the
  challenge invites comparing an SI approach with traditional statistical methods. We did
  that comparison, and it changed the project. The first version of our model weighted
  the factors from a single regression against provincial yield and it could not tell a
  real ube province from a non producing one. Rebuilding the weighting on the Analytic
  Hierarchy Process, with a published consistency ratio and named rules, made the model
  explainable to an extension worker, and it is the version that ships. We kept the
  regression result as a comparison in `research_notes/`.
* **SI generated images or video:** none in this submission. The only generated artwork is
  the application icon, which is a hand written SVG in `public/icon.svg`.
* **SI generated data:** none. Every number in the application comes from NASA, ISRIC or
  the Philippine Statistics Authority, and the retrieval script for each is in
  `scripts/`.

---

## 7. NASA Data

Seven NASA datasets and resources are used. The full register, with resolution, retrieval
date and a working link for each, is shown in the application's Sources panel.

| NASA dataset | What it gives | Resolution | How it is used | Live? |
|---|---|---|---|---|
| **NASA POWER** (power.larc.nasa.gov, community=AG, MERRA-2 and CERES) | Monthly rainfall, maximum and minimum temperature, humidity, solar radiation, root zone and surface soil wetness | about 50 km, monthly and daily | The climate record behind every score, 2015 to 2024 plus the climatology and the ten year rainfall range | Precomputed with the exact API URL stored per cell |
| **NASA SRTM** (Shuttle Radar Topography Mission) | Elevation and slope | 30 m | Erosion risk, drainage rating, the 3D terrain | Precomputed |
| **NASA GIBS MODIS Terra and Aqua** | True colour, NDVI, land surface temperature, flood extent | 250 m | Live map layers drawn straight from NASA in the browser | Yes, live, image date 2026-11-14 |
| **NASA GIBS VIIRS NOAA-20, NOAA-21 and Suomi NPP** | True colour, NDVI, flood extent | 375 to 500 m | Live map layers, higher detail than MODIS | Yes, live |
| **NASA GIBS SMAP L3** | Passive enhanced night soil moisture | 36 km | Live map layer, and the satellite half of the satellite versus ground comparison | Yes, live, image date 2026-11-11 |
| **NASA GIBS GPM IMERG** | Global precipitation | 10 km | Live map layer | Yes, live, image date 2026-11-13 |
| **NASA CMR** (Common Metadata Repository) | Collection metadata and concept ids | metadata | Provenance, proving which collection each layer belongs to | Queried live during the build |

Note on data use: NASA data are generally not copyrighted and may be reused, but each data
set carries its own citation and acknowledgement requirements, and NASA does not endorse
non US Government websites. No NASA account, key or payment was needed for anything we
used.

A note on what is not there: **ECOSTRESS is not in NASA GIBS.** We grepped all 1,330
layer identifiers in the live capabilities document and found zero ECOSTRESS layers, so
we use MODIS land surface temperature for the heat layer instead. Landsat daily true
colour is also not in GIBS, only the WELD monthly and annual mosaics, and that series
ends in 2001.

---

## 8. Space Agency Partner Data and Other References

**Space Agency Partner data**

* **ISRIC SoilGrids 2.0** (SoilGrids250m), the World Soil Information product behind the
  International Reference Soil Information System. Soil pH, clay, sand, silt, organic
  carbon, bulk density and cation exchange capacity for every grid cell.
  https://rest.isric.org/soilgrids/v2.0/properties/query (CC BY 4.0)
* **ESA / ECMWF ERA5** reanalysis, used as a comparison product when diagnosing the
  resolution limit of the NASA POWER dry season signal, and **Copernicus Sentinel-2**,
  named in the challenge resources and referenced for the higher resolution vegetation
  indices that would be the next step for field scale mapping.

** Philippine government and statistics sources**

* **Philippine Statistics Authority OpenSTAT**, crops production tables
  `0082E4EVCP3.px` (volume) and `0112E4EAHM3.px` (area) for "Ubi [Greater yam]", 2010 to
  2025, used for the validation and for the problem statement.
  https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/
* **PAGASA** climate classification thresholds for the wet, dry and shoulder seasons.
* **Department of Agriculture Regional Field Office and ATI-7** ube production materials,
  and the **USDA Foreign Agricultural Service** report on Philippine ube, for the
  agronomic requirements and the rotation rules.

**Code, libraries and other references**

* React, Vite, MapLibre GL JS, Python 3.13 with requests, Pillow and NumPy.
* CartoDB basemap tiles for the street and place name background, with OpenStreetMap
  attribution, under their respective terms.
* The pairwise judgement matrix and consistency ratio come from Saaty's Analytic
  Hierarchy Process, with the standard random index table.
* The season classification follows the PAGASA convention of 250 mm over three
  consecutive months for a wet season and 50 mm for a dry season, with the monthly 100 mm
  wet month threshold used for the crop calendar.
* Background map data: &copy; OpenStreetMap contributors, &copy; CARTO.

**Our own work**

* The UbiMap application, the data pipeline, the model, the validation harness and the
  ESP32 firmware are original work by our team, and are released with this submission.

---

## The two checkboxes

* [ ] I agree to the Terms and Conditions.
* [ ] I confirm that all of the work submitted is my own original work.

Then press **Submit for Judging**.

---

## Team

**Team Messiah Project Digital** (Universal Event), Pagadian City, Zamboanga del Sur,
Philippines.

| Name | Role |
|---|---|
| Zhameer Sheraz Tampugao | Team Owner, data and model, frontend, project lead |
| Mark John Riel Alforque | Team member |
| Cathy Untolan | Team member |
| Jerenze Levi T. Omandam | Team member |

Roles to cover across the team, matching the project plan:

| Role | Responsibility |
|---|---|
| Data and model | Earth Engine and NASA POWER pipeline, harmonisation, the suitability model and the rotation scoring, the validation harness |
| Frontend | React application, MapLibre map with the NASA GIBS layers, the rotation cards, the planting calendar, the Farm Card |
| Hardware | UbiSense build, firmware, calibration, data upload |
| Research and pitch | ube agronomy sources, PSA and DA data, the thesis write up, the pitch and the Filipino copy |

---

## Before you press submit

1. Open `https://ubimap.pages.dev` in a private window. It must load without a login, open in
   English, and the "Check live with NASA POWER" button must return real NASA data.
2. Watch the demo video end to end and confirm it is 30 seconds or less, or count the
   slides and confirm there are 7 or less.
3. Open `https://github.com/zhameersheraz/ubimap` in a private window and confirm the repository is public.
4. Confirm every member of the team is registered for the Universal Event and is on the
   team page, and that the team has selected the "Field Shift: Adapting Farms with NASA
   Data" challenge. The Project tab does not appear until the challenge is selected.
5. Confirm at least two team members are registered, which is the Universal Event
   requirement for global judging.
6. Confirm the mailbox `zhameersheraztampugao@gmail.com` is one you will actually read.
