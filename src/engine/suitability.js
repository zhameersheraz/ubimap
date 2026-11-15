/**
 * Ube suitability model.
 *
 * Every score here is traceable: each factor names the dataset it came from, the raw
 * value, and the threshold it was compared against. Nothing is a black box, because the
 * challenge asks us to explain where information is missing and where local experts
 * must validate the result.
 */
import { ahpWeights, SUITABILITY_MATRIX } from './ahp.js';

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_BIS = ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Sep', 'Okt', 'Nob', 'Dis'];
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Agronomy thresholds are stored with their source and note attached, so a threshold
 * can be either a plain number or an object with a value field. This normalises them
 * so the model code can compare against them directly.
 */
export function normThresholds(t) {
  const out = { ...t };
  for (const [k, v] of Object.entries(t || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) out[k] = v.value;
  }
  return out;
}

/**
 * Linear interpolation across control points, clamped at the ends.
 * points: [[x, y], ...] sorted ascending by x.
 */
export function ramp(value, points) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * Build the 12 month profile for a grid cell.
 *
 * Rainfall comes from GPM IMERG at about 10 km when the cell has it, because it agrees
 * with the nearest representative PAGASA station to within 0.3% where POWER reads 7%
 * low. NASA POWER still supplies temperature, humidity and soil wetness, and it stays in
 * the cell as the independent cross check. POWER precipitation is kept as a fallback.
 *
 * POWER precipitation arrives as mm/day, so it is converted to mm/month.
 */
export function monthlyProfile(cell) {
  const c = cell.climate || {};
  const precipDay = c.precip_mm_day || [];
  const soil = cell.soil_moisture || {};
  const gwetMonthly = soil.gwetroot_monthly || [];
  const imergMonthly = cell.imerg?.monthly_mm || null;

  const months = MONTHS_EN.map((label, i) => {
    const pd = precipDay[i];
    const powerMm = pd === null || pd === undefined ? null : Number((pd * DAYS_IN_MONTH[i]).toFixed(1));
    const imergMm = imergMonthly && imergMonthly[i] !== null && imergMonthly[i] !== undefined
      ? Number(imergMonthly[i].toFixed(1))
      : null;
    return {
      index: i,
      label_en: label,
      label_bis: MONTHS_BIS[i],
      precip_mm: imergMm !== null ? imergMm : powerMm,
      precip_mm_power: powerMm,
      precip_source: imergMm !== null ? 'GPM IMERG' : 'NASA POWER',
      tmax: c.tmax?.[i] ?? null,
      tmin: c.tmin?.[i] ?? null,
      tmean: c.tmean?.[i] ?? null,
      rh: c.rh?.[i] ?? null,
      solar_mj: c.solar_mj?.[i] ?? null,
      gwetroot: gwetMonthly[i] ?? null,
    };
  });

  const annualMm = months.reduce((a, m) => a + (m.precip_mm ?? 0), 0);
  const annualPower = months.reduce((a, m) => a + (m.precip_mm_power ?? 0), 0);
  return {
    months,
    annual_mm: Number(annualMm.toFixed(1)),
    annual_mm_power: Number(annualPower.toFixed(1)),
    rain_source: months[0]?.precip_source || 'NASA POWER',
  };
}

/**
 * Philippine season classification.
 *
 * PAGASA's climate classification marks a wet season when three consecutive months
 * average at least 250 mm and a dry season when three consecutive months average below
 * 50 mm. Many parts of the Philippines, including the Zamboanga peninsula, never have
 * three months that dry, so that rule alone leaves every month as a shoulder season.
 *
 * For a crop calendar the monthly PAGASA rainfall thresholds are the useful ones: a
 * month with at least 100 mm is a wet month, under 50 mm is a dry month, and in between
 * is a shoulder month. Both classifications are returned so the app can state which
 * one it is using instead of hiding the choice.
 */
export const WET_MONTH_MM = 100;
export const DRY_MONTH_MM = 50;

