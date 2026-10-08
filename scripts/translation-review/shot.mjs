// Headless Chrome over the DevTools protocol: node shot.mjs <steps.json>
// steps: [{ w, h, dpr, lang, url, seen (false = first visit), pre, js, load, wait, out, full, throttle (slow phone line), cpu (slow-down factor), media (emulated media features), print (true = as printed), tz (device time zone), init (script run before the page's own), geo ({lat,lng,acc}: the answer to "My location"), drag (finger drags), tap (finger taps on selectors), keys (+ trail: real key presses), block (url patterns) }]
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
let size = { w: 360, h: 640, dpr: 2 };
let initId = null;
for (const s of steps) {
  // A step that gives no size keeps the size of the step before it (the
  // first, 360x640): a follow-on step used to snap back to a phone.
  size = { w: s.w ?? size.w, h: s.h ?? size.h, dpr: s.dpr ?? size.dpr };
  await send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: size.dpr, mobile: size.w < 768 });
  if (s.touch !== false && size.w < 768) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  // cpu: 4 = a phone four times slower than this machine.
  await send('Emulation.setCPUThrottlingRate', { rate: s.cpu ?? 1 });
  // media: { 'forced-colors': 'active', 'prefers-reduced-motion': 'reduce', … }
  await send('Emulation.setEmulatedMedia', { media: s.print ? 'print' : '', features: Object.entries(s.media ?? {}).map(([name, value]) => ({ name, value })) });
  // tz: the device's time zone ("America/New_York"); '' = this machine's.
  await send('Emulation.setTimezoneOverride', { timezoneId: s.tz ?? '' });
  // geo: { lat, lng, acc } = a device that answers "My location" with this
  // (a made-up position, in this throwaway profile); geo: 'deny' refuses.
  if (s.geo && s.url) {
    const origin = new URL(s.url).origin;
    const r = await send(s.geo === 'deny' ? 'Browser.resetPermissions' : 'Browser.grantPermissions', s.geo === 'deny' ? {} : { origin, permissions: ['geolocation'] });
    if (r.error) console.log('geo:', r.error.message);
    if (s.geo !== 'deny') await send('Emulation.setGeolocationOverride', { latitude: s.geo.lat, longitude: s.geo.lng, accuracy: s.geo.acc ?? 20 });
  }
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', s.throttle ? { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Network.setBlockedURLs', { urls: s.block ?? [] });
  if (s.url) {
    const origin = new URL(s.url).origin;
    await send('Page.navigate', { url: origin + '/robots.txt' });
    await sleep(500);
    await evalJs(`localStorage.setItem('kfm-language', ${JSON.stringify(s.lang ?? 'en')}); ${s.seen === false ? '' : "localStorage.setItem('kfm-prologue','true');"} ${s.pre ?? ''}`);
    // init: script run in the page before its own (a fixed clock, say).
    if (initId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: initId });
    initId = s.init ? (await send('Page.addScriptToEvaluateOnNewDocument', { source: s.init })).result.identifier : null;
    await send('Page.navigate', { url: s.url });
    await sleep(s.load ?? 4500);
  }
  // drag: [{ from: [x, y], to: [x, y], ms, hold }] = a finger put down, moved
  // and lifted (real touch events), one after another, before `js` runs.
  for (const d of s.drag ?? []) {
    const n = 12;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: d.from[0], y: d.from[1] }] });
    for (let i = 1; i <= n; i += 1) {
      await sleep((d.ms ?? 240) / n);
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: d.from[0] + (d.to[0] - d.from[0]) * i / n, y: d.from[1] + (d.to[1] - d.from[1]) * i / n }] });
    }
    await sleep(d.hold ?? 0);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(500);
  }
  // tap: ['.css-selector', …] = a finger tap on the middle of the first
  // visible element that matches (real touch events), one after another.
  for (const sel of s.tap ?? []) {
    const at = await evalJs(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest(${JSON.stringify(sel)})===x});if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    if (!at) { console.log('tap: nothing to tap for', sel); continue; }
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at[0], y: at[1] }] });
    await sleep(60);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(s.tapWait ?? 1200);
  }
  // keys: ['Tab', 'Shift+Tab', 'Enter', 'Escape', 'ArrowDown', ' '] = real
  // key presses, one after another; with `trail: true` what has focus after
  // each is printed (its tag, class and first words).
  if (s.keys) {
    const CODES = { Tab: 9, Enter: 13, Escape: 27, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 };
    const trail = [];
    for (const k of s.keys) {
      const shift = k.startsWith('Shift+');
      const key = shift ? k.slice(6) : k;
      const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: CODES[key] ?? 0, nativeVirtualKeyCode: CODES[key] ?? 0, modifiers: shift ? 8 : 0 };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      if (key === 'Enter' || key === ' ') await send('Input.dispatchKeyEvent', { type: 'char', ...base, text: key === 'Enter' ? String.fromCharCode(13) : ' ' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(s.keyWait ?? 250);
      if (s.trail) trail.push(await evalJs(`(()=>{const e=document.activeElement; if(!e||e===document.body) return 'body'; return (e.tagName.toLowerCase()+'.'+String(e.className||'').split(' ')[0]+' "'+(e.getAttribute('aria-label')||e.textContent||e.placeholder||'').trim().slice(0,24)+'"');})()`));
    }
    if (s.trail) console.log(s.out ?? '', JSON.stringify(trail));
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
