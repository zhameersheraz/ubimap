/**
 * Engine sanity test. Run with:
 *   npx vite build --ssr scripts/test_engine.mjs --outDir .tmp-test
 *   node .tmp-test/test_engine.mjs
 */
import agronomyData from '../src/data/agronomy.json';
import gridData from '../data/pilot_grid.json';
import { ahpWeights, SUITABILITY_MATRIX, ROTATION_MATRIX, blendWeights } from '../src/engine/ahp.js';
import { evaluateCell, monthlyProfile, classifySeasons, longestDryRun } from '../src/engine/suitability.js';
import { scoreRotations } from '../src/engine/rotations.js';

let failures = 0;
function check(label, cond, extra = '') {
  const ok = !!cond;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
}

console.log('='.repeat(78));
console.log('AHP CONSISTENCY');
console.log('='.repeat(78));
const a1 = ahpWeights(SUITABILITY_MATRIX);
const a2 = ahpWeights(ROTATION_MATRIX);
console.log('suitability weights:', JSON.stringify(a1.weights, null, 0));
console.log(`  lambda_max=${a1.lambdaMax} CR=${a1.cr} RI=${a1.ri} consistent=${a1.consistent}`);
console.log('rotation weights   :', JSON.stringify(a2.weights, null, 0));
console.log(`  lambda_max=${a2.lambdaMax} CR=${a2.cr} RI=${a2.ri} consistent=${a2.consistent}`);
check('suitability CR <= 0.10', a1.cr <= 0.1, `CR=${a1.cr}`);
check('rotation CR <= 0.10', a2.cr <= 0.1, `CR=${a2.cr}`);
check('suitability weights sum to 1', Math.abs(Object.values(a1.weights).reduce((x, y) => x + y, 0) - 1) < 1e-9);
check('rotation weights sum to 1', Math.abs(Object.values(a2.weights).reduce((x, y) => x + y, 0) - 1) < 1e-9);

console.log();
console.log('='.repeat(78));
console.log('GRID COVERAGE');
console.log('='.repeat(78));
const cells = gridData.cells;
const withClimate = cells.filter((c) => c.climate).length;
const withSoil = cells.filter((c) => c.soil).length;
const withSlope = cells.filter((c) => c.slope_deg !== null && c.slope_deg !== undefined).length;
const withMoist = cells.filter((c) => c.soil_moisture?.gwetroot_monthly?.some((v) => v !== null)).length;
console.log(`cells=${cells.length} climate=${withClimate} soil=${withSoil} slope=${withSlope} monthlyMoisture=${withMoist}`);
check('every cell has POWER climate', withClimate === cells.length, `${withClimate}/${cells.length}`);
check('most cells have soil', withSoil / cells.length > 0.8, `${withSoil}/${cells.length}`);
check('every cell has slope', withSlope === cells.length, `${withSlope}/${cells.length}`);

console.log();
console.log('='.repeat(78));
console.log('SUITABILITY SCORE SPREAD (the map must not be flat)');
console.log('='.repeat(78));
const scored = cells.map((c) => ({ c, r: evaluateCell(c, agronomyData) }));
const vals = scored.map((s) => s.r.score);
const min = Math.min(...vals);
const max = Math.max(...vals);
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
console.log(`min=${min.toFixed(1)} mean=${mean.toFixed(1)} max=${max.toFixed(1)}`);
const bands = {};
for (const v of vals) {
  const b = v >= 75 ? 'excellent' : v >= 58 ? 'good' : v >= 40 ? 'fair' : 'poor';
  bands[b] = (bands[b] || 0) + 1;
}
console.log('band spread:', JSON.stringify(bands));
check('scores vary across the grid', max - min > 8, `spread=${(max - min).toFixed(1)}`);
check('scores are inside 0..100', min >= 0 && max <= 100);

console.log();
console.log('='.repeat(78));
console.log('DEMO CELL (Pagadian centre)');
console.log('='.repeat(78));
let demo = null;
let bestD = Infinity;
for (const c of cells) {
  const d = (c.lat - 7.8397) ** 2 + (c.lon - 123.4373) ** 2;
  if (d < bestD) { bestD = d; demo = c; }
}
const res = evaluateCell(demo, agronomyData);
console.log(`cell ${demo.id} lat=${demo.lat} lon=${demo.lon} score=${res.score} band=${res.band} conf=${res.confidence.level}`);
console.log('factors:');
for (const f of res.factors) {
  console.log(`  ${f.id.padEnd(15)} w=${(f.weight * 100).toFixed(1)}% score=${f.score ?? 'n/a'} contrib=${f.contribution ?? 'missing'}  [${f.dataset}]`);
}
console.log('reasons:');
for (const r of res.reasons) console.log(`  + ${r.id}: ${r.detail_en}`);
console.log('concerns:');
for (const r of res.concerns) console.log(`  - ${r.id}: ${r.detail_en}`);
check('demo cell produced a score', res.score > 0 && res.score <= 100, `${res.score}`);
check('every factor has a dataset name', res.factors.every((f) => f.dataset && f.dataset.length > 3));

