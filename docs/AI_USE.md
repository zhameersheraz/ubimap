# Use of Super Intelligence (SI) in this project

NASA Space Apps Challenge 2026 asks every team to state where and how Super
Intelligence (SI, the Space Apps term for AI) tools were used, and to acknowledge
SI-generated code and data in the descriptive text and metadata of the final project.

This file is that acknowledgement. It is referenced from `SUBMISSION.md` field 6 and
from the module headers of the files listed below.

## The idea was not SI generated

The concept came from the project manager, who raised it at a team meeting in Cebuano:
that the Philippines has a shortage of ube and imports it from Vietnam, Taiwan and
China while its own farmers are not growing it, and that a tool should unlock the
perspective that their own land could grow it. That is recorded verbatim in the project
file `PM's idea` and developed in `UbiMap_Project_Plan.txt`. The pilot location, the
crop and the framing all come from the team.

## Where SI tools were used

AI coding assistants were used as engineering tools during the build:

| Area | What the assistant was used for | Files |
|---|---|---|
| Frontend | Drafting and refactoring React components, writing and reviewing the CSS, structuring the i18n string file | `src/App.jsx`, `src/components/MapPanel.jsx`, `src/components/Panels.jsx`, `src/styles.css`, `src/i18n/strings.js` |
| Model | Reviewing the AHP implementation, the suitability factors and the rotation scoring for logic errors, and writing the headless test harness | `src/engine/ahp.js`, `src/engine/suitability.js`, `src/engine/rotations.js`, `scripts/test_engine.mjs` |
| Data pipeline | Writing the NASA POWER and ISRIC SoilGrids fetchers, the DEM tile decoder and the validation harness, and reviewing the retry and rate-limit handling | `scripts/build_pilot_grid.py`, `scripts/enrich_grid.py`, `scripts/add_rain_years.py`, `scripts/build_validation.py`, `scripts/add_validation_slope.py`, `scripts/fill_missing_soil.py`, `scripts/build_layer_config.py` |
| Validation | Writing the statistics and the correlation reporting, and checking the arithmetic | `scripts/validate_model.mjs` |
| Hardware | Drafting the ESP32 firmware and the calibration procedure | `firmware/ubisense/ubisense.ino` |
| Server and deployment | Writing the static server, the NASA POWER proxy and the deployment configuration | `server/server.mjs`, `netlify.toml`, `.github/workflows/deploy.yml` |
| Documentation | Drafting the README and the submission copy, which were then checked line by line against the source and against the official challenge statement | `README.md`, `SUBMISSION.md`, `DEMO_MATERIALS.md` |

## Where SI tools were not used, and why that matters

The following were produced by the team from primary sources, not by an SI tool, and
that distinction is the point of the project:

* **Every agronomic threshold.** The ube rainfall, temperature, soil pH, slope, drainage
  and duration thresholds come from published Philippine material, the DA Regional Field
  Office and ATI-7 ube production guides, the USDA Foreign Agricultural Service report
  on Philippine ube, and FAO. They are recorded with their sources in
  `src/data/agronomy.json`, and where a value is still a team estimate rather than a
  verified figure, it is marked `"verified": false` in that file and in
  `research_notes/UBE_AGRONOMY_AND_PH_DATA.md`. An assistant did not supply these
  numbers, and none were accepted without a citation.
* **All statistical results.** The AHP weights, the consistency ratio, the validation
  correlations and the PSA production figures were computed by the scripts in
  `scripts/`, from NASA POWER, NASA SRTM, ISRIC SoilGrids and Philippine Statistics
  Authority OpenSTAT responses.
* **The one place where SI output was rejected.** An early version of the suitability
  model was built with a regression weighting fitted against provincial yield. It was
  discarded because it could not tell a real ube province from a non producing one, and
  it could not be explained to a farmer. The shipped model uses AHP weights with a
  published consistency ratio and named rules. The comparison between the two is kept in
  `research_notes/` because the failure is informative.

## SI generated images and video

**None in this submission.** The only generated artwork in the repository is the
application icon, which is a hand written SVG at `public/icon.svg`. No SI generated
image or video appears in the app, the demo video or the slide deck, so no watermark is
required.

## SI generated data

**None.** Every number displayed in the application comes from NASA POWER, NASA SRTM,
NASA GIBS or the Philippine Statistics Authority. The script that fetches each one is in
`scripts/` and the retrieval URL is stored alongside the value, so any figure can be
traced back to the original response.

## Reproducibility

The build is reproducible without any SI tool. To regenerate every dataset from
scratch:

```bash
python scripts/build_pilot_grid.py --bbox 7.70,123.25,8.00,123.65 --step 0.02
python scripts/enrich_grid.py --grid data/pilot_grid.json --zoom 14
python scripts/add_rain_years.py
python scripts/fill_missing_soil.py
python scripts/build_layer_config.py
python scripts/build_validation.py
python scripts/add_validation_slope.py
npx vite build --ssr scripts/validate_model.mjs --outDir .tmp-test && node .tmp-test/validate_model.js
```

The only network access these scripts need is to NASA, ISRIC and the Philippine
Statistics Authority. No API key, no account and no payment is required.
