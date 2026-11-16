/**
 * Record the UbiMap demo as a real screen recording.
 *
 * Uses the Chrome DevTools Protocol screencast to capture the actual app while a
 * script drives it, so every frame in the finished video is the real interface
 * and the real NASA data. The frames and their timestamps land in
 * demo/frames/, and build_demo_video.py turns them into the 30 second MP4.
 *
 *   node scripts/record_demo.mjs <url> <outDir>
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'https://ubimap.pages.dev';
const outDir = path.resolve(process.argv[3] || 'demo/frames');
// "long" records the whole app walkthrough, used for the project page. The
// NASA demo video itself must stay at 30 seconds or less.
const LONG = process.argv.includes('--long');
const PORT = 9337;
const W = 1280;
const H = 720;

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ubivideo-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-gpu', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const ws = new WebSocket(await findTarget());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let nextId = 1;
const pending = new Map();
const frames = [];
let recording = false;

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Page.screencastFrame' && recording) {
    frames.push({ data: msg.params.data, ts: msg.params.metadata.timestamp });
    // Acknowledge, otherwise the screencast stalls after one frame.
    send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }).catch(() => {});
  }
};

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) console.error('eval:', r.exceptionDetails.text);
  return r.result?.value;
};

/** Eased scroll so the screencast has frames for the move, not just the jump. */
const scrollTo = async (selector, offset = 80, duration = 1100) => {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return;
    const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - ${offset});
    const start = window.scrollY;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ${duration});
      window.scrollTo(0, start + (target - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })()`);
  await sleep(duration + 120);
};

/** Eased scroll by a pixel amount, so the shot keeps producing frames. */
const scrollBy = async (dy, duration = 2400) => {
  await evaluate(`(() => {
    const start = window.scrollY;
    const target = start + ${dy};
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ${duration});
      window.scrollTo(0, start + (target - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })()`);
  await sleep(duration + 150);
};

const click = (selector, index = 0) => evaluate(`(() => {
  const els = document.querySelectorAll(${JSON.stringify(selector)});
  if (!els[${index}]) return false;
  els[${index}].click();
  return true;
})()`);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(6000);

console.log('recording...');
await send('Page.startScreencast', {
  format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1,
});
recording = true;

const t0 = Date.now();
const t0Epoch = t0 / 1000;
const marks = [];
const mark = async (label, ms) => {
  await sleep(ms);
  const at = (Date.now() - t0) / 1000;
  // The frame index at this moment is the first frame of the new shot, which is
  // what the captions get aligned to. Wall clock is only a rough guide.
  marks.push({ label, at, frame: frames.length });
  console.log(`  ${at.toFixed(1)}s  ${label}  (frame ${frames.length})`);
};

// 1. The NASA plate the app opens on.
await mark('plate', 1800);

// 2. Smooth scroll down to the live map.
await scrollTo('.mapwrap', 40, 1100);
await mark('map, tiles loading', 2900);

// 3. Pick the demo field, the pin lands on Pagadian City.
await scrollTo('.card', 40, 900);
await click('.card .chips button', 1);
await mark('demo field pinned', 1500);

// 4. The farmer profile step.
await click('.navrow .btn:not(.btn-ghost)', 0);
await mark('profile', 1300);

// 5. The Farm Card.
await click('.navrow .btn:not(.btn-ghost)', 0);
await sleep(700);
await scrollTo('.readiness-head', 60, 1000);
await mark('farm card', 1900);

// 6. The live NASA POWER call, the button really hits the API.
await scrollTo('.livecheck', 60, 900);
await click('.livecheck .chip', 0);
await mark('live NASA check', 2600);

// 7. The rotation comparison.
await scrollTo('.rot-cards', 60, 1100);
await mark('rotations', 1700);

// 8. The validation table, then a slow move down through the honest paragraph
// underneath it. A still page produces no frames, so the shot has to move for
// the footage to keep running.
await scrollTo('.prov-scroll', 60, 1200);
await scrollBy(230, 2400);
await mark('validation table', 400);

if (LONG) {
  // 9. The planting calendar.
  await scrollTo('.cal', 60, 1200);
  await scrollBy(180, 1600);
  await mark('calendar', 300);

  // 10. The Farm Card as the farmer takes it away.
  await scrollTo('.farmcard', 60, 1200);
  await scrollBy(200, 1600);
  await mark('farm card view', 300);

  // 11. Satellite against ground.
  await scrollTo('.cmp', 60, 1200);
  await scrollBy(180, 1600);
  await mark('satellite vs ground', 300);

  // 12. The rainfall cross check.
  await scrollTo('.val-stats', 60, 1200);
  await scrollBy(200, 1600);
  await mark('rainfall cross check', 300);

  // 13. The NASA data list and the source table.
  await scrollTo('.nasa-list', 60, 1200);
  await scrollBy(200, 1600);
  await mark('nasa data list', 300);

  await scrollTo('.prov', 60, 1200);
  await scrollBy(200, 1600);
  await mark('sources table', 400);
}

await send('Page.stopScreencast');
recording = false;
await sleep(300);

const manifest = [];
for (let i = 0; i < frames.length; i++) {
  const name = `f${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(outDir, name), Buffer.from(frames[i].data, 'base64'));
  manifest.push({ name, ts: frames[i].ts });
}
fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(outDir, 'marks.json'), JSON.stringify({ t0Epoch, marks }));
const span = frames.length > 1 ? frames[frames.length - 1].ts - frames[0].ts : 0;
console.log(`${frames.length} frames, ${span.toFixed(2)}s of footage in ${outDir}`);

ws.close();
chrome.kill();
