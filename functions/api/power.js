/**
 * Cloudflare Pages Function: a CORS-safe proxy to the NASA POWER API.
 *
 * NASA POWER sends no CORS headers, so a browser on another origin cannot call it
 * directly. This function forwards the request server side and adds the headers the
 * browser needs. It is the only server side piece of UbiMap: the app works with no
 * network at all without it, because every number it needs is baked in.
 *
 * Route:  /api/power/<rest of the POWER path>
 * Example: /api/power/temporal/daily/point?parameters=T2M&community=AG&longitude=123.4&latitude=7.8
 */
const POWER_BASE = 'https://power.larc.nasa.gov/api';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/api\/power/, '') || '/';
  const target = `${POWER_BASE}${rest}${url.search}`;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=900',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)' },
      signal: AbortSignal.timeout(30000),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `NASA POWER request failed: ${err.message}` }),
      { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }
}
