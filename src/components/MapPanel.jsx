import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { NASA_LAYERS, gridGeoJSON } from '../engine/grid.js';

/**
 * The map: a plain raster style so no Mapbox account or token is needed, with the NASA
 * GIBS layers drawn straight from NASA's tile service, our own suitability grid on top,
 * and real terrain from the SRTM derived elevation tiles so the land reads in three
 * dimensions.
 *
 * The basemap is Esri's canvas tiles, which are served without an API key. The previous
 * CARTO basemap started returning an "API KEY REQUIRED" watermark tile, so it was
 * replaced. There is a dark and a light variant so the map matches the interface theme.
 */
const BASEMAP = {
  dark: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  light: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
};

const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community';

function baseStyle(theme) {
  const tiles = BASEMAP[theme] || BASEMAP.dark;
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: [tiles.base],
        tileSize: 256,
        attribution: ATTRIBUTION,
        maxzoom: 16,
      },
      labels: {
        type: 'raster',
        tiles: [tiles.labels],
        tileSize: 256,
        maxzoom: 16,
      },
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base' },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  };
}

/** SRTM derived elevation tiles, the same terrain NASA SRTM is built from. */
const TERRAIN_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 13,
  attribution: 'Elevation: SRTM via AWS Terrain Tiles',
};

