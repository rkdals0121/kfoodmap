// A first visit on a slow phone connection (1.6 Mbps, 150 ms; set rate: 4 below for a slow processor too):
// when the welcome screen mounts, the largest paint, layout shift, and each file's start and end.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
const port = 9800 + (process.pid % 100);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'kfm-perf-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* not yet */ } }
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
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lcp=0;window.__m=0;new MutationObserver(()=>{if(!window.__m&&document.querySelector('.prologue-layout'))window.__m=Math.round(performance.now())}).observe(document,{childList:true,subtree:true});window.__l=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__l.push([Math.round(e.startTime),e.size,(e.element&&(e.element.tagName+'.'+e.element.className))||''])}).observe({type:'largest-contentful-paint',buffered:true});window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});` });
await send('Page.navigate', { url });
await sleep(22000);
const v = (await send('Runtime.evaluate', { expression: `JSON.stringify({lcp:Math.round(window.__lcp),cls:+window.__cls.toFixed(3),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime??0),dcl:Math.round(performance.timing.domContentLoadedEventEnd-performance.timing.navigationStart),load:Math.round(performance.timing.loadEventEnd-performance.timing.navigationStart),l:window.__l,mounted:window.__m,res:performance.getEntriesByType('resource').map(r=>[Math.round(r.startTime),Math.round(r.responseEnd),r.name.split('/').pop().slice(0,28)]).filter(r=>r[1]<9000)})`, returnByValue: true })).result.result.value;
console.log(url, v);
console.log('transferred kB', Math.round(bytes / 1024), Object.fromEntries(Object.entries(byType).map(([k, n]) => [k, Math.round(n / 1024)])));
console.log([...reqs.values()].filter(r => r.size > 40000).sort((a, b) => b.size - a.size).slice(0, 10).map(r => `${Math.round(r.size / 1024)}kB ${r.url.split('/').pop().slice(0, 50)}`).join('\n'));
ws.close(); chrome.kill(); process.exit(0);
