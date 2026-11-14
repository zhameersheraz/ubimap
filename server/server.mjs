#!/usr/bin/env node
/**
 * UbiMap local server.
 *
 * Two jobs, no npm dependencies:
 *   1. Serve the built app from dist/ (or the folder given as argv[2]).
 *   2. Proxy /api/power/* to NASA POWER, because the NASA POWER API does not send
 *      CORS headers and a browser on another origin cannot call it directly.
 *
 * The app works fully offline without this server: every NASA number it needs is
 * already baked into data/pilot_grid.json. The proxy only exists so the live
 * "refresh from NASA POWER" button works during a demo.
 *
 * Usage: node server/server.mjs [port] [staticDir]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const STATIC_DIR = path.resolve(ROOT, process.argv[3] || 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Power API calls are slow, so cache them on disk for an hour. */
const CACHE_DIR = path.join(ROOT, '.cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const cacheKey = (url) => path.join(CACHE_DIR, `${Buffer.from(url).toString('base64url').slice(0, 120)}.json`);

async function proxyPower(req, res, url) {
  const key = cacheKey(url);
  const stat = fs.existsSync(key) ? fs.statSync(key) : null;
  if (stat && Date.now() - stat.mtimeMs < 3600_000) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-UbiMap-Cache': 'hit' });
    res.end(fs.readFileSync(key));
    return;
  }
  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'UbiMap/1.0 (NASA Space Apps Challenge 2026 - Field Shift)' },
      signal: AbortSignal.timeout(45000),
    });
    const body = await upstream.text();
    if (upstream.ok) fs.writeFileSync(key, body);
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: `NASA POWER request failed: ${err.message}` }));
  }
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const target = path.join(STATIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(STATIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback
      const fallback = path.join(STATIC_DIR, 'index.html');
      fs.readFile(fallback, (e2, buf) => {
        if (e2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(buf);
      });
      return;
    }
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': target.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname, search } = parsed;

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, static: STATIC_DIR, powerProxy: '/api/power/*' }));
    return;
  }

  if (pathname.startsWith('/api/power/')) {
    const target = `https://power.larc.nasa.gov/api/${pathname.replace('/api/power/', '')}${search}`;
    proxyPower(req, res, target);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`UbiMap serving ${STATIC_DIR} on http://localhost:${PORT}`);
  console.log(`NASA POWER proxy at http://localhost:${PORT}/api/power/`);
});
