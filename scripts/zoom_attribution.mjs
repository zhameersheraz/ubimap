/**
 * Capture the map attribution control at high zoom, so the icon can be checked.
 *
 *   node scripts/zoom_attribution.mjs <url> <outFile>
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'https://ubimap.pages.dev';
const out = path.resolve(process.argv[3] || 'demo/attrib.png');
const PORT = 9339;
const SCALE = Number(process.argv[4] || 8);

fs.mkdirSync(path.dirname(out), { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubiattrib-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', '--hide-scrollbars', '--disable-gpu', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('no devtools endpoint');
}

const ws = new WebSocket(await target());
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
  return r.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 720, deviceScaleFactor: SCALE, mobile: false,
});
await send('Page.navigate', { url });
await sleep(7000);

// Open the attribution so the button and the panel are both visible.
await evaluate("document.querySelector('.maplibregl-ctrl-attrib').classList.add('maplibregl-compact-expanded')");
await sleep(800);

const rect = await evaluate(`(() => {
  const el = document.querySelector('.maplibregl-ctrl-attrib');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
})()`);
console.log('attribution box', rect);

const shot = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
});
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote', out);

ws.close();
chrome.kill();
