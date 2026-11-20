/**
 * Capture the top of the app in a given theme, so both can be checked.
 *
 *   node scripts/shoot_theme.mjs <url> <outFile> <dark|light> [width] [height]
 *
 * Uses Chrome's DevTools Protocol directly over Node's built in WebSocket client,
 * so nothing has to be installed.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'http://localhost:8080';
const out = path.resolve(process.argv[3] || '.tmp-shots/theme.png');
const theme = process.argv[4] || 'dark';
const W = Number(process.argv[5] || 1440);
const H = Number(process.argv[6] || 860);
const PORT = 9341;

fs.mkdirSync(path.dirname(out), { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubitheme-'));

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

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
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
  width: W, height: H, deviceScaleFactor: 2, mobile: false,
});

await send('Page.navigate', { url });
await sleep(2500);
await evaluate(`localStorage.setItem('ubimap-theme', ${JSON.stringify(theme)})`);
await send('Page.reload', {});
await sleep(3500);

// Pick the demo field so the hero shows the picked state as well.
await evaluate("document.querySelector('.btn-demo')?.click()");
await sleep(1200);
await evaluate("window.scrollTo(0,0)");
await sleep(800);

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
});
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote', out);

ws.close();
chrome.kill();
