/**
 * Capture the images used in README.md.
 *
 * These are separate from the slide deck shots on purpose: the README wants
 * 1x captures, cropped to the interesting part, so the page stays light and
 * the text in the screenshots stays readable.
 *
 *   node scripts/shoot_readme_images.mjs <baseUrl> <outDir>
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.argv[2] || 'http://localhost:8080';
const outDir = path.resolve(process.argv[3] || 'docs/images');
const PORT = 9336;
const W = 1280;
const H = 900;

fs.mkdirSync(outDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubireadme-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-gpu', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('no devtools endpoint');
}

const ws = new WebSocket(await findTarget());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text}`);
  return r.result?.value;
};

/** Clip one element by selector, in page coordinates. */
async function shoot(name, selector, { pad = 0, maxH = 0, scale = 1 } = {}) {
  const rect = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  })()`);
  if (!rect) throw new Error(`not found: ${selector}`);
  const h = maxH ? Math.min(rect.h, maxH) : rect.h;
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: {
      x: Math.max(0, rect.x - pad),
      y: Math.max(0, rect.y - pad),
      width: Math.min(W, rect.w + pad * 2),
      height: Math.min(h + pad, 1600),
      scale,
    },
  });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log(`  ${file}`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: baseUrl });
await sleep(2500);

console.log('README images:');
// The landing screen, the headline and the NASA plate together.
await shoot('hero', '.hero');

// The NASA plate that opens the app, with its own caption strip.
await shoot('nasa-plate', '.plate');

// Pick the demo field so the map has a pin and the heat map has data.
await evaluate("document.querySelector('.btn-demo').click()");
await sleep(1200);
// The NASA GIBS tiles stream in, so give them time to fill the viewport
// before the shot, otherwise the map is half dark.
await sleep(7000);
await evaluate("window.scrollTo(0,0)");
await sleep(2500);

// The live map with the NASA layer chips under it.
await shoot('map', '.mapwrap', { maxH: 760 });

// Walk to the Farm Card.
await evaluate("[...document.querySelectorAll('.navrow .btn')].find(b=>!b.classList.contains('btn-ghost')).click()");
await sleep(500);
await evaluate("[...document.querySelectorAll('.navrow .btn')].find(b=>!b.classList.contains('btn-ghost')).click()");
await sleep(1500);

await shoot('farm-card', '.readiness-head');
await shoot('rotation-card', '.rot-cards .rot', { maxH: 760 });
await shoot('validation-table', '.prov-scroll table.val', { maxH: 560 });

// A phone sized capture, because the app is phone first.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(1500);
await evaluate("(() => { const el = document.querySelector('.readiness-head'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70); })()");
await sleep(1500);
// Clip the visible phone screen, not the whole document.
const scrollY = await evaluate('Math.round(window.scrollY)');
{
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: scrollY, width: 390, height: 844, scale: 1 },
  });
  const file = path.join(outDir, 'phone.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log(`  ${file}`);
}

ws.close();
chrome.kill();
console.log('done');
