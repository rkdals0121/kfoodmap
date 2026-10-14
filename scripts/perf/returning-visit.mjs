// A returning visit on the same profile: when the first place card mounts.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
// (Its own browser folder, deleted when done: left behind, they piled up.)
// …and any an earlier run could not delete (a helper held it a few seconds
// longer), once it is ten minutes old.
for (const old of readdirSync(tmpdir()).filter(n => n.startsWith('kfm-perf-'))) {
  try { if (Date.now() - statSync(join(tmpdir(), old)).mtimeMs > 10 * 60 * 1000) rmSync(join(tmpdir(), old), { recursive: true, force: true }); } catch { /* still held, or gone */ }
}
const profile = mkdtempSync(join(tmpdir(), 'kfm-perf-'));
// (Port 0: the browser picks a free one and writes it in its folder — a fixed
// number could reach another run's browser, and Browser.close would close it.)
let port = 0;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { port = port || Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0]) || 0; if (!port) continue; target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* not yet */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let id = 0; const pending = new Map(); const reqs = new Map(); let bytes = 0; const byType = {};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Network.responseReceived') reqs.set(m.params.requestId, { url: m.params.response.url, type: m.params.type });
  if (m.method === 'Network.loadingFinished') { const r = reqs.get(m.params.requestId); if (r) { r.size = m.params.encodedDataLength; bytes += r.size; byType[r.type] = (byType[r.type] ?? 0) + r.size; } }
};
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('kfm-prologue','true')}catch(e){};window.__lcp=0;window.__m=0;new MutationObserver(()=>{if(!window.__m&&document.querySelector('.place-card'))window.__m=Math.round(performance.now())}).observe(document,{childList:true,subtree:true});window.__l=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__l.push([Math.round(e.startTime),e.size,(e.element&&(e.element.tagName+'.'+e.element.className))||''])}).observe({type:'largest-contentful-paint',buffered:true});window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});` });
await send('Page.navigate', { url });
await sleep(22000);
const v = (await send('Runtime.evaluate', { expression: `JSON.stringify({lcp:Math.round(window.__lcp),cls:+window.__cls.toFixed(3),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime??0),dcl:Math.round(performance.timing.domContentLoadedEventEnd-performance.timing.navigationStart),load:Math.round(performance.timing.loadEventEnd-performance.timing.navigationStart),l:window.__l,mounted:window.__m,res:performance.getEntriesByType('resource').map(r=>[Math.round(r.startTime),Math.round(r.responseEnd),r.name.split('/').pop().slice(0,28)]).filter(r=>r[1]<9000)})`, returnByValue: true })).result.result.value;
console.log(url, v);
console.log('transferred kB', Math.round(bytes / 1024), Object.fromEntries(Object.entries(byType).map(([k, n]) => [k, Math.round(n / 1024)])));
console.log([...reqs.values()].filter(r => r.size > 40000).sort((a, b) => b.size - a.size).slice(0, 10).map(r => `${Math.round(r.size / 1024)}kB ${r.url.split('/').pop().slice(0, 50)}`).join('\n'));
await Promise.race([send('Browser.close'), sleep(3000)]);
ws.close();
if (chrome.exitCode !== null) { /* closed */ } else if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000, windowsHide: true }); else chrome.kill();
// (A helper of the browser can hold the folder: ended by the folder's name, as shot.mjs does.)
for (let tries = 0; tries < 6 && existsSync(profile); tries++) {
  if (tries > 0) await sleep(1000);
  if (tries === 1 && process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${profile.split(/[\\/]/).pop()}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', timeout: 15000, windowsHide: true });
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* still held */ } }
process.exit(0);
