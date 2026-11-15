import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapPanel from './components/MapPanel.jsx';
import {
  FarmProfile, ReadinessCard, RotationCompare, PlantingCalendar,
  Provenance, ValidationPanel, NasaDataPanel,
} from './components/Panels.jsx';
import SatelliteVsGroundPanel from './components/SatelliteVsGroundPanel.jsx';
import RainfallCrossCheck from './components/RainfallCrossCheck.jsx';
import LiveCheck from './components/LiveCheck.jsx';
import { AGRONOMY, DEMO_FIELD, GRID_META, nearestCell, provenanceRows } from './engine/grid.js';
import validationData from '../data/validation_results.json';
import HERO from './data/heroPlate.json';
import { evaluateCell, monthlyProfile, classifySeasons, longestDryRun } from './engine/suitability.js';
import { scoreRotations } from './engine/rotations.js';
import { LANGS, t } from './i18n/strings.js';

const DEFAULT_FARMER = {
  currentCrop: 'corn',
  areaHa: 1,
  priorities: { income: 0.7, water: 0.5, soil: 0.6, labour: 0.3 },
  irrigation: false,
};

/** Months to plant, harvest and to leave bare, derived from the local rainfall cycle. */
function buildPlan(profile, rotation) {
  const months = profile?.months || [];
  if (!months.length) return null;
  const ube = AGRONOMY.ube.thresholds;

  // the agronomic planting window from the DA guide, which says plant from March to
  // May and best at the start of the rains
  const planting = (ube.planting_window?.months || [3, 4, 5]).map((m) => m - 1);

  // where the local rainfall actually turns on, which is the other half of the advice
  const wetIdx = months.filter((m) => m.season === 'wet').map((m) => m.index);
  const onset = wetIdx.length
    ? Math.min(...wetIdx)
    : [...months].sort((a, b) => (b.precip_mm ?? 0) - (a.precip_mm ?? 0))[0].index;

  // harvest follows the planting window by the crop cycle length
  const duration = ube.duration_months?.typical ?? 10;
  const harvest = planting.map((p) => (p + duration) % 12);

  // bare months: the time the current rotation leaves the soil uncovered
  const covered = rotation?.sequence?.length
    ? rotation.sequence.reduce((a, id) => a + (AGRONOMY.companion_crops[id]?.duration_months || 0), 0)
    : 8;
  const bareCount = Math.max(0, Math.min(6, 12 - covered));
  const bare = Array.from({ length: bareCount }, (_, i) => (onset - 1 - i + 12) % 12);

  return { planting, harvest, bare, onset };
}

