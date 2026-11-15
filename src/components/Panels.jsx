import React, { useState } from 'react';
import { MONTHS_EN, MONTHS_BIS, SEASON_LABEL } from '../engine/suitability.js';
import { t } from '../i18n/strings.js';

function Dim({ children }) {
  return <span className="dim">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Readiness score                                                      */
/* ------------------------------------------------------------------ */
export function ReadinessCard({ lang, result }) {
  if (!result) return null;
  const bandLabel = {
    excellent: t(lang, 'excellent'),
    good: t(lang, 'good'),
    fair: t(lang, 'fair'),
    poor: t(lang, 'poor'),
  }[result.band];
  const conf = {
    high: t(lang, 'confidenceHigh'),
    medium: t(lang, 'confidenceMedium'),
    low: t(lang, 'confidenceLow'),
  }[result.confidence.level];

  return (
    <section className="card readiness">
      <div className="readiness-head">
        <div className="gauge" data-band={result.band}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="50" className="gauge-bg" />
            <circle
              cx="60"
              cy="60"
              r="50"
              className="gauge-val"
              style={{ strokeDasharray: `${(result.score / 100) * 314} 314` }}
            />
          </svg>
          <div className="gauge-num">
            <strong>{Math.round(result.score)}</strong>
            <span>/100</span>
          </div>
        </div>
        <div className="readiness-meta">
          <h2>{t(lang, 'readiness')}</h2>
          <p className="band" data-band={result.band}>{bandLabel}</p>
          <p className="conf">
            {t(lang, 'confidence')}: <strong>{conf}</strong>
          </p>
          <p className="note">
            {lang === 'bis' ? result.confidence.note_bis : result.confidence.note_en}
          </p>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h3 className="pos">{t(lang, 'reasons')}</h3>
          <ul className="reasons">
            {result.reasons.map((f) => (
              <li key={f.id}>
                <span className="chip-dataset">{f.dataset}</span>
                <span className="txt">{lang === 'bis' ? f.detail_bis : f.detail_en}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="neg">{t(lang, 'concerns')}</h3>
          <ul className="reasons">
            {result.concerns.map((f) => (
              <li key={f.id}>
                <span className="chip-dataset">{f.dataset}</span>
                <span className="txt">{lang === 'bis' ? f.detail_bis : f.detail_en}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {result.profile.rain_years && (
        <div className="rainrange">
          <h4>{lang === 'bis' ? 'Ulan sa taun, 2015 to 2024' : 'Rainfall a year, 2015 to 2024'}</h4>
          <div className="rr-bar">
            <span
              className="rr-range"
              style={{
                left: `${Math.min(100, Math.max(0, ((result.profile.rain_years.min - 1200) / 2200) * 100))}%`,
                width: `${Math.max(4, Math.min(100, ((result.profile.rain_years.max - result.profile.rain_years.min) / 2200) * 100))}%`,
              }}
            />
            <span
              className="rr-median"
              style={{ left: `${Math.min(99, Math.max(1, ((result.profile.rain_years.median - 1200) / 2200) * 100))}%` }}
            />
          </div>
          <p className="dim small">
            {lang === 'bis'
              ? `${result.profile.rain_years.min.toLocaleString()} to ${result.profile.rain_years.max.toLocaleString()} mm sa tulo nga tuig, median ${result.profile.rain_years.median.toLocaleString()} mm. Klima ang average, dili ang usa ka tuig, so mas maayo nga tan-awon ang range, dili ang usa ka numero.`
              : `${result.profile.rain_years.min.toLocaleString()} to ${result.profile.rain_years.max.toLocaleString()} mm across ten years, median ${result.profile.rain_years.median.toLocaleString()} mm. The climate value is an average, not a single year, so the range is the honest thing to look at.`}
          </p>
        </div>
      )}

      <details className="factor-table">
        <summary>
          {lang === 'bis' ? 'Tanaw sa matematyka (AHP)' : 'How the score was computed (AHP)'}
        </summary>
        <p className="dim small">
          {lang === 'bis'
            ? 'Ang mga timbang gikan sa AHP (Analytic Hierarchy Process). Ang CR below 0.10 nga naa pa gyud consistent ang mga judgments. Kinuha ni nato ang team judgment, unya gyud i-validate sa extension expert.'
            : 'Weights come from the Analytic Hierarchy Process. A consistency ratio below 0.10 means the judgements are internally consistent. These are the team judgement and still need validation by a local extension expert.'}
        </p>
        <table>
          <thead>
            <tr>
              <th>{lang === 'bis' ? 'Faktar' : 'Factor'}</th>
              <th>{lang === 'bis' ? 'Mga datos' : 'Dataset'}</th>
              <th>{lang === 'bis' ? 'Timbang' : 'Weight'}</th>
              <th>{lang === 'bis' ? 'Puntos' : 'Score'}</th>
              <th>{lang === 'bis' ? 'Nakatabak' : 'Contribution'}</th>
            </tr>
          </thead>
          <tbody>
            {result.factors.map((f) => (
              <tr key={f.id} className={f.missing ? 'missing' : ''}>
                <td>{lang === 'bis' ? f.label_bis : f.label_en}</td>
                <td className="dim">{f.dataset}</td>
                <td>{(f.weight * 100).toFixed(1)}%</td>
                <td>{f.score === null ? 'n/a' : f.score.toFixed(2)}</td>
                <td>{f.contribution === null ? 'missing' : f.contribution.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dim small">
          lambda_max {result.ahp.lambdaMax} &middot; CR {result.ahp.cr} &middot; RI {result.ahp.ri} &middot;{' '}
          {result.ahp.consistent
            ? 'consistent'
            : 'NOT consistent - the matrix needs revision'}
        </p>
      </details>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Rotation comparison                                                  */
/* ------------------------------------------------------------------ */
export function RotationCompare({ lang, rotationResult, priorities }) {
  if (!rotationResult) return null;
  const { rotations } = rotationResult;
  const dimOrder = [
    ['water_fit', 'Water fit'],
    ['soil_cover', 'Soil cover'],
    ['nitrogen', 'Nitrogen'],
    ['erosion', 'Erosion protection'],
    ['pest_break', 'Pest cycle break'],
    ['income', 'Income'],
    ['climate_risk', 'Climate risk'],
    ['labour', 'Less work'],
  ];
  const recLabel = {
    recommended: t(lang, 'recommended'),
    possible: t(lang, 'possible'),
    current: t(lang, 'current'),
    weak: t(lang, 'weak'),
  };

  return (
    <section className="card">
      <h2>{t(lang, 'rotations')}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Limbag ang score para sa imong mga priority. Usa ka gyud ang score model sa tanan, para makita nimo unsay gyud naayo.'
          : 'Each rotation is scored against the priorities you set. The same scoring model is applied to every option, so the comparison is fair.'}
      </p>

      <div className="rot-cards">
        {rotations.map((r) => (
          <article key={r.id} className={`rot rot-${r.recommendation}`}>
            <header>
              <div>
                <h3>{lang === 'bis' ? r.name_bis : r.name_en}</h3>
                <p className="seq">{r.sequence.join(' → ')}</p>
              </div>
              <div className="rot-score">
                <strong>{r.score.toFixed(0)}</strong>
                <span className={`badge b-${r.recommendation}`}>{recLabel[r.recommendation]}</span>
              </div>
            </header>

            <div className="dim-block">
              <h4>{t(lang, 'why')}</h4>
              <p>{lang === 'bis' ? r.why_bis : r.why_en}</p>
            </div>

            <div className="bars">
              {dimOrder.map(([id, label]) => {
                const d = r.dimensions[id];
                if (!d) return null;
                return (
                  <div className="bar-row" key={id}>
                    <span className="bar-label">{label}</span>
                    <span className="bar-track">
                      <span
                        className={`bar-fill ${d.score >= 0.66 ? 'good' : d.score >= 0.4 ? 'mid' : 'bad'}`}
                        style={{ width: `${Math.round(d.score * 100)}%` }}
                      />
                    </span>
                    <span className="bar-num">{Math.round(d.score * 100)}</span>
                  </div>
                );
              })}
            </div>

            <div className="dim-block">
              <h4>{t(lang, 'evidence')}</h4>
              <ul className="tight">
                {Object.entries(r.dimensions).map(([id, d]) => (
                  <li key={id}>
                    <strong>{d.raw && Object.values(d.raw).length ? '' : ''}</strong>
                    {lang === 'bis' ? d.detail_bis : d.detail_en}
                  </li>
                ))}
              </ul>
            </div>

            {r.benefits_en.length > 0 && (
              <div className="dim-block">
                <h4>{t(lang, 'benefits')}</h4>
                <ul className="tight pos-list">
                  {r.benefits_en.map((b, i) => (
                    <li key={i}>{lang === 'bis' && r.benefits_bis?.[i] ? r.benefits_bis[i] : b}</li>
                  ))}
                </ul>
              </div>
            )}

            {r.gaps_en.length > 0 && (
              <div className="dim-block">
                <h4>{t(lang, 'gaps')}</h4>
                <ul className="tight gap-list">
                  {r.gaps_en.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}

            {r.risks_en.length > 0 && (
              <div className="dim-block">
                <h4>{t(lang, 'risks')}</h4>
                <ul className="tight risk-list">
                  {r.risks_en.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Planting calendar                                                    */
/* ------------------------------------------------------------------ */
export function PlantingCalendar({ lang, profile, plan }) {
  if (!profile) return null;
  const months = profile.months;
  const maxPrecip = Math.max(...months.map((m) => m.precip_mm ?? 0), 1);
  const maxTemp = Math.max(...months.map((m) => m.tmax ?? 0), 1);

  return (
    <section className="card">
      <h2>{t(lang, 'calendar')}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Ang klima gikan sa NASA POWER (MERRA-2). Gi-classify ang season sa PAGASA nga rule: panahon sa ulan kung tulo ka bulan nga sunod nga labaw sa 250 mm, panahon sa katag kung tulo ka bulan nga sunod nga ubos sa 50 mm.'
          : 'The climate strip comes from NASA POWER (MERRA-2). Seasons use the PAGASA rule: wet season when three consecutive months get at least 250 mm, dry season when three consecutive months get below 50 mm.'}
      </p>

      <div className="cal">
        <div className="cal-months">
          {months.map((m) => (
            <div key={m.index} className="cal-m" data-season={m.season}>
              <span className="cal-m-label">{lang === 'bis' ? m.label_bis : m.label_en}</span>
              <div className="cal-rain">
                <span className="cal-rain-fill" style={{ height: `${((m.precip_mm ?? 0) / maxPrecip) * 100}%` }} />
              </div>
              <span className="cal-rain-val">{Math.round(m.precip_mm ?? 0)}</span>
              <div className="cal-temp">
                <span
                  className="cal-temp-fill"
                  style={{ height: `${((m.tmax ?? 0) / maxTemp) * 100}%` }}
                />
              </div>
              <span className="cal-temp-val">{Math.round(m.tmax ?? 0)}°</span>
              <div className="cal-marks">
                {plan?.planting?.includes(m.index) && <span className="mark plant" title="plant ube">P</span>}
                {plan?.harvest?.includes(m.index) && <span className="mark harvest" title="harvest">H</span>}
                {plan?.bare?.includes(m.index) && <span className="mark bare" title="bare field">B</span>}
                {m.season === 'wet' && <span className="mark wet" title="wet season">~</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="cal-legend">
          <span><i className="sw plant" /> plant ube</span>
          <span><i className="sw harvest" /> harvest</span>
          <span><i className="sw bare" /> bare field</span>
          <span><i className="sw wet" /> wet season</span>
          <span className="dim">rain mm (bar) / max temp °C (bar)</span>
        </div>
      </div>

      <div className="two-col tight-cols">
        <div className="dim-block">
          <h4>{lang === 'bis' ? 'Mga bulan kada season' : 'Season by month'}</h4>
          <p className="dim small">
            {months.map((m) => `${lang === 'bis' ? m.label_bis : m.label_en}: ${lang === 'bis' ? SEASON_LABEL[m.season].bis : SEASON_LABEL[m.season].en}`).join(' · ')}
          </p>
        </div>
        <div className="dim-block">
          <h4>{lang === 'bis' ? 'Pinak katag nga panahon nga walay ulan' : 'Longest dry spell'}</h4>
          <p className="dim small">
            {lang === 'bis'
              ? `${profile.drySpellMonths} ka bulan sa panahon sa tanom nga ubos sa 40 mm nga ulan.`
              : `${profile.drySpellMonths} month${profile.drySpellMonths === 1 ? '' : 's'} in the growing season with under 40 mm of rain.`}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Satellite versus ground                                               */
/* ------------------------------------------------------------------ */
export function SatelliteVsGround({ lang }) {
  return (
    <section className="card">
      <h2>{t(lang, 'satelliteVsGround')}</h2>
      <p>
        {lang === 'bis'
          ? 'Ang matag-iya nga limitation niini sa spatial scale, ipakita diri sa simple nga numero. Esensyal nga mahitungod kung unsa ang mapakita niini sa imong uma.'
          : 'The honest limitation of this tool is spatial scale, so here it is in plain numbers.'}
      </p>

      <table className="cmp">
        <thead>
          <tr>
            <th />
            <th>{lang === 'bis' ? 'Satellite' : 'Satellite'}</th>
            <th>{lang === 'bis' ? 'Sensor sa yuta' : 'Ground sensor'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{lang === 'bis' ? 'Area nga ginalugdan' : 'Area it covers'}</td>
            <td>SMAP L3: about 36 km across one pixel. MODIS: 250 m. POWER: about 50 km.</td>
            <td>One ESP32 node: about 1 square metre.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Unsa iyang nakita' : 'What it sees'}</td>
            <td>The neighbourhood. Bare soil, water, canopy and heat mixed together in one pixel.</td>
            <td>One spot of soil. Moisture and temperature at root depth, every 15 minutes.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Kusog' : 'Strength'}</td>
            <td>Covers the whole province, every 2 to 3 days, for 25 years of history, at no cost.</td>
            <td>Real ground truth at the scale the farmer actually works.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Kahuyag' : 'Weakness'}</td>
            <td>Cannot separate a wet corner from a dry corner of the same field.</td>
            <td>One point. Cannot say anything about the rest of the field or the season behind it.</td>
          </tr>
        </tbody>
      </table>

      <div className="dim-block">
        <h4>{lang === 'bis' ? 'Giunsa nga maayo ang duha' : 'Why combining them is better'}</h4>
        <p>
          {lang === 'bis'
            ? 'Usa ka pixel sa SMAP mga 36 km ka lapad. Usa ka uma gamay lang sa pixel, so ang SMAP number kay "average" sa dako nga lugar, dili sa imong plot. Usa ka sensor lang sa sulat sa langit, mahimong mapalabas kung kinsa nga bahin sa uma ang basahi. Pagduha nga gi-combine, naa tana i-check kung ang sensor naayon sa satellite, kay kung dili, naa tana lokal nga anomalya (baso nga utod, maa kanal, giablado nga yuta). Mao kana ang "SI" nga gi-validate sa ground.'
            : 'One SMAP pixel is about 36 km wide. A farm is a small part of that pixel, so the SMAP number is an average over a large area, not your plot. A single sensor reads one point of soil. Put the two together and you can check whether the ground reading agrees with the satellite reading. If it does not, the difference points to a local anomaly: a wet corner, a blocked drain, or a patch of compacted soil. That is the value of validation against ground truth.'}
        </p>
      </div>

      <div className="dim-block plan-box">
        <h4>UbiSense: what we built and what is still to do</h4>
        <ul className="tight">
          <li>
            <strong>Built.</strong> ESP32 firmware for a capacitive soil moisture probe plus a
            DS18B20 soil temperature probe, reading every 15 minutes and posting to the
            UbiMap endpoint. The source is in <code>firmware/ubisense/</code> in this repository.
          </li>
          <li>
            <strong>Not yet done, and we are not pretending otherwise.</strong> No node has been
            deployed in the field yet, so this build shows <em>no</em> ground measurements. We
            would rather show an empty chart with an honest label than a chart full of invented numbers.
          </li>
          <li>
            <strong>Next step.</strong> One node per barangay, shared by a cooperative. The node
            cost is roughly PHP 1,000 to 1,500, which is one basket of ube.
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Provenance                                                           */
/* ------------------------------------------------------------------ */
export function Provenance({ lang, rows, meta }) {
  return (
    <section className="card">
      <h2>{t(lang, 'provenance')}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Matag numero niini nga tool gikan sa usa sa mga kini. Openi ang bisan unsang link aron matan-aw nimo ang datos. Walay NASA account, walay bayad, walay tracking sa imong uma.'
          : 'Every number in this tool came from one of these sources. Open any link to see the data yourself. No NASA account, no payment, and nothing about your farm is sent anywhere.'}
      </p>
      <div className="prov-scroll">
        <table className="prov">
          <thead>
            <tr>
              <th>{lang === 'bis' ? 'Pinagmulan' : 'Source'}</th>
              <th>{lang === 'bis' ? 'Misyon' : 'Mission'}</th>
              <th>{lang === 'bis' ? 'Gigamit para sa' : 'Used for'}</th>
              <th>{lang === 'bis' ? 'Resolusyon' : 'Resolution'}</th>
              <th>{lang === 'bis' ? 'Nakuha' : 'Retrieved'}</th>
              <th>{lang === 'bis' ? 'Kahimugaan' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a></td>
                <td className="dim">{r.mission}</td>
                <td>{r.used_for}</td>
                <td className="dim">{r.resolution}</td>
                <td className="dim">{String(r.retrieved).slice(0, 16).replace('T', ' ')}</td>
                <td>{r.live}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && (
        <p className="dim small">
          Grid: {meta.cells} cells at {meta.step_deg}° ({meta.step_km_approx} km), bbox{' '}
          {meta.bbox?.join(', ')}. Built {String(meta.retrieved_philippine || '').slice(0, 16).replace('T', ' ')} PHT.
          Rebuild it any time with <code>python scripts/build_pilot_grid.py</code> and{' '}
          <code>python scripts/enrich_grid.py</code>.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Model validation against PSA statistics                              */
/* ------------------------------------------------------------------ */
export function ValidationPanel({ lang, validation }) {
  if (!validation) return null;
  const st = validation.statistics || {};
  const provinces = validation.provinces || [];
  const producers = provinces.filter((p) => (p.psa_volume_mt || 0) > 0);
  const nonProducers = provinces.filter((p) => (p.psa_volume_mt || 0) === 0);
  const bottom = provinces.slice(-4);
  const bottomAllNonProducers = bottom.length > 0 && bottom.every((p) => (p.psa_volume_mt || 0) === 0);

  return (
    <section className="card">
      <h2>{lang === 'bis' ? 'Validation sa datos sa PSA' : 'Validation against PSA data'}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Gin-score ang modelo sa 110 ka punto sa 18 ka probinsiya nga nagpoproduce ug sa 4 ka probinsiya nga walay ube, dayon gitawag sa aktuwal nga produksyon gikan sa PSA OpenSTAT.'
          : 'The model was scored at 110 points across 18 ube-producing provinces and 4 provinces with no reported ube, then compared with real PSA production figures.'}
      </p>

      <div className="val-stats">
        <div>
          <strong>{st.mean_score_producers}</strong>
          <span>{lang === 'bis' ? 'mean score, may produksyon' : 'mean score, with production'}</span>
        </div>
        <div>
          <strong>{st.mean_score_non_producers}</strong>
          <span>{lang === 'bis' ? 'mean score, walang produksyon' : 'mean score, no production'}</span>
        </div>
        <div>
          <strong>{st.spearman_score_vs_yield}</strong>
          <span>{lang === 'bis' ? 'Spearman r kontra yield' : 'Spearman r vs yield'}</span>
        </div>
        <div>
          <strong>{st.spearman_score_vs_log_volume}</strong>
          <span>{lang === 'bis' ? 'Spearman r kontra volume' : 'Spearman r vs volume'}</span>
        </div>
      </div>

      <div className="prov-scroll">
        <table className="prov val">
          <thead>
            <tr>
              <th>{lang === 'bis' ? 'Probinsiya' : 'Province'}</th>
              <th>{lang === 'bis' ? 'Puntos' : 'Score'}</th>
              <th>{lang === 'bis' ? 'Ulan mm' : 'Rain mm'}</th>
              <th>PSA MT</th>
              <th>t/ha</th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((p) => (
              <tr key={p.province} className={(p.psa_volume_mt || 0) === 0 ? 'nonprod' : ''}>
                <td>{p.province}</td>
                <td>{p.score_mean}</td>
                <td className="dim">{p.annual_mm_mean}</td>
                <td className="dim">{(p.psa_volume_mt || 0).toFixed(0)}</td>
                <td className="dim">{(p.yield_t_ha || 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dim-block honest">
        <h4>{lang === 'bis' ? 'Ang nakatabak nga finding, mao pa gikan pa' : 'The finding, including the part that did not work'}</h4>
        <p>
          {lang === 'bis'
            ? 'Ang una nga bersyon sa modelo wala nagkaayo: ang correlation nga niya kontra sa aktuwal nga yield sa probinsiya halos zero. Ngano? Ang ulan. Ang ube nangkinang sa dry window para sa pagtiniug sa tubero, ug ang usa ka bulan nga ubos sa 50 mm nga ulan mao ang labing kusog nga predictor nga nakaabot sa aktuwal nga yield (r = +0.36 sa POWER, r = +0.30 sa IMERG, sa 17 ka probinsiya). Nasa halos 50 km nga grid ang NASA POWER, so naa magkawala ang dry season sa Pilipinas. Gibuild nami ang ulan sa modelo gikan sa GPM IMERG sa mga 10 km, gikan sa 9,124 ka daily nga tile sa NASA GIBS. Sa parehong 18 ka probinsiya, ang correlation kontra sa aktuwal nga yield gikan sa r = +0.00 to r = +0.32, ug kontra sa volume gikan sa r = +0.21 to r = +0.48. Dili lang iya ang detalyadong produkto nga nakaabot, kay andamit ani kung naa gikan sa six factors. Usa ka real nga signal ka r = +0.32, ug gamay ra, so screening tool niini, dili predictor sa yield.'
            : 'The first version of this model did not work: its correlation with real provincial yield was essentially zero. The reason was the rainfall. Ube needs a dry maturation window, and the number of months under 50 mm of rain is the strongest observable that predicts real provincial yield (r = +0.36 for POWER and +0.30 for IMERG across 17 provinces). NASA POWER works on a roughly 50 km grid, so it smooths the Philippine dry season away. We rebuilt the model\'s rainfall from GPM IMERG at about 10 km, from 9,124 daily NASA GIBS tiles. On the same 18 provinces the correlation with real yield went from r = +0.00 to r = +0.32, and with production volume from r = +0.21 to r = +0.48. The finer product was not enough on its own; the model works because six factors are combined. r = +0.32 is a real signal and a modest one, so this is a screening tool and not a yield predictor.'}
        </p>
        <p>
          {lang === 'bis'
            ? 'Ang nga pa: ang PAGASA station nga pinak malapit kay Cotabato City, 110 ka kilometro sa parehong baybayin, nga narekord 2,414.3 mm sa tuig. Ang IMERG nagsaad og 2,421.9 mm sa Pagadian, mga 0.3% lang ang gibanayaw, pero ang POWER nagsaad og 2,246 mm, mga 7% nga ubos. Walay PAGASA station mismo sa Pagadian. Mao kana ang gap nga ang sensor sa uma unya ma-close. Ang UbiMap kay screening tool para sa pagtambag sa farmer, dili predictor sa yield.'
            : 'What is left open is the interesting part: the nearest representative PAGASA station is Cotabato City, 110 kilometres away on the same Sulu Sea coast, with 2,414.3 mm a year. IMERG reads 2,421.9 mm at Pagadian, within 0.3%, and POWER reads 2,246 mm, about 7% low. There is no PAGASA station at Pagadian itself. That is the gap a field sensor would close. Meanwhile the honest conclusion stands: UbiMap is a screening tool for a conversation with a farmer, not a yield predictor.'}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* NASA data register                                                    */
/* ------------------------------------------------------------------ */
export function NasaDataPanel({ lang, rows }) {
  const nasa = rows.filter((r) => /NASA|GIBS|MODIS|SMAP|IMERG|SRTM|GRACE|Landsat|VIIRS|ECOSTRESS|POWER|CMR/i.test(`${r.name} ${r.mission}`));
  return (
    <section className="card">
      <h2>{lang === 'bis' ? 'NASA data nga among gigamit' : 'NASA data used'}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Pit ka dataset, dili usa. Naa tana live gikan sa NASA GIBS direkta sa browser, ug nasa tana NASA POWER nga pre-computed para ma-offline ang app.'
          : 'Seven datasets, not one. The imagery streams live from NASA GIBS straight into the browser, and the NASA POWER numbers are precomputed so the app keeps working with no network.'}
      </p>
      <ul className="tight nasa-list">
        {nasa.map((r) => (
          <li key={r.name}>
            <strong>{r.name}</strong>
            <span className="dim"> &middot; {r.mission} &middot; {r.resolution}</span>
            <div>{r.used_for}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Farm profile (step 2)                                                */
/* ------------------------------------------------------------------ */
const CROPS = [
  { id: 'corn', en: 'Corn', bis: 'Mais' },
  { id: 'cassava', en: 'Cassava', bis: 'Kamoteng' },
  { id: 'sweetpotato', en: 'Sweet potato', bis: 'Kamote' },
  { id: 'mungbean', en: 'Mungbean', bis: 'Mungbean' },
  { id: 'peanut', en: 'Peanut', bis: 'Peanut' },
  { id: 'coconut', en: 'Coconut', bis: 'Niyo' },
  { id: 'ube', en: 'Ube (already growing)', bis: 'Ube (naa na)' },
];

export function FarmProfile({ lang, farmer, setFarmer }) {
  const set = (k, v) => setFarmer((f) => ({ ...f, [k]: v }));
  const setPriority = (k, v) => setFarmer((f) => ({ ...f, priorities: { ...f.priorities, [k]: v } }));

  return (
    <div className="card">
      <h2>{t(lang, 'currentCrop')}</h2>
      <div className="chips">
        {CROPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${farmer.currentCrop === c.id ? 'chip-on' : ''}`}
            onClick={() => set('currentCrop', c.id)}
          >
            {lang === 'bis' ? c.bis : c.en}
          </button>
        ))}
      </div>

      <h2 className="mt">{t(lang, 'priorities')}</h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Ibutang ang slider kung unsa ang labing importante. Mahimong duha o tulo nga mataas.'
          : 'Move each slider to what matters most. More than one can be high.'}
      </p>
      <div className="sliders">
        {[
          ['income', t(lang, 'moreIncome')],
          ['water', t(lang, 'saveWater')],
          ['soil', t(lang, 'healthySoil')],
          ['labour', t(lang, 'lessWork')],
        ].map(([k, label]) => (
          <label key={k} className="slider-row">
            <span>{label}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={farmer.priorities[k]}
              onChange={(e) => setPriority(k, Number(e.target.value))}
            />
            <span className="slider-val">{Math.round(farmer.priorities[k] * 100)}</span>
          </label>
        ))}
      </div>

      <h2 className="mt">{t(lang, 'areaHa')}</h2>
      <input
        className="num"
        type="number"
        min="0.05"
        step="0.05"
        value={farmer.areaHa}
        onChange={(e) => set('areaHa', Number(e.target.value))}
      />

      <h2 className="mt">{t(lang, 'irrigation')}</h2>
      <div className="chips">
        <button
          type="button"
          className={`chip ${farmer.irrigation ? 'chip-on' : ''}`}
          onClick={() => set('irrigation', true)}
        >
          {t(lang, 'irrigationYes')}
        </button>
        <button
          type="button"
          className={`chip ${!farmer.irrigation ? 'chip-on' : ''}`}
          onClick={() => set('irrigation', false)}
        >
          {t(lang, 'irrigationNo')}
        </button>
      </div>
    </div>
  );
}
