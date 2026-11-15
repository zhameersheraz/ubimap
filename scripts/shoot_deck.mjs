/**
 * Render each slide of deck/index.html to deck/preview-NN.png so the layout can
 * be checked without opening the PDF.
 *
 *   node scripts/shoot_deck.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'C:/Users/ASUS/OneDrive/Documents/MiniMax/HACKATHON/NASA-HACKATHON/UbiMap';
const HTML = path.join(ROOT, 'deck', 'index.html');
const OUT = path.join(ROOT, 'deck', 'preview');
const PORT = 9334;

fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubideck-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', '--hide-scrollbars', '--disable-gpu', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
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
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send('Page.navigate', { url: 'file:///' + HTML.replace(/\\/g, '/') });
await sleep(3500);

const n = await evaluate("document.querySelectorAll('.slide').length");
for (let i = 0; i < n; i++) {
  const rect = await evaluate(`(() => {
    const el = document.querySelectorAll('.slide')[${i}];
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  })()`);
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
  });
  const f = path.join(OUT, `preview-${String(i + 1).padStart(2, '0')}.png`);
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  console.log(f);
}

ws.close();
chrome.kill();
