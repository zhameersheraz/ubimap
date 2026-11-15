/**
 * Loading and querying the precomputed NASA feature grid.
 *
 * The grid was produced by scripts/build_pilot_grid.py and scripts/enrich_grid.py.
 * It ships with the app so the tool works with no network at all. The app never
 * invents a value: if a cell has no soil data, the engine says so.
 */
import gridData from '../../data/pilot_grid.json';
import agronomyData from '../data/agronomy.json';
import nasaLayersData from '../data/nasaLayers.json';

export const GRID = gridData;
export const AGRONOMY = agronomyData;
export const NASA_LAYERS = nasaLayersData.layers || {};
export const GRID_META = gridData.meta || {};

/** Grid cell whose centre is closest to a point. */
export function nearestCell(lat, lon) {
  const cells = GRID.cells;
  if (!cells?.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const c of cells) {
    const dLat = c.lat - lat;
    const dLon = (c.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  const step = best.step || GRID_META.step_deg || 0.02;
  // how far the pin is from the cell centre, in kilometres
  const dxKm = (best.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const dyKm = (best.lat - lat) * 111.32;
  return {
    cell: best,
    offsetKm: Math.sqrt(dxKm * dxKm + dyKm * dyKm),
    cellKm: step * 111.32,
  };
}

/** The grid as a GeoJSON FeatureCollection, for the MapLibre suitability layer. */
export function gridGeoJSON(scoreFn) {
  const features = GRID.cells.map((c) => {
    const props = {
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      elev_m: c.elev_m ?? null,
      slope_deg: c.slope_deg ?? null,
      ph: c.soil?.phh2o ?? null,
      clay: c.soil?.clay ?? null,
      annual_mm: c.climate?.precip_mm_day
        ? Number(c.climate.precip_mm_day.reduce((a, b) => a + (b ?? 0), 0).toFixed(1))
        : null,
    };
    if (scoreFn) {
      const s = scoreFn(c);
      props.score = s?.score ?? null;
      props.band = s?.band ?? null;
    }
    return {
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'Point',
        coordinates: [c.lon, c.lat],
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

/**
 * The pilot field used by the demo button.
 *
 * Pagadian's city centre falls on a SoilGrids pixel with no data, because that pixel is
 * sea. The demo point is therefore the nearest grid cell that actually has soil, so the
 * demo never opens on a cell with a hole in it. The offset from the city centre is
 * about a kilometre and is still inside Pagadian City.
 */
function pickDemoField() {
  const target = { lat: 7.8397, lon: 123.4373 };
  let best = null;
  let bestScore = Infinity;
  for (const c of GRID.cells || []) {
    const soil = c.soil || {};
    const has = Object.keys(soil).filter((k) => !k.startsWith('_')).length >= 3;
    if (!has) continue;
    const d = (c.lat - target.lat) ** 2 + (c.lon - target.lon) ** 2;
    if (d < bestScore) {
      bestScore = d;
      best = c;
    }
  }
  if (!best) {
    return { ...target, name: 'Demo field, Pagadian City', currentCrop: 'corn' };
  }
  return {
    name: 'Demo field, Pagadian City',
    lat: best.lat,
    lon: best.lon,
    currentCrop: 'corn',
    offset_from_city_centre_km: Number((Math.sqrt(bestScore) * 111).toFixed(2)),
    cell: best.id,
  };
}

export const DEMO_FIELD = pickDemoField();

/** Provenance rows for the sources screen. */
export function provenanceRows() {
  const m = GRID_META;
  return [
    {
      name: 'NASA POWER (agro climatology)',
      mission: 'NASA / MERRA-2 and CERES',
      used_for: 'Monthly rainfall, temperature, humidity, solar radiation and root zone soil moisture for every grid cell',
      url: 'https://power.larc.nasa.gov/api/temporal/climatology/point',
      resolution: 'about 50 km, monthly',
      retrieved: m.retrieved_philippine || m.retrieved_utc || '2026-11-14',
      auth: 'none',
      live: 'Baked into the app, re-fetchable with the link on each cell',
    },
    {
      name: 'NASA POWER (monthly soil moisture)',
      mission: 'NASA / MERRA-2',
      used_for: 'Root zone (GWETROOT) and surface (GWETTOP) soil moisture, 2015 to 2024 monthly means, used for the waterlogging and drought risk',
      url: 'https://power.larc.nasa.gov/api/temporal/monthly/point',
      resolution: 'about 50 km, monthly',
      retrieved: m.retrieved_philippine || m.retrieved_utc || '2026-11-14',
      auth: 'none',
      live: 'Baked into the app, re-fetchable with the link on each cell',
    },
    {
      name: 'NASA SRTM',
      mission: 'Shuttle Radar Topography Mission',
      used_for: 'Elevation and slope, which set the erosion risk and the drainage rating',
      url: 'https://api.opentopodata.org/v1/srtm30m',
      resolution: '30 m',
      retrieved: m.enriched_philippine || m.retrieved_philippine || '2026-11-14',
      auth: 'none',
      live: 'Baked into the app',
    },
    {
      name: 'ISRIC SoilGrids 2.0',
      mission: 'ISRIC World Soil Information',
      used_for: 'Soil pH, clay, sand, silt, organic carbon, bulk density and cation exchange capacity',
      url: 'https://rest.isric.org/soilgrids/v2.0/properties/query',
      resolution: '250 m, 0 to 30 cm',
      retrieved: m.enriched_philippine || m.retrieved_philippine || '2026-11-14',
      auth: 'none',
      live: 'Baked into the app',
    },
    ...Object.values(NASA_LAYERS).map((l) => ({
      name: l.label_en,
      mission: l.mission,
      used_for: l.what_en,
      url: l.source_page,
      resolution: l.resolution,
      retrieved: l.time || 'live tile service',
      auth: 'none',
      live: 'LIVE in the browser, rendered straight from NASA GIBS',
    })),
    {
      name: 'NASA CMR (Common Metadata Repository)',
      mission: 'NASA EOSDIS',
      used_for: 'Dataset metadata and concept ids, used to prove which collection each layer belongs to',
      url: 'https://cmr.earthdata.nasa.gov/search/collections.json',
      resolution: 'metadata',
      retrieved: '2026-11-14',
      auth: 'none',
      live: 'Metadata only, pixel download needs Earthdata Login',
    },
  ];
}