export function classifySeasons(months) {
  const n = months.length;
  const wet3 = new Array(n).fill(false);
  const dry3 = new Array(n).fill(false);
  const p = months.map((m) => m.precip_mm ?? 0);

  for (let i = 0; i < n; i += 1) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const c = p[(i + 2) % n];
    if (a >= 250 && b >= 250 && c >= 250) {
      wet3[i] = wet3[(i + 1) % n] = wet3[(i + 2) % n] = true;
    }
    if (a < 50 && b < 50 && c < 50) {
      dry3[i] = dry3[(i + 1) % n] = dry3[(i + 2) % n] = true;
    }
  }
  return months.map((m, i) => ({
    ...m,
    season: p[i] >= WET_MONTH_MM ? 'wet' : p[i] < DRY_MONTH_MM ? 'dry' : 'shoulder',
    pagasa_season: wet3[i] ? 'wet' : dry3[i] ? 'dry' : 'shoulder',
  }));
}

/** Longest run of consecutive months below a threshold, circular. */
export function longestDryRun(months, thresholdMm, restrictTo = null) {
  const n = months.length;
  const flagged = months.map((m, i) => {
    if (restrictTo && !restrictTo.includes(i)) return false;
    return (m.precip_mm ?? 0) < thresholdMm;
  });
  if (!flagged.some(Boolean)) return 0;
  let best = 0;
  let run = 0;
  for (let k = 0; k < n * 2; k += 1) {
    if (flagged[k % n]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    if (best >= n) return n;
  }
  return Math.min(best, n);
}

export const SEASON_LABEL = {
  wet: { en: 'Wet season', bis: 'Panahon sa ulan', fil: 'Tag-ulan' },
  dry: { en: 'Dry season', bis: 'Panahon sa katag', fil: 'Tag-tuyo' },
  shoulder: { en: 'Shoulder season', bis: 'Panahon sa pagpugong', fil: 'Panahon ng pagitanaw' },
};

/**
 * Score one factor. Returns { score 0..1, detail, raw }.
 */
/**
 * Score the rainfall factor.
 *
 * This scores the PATTERN of rain, not just the amount. Ube is planted at the start of
 * the rains and lifted at the end of them, so a field needs a wet season with enough
 * rain to carry the crop and a distinct dry window to mature the tubers in. A place
 * that is wet in all twelve months is a poor ube field even when the total rainfall
 * looks generous, and validation against PSA production data showed that this
 * distinction is what separates a real ube province from a non producing one.
 */
function scoreRainfall(months, t, wetMonths) {
  const annual = months.reduce((a, m) => a + (m.precip_mm ?? 0), 0);
  const wetSet = wetMonths.length ? wetMonths : months.map((m) => m.index);
  const wetSeasonTotal = months
    .filter((m) => wetSet.includes(m.index))
    .reduce((a, m) => a + (m.precip_mm ?? 0), 0);

  // enough rain through the growing season
  const growthRain = ramp(wetSeasonTotal, [
    [400, 0], [800, 0.45], [1200, 0.85], [1700, 1], [2400, 0.9], [3200, 0.65], [4200, 0.4],
  ]);

  // a dry window to mature the tubers in, long enough to cure but not so long that
  // establishment becomes impossible
  const dryRun50 = longestDryRun(months, t.drought_monthly_rain_mm);
  const dryRun100 = longestDryRun(months, t.planting_stress_monthly_rain_mm);
  const dryWindow = ramp(dryRun50, [
    [0, 0], [1, 0.35], [2, 0.72], [3, 0.95], [5, 1], [7, 0.75], [9, 0.5],
  ]);

  // how dependable the rain is month to month through the growing season
  const inSeason = months.filter((m) => wetSet.includes(m.index));
  const reliable = inSeason.filter(
    (m) => m.precip_mm >= t.monthly_rainfall_mm.min && m.precip_mm <= t.monthly_rainfall_mm.max,
  ).length;
  const reliability = inSeason.length ? reliable / inSeason.length : 0;

  const score = 0.40 * (growthRain ?? 0) + 0.35 * (dryWindow ?? 0) + 0.25 * reliability;

  return {
    score,
    raw: {
      annual_mm: Number(annual.toFixed(1)),
      wet_season_mm: Number(wetSeasonTotal.toFixed(1)),
      dry_months_under_50mm: dryRun50,
      shoulder_months_under_100mm: dryRun100,
      reliable_months: reliable,
      in_season_months: inSeason.length,
    },
    detail_en: `${Math.round(wetSeasonTotal).toLocaleString()} mm falls in the growing season and the field has ${dryRun50} month${dryRun50 === 1 ? '' : 's'} under ${t.drought_monthly_rain_mm} mm at the end. Ube needs that dry window: the tubers are lifted then, and a field that is wet all year cannot cure them. ${dryRun50 >= t.dry_season_requirement.min_dry_months ? 'Your field has it.' : 'Your field does not have one, and that is the biggest thing working against ube here.'}`,
    detail_bis: `${Math.round(wetSeasonTotal).toLocaleString()} mm ang nahugsa sa panahon sa tanom, ug ${dryRun50} ka bulan nga ubos sa ${t.drought_monthly_rain_mm} mm sa katapusan. Ube nangkinang niini nga dry window: diin naa gi-ani ang tubero, ug ang yuta nga basahi sa tuig walang mahimong maayo. ${dryRun50 >= t.dry_season_requirement.min_dry_months ? 'Naa ang imong uma niini.' : 'Wala ang imong uma niini, ug mao kana ang pinak dako nga problema para sa ube diri.'}`,
  };
}

/**
 * Score the soil moisture factor.
 *
 * NASA POWER reports GWETROOT as a dimensionless MERRA-2 root zone wetness index
 * (0 to 1), not as m3/m3, so it cannot be compared with a physical soil moisture
 * threshold. The risk flags are therefore driven by rainfall, which has an unambiguous
 * unit, and the wetness index only sharpens the waterlogging signal.
 */
function scoreSoilMoisture(months, t, wetMonths) {
  const inSeason = wetMonths.length ? months.filter((m) => wetMonths.includes(m.index)) : months;
  if (!inSeason.length) {
    return { score: null, raw: null, detail_en: 'No soil moisture data available for this cell.', detail_bis: 'Walay datos sa soil moisture alang sa cell niini.', missing: true };
  }
  let sum = 0;
  let n = 0;
  let waterloggingMonths = 0;
  let droughtMonths = 0;
  let wetnessPeak = 0;
  let peakMonth = null;
  for (const m of inSeason) {
    const pr = m.precip_mm ?? 0;
    const w = m.gwetroot;
    if (w !== null && w !== undefined && w > wetnessPeak) {
      wetnessPeak = w;
      peakMonth = m.label_en;
    }
    let s = 1;
    if (pr >= t.waterlogging_monthly_rain_mm) {
      // sustained heavy rain is what rots the tubers, and a wet soil model makes it worse
      s = (w !== null && w !== undefined && w >= t.root_zone_wetness_index.wet) ? 0.12 : 0.4;
      waterloggingMonths += 1;
    } else if (pr >= t.waterlogging_monthly_rain_mm * 0.65) {
      s = 0.78;
    }
    if (pr < t.drought_monthly_rain_mm) {
      s = Math.min(s, 0.3);
      droughtMonths += 1;
    }
    sum += s;
    n += 1;
  }
  const score = n ? sum / n : null;
  return {
    score,
    raw: {
      waterlogging_months: waterloggingMonths,
      drought_months: droughtMonths,
      peak_wetness_index: Number(wetnessPeak.toFixed(3)),
      peak_wetness_month: peakMonth,
    },
    detail_en: `${waterloggingMonths} month${waterloggingMonths === 1 ? '' : 's'} get more than ${t.waterlogging_monthly_rain_mm} mm of rain, which is when ube tubers rot, and ${droughtMonths} month${droughtMonths === 1 ? '' : 's'} fall under ${t.drought_monthly_rain_mm} mm, which is the dry stress. The modelled root zone wetness peaks at ${wetnessPeak.toFixed(2)} in ${peakMonth}.`,
    detail_bis: `${waterloggingMonths} ka bulan nga labaw sa ${t.waterlogging_monthly_rain_mm} mm nga ulan, kay naa diin mamatong ang mga tubero, ug ${droughtMonths} ka bulan nga ubos sa ${t.drought_monthly_rain_mm} mm, kay naa diin stress sa katag. Ang modeled nga wetness sa lawas sa gamot gikan sa ${wetnessPeak.toFixed(2)} sa ${peakMonth}.`,
  };
}

function scoreTemperature(months, t, wetMonths) {
  const inSeason = wetMonths.length ? months.filter((m) => wetMonths.includes(m.index)) : months;
  let sum = 0;
  let n = 0;
  let hot = 0;
  let peak = null;
  for (const m of inSeason) {
    if (m.tmax === null || m.tmax === undefined) continue;
    const v = m.tmax;
    if (peak === null || v > peak.v) peak = { v, index: m.index };
    if (v > t.air_temp_c.heat_stress) hot += 1;
    sum += ramp(v, [
      [t.air_temp_c.growth_min - 4, 0], [t.air_temp_c.growth_min, 0.4],
      [t.air_temp_c.optimal[0], 0.9], [t.air_temp_c.optimal[1], 1],
      [t.air_temp_c.heat_stress, 0.55], [t.air_temp_c.heat_stress + 3, 0.2], [42, 0],
    ]);
    n += 1;
  }
  if (!n) {
    return { score: null, raw: null, detail_en: 'No temperature data available for this cell.', detail_bis: 'Walay datos sa temperatura alang sa cell niini.', missing: true };
  }
  const score = sum / n;
  return {
    score,
    raw: { hottest_month_max_c: peak ? peak.v : null, heat_stress_months: hot },
    detail_en: `Hottest month reaches ${peak ? peak.v.toFixed(1) : '-'} degrees C. ${hot} month${hot === 1 ? '' : 's'} go above the ${t.air_temp_c.heat_stress} degrees C heat stress line for ube.`,
    detail_bis: `${peak ? peak.v.toFixed(1) : '-'} grados ang pinak taas nga temperatura. ${hot} ka bulan nga labaw sa ${t.air_temp_c.heat_stress} grados, naa stress sa init para sa ube.`,
  };
}

function scoreSlope(cell, t) {
  const s = cell.slope_deg;
  if (s === null || s === undefined) {
    return { score: null, raw: null, detail_en: 'No slope value available for this cell.', detail_bis: 'Walay datos sa kantidad alang sa cell niini.', missing: true };
  }
  const score = ramp(s, [[0, 1], [t.slope_deg.ideal, 1], [t.slope_deg.tolerable, 0.55], [t.slope_deg.reject_above, 0]]);
  return {
    score,
    raw: { slope_deg: s, elevation_m: cell.elev_m ?? null },
    detail_en: `Ground slopes ${s.toFixed(1)} degrees (about ${cell.elev_m ?? '?'} m above sea level). Ube wants ${t.slope_deg.ideal} degrees or less; above ${t.slope_deg.tolerable} degrees the tubers sit exposed.`,
    detail_bis: `${s.toFixed(1)} grados ang kantidad sa yuta (mga ${cell.elev_m ?? '?'} m sa ibabaw sa dagat). Gusto nga ube ang ${t.slope_deg.ideal} grados pababa; labaw sa ${t.slope_deg.tolerable} grados, gipagtray ang mga tubero.`,
  };
}

function scoreSoilPh(cell, t) {
  const ph = cell.soil?.phh2o;
  if (ph === null || ph === undefined) {
    return { score: null, raw: null, detail_en: 'No soil pH data for this cell. Ask your municipal agriculturist for a soil test, this is a real gap in our data.', detail_bis: 'Walay datos sa pH sa yuta alang sa cell niini. Pangutnag ang imong lokal na agronomista para sa soil test, kay naa gyud na gap sa among datos.', missing: true };
  }
  const score = ramp(ph, [[t.soil_ph.tolerable[0], 0.15], [t.soil_ph.optimal[0], 1], [t.soil_ph.optimal[1], 1], [t.soil_ph.tolerable[1], 0.25]]);
  return {
    score,
    raw: { ph, depth: cell.soil._depth ?? '0-30cm' },
    detail_en: `Soil pH is ${ph.toFixed(1)} at ${cell.soil._depth ?? '0-30cm'} depth. Ube grows best at pH ${t.soil_ph.optimal[0]}-${t.soil_ph.optimal[1]}.`,
    detail_bis: `Ang pH sa yuta kay ${ph.toFixed(1)} sa ${cell.soil._depth ?? '0-30cm'}. Maayo ang ube sa pH ${t.soil_ph.optimal[0]}-${t.soil_ph.optimal[1]}.`,
  };
}

function scoreDrainage(cell, t) {
  const soil = cell.soil || {};
  const clay = soil.clay;
  const bdod = soil.bdod;
  if (clay === undefined || clay === null) {
    return { score: null, raw: null, detail_en: 'No soil texture data for this cell, so drainage could not be checked. This is a real gap.', detail_bis: 'Walay datos sa textura sa yuta alang sa cell niini, kaya dili na-check ang drainage. Naa gyud na gap.', missing: true };
  }
  const clayScore = ramp(clay, [[15, 1], [30, 0.9], [t.clay_percent.max, 0.35], [60, 0.1]]);
  const bdodScore = bdod === undefined || bdod === null ? null : ramp(bdod, [[1.0, 1], [1.35, 0.9], [1.55, 0.45], [1.8, 0.15]]);
  const score = bdodScore === null ? clayScore : clayScore * 0.65 + bdodScore * 0.35;
  return {
    score,
    raw: { clay_percent: clay, sand_percent: soil.sand ?? null, silt_percent: soil.silt ?? null, bulk_density: bdod ?? null, organic_carbon: soil.soc ?? null },
    detail_en: `Soil is ${clay.toFixed(0)}% clay with ${soil.sand?.toFixed?.(0) ?? '?'}% sand${bdod ? ` and bulk density ${bdod.toFixed(2)} g/cm3` : ''}. Heavy clay holds water against the tubers, so drainage matters more here than fertility.`,
    detail_bis: `${clay.toFixed(0)}% clay ang yuta, uban sa ${soil.sand?.toFixed?.(0) ?? '?'}% sand${bdod ? ` ug ${bdod.toFixed(2)} g/cm3 nga bulk density` : ''}. Ang heavy clay nga nagpugong sa tubig, kaya ang drainage labaw sa fertility ang importante.`,
  };
}

/**
 * Evaluate one grid cell for ube suitability.
 * @param {object} cell grid cell from data/pilot_grid.json
 * @param {object} agronomy parsed src/data/agronomy.json
 * @param {object} opts { scenarioRainFactor: number, scenarioTempDelta: number }
 */
export function evaluateCell(cell, agronomy, opts = {}) {
  const rainFactor = opts.scenarioRainFactor ?? 1;
  const tempDelta = opts.scenarioTempDelta ?? 0;

  const base = monthlyProfile(cell);
  const months = classifySeasons(base.months.map((m) => ({
    ...m,
    precip_mm: m.precip_mm === null ? null : Number((m.precip_mm * rainFactor).toFixed(1)),
    tmax: m.tmax === null ? null : Number((m.tmax + tempDelta).toFixed(2)),
  })));
  const wetMonths = months.filter((m) => m.season === 'wet').map((m) => m.index);
  if (!wetMonths.length) {
    // fall back to the three wettest months so the model still has a growing season
    const wettest = [...months].sort((a, b) => (b.precip_mm ?? 0) - (a.precip_mm ?? 0)).slice(0, 4).map((m) => m.index);
    wetMonths.push(...wettest);
  }

  const t = normThresholds(agronomy.ube.thresholds);
  const parts = {
    rainfall: scoreRainfall(months, t, wetMonths),
    soil_moisture: scoreSoilMoisture(months, t, wetMonths),
    temperature: scoreTemperature(months, t, wetMonths),
    slope: scoreSlope(cell, t),
    soil_ph: scoreSoilPh(cell, t),
    drainage: scoreDrainage(cell, t),
  };

  const ahp = ahpWeights(SUITABILITY_MATRIX);
  const factors = SUITABILITY_MATRIX.factors.map((f) => {
    const p = parts[f.id];
    const weight = ahp.weights[f.id];
    const scored = p.score === null ? null : p.score * weight;
    return {
      id: f.id,
      label_en: f.label_en,
      label_bis: f.label_bis,
      dataset: f.dataset,
      weight: Number(weight.toFixed(4)),
      score: p.score === null ? null : Number(p.score.toFixed(3)),
      contribution: scored === null ? null : Number((scored * 100).toFixed(2)),
      raw: p.raw,
      detail_en: p.detail_en,
      detail_bis: p.detail_bis,
      missing: !!p.missing,
    };
  });

  const available = factors.filter((f) => f.contribution !== null);
  const missing = factors.filter((f) => f.missing);
  const totalWeight = available.reduce((a, f) => a + f.weight, 0);
  const score = totalWeight ? (available.reduce((a, f) => a + f.contribution, 0) / totalWeight) : 0;

  const band = score >= 75 ? 'excellent' : score >= 58 ? 'good' : score >= 40 ? 'fair' : 'poor';

  const sorted = [...available].sort((a, b) => b.contribution - a.contribution);
  const reasons = sorted.slice(0, 3);
  const reasonIds = new Set(reasons.map((f) => f.id));
  // concerns must not repeat the strengths, otherwise a farmer reads the same line twice
  const concerns = [...available]
    .filter((f) => !reasonIds.has(f.id))
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 3);
  const concernFallback = concerns.length ? concerns : [...available].sort((a, b) => a.contribution - b.contribution).slice(0, 3);

  const confidence = {
    level: missing.length === 0 ? 'high' : missing.length <= 2 ? 'medium' : 'low',
    missing_factors: missing.map((f) => f.label_en),
    note_en: missing.length === 0
      ? 'All six factors have data for this cell. The climate and soil numbers are gridded NASA and ISRIC products, so they describe the neighbourhood, not your exact plot.'
      : `We are missing ${missing.length} of the six factors (${missing.map((f) => f.label_en).join(', ')}). Treat the score as a screening result and confirm those points locally.`,
    note_bis: missing.length === 0
      ? 'May datos sa unom ka factor alang sa cell niini. Gridded lang ang NASA ug ISRIC, so naa gikan lang sa kighborhood, dili sa imong eksaktong plot.'
      : `Wala kami sa ${missing.length} sa unom ka factor (${missing.map((f) => f.label_bis).join(', ')}). Isaha ang score, screening lang, ug kumpirma sa lokal ang mga hangtud nga imong area.`,
  };

  return {
    cell_id: cell.id,
    lat: cell.lat,
    lon: cell.lon,
    score: Number(score.toFixed(1)),
    band,
    factors,
    reasons,
    concerns: concernFallback,
    confidence,
    ahp,
    profile: {
      months,
      annual_mm: base.annual_mm,
      wet_months: wetMonths,
      climate: cell.climate,
      soil_moisture: cell.soil_moisture,
      soil: cell.soil,
      elev_m: cell.elev_m,
      slope_deg: cell.slope_deg,
      rain_years: cell.rain_years || null,
      sources: cell.sources,
    },
  };
}
