/**
 * Download the generated narration clips for the long version.
 *
 *   node scripts/fetch_narration.mjs long
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/ASUS/OneDrive/Documents/MiniMax/HACKATHON/NASA-HACKATHON/UbiMap';
const SUFFIX = process.argv[2] ? `-${process.argv[2]}` : '';
const CARDS = path.join(ROOT, 'demo', `cards${SUFFIX}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = JSON.parse(fs.readFileSync(path.join(CARDS, 'tts_out.json'), 'utf8').replace(/^\uFEFF/, ''));
const ids = out.success_items.map((i) => i.node_id);

for (let i = 0; i < ids.length; i++) {
  const name = `nar${String(i + 1).padStart(2, '0')}.mp3`;
  const file = path.join(CARDS, name);
  const raw = execSync(`mcode-tools get_asset_url ${ids[i]}`, { encoding: 'utf8', shell: true });
  const url = JSON.parse(raw).download_url;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`http ${res.status}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      ok = true;
    } catch {
      await sleep(1500);
    }
  }
  console.log(`${name} ${ok ? 'ok' : 'FAILED'}`);
  await sleep(500);
}
