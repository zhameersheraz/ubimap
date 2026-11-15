/**
 * Rotation comparison engine.
 *
 * The challenge requires comparing at least three rotation strategies including the
 * farmer's existing one, and for each one explaining why it is suggested, what evidence
 * supports it, what benefits it brings, where the information gaps are, and what risks
 * need local review. This module produces all of that from the cell data.
 *
 * The scoring is rule based on purpose. A farmer can be told exactly which rule moved
 * their number, and an extension worker can argue with the rule. An opaque model would
 * be less useful to both.
 */
import { ahpWeights, ROTATION_MATRIX, blendWeights } from './ahp.js';
import { ramp, normThresholds } from './suitability.js';

/**
 * Crop trait lookup. Ube lives in agronomy.ube, the companion crops live in
 * agronomy.companion_crops, so both have to be reachable from here.
 */
const CROP = (agronomy, id) => {
  if (!agronomy) return null;
  if (id === 'ube') {
    const t = agronomy.ube?.traits || {};
    return {
      id: 'ube',
      common_en: agronomy.ube?.common_en || 'Ube',
      common_bis: agronomy.ube?.common_bis || 'Ube',
      duration_months: agronomy.ube?.thresholds?.duration_months?.typical || 9,
      ...t,
    };
  }
  return agronomy.companion_crops?.[id] || null;
};

/** Crops that share a plant family can carry the same pests and disease forward. */
function families(sequence, agronomy) {
  return sequence.map((id) => {
    const c = CROP(agronomy, id);
    if (!c) return 'unknown';
    if (c.pest_family) return c.pest_family;
    if (id === 'ube') return agronomy.ube.traits.pest_family;
    return id;
  });
}

/** Build the "what you plant now" rotation from the farmer's stated crop. */
export function existingRotation(farmer, agronomy) {
  const id = farmer.currentCrop || 'corn';
  const crop = CROP(agronomy, id);
  return {
    id: 'R_EXISTING',
    kind: 'existing',
    name_en: 'What you plant now',
    name_bis: 'Imong gina-planta karon',
    name_fil: 'Ang inyong tanim ngayon',
    sequence: [id, id],
    crop_label_en: crop?.common_en || id,
    crop_label_bis: crop?.common_bis || id,
  };
}

/**
 * Monthly water reference for turning the dimensionless crop water demand index into
 * millimetres, so the demand can be compared with the rainfall that actually falls.
 */
const MM_PER_WATER_UNIT_MONTH = 125;

function scoreWaterFit(sequence, agronomy, profile, rainFactor) {
  const months = profile.months;
  const annual = months.reduce((a, m) => a + (m.precip_mm ?? 0), 0) * rainFactor;
  let demandMm = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    demandMm += (c.water_demand ?? 0.5) * (c.duration_months || 0) * MM_PER_WATER_UNIT_MONTH;
  }
  const ratio = demandMm / Math.max(annual, 1);
  const score = ramp(ratio, [
    [0.20, 1], [0.55, 0.95], [0.80, 0.7], [1.00, 0.4], [1.30, 0.12], [1.80, 0],
  ]);
  return {
    score: score ?? 0,
    raw: {
      annual_rain_mm: Math.round(annual),
      demand_mm: Math.round(demandMm),
      ratio: Number(ratio.toFixed(2)),
    },
    detail_en: `This rotation needs about ${Math.round(demandMm).toLocaleString()} mm of water over the year, and the field gets about ${Math.round(annual).toLocaleString()} mm of rain. ${ratio <= 0.8 ? 'That leaves a comfortable margin.' : ratio <= 1 ? 'That is tight, a dry year would hurt.' : 'That is more than the rain can supply, so this rotation needs irrigation or a drier set of crops.'}`,
    detail_bis: `Nagtukod og mga ${Math.round(demandMm).toLocaleString()} mm nga tubig sa rotation niini, ug ang uma nakadawat og mga ${Math.round(annual).toLocaleString()} mm nga ulan. ${ratio <= 0.8 ? 'May kasaligan pa.' : ratio <= 1 ? 'Konting kulang, ang tuig nga katag makaputol.' : 'Labaw sa ulan, so kinahanglan nga irrigation o mas katag nga tanom.'}`,
  };
}

