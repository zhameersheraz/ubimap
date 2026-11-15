/**
 * Capture real screenshots of the running UbiMap for the NASA slide deck.
 *
 * Uses Chrome's DevTools Protocol directly over Node's built in WebSocket client,
 * so nothing has to be installed. It drives the app the way a farmer would:
 * pick the demo field, walk through the three steps, and grab the frames.
 *
 *   node scripts/shoot_screenshots.mjs <baseUrl> <outDir>
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.argv[2] || 'http://localhost:8080';
const outDir = process.argv[3] || 'deck/shots';
const PORT = 9333;
const W = 1440;
const H = 900;

fs.mkdirSync(outDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubishot-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const ws = new WebSocket(await findTarget());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data || ''}`));
    else resolve(msg.result);
  } else if (msg.method) {
    events.push(msg.method);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(r.exceptionDetails.text)}`);
  return r.result?.value;
}

async function waitForLoad() {
  for (let i = 0; i < 80; i++) {
    if (events.includes('Page.loadEventFired')) { events.length = 0; return; }
    await sleep(150);
  }
  events.length = 0;
}

async function shoot(name, { full = false, clip = null } = {}) {
  let params = { format: 'png' };
  if (clip) {
    params = { ...params, clip: { ...clip, scale: 1 }, captureBeyondViewport: true };
  } else if (full) {
    const m = await send('Page.getLayoutMetrics');
    const cs = m.cssContentSize || m.contentSize;
    params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cs.width, height: cs.height, scale: 1 } };
  }
  const r = await send('Page.captureScreenshot', params);
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log(`  ${file}`);
}

/** Capture one element by selector, clipped to its box in page coordinates. */
async function shootEl(name, selector, { pad = 16, maxH = 0, offset = 96 } = {}) {
  const find = selector.startsWith('js:')
    ? `(() => { const el = (${selector.slice(3)}); return el ? el : null; })()`
    : `document.querySelector(${JSON.stringify(selector)})`;
  const rect = await evaluate(`(() => {
    const el = ${find};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  })()`);
  if (!rect) throw new Error(`selector not found: ${selector}`);
  const h = maxH ? Math.min(rect.h, maxH) : rect.h;
  await shoot(name, {
    clip: {
      x: Math.max(0, rect.x - pad),
      y: Math.max(0, rect.y - pad),
      width: Math.min(W, rect.w + pad * 2),
      height: Math.min(h + pad, 1600),
    },
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });

console.log('capturing...');
await send('Page.navigate', { url: baseUrl });
await waitForLoad();
await sleep(2500);

// The hero plate only exists on step 1, so grab it before walking forward.
await shootEl('06-plate', '.plate', { pad: 0 });

// Step 1: the map with the MODIS layer and the suitability heatmap on.
await evaluate("document.querySelectorAll('.card .chips button')[1].click()");
await sleep(1500);
await evaluate("document.querySelector('.mapwrap').scrollIntoView({block:'start'})");
await sleep(2500);
await shoot('01-map');

// The Farm Card, scored and explained.
await evaluate("[...document.querySelectorAll('.navrow .btn')].find(b=>!b.classList.contains('btn-ghost')).click()");
await sleep(400);
await evaluate("[...document.querySelectorAll('.navrow .btn')].find(b=>!b.classList.contains('btn-ghost')).click()");
await sleep(1200);
await shootEl('02-farmcard', '.readiness-head', { pad: 20 });

// The reasons, each with the dataset it came from.
await shootEl('02b-reasons', '.two-col', { pad: 20, maxH: 460 });

// A rotation card, so one frame carries why, evidence, benefits, gaps and risks.
await shootEl('03-rotations', '.rot-cards .rot', { pad: 16, maxH: 720 });

// The validation table with the honest paragraph under it.
await shootEl('04-validation', '.val-stats', { pad: 20 });
await shootEl('04b-validation-table', '.prov-scroll table.val', { pad: 12, maxH: 520 });

// The rainfall cross check. Both panels use .val-stats, so pick the one whose
// heading names the cross check.
await evaluate(`(() => {
  const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes('Rainfall cross-check'));
  if (h) { window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 96); }
})()`);
await sleep(700);
await shootEl('05-crosscheck',
  "js:[...document.querySelectorAll('section.card')].find(s => s.querySelector('h2')?.textContent.includes('Rainfall cross-check'))?.querySelector('.cmp')",
  { pad: 14, maxH: 420, offset: 0 });

// The hero plate on the landing screen.
await evaluate("window.scrollTo(0,0)");
await sleep(1500);
await shoot('06-hero', { clip: { x: 0, y: 0, width: W, height: 560 } });

ws.close();
chrome.kill();
console.log('done');