console.log();
console.log('='.repeat(78));
console.log('SEASONS AND CALENDAR');
console.log('='.repeat(78));
const prof = res.profile;
const months = prof.months;
console.log('month  rain_mm  tmax  gwetroot  season');
months.forEach((m) => {
  console.log(
    `  ${String(m.label_en).padEnd(5)} ${String(Math.round(m.precip_mm ?? -1)).padStart(6)} ${String((m.tmax ?? -1).toFixed(1)).padStart(6)} ${String((m.gwetroot ?? -1).toFixed(3)).padStart(8)}  ${m.season}`,
  );
});
const wetCount = months.filter((m) => m.season === 'wet').length;
const dryCount = months.filter((m) => m.season === 'dry').length;
console.log(`wet months=${wetCount} dry months=${dryCount} annual=${prof.annual_mm}mm`);
check('seasons were classified', wetCount + dryCount > 0, `wet=${wetCount} dry=${dryCount}`);
check('annual rainfall is plausible for the Philippines', prof.annual_mm > 800 && prof.annual_mm < 4000, `${prof.annual_mm}mm`);

console.log();
console.log('='.repeat(78));
console.log('ROTATION SCORING');
console.log('='.repeat(78));
const farmer = {
  currentCrop: 'corn',
  areaHa: 1,
  priorities: { income: 0.8, water: 0.5, soil: 0.6, labour: 0.3 },
  irrigation: false,
};
const rot = scoreRotations(demo, agronomyData, prof, farmer, {});
console.log(`rotation weights: ${JSON.stringify(Object.fromEntries(Object.entries(rot.weights).map(([k, v]) => [k, Number(v.toFixed(3))])))}`);
for (const r of rot.rotations) {
  console.log(`\n${r.id}  score=${r.score}  rec=${r.recommendation}`);
  console.log(`  sequence: ${r.sequence.join(' -> ')}`);
  for (const [k, v] of Object.entries(r.dimensions)) {
    console.log(`    ${k.padEnd(13)} ${String(v.score).padEnd(6)} raw=${JSON.stringify(v.raw)}`);
  }
}
check('four rotations compared', rot.rotations.length >= 4, `${rot.rotations.length}`);
check('the existing rotation is present', rot.rotations.some((r) => r.kind === 'existing'));
check('every rotation scored 0..100', rot.rotations.every((r) => r.score >= 0 && r.score <= 100));
const ub = rot.rotations.find((r) => r.id === 'R_UBE_LEGUME');
const ex = rot.rotations.find((r) => r.kind === 'existing');
check('a ube rotation beats the existing corn-corn on soil health',
  ub.dimensions.pest_break.score > ex.dimensions.pest_break.score,
  `ube=${ub.dimensions.pest_break.score} existing=${ex.dimensions.pest_break.score}`);
check('a ube rotation beats corn-corn on nitrogen',
  ub.dimensions.nitrogen.score > ex.dimensions.nitrogen.score,
  `ube=${ub.dimensions.nitrogen.score} existing=${ex.dimensions.nitrogen.score}`);

console.log();
console.log('='.repeat(78));
console.log('SCENARIO REACTION (rain down 20 percent, temperature up 3 C)');
console.log('='.repeat(78));
const dry = evaluateCell(demo, agronomyData, { scenarioRainFactor: 0.8 });
console.log(`normal rain: score=${res.score} band=${res.band}`);
console.log(`rain -20%:   score=${dry.score} band=${dry.band}`);
const hot = evaluateCell(demo, agronomyData, { scenarioTempDelta: 3 });
console.log(`temp +3C:    score=${hot.score} band=${hot.band}`);

const smOf = (r) => r.factors.find((f) => f.id === 'soil_moisture');
console.log(`  waterlogging months: normal ${smOf(res).raw.waterlogging_months}, drier ${smOf(dry).raw.waterlogging_months}`);

// The direction is not always down, and that is correct rather than a bug. Ube tubers
// rot in waterlogged soil, so in a location that is already too wet, less rain means
// less rot and the score can rise. The rule that must always hold is that the model
// responds to the scenario and that the waterlogging risk falls when the rain falls.
check('the model responds to the rainfall scenario', Math.abs(dry.score - res.score) > 0.5,
  `${res.score} -> ${dry.score}`);
check('a drier climate reduces the waterlogging months',
  smOf(dry).raw.waterlogging_months < smOf(res).raw.waterlogging_months,
  `${smOf(res).raw.waterlogging_months} -> ${smOf(dry).raw.waterlogging_months}`);
check('a hotter climate lowers the suitability score', hot.score < res.score, `${hot.score} < ${res.score}`);

console.log();
console.log('='.repeat(78));
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
console.log('='.repeat(78));
process.exit(failures === 0 ? 0 : 1);
