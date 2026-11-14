/**
 * Analytic Hierarchy Process (AHP) weights with a published consistency check.
 *
 * The pairwise judgements below are the team's expert judgement, recorded explicitly so
 * they can be argued with. AHP is only honest if the matrix is visible and the
 * consistency ratio is reported, so both are exposed to the UI.
 *
 * Method: geometric mean approximation of the principal eigenvector, then
 * lambda_max from A*w, then CR = (lambda_max - n) / (RI * (n - 1)).
 */

/** Saaty random index, the consistency benchmark for each matrix size. */
export const RANDOM_INDEX = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

export const CONSISTENCY_LIMIT = 0.1;

/**
 * Pairwise judgements for ube suitability.
 * Rows are factors, columns are factors, value = how much more important the row factor
 * is than the column factor (Saaty 1-9 scale: 1 equal, 3 moderate, 5 strong, 9 extreme).
 */
export const SUITABILITY_MATRIX = {
  factors: [
    { id: 'rainfall', label_en: 'Rainfall pattern and dry maturation window', label_bis: 'Patron sa ulan ug dry maturation window', dataset: 'GPM IMERG (NASA GIBS)' },
    { id: 'soil_moisture', label_en: 'Root zone soil moisture', label_bis: 'Katog sa yuta sa lawas sa gamot', dataset: 'NASA POWER (GWETROOT)' },
    { id: 'temperature', label_en: 'Temperature and heat stress', label_bis: 'Temperatura ug stress sa init', dataset: 'NASA POWER (T2M_MAX)' },
    { id: 'slope', label_en: 'Slope and erosion risk', label_bis: 'Kantidad ug risk sa erosion', dataset: 'NASA SRTM' },
    { id: 'soil_ph', label_en: 'Soil pH', label_bis: 'pH sa yuta', dataset: 'ISRIC SoilGrids' },
    { id: 'drainage', label_en: 'Soil texture and drainage', label_bis: 'Textura ug drainage sa yuta', dataset: 'ISRIC SoilGrids' },
  ],
  // A[i][j] = importance of factor i relative to factor j
  A: [
    [1, 2, 2, 3, 2, 2],
    [1 / 2, 1, 2, 2, 2, 3],
    [1 / 2, 1 / 2, 1, 2, 1, 1],
    [1 / 3, 1 / 2, 1 / 2, 1, 1, 2],
    [1 / 2, 1 / 2, 1, 1, 1, 1],
    [1 / 2, 1 / 3, 1, 1 / 2, 1, 1],
  ],
};

/**
 * Compute AHP weights and the consistency ratio.
 * @returns {{weights: Object<string, number>, lambdaMax: number, cr: number, ri: number, n: number, consistent: boolean}}
 */
export function ahpWeights({ factors, A }) {
  const n = factors.length;
  if (A.length !== n) throw new Error('AHP: matrix size does not match factor list');

  // geometric mean row products
  const gm = A.map((row) => {
    let prod = 1;
    for (const v of row) prod *= v;
    return Math.pow(prod, 1 / n);
  });
  const total = gm.reduce((a, b) => a + b, 0);
  const w = gm.map((g) => g / total);

  // lambda_max = sum_i (A*w)_i / w_i
  let lambdaMax = 0;
  for (let i = 0; i < n; i += 1) {
    let aw = 0;
    for (let j = 0; j < n; j += 1) aw += A[i][j] * w[j];
    lambdaMax += aw / w[i];
  }
  lambdaMax /= n;

  const ri = RANDOM_INDEX[n] ?? 1.49;
  const cr = (lambdaMax - n) / (ri * (n - 1));

  const weights = {};
  factors.forEach((f, i) => {
    weights[f.id] = w[i];
  });

  return {
    weights,
    lambdaMax: Number(lambdaMax.toFixed(4)),
    cr: Number(cr.toFixed(4)),
    ri,
    n,
    consistent: cr <= CONSISTENCY_LIMIT,
  };
}

/** Weights for the rotation comparison dimensions. */
export const ROTATION_MATRIX = {
  factors: [
    { id: 'water_fit', label_en: 'Fits your water', label_bis: 'Naayay sa imong tubig' },
    { id: 'soil_cover', label_en: 'Soil cover', label_bis: 'Tabon sa yuta' },
    { id: 'nitrogen', label_en: 'Nitrogen balance', label_bis: 'Balance sa nitrogen' },
    { id: 'erosion', label_en: 'Erosion protection', label_bis: 'Proteksyon sa erosion' },
    { id: 'pest_break', label_en: 'Breaks pest cycles', label_bis: 'Pagbasak sa siklo sa peste' },
    { id: 'income', label_en: 'Income potential', label_bis: 'Potensyal sa kita' },
    { id: 'climate_risk', label_en: 'Climate risk', label_bis: 'Risk sa klima' },
  ],
  A: [
    [1, 2, 2, 2, 1, 2, 1],
    [1 / 2, 1, 1, 2, 1, 1, 1],
    [1 / 2, 1, 1, 1, 1, 2, 1],
    [1 / 2, 1 / 2, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1 / 2, 1, 1 / 2, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
};

/**
 * Blend the base rotation weights with the farmer's stated priorities.
 * Priority weights are 0..1 sliders; each dimension maps to one or more priorities.
 */
export const PRIORITY_MAP = {
  water_fit: ['water'],
  soil_cover: ['soil'],
  nitrogen: ['soil'],
  erosion: ['soil'],
  pest_break: ['soil'],
  income: ['income'],
  climate_risk: ['water', 'soil'],
  labour: ['labour'],
};

export function blendWeights(base, priorities) {
  const out = {};
  const entries = Object.entries(base);
  let total = 0;
  for (const [id, w] of entries) {
    const linked = PRIORITY_MAP[id] || [];
    const boost = linked.length
      ? linked.reduce((a, k) => a + (priorities[k] ?? 0.5), 0) / linked.length
      : 0.5;
    // blend: half the base weight, half driven by the farmer
    const blended = 0.5 * w + 0.5 * boost * w * 2;
    out[id] = blended;
    total += blended;
  }
  for (const id of Object.keys(out)) out[id] = out[id] / total;
  return out;
}