function scoreSoilCover(sequence, agronomy) {
  let cover = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    cover += (c.soil_cover ?? 0.5) * (c.duration_months || 0);
  }
  const coverMonths = Math.min(12, cover);
  return {
    score: coverMonths / 12,
    raw: { covered_months: Number(coverMonths.toFixed(1)), bare_months: Number((12 - coverMonths).toFixed(1)) },
    detail_en: `Roughly ${coverMonths.toFixed(0)} of the 12 months have a crop or cover over the soil, leaving about ${(12 - coverMonths).toFixed(0)} months of bare ground where rain can wash the topsoil away.`,
    detail_bis: `Mga ${coverMonths.toFixed(0)} sa 12 ka bulan adunay crop o cover sa yuta, mga ${(12 - coverMonths).toFixed(0)} ka bulan nga walay tanom ang yuta asa makatilaw ang ulan sa ibabaw nga yuta.`,
  };
}

function scoreNitrogen(sequence, agronomy) {
  let balance = 0;
  let fixers = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    const share = (c.duration_months || 0) / 12;
    if (c.fixes_nitrogen) {
      balance += 1.2 * share;
      fixers += 1;
    } else {
      balance -= (c.nitrogen_demand ?? 0.5) * share;
    }
  }
  const score = ramp(balance, [[-0.8, 0], [-0.3, 0.25], [0, 0.5], [0.3, 0.75], [0.7, 1]]);
  return {
    score: score ?? 0.5,
    raw: { nitrogen_balance: Number(balance.toFixed(2)), nitrogen_fixing_crops: fixers },
    detail_en: fixers
      ? `${fixers} legume in this rotation puts nitrogen back into the soil after the hungry crop takes it out.`
      : 'No nitrogen fixing crop in this rotation, so the soil keeps losing nitrogen every season.',
    detail_bis: fixers
      ? `${fixers} ka legume sa rotation niini mao ang nakaibalik og nitrogen sa yuta human maubos ang matapog nga tanom.`
      : 'Walay legume nga nagbalik og nitrogen sa rotation niini, so ka season mawadto ang yuta og nitrogen.',
  };
}

function scoreErosion(sequence, agronomy, cell) {
  const slope = cell.slope_deg ?? 8;
  const slopeFactor = 1 + Math.min(slope, 30) / 18;
  let pressure = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    pressure += (c.erosion_sensitivity ?? 0.4) * ((c.duration_months || 0) / 12);
  }
  pressure *= slopeFactor;
  const score = ramp(pressure, [[0.3, 1], [0.7, 0.7], [1.1, 0.4], [1.6, 0.15], [2.2, 0]]);
  return {
    score: score ?? 0.5,
    raw: { erosion_pressure: Number(pressure.toFixed(2)), slope_deg: cell.slope_deg ?? null },
    detail_en: `With ${slope.toFixed(1)} degrees of slope, the bare months in this rotation are the erosion risk. Cover crops and terraces cut that.`,
    detail_bis: `Sa ${slope.toFixed(1)} grados nga tilt, ang mga bulan nga walay tanom sa rotation niini ang risk sa erosion. Ang cover crop ug terrasa makapugong niini.`,
  };
}

function scorePestBreak(sequence, agronomy) {
  const fams = families(sequence, agronomy);
  const distinct = new Set(fams).size;
  let repeats = 0;
  for (let i = 1; i < fams.length; i += 1) if (fams[i] === fams[i - 1]) repeats += 1;
  let score = ramp(distinct, [[1, 0.1], [2, 0.45], [3, 0.8], [4, 1]]);
  if (repeats) score = Math.max(0, score - repeats * 0.25);
  const ubeIndex = sequence.indexOf('ube');
  const sameFamilyAfter = ubeIndex >= 0 && fams.some((f, i) => i > ubeIndex && f === agronomy.ube.traits.pest_family);
  if (sameFamilyAfter) score = Math.max(0, score - 0.4);
  return {
    score: score ?? 0,
    raw: { distinct_families: distinct, same_family_repeats: repeats },
    detail_en: `${distinct} different plant famil${distinct === 1 ? 'y' : 'ies'} in this rotation. ${sameFamilyAfter ? 'Careful: a crop from the yam family follows the ube, which carries the same disease risk.' : 'Different families do not share the same soil-borne pests.'}`,
    detail_bis: `${distinct} ka lain nga pamilya sa tanom sa rotation niini. ${sameFamilyAfter ? 'Pagkatiya: usa ka tanom sa pamilya sa yam ang nakaabot human sa ube, naa sila sama nga risk sa sakit.' : 'Lain nga pamilya wala sila sama nga peste sa yuta.'}`,
  };
}

