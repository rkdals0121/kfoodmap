// Headless Chrome over the DevTools protocol: node shot.mjs <steps.json>
// steps: [{ w, h, dpr, lang, url, seen (false = first visit), pre, js, load, wait, out, full, throttle (slow phone line), block (url patterns) }]
// One browser for all steps: storage carries over, so run a first-visit step in a file of its own.
// A step's js that navigates away (history.back() off the app) loses its result.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const steps = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// A port of its own per run: two runs side by side used to land on one.
const port = 9300 + Math.floor((process.pid * 7 + Date.now()) % 2000);
const dir = mkdtempSync(join(tmpdir(), 'kfm-shot-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* not up yet */ }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJs = async (expression) => { const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result; if (r?.exceptionDetails) console.log('EXCEPTION', r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r?.result?.value; };
await send('Page.enable');
await send('Runtime.enable');
// As a window in front: without this no focus events fire in a headless page.
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
for (const s of steps) {
  await send('Emulation.setDeviceMetricsOverride', { width: s.w ?? 360, height: s.h ?? 640, deviceScaleFactor: s.dpr ?? 2, mobile: (s.w ?? 360) < 768 });
  if (s.touch !== false && (s.w ?? 360) < 768) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', s.throttle ? { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Network.setBlockedURLs', { urls: s.block ?? [] });
  if (s.url) {
    const origin = new URL(s.url).origin;
    await send('Page.navigate', { url: origin + '/robots.txt' });
    await sleep(500);
    await evalJs(`localStorage.setItem('kfm-language', ${JSON.stringify(s.lang ?? 'en')}); ${s.seen === false ? '' : "localStorage.setItem('kfm-prologue','true');"} ${s.pre ?? ''}`);
    await send('Page.navigate', { url: s.url });
    await sleep(s.load ?? 4500);
  }
  if (s.js) { const v = await evalJs(`(async()=>{${s.js}})()`); if (v !== undefined) console.log(s.out ?? '', JSON.stringify(v)); }
  await sleep(s.wait ?? 600);
  if (s.out) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(s.full) });
    writeFileSync(s.out, Buffer.from(shot.result.data, 'base64'));
    console.log('wrote', s.out);
  }
}
ws.close();
chrome.kill();
process.exit(0);