export default function MapPanel({
  lang,
  theme = 'dark',
  center,
  zoom = 10.4,
  onPick,
  scoreFn,
  activeLayer,
  onLayerChange,
  showHeatmap,
  onToggleHeatmap,
  pin,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [terrain, setTerrain] = useState(true);
  // The map opens flat. A tilted view looked impressive but it hid the field
  // shape that the whole tool is about, and on a phone it was unreadable.
  // The 3D toggle is one tap away.
  const [view3d, setView3d] = useState(false);

  const geo = useMemo(() => gridGeoJSON(scoreFn), [scoreFn]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle(theme),
        center: [center.lon, center.lat],
        zoom,
        attributionControl: false,
        maxZoom: 16,
        pitchWithRotate: true,
        dragRotate: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('error', (e) => {
        if (e?.error?.message && /Failed to load|tile/i.test(e.error.message)) return;
        setMapError(e?.error?.message || 'Map error');
      });

      map.on('load', () => {
        map.addSource('ubimap-grid', { type: 'geojson', data: geo });
        map.addLayer({
          id: 'ubimap-heat',
          type: 'circle',
          source: 'ubimap-grid',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 11, 8, 14, 13],
            'circle-color': [
              'case',
              ['==', ['get', 'score'], null],
              'rgba(0,0,0,0)',
              ['step', ['get', 'score'], '#b3261e', 40, '#e08214', 55, '#f2c94c', 70, '#7cb342', 85, '#1b5e20'],
            ],
            'circle-opacity': ['case', ['==', ['get', 'score'], null], 0.0, 0.45],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        });
        map.setLayoutProperty('ubimap-heat', 'visibility', 'none');

        // real terrain, from the SRTM derived elevation tiles
        map.addSource('ubimap-dem', TERRAIN_SOURCE);
        map.setTerrain({ source: 'ubimap-dem', exaggeration: 1.25 });
        map.setPitch(0);
        map.setBearing(0);

        map.on('click', 'ubimap-heat', (e) => {
          const f = e.features?.[0];
          if (f && onPick) onPick({ lat: f.properties.lat, lon: f.properties.lon });
        });
        map.on('mouseenter', 'ubimap-heat', () => { map.getCanvas().style.cursor = 'crosshair'; });
        map.on('mouseleave', 'ubimap-heat', () => { map.getCanvas().style.cursor = ''; });
        map.on('click', (e) => {
          if (e.features?.length) return;
          if (onPick) onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        });
        setReady(true);
      });
      mapRef.current = map;
    } catch (err) {
      setMapError(err?.message || 'Could not start the map');
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('ubimap-grid');
    if (src) src.setData(geo);
  }, [geo, ready]);

  // swap the basemap when the interface theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const tiles = BASEMAP[theme] || BASEMAP.dark;
    const base = map.getSource('base');
    if (base) {
      base.setTiles([tiles.base]);
      // nudge the map so the new tiles are requested straight away
      map.triggerRepaint();
    }
  }, [theme, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty('ubimap-heat', 'visibility', showHeatmap ? 'visible' : 'none');
  }, [showHeatmap, ready]);

  // NASA layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [id, layer] of Object.entries(NASA_LAYERS)) {
      const srcId = `nasa-${id}`;
      if (!map.getSource(srcId)) {
        map.addSource(srcId, {
          type: 'raster',
          tiles: [layer.url],
          tileSize: 256,
          attribution: layer.attribution,
          minzoom: layer.maxzoom,
          maxzoom: layer.maxzoom,
        });
        // insert below the suitability grid so the overlay stays visible
        const before = map.getLayer('ubimap-heat') ? 'ubimap-heat' : undefined;
        map.addLayer(
          {
            id: srcId,
            type: 'raster',
            source: srcId,
            paint: { 'raster-opacity': layer.kind === 'imagery' ? 0.95 : 0.72 },
            layout: { visibility: 'none' },
          },
          before,
        );
      }
    }
    if (map.getLayer('labels') && map.getLayer('ubimap-heat')) {
      map.moveLayer('labels', 'ubimap-heat');
    }
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of Object.keys(NASA_LAYERS)) {
      const layerId = `nasa-${id}`;
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, 'visibility', activeLayer === id ? 'visible' : 'none');
    }
  }, [activeLayer, ready]);

  // terrain and the 3D camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (terrain) {
      map.setTerrain({ source: 'ubimap-dem', exaggeration: 1.25 });
    } else {
      map.setTerrain(null);
    }
  }, [terrain, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.easeTo({
      pitch: view3d ? 48 : 0,
      bearing: view3d ? -16 : 0,
      duration: 700,
    });
  }, [view3d, ready]);

  // the pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!pin) return;
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = '<div class="pin-dot"></div><div class="pin-ring"></div>';
    markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([pin.lon, pin.lat])
      .addTo(map);
    map.easeTo({
      center: [pin.lon, pin.lat],
      zoom: Math.max(map.getZoom(), 11),
      pitch: view3d ? 48 : 0,
      duration: 800,
    });
  }, [pin, ready, view3d]);

  const layer = NASA_LAYERS[activeLayer];

  return (
    <div className="mapwrap">
      <div className="map" ref={containerRef}>
        {showHeatmap && (
          <div className="map-legend">
            <span>Ube suitability 0 to 100</span>
            <div className="legend-bar" />
            <div className="legend-labels">
              <span>0</span><span>40</span><span>55</span><span>70</span><span>85</span><span>100</span>
            </div>
          </div>
        )}
      </div>
      {mapError && <div className="map-error">Map: {mapError}</div>}

      <div className="filmstrip">
        <button
          type="button"
          className={`chip ${activeLayer === '' ? 'on' : ''}`}
          onClick={() => onLayerChange('')}
        >
          Street map
        </button>
        {Object.entries(NASA_LAYERS).map(([id, l]) => (
          <button
            type="button"
            key={id}
            className={`chip ${activeLayer === id ? 'on' : ''}`}
            onClick={() => onLayerChange(id)}
            title={`${l.mission} - ${l.resolution} - ${l.what_en}`}
          >
            {l.label_en}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${showHeatmap ? 'on' : ''}`}
          onClick={onToggleHeatmap}
        >
          UbiMap suitability
        </button>
        <button
          type="button"
          className={`chip ${view3d ? 'on' : ''}`}
          onClick={() => setView3d((v) => !v)}
        >
          3D terrain
        </button>
        <button
          type="button"
          className={`chip ${terrain ? 'on' : ''}`}
          onClick={() => setTerrain((v) => !v)}
        >
          Relief
        </button>
      </div>

      {layer && (
        <div className="map-note">
          <strong>{layer.label_en}</strong>{' '}
          <span className="dim">
            {layer.mission} &middot; {layer.resolution} &middot; {layer.period} &middot; image date{' '}
            {layer.time || 'static'} &middot; {layer.attribution}
          </span>
          <div>{lang === 'bis' ? layer.what_bis : layer.what_en}</div>
        </div>
      )}
    </div>
  );
}