function scoreIncome(sequence, agronomy) {
  let value = 0;
  let harvests = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    const share = (c.duration_months || 0) / 12;
    value += (c.market_value_index ?? 0.4) * share;
    if ((c.duration_months || 0) > 0) harvests += 1;
  }
  const score = ramp(value, [[0.15, 0], [0.4, 0.3], [0.7, 0.6], [1.0, 0.85], [1.3, 1]]);
  return {
    score: score ?? 0,
    raw: { market_value_index: Number(value.toFixed(2)), marketable_harvests: harvests },
    detail_en: `${harvests} marketable harvest${harvests === 1 ? '' : 's'} a year from this rotation, with ube as the highest value crop of the set.`,
    detail_bis: `${harvests} ka marketable nga ani sa tuig gikan sa rotation niini, ug ang ube ang tanom nga labing dako ang kita niini.`,
  };
}

function scoreClimateRisk(sequence, agronomy, profile) {
  const months = profile.months;
  const t = normThresholds(agronomy.ube.thresholds);
  // The MERRA-2 root zone wetness index is dimensionless, so the risk flags are driven
  // by rainfall, which has an unambiguous unit, with wetness used only to sharpen it.
  const heatMonths = months.filter((m) => (m.tmax ?? 0) > t.air_temp_c.heat_stress).length;
  const wetMonths = months.filter((m) => (m.precip_mm ?? 0) >= t.waterlogging_monthly_rain_mm).length;
  const dryMonths = months.filter((m) => (m.precip_mm ?? 0) < t.drought_monthly_rain_mm).length;
  let risk = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    const share = (c.duration_months || 0) / 12;
    risk += share * (
      (c.heat_susceptibility ?? 0.5) * (heatMonths / 12) +
      (c.waterlogging_susceptibility ?? 0.4) * (wetMonths / 12) +
      (c.drought_susceptibility ?? 0.4) * (dryMonths / 12)
    );
  }
  risk *= 3;
  const score = ramp(risk, [[0.15, 1], [0.45, 0.75], [0.8, 0.45], [1.2, 0.2], [1.8, 0]]);
  return {
    score: score ?? 0.5,
    raw: { heat_months: heatMonths, heavy_rain_months: wetMonths, drought_months: dryMonths, risk_index: Number(risk.toFixed(2)) },
    detail_en: `At this location there ${heatMonths === 1 ? 'is' : 'are'} ${heatMonths} heat month${heatMonths === 1 ? '' : 's'}, ${wetMonths} month${wetMonths === 1 ? '' : 's'} with heavy rain above ${t.waterlogging_monthly_rain_mm} mm, and ${dryMonths} dry month${dryMonths === 1 ? '' : 's'} under ${t.drought_monthly_rain_mm} mm. The risk depends on which crops sit in the field during those months.`,
    detail_bis: `Sa niini nga lugar, ${heatMonths} ka bulan sa init, ${wetMonths} ka bulan nga kusog nga ulan (labaw sa ${t.waterlogging_monthly_rain_mm} mm), ug ${dryMonths} ka bulan nga katag (ubos sa ${t.drought_monthly_rain_mm} mm). Depende sa unsang tanom nga anaa sa uma sa mga bulang naa.`,
  };
}

