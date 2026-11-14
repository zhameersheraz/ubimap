/**
 * Netlify Function: a CORS-safe proxy to the NASA POWER API.
 *
 * Same behaviour as the Cloudflare Pages Function in functions/api/power.js, written for
 * Netlify's function format. Only needed if the site is hosted on Netlify.
 */
const POWER_BASE = 'https://power.larc.nasa.gov/api';

export default async (req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=900',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers).end();
    return;
  }

  const path = req.url.replace(/^\/?api\/power/, '').split('?')[0];
  const search = req.url.includes('?') ? `?${req.url.split('?')[1]}` : '';

  try {
    const upstream = await fetch(`${POWER_BASE}${path}${search}`, {
      headers: { 'User-Agent': 'UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)' },
      signal: AbortSignal.timeout(30000),
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `NASA POWER request failed: ${err.message}` }));
  }
};
