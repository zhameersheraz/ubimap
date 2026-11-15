/**
 * Report the rendered height of every slide so nothing is silently cut by the
 * 720px page box when the deck is printed to PDF.
 *
 *   node scripts/check_deck_overflow.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'C:/Users/ASUS/OneDrive/Documents/MiniMax/HACKATHON/NASA-HACKATHON/UbiMap';
const HTML = path.join(ROOT, 'deck', 'index.html');
const PORT = 9335;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubiover-'));
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
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///' + HTML.replace(/\\/g, '/') });
await sleep(3000);

const rows = await evaluate(`(() => {
  return [...document.querySelectorAll('.slide')].map((s, i) => {
    const pad = s.querySelector('.pad');
    const foot = s.querySelector('.foot');
    const contentBottom = pad ? pad.getBoundingClientRect().bottom : 0;
    const footTop = foot ? foot.getBoundingClientRect().top : 720;
    return {
      n: i + 1,
      slideH: Math.round(s.getBoundingClientRect().height),
      contentBottom: Math.round(contentBottom),
      footTop: Math.round(footTop),
      over: Math.round(contentBottom - footTop),
      scrollH: s.scrollHeight,
    };
  });
})()`);

let bad = 0;
for (const r of rows) {
  const flag = r.over > 0 || r.scrollH > 721 ? '  <-- OVERFLOW' : '';
  if (flag) bad++;
  console.log(`slide ${r.n}: content bottom ${r.contentBottom}, footer top ${r.footTop}, scrollHeight ${r.scrollH}${flag}`);
}
console.log(bad ? `\n${bad} slide(s) overflow the page box` : '\nno slide overflows');

ws.close();
chrome.kill();