function scoreLabour(sequence, agronomy) {
  let units = 0;
  for (const id of sequence) {
    const c = CROP(agronomy, id);
    if (!c) continue;
    units += (c.duration_months || 0) / 12;
  }
  units += 0.28 * Math.max(0, sequence.length - 1);
  const score = ramp(units, [[0.8, 1], [1.4, 0.75], [2.0, 0.5], [2.6, 0.25], [3.4, 0.05]]);
  return {
    score: score ?? 0.5,
    raw: { labour_index: Number(units.toFixed(2)), crops: sequence.length },
    detail_en: `${sequence.length} crop${sequence.length === 1 ? '' : 's'} to plant, tend and harvest. More crops means more work days and more chances to be caught out by the weather.`,
    detail_bis: `${sequence.length} ka tanim nga tanom, atong, ug ani. Mas daghan nga tanim, mas daghan nga trabaho ug mas daghan nga risgo sa panahon.`,
  };
}

/**
 * Score every rotation for a cell.
 * @param {object} cell grid cell
 * @param {object} agronomy parsed agronomy.json
 * @param {object} profile result of monthlyProfile/classifySeasons
 * @param {object} farmer { currentCrop, priorities:{income,water,soil,labour}, irrigation }
 * @param {object} opts { scenarioRainFactor, scenarioTempDelta }
 */
export function scoreRotations(cell, agronomy, profile, farmer, opts = {}) {
  const rainFactor = opts.scenarioRainFactor ?? 1;
  const existing = existingRotation(farmer, agronomy);
  const library = agronomy.rotation_library.filter((r) => r.kind === 'alternative');
  const rotations = [existing, ...library];

  const ahp = ahpWeights(ROTATION_MATRIX);
  const priorities = farmer.priorities || { income: 0.5, water: 0.5, soil: 0.5, labour: 0.5 };
  const weights = blendWeights(ahp.weights, priorities);

  const scored = rotations.map((rot) => {
    const dims = {
      water_fit: scoreWaterFit(rot.sequence, agronomy, profile, rainFactor),
      soil_cover: scoreSoilCover(rot.sequence, agronomy),
      nitrogen: scoreNitrogen(rot.sequence, agronomy),
      erosion: scoreErosion(rot.sequence, agronomy, cell),
      pest_break: scorePestBreak(rot.sequence, agronomy),
      income: scoreIncome(rot.sequence, agronomy),
      climate_risk: scoreClimateRisk(rot.sequence, agronomy, profile),
      labour: scoreLabour(rot.sequence, agronomy),
    };
    let total = 0;
    let wsum = 0;
    const detail = {};
    for (const [k, v] of Object.entries(dims)) {
      const w = weights[k] ?? ahp.weights[k] ?? 0;
      total += v.score * w;
      wsum += w;
      detail[k] = { score: Number(v.score.toFixed(3)), weight: Number(w.toFixed(4)), raw: v.raw, detail_en: v.detail_en, detail_bis: v.detail_bis };
    }
    const totalScore = wsum ? total / wsum : 0;

    const sortedDims = Object.entries(detail).sort((a, b) => b[1].score - a[1].score);
    const weakest = sortedDims[sortedDims.length - 1];

    return {
      id: rot.id,
      kind: rot.kind,
      name_en: rot.name_en,
      name_bis: rot.name_bis,
      name_fil: rot.name_fil,
      sequence: rot.sequence,
      why_en: rot.why_en,
      why_bis: rot.why_bis,
      benefits_en: rot.benefits_en ?? [],
      benefits_bis: rot.benefits_bis ?? [],
      gaps_en: rot.gaps_en ?? [],
      risks_en: rot.risks_en ?? [],
      gaps_bis: rot.gaps_bis ?? [],
      risks_bis: rot.risks_bis ?? [],
      score: Number((totalScore * 100).toFixed(1)),
      dimensions: detail,
      top_strength: { id: sortedDims[0][0], ...sortedDims[0][1] },
      weakest: { id: weakest[0], ...weakest[1] },
    };
  });

  const max = Math.max(...scored.map((s) => s.score), 1);
  for (const s of scored) {
    s.normalised = Number(((s.score / max) * 100).toFixed(1));
    s.recommendation = s.kind === 'existing' ? 'current' : s.score >= 60 ? 'recommended' : s.score >= 45 ? 'possible' : 'weak';
  }
  scored.sort((a, b) => b.score - a.score);
  return { rotations: scored, weights, ahp };
}