export default function App() {
  const [lang, setLang] = useState('en');
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState(null);
  const [farmer, setFarmer] = useState(DEFAULT_FARMER);
  const [activeLayer, setActiveLayer] = useState('MODIS_Terra_CorrectedReflectance_TrueColor');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [rainFactor, setRainFactor] = useState(1);
  const [tempDelta, setTempDelta] = useState(0);

  // Dark is the default. A visitor who has chosen the light theme keeps it.
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('ubimap-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('ubimap-theme', theme);
    } catch {
      /* private mode, the theme just will not persist */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((v) => (v === 'dark' ? 'light' : 'dark'));

  // Every step is a new screen, and the browser keeps the old scroll offset when
  // the content swaps. Step 1 is much taller than step 2 because of the map, so
  // Continue used to drop you at the bottom of the page instead of the top of
  // the new step. Jump to the top whenever the step changes.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  // The logo doubles as a back to top control, so it has to work from the
  // bottom of a long page as well as from the top.
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The logo is also the home button: it takes you back to the start of the
  // tool and clears the field you had picked, so there is always a way out
  // of a scored field and back to the beginning.
  const goHome = () => {
    setStep(1);
    setPin(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scenario = useMemo(
    () => ({ scenarioRainFactor: rainFactor, scenarioTempDelta: tempDelta }),
    [rainFactor, tempDelta],
  );

  const nearest = useMemo(() => (pin ? nearestCell(pin.lat, pin.lon) : null), [pin]);

  const result = useMemo(() => {
    if (!nearest) return null;
    try {
      return evaluateCell(nearest.cell, AGRONOMY, scenario);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [nearest, scenario]);

  const rotationResult = useMemo(() => {
    if (!nearest || !result) return null;
    try {
      return scoreRotations(nearest.cell, AGRONOMY, result.profile, farmer, scenario);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [nearest, result, farmer, scenario]);

  const plan = useMemo(() => {
    if (!result) return null;
    const profile = result.profile;
    const existing = rotationResult?.rotations?.find((r) => r.kind === 'existing');
    const p = buildPlan(profile, existing);
    return {
      ...p,
      drySpellMonths: longestDryRun(profile.months, 40, profile.wet_months),
    };
  }, [result, rotationResult]);

  /** Score for every cell, used by the map heatmap. */
  const scoreForMap = useCallback((cell) => {
    try {
      return evaluateCell(cell, AGRONOMY, scenario);
    } catch {
      return null;
    }
  }, [scenario]);

  const handlePick = (p) => setPin(p);

  const useGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPin({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setPin({ lat: DEMO_FIELD.lat, lon: DEMO_FIELD.lon }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const provRows = useMemo(() => provenanceRows(), []);

  const cropLabel = (id) => {
    const c = AGRONOMY.companion_crops[id];
    if (!c) return id;
    return lang === 'bis' ? c.common_bis : c.common_en;
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <button
            type="button"
            className="logo"
            onClick={goHome}
            aria-label="UbiMap home"
            title="Back to the start"
          >
            {/* The ube itself, drawn by the team. It doubles as the home button,
                so it goes back to the start of the tool, not just to the top
                of the page. */}
            <img src={`${import.meta.env.BASE_URL}logo-ube-256.png`} alt="" width="34" height="34" />
          </button>
          <div>
            <h1>
              UbiMap <em>NASA Space Apps Hackathon 2026</em>
            </h1>
            <p className="dim small">{t(lang, 'tagline')}</p>
          </div>
        </div>
        <div className="langs">
          <span className="dim tiny langs-label">
            {t(lang, 'langLabel')}
          </span>
          <div className="lang-group" role="group" aria-label={t(lang, 'langLabel')}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip ${lang === l.id ? 'chip-on' : ''}`}
                onClick={() => setLang(l.id)}
                aria-pressed={lang === l.id}
              >
                {l.short}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
            title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          >
            <svg className="theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.4v2.6M12 19v2.6M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M2.4 12H5M19 12h2.6M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" />
            </svg>
            <svg className="theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
            </svg>
          </button>
        </div>
      </header>

      {step === 1 && (
        <>
          <section className="plate">
            <img
              src={`${import.meta.env.BASE_URL}hero-plate.jpg`}
              alt="NASA MODIS Terra true colour image of the Zamboanga peninsula, showing the Sulu Sea and the coastal plain around Pagadian City"
              width="768"
              height="512"
            />
            <div className="plate-caption">
              <span>
                <b>Plate 01</b> {HERO.plate_layer}
              </span>
              <span>{HERO.plate_date}</span>
              <span>{HERO.plate_resolution}</span>
              <span>{HERO.plate_lat}, {HERO.plate_lon}</span>
              <span>{HERO.plate_source}</span>
            </div>
          </section>

          <section className="card">
            <h2>{t(lang, 'step1_title')}</h2>
            <p className="dim">{t(lang, 'step1_body')}</p>
            <div className="chips mt">
              <button type="button" className="chip chip-on" onClick={useGps}>
                {t(lang, 'useGps')}
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setPin({ lat: DEMO_FIELD.lat, lon: DEMO_FIELD.lon })}
              >
                {t(lang, 'useDemo')}
              </button>
            </div>
            {pin && (
              <>
                <p className="pin-readout">
                  <strong>{pin.lat.toFixed(4)}°N, {pin.lon.toFixed(4)}°E</strong>
                  {nearest && (
                    <span className="dim">
                      {' '}· grid cell {nearest.cell.id} · {nearest.offsetKm.toFixed(2)} km from the pin
                    </span>
                  )}
                </p>
                <p className="dim small explore-row">
                  {lang === 'bis'
                    ? 'Tan-aw ang lugar nga imong gipili:'
                    : 'Look around the field you picked:'}{' '}
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${pin.lat},${pin.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {lang === 'bis' ? 'Street View' : 'Street View'}
                  </a>
                  {' · '}
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=map&center=${pin.lat},${pin.lon}&zoom=15`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {lang === 'bis' ? 'Mapa' : 'Map'}
                  </a>
                </p>
              </>
            )}
          </section>

          <MapPanel
            lang={lang}
            center={{ lat: DEMO_FIELD.lat, lon: DEMO_FIELD.lon }}
            onPick={handlePick}
            scoreFn={scoreForMap}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((v) => !v)}
            pin={pin}
          />

          <div className="navrow">
            <button type="button" className="btn" disabled={!pin} onClick={() => setStep(2)}>
              {t(lang, 'continue')}
            </button>
            {!pin && (
              <span className="dim small nav-hint">
                {lang === 'bis'
                  ? 'Tap ang mapa o gamit ang demo field una.'
                  : 'Tap the map or use the demo field first.'}
              </span>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <FarmProfile lang={lang} farmer={farmer} setFarmer={setFarmer} />
          <div className="navrow">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              {t(lang, 'back')}
            </button>
            <button type="button" className="btn" onClick={() => setStep(3)}>
              {t(lang, 'continue')}
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <>
          <div className="card scen">
            <h2>{t(lang, 'scenario')}</h2>
            <label className="slider-row">
              <span>{t(lang, 'rain')}</span>
              <input
                type="range"
                min="0.6"
                max="1.3"
                step="0.05"
                value={rainFactor}
                onChange={(e) => setRainFactor(Number(e.target.value))}
              />
              <span className="slider-val">{Math.round(rainFactor * 100)}%</span>
            </label>
            <label className="slider-row">
              <span>{t(lang, 'temp')}</span>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={tempDelta}
                onChange={(e) => setTempDelta(Number(e.target.value))}
              />
              <span className="slider-val">{tempDelta > 0 ? '+' : ''}{tempDelta}°C</span>
            </label>
            <p className="dim small">
              {lang === 'bis'
                ? 'Gidoktor para sa "unsa kung naa bag-o na klima". Dili bag-o nga datos gikan sa NASA POWER, gipakita lang unsa naa mahimo kung mag-usab ang ulan o temperatura.'
                : 'A what-if on the NASA POWER climate record. The numbers are not new data, they show what the model does when rainfall or temperature shifts.'}
            </p>
          </div>

          <ReadinessCard lang={lang} result={result} />
          <section className="card livecard">
            <h2>{lang === 'bis' ? 'Live nga check' : 'Live check'}</h2>
            <p className="dim small">
              {lang === 'bis'
                ? 'Ang mga numero sa screen gikan sa NASA POWER, gipull samtang gihatag ang grid. Ginatamon nato kung naa pa gyud nga live ang NASA para sa imong uma karon.'
                : 'The numbers on screen came from NASA POWER, fetched when the grid was built. This asks the NASA POWER API right now, for your field.'}
            </p>
            {nearest && <LiveCheck lang={lang} lat={nearest.cell.lat} lon={nearest.cell.lon} />}
          </section>
          <RotationCompare lang={lang} rotationResult={rotationResult} priorities={farmer.priorities} />
          <PlantingCalendar lang={lang} profile={result.profile} plan={plan} />

          <section className="card">
            <h2>{t(lang, 'result_title')}</h2>
            <div className="farmcard" id="farmcard">
              <header>
                <div>
                  <strong>UbiMap Farm Card</strong>
                  <p className="dim small">
                    {pin.lat.toFixed(4)}°N, {pin.lon.toFixed(4)}°E &middot; Pagadian City, Zamboanga del Sur
                  </p>
                </div>
                <div className="fc-score">
                  <strong>{Math.round(result.score)}</strong><span>/100</span>
                </div>
              </header>
              <div className="fc-grid">
                <div>
                  <h4>{lang === 'bis' ? 'Imong tanom' : 'Your current crop'}</h4>
                  <p>{cropLabel(farmer.currentCrop)}</p>
                </div>
                <div>
                  <h4>{lang === 'bis' ? 'Girekomenda nga rotation' : 'Suggested rotation'}</h4>
                  <p>
                    {rotationResult?.rotations?.[0]?.sequence?.map(cropLabel).join(' → ')}
                  </p>
                </div>
                <div>
                  <h4>{lang === 'bis' ? 'Paglugod sa ube' : 'Plant ube'}</h4>
                  <p>{plan?.planting?.map((i) => (lang === 'bis' ? result.profile.months[i].label_bis : result.profile.months[i].label_en)).join(', ')}</p>
                </div>
                <div>
                  <h4>{lang === 'bis' ? 'Ani sa ube' : 'Harvest ube'}</h4>
                  <p>{plan?.harvest?.map((i) => (lang === 'bis' ? result.profile.months[i].label_bis : result.profile.months[i].label_en)).join(', ')}</p>
                </div>
                <div>
                  <h4>{lang === 'bis' ? 'Ulan sa tuig' : 'Rainfall a year'}</h4>
                  <p>{Math.round(result.profile.annual_mm).toLocaleString()} mm</p>
                </div>
                <div>
                  <h4>{lang === 'bis' ? 'Kasaligan' : 'Confidence'}</h4>
                  <p>
                    {lang === 'bis'
                      ? {
                          high: t(lang, 'confidenceHigh'),
                          medium: t(lang, 'confidenceMedium'),
                          low: t(lang, 'confidenceLow'),
                        }[result.confidence.level]
                      : result.confidence.level}
                  </p>
                </div>
              </div>
              <ul className="fc-reasons">
                {result.reasons.map((f) => (
                  <li key={f.id}>
                    <span className="chip-dataset">{f.dataset}</span>{' '}
                    {lang === 'bis' ? f.detail_bis : f.detail_en}
                  </li>
                ))}
              </ul>
              <p className="disclaimer">{t(lang, 'disclaimer')}</p>
              <p className="dim tiny">
                Built with NASA POWER, NASA SRTM, NASA GIBS (MODIS, VIIRS, SMAP, GPM IMERG) and
                ISRIC SoilGrids. UbiMap &middot; NASA Space Apps Challenge 2026.
              </p>
            </div>
            <div className="navrow">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                {t(lang, 'back')}
              </button>
              <button type="button" className="btn" onClick={() => window.print()}>
                {t(lang, 'print')}
              </button>
            </div>
          </section>

          <SatelliteVsGroundPanel lang={lang} profile={result.profile} />
          <RainfallCrossCheck lang={lang} cellId={nearest.cell.id} />
          <ValidationPanel lang={lang} validation={validationData} />
          <NasaDataPanel lang={lang} rows={provRows} />
          <Provenance lang={lang} rows={provRows} meta={GRID_META} />

          <MapPanel
            lang={lang}
            theme={theme}
            center={{ lat: pin.lat, lon: pin.lon }}
            zoom={11}
            onPick={handlePick}
            scoreFn={scoreForMap}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((v) => !v)}
            pin={pin}
          />
        </>
      )}

      <footer className="foot">
        <p className="dim small">
          UbiMap is an independent student project for the 2026 NASA Space Apps Hackathon,
          challenge "Field Shift: Adapting Farms with NASA Data". NASA and the NASA Space
          Agency Partners do not endorse this project.
        </p>
      </footer>
    </div>
  );
}
