// Draws the per-category link-preview cards (public/og/<category>.png,
// 1200x630) that scripts/prerender-places.mjs points og:image at. Crawlers
// (KakaoTalk, Facebook, X) need a raster image and drop an SVG og:image.
//
// Each card pairs the category illustration (public/images/*.svg) with what
// the map is, in Pretendard GOV, so a shared place link says "K-Food Map"
// and not just "a drawing of a bowl". fallback.png is drawn separately, by
// scripts/og-card.py, and is left alone here.
//
// Not part of the build — run it and commit the output when an illustration
// or the wording changes. Uses a headless Chromium (Edge or Chrome; set
// BROWSER to its path if neither default exists):
//   node scripts/rasterize-og-images.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = path.join(root, 'public', 'images');
const outDir = path.join(root, 'public', 'og');
const font = (w) => pathToFileURL(path.join(root, `node_modules/pretendard-gov/dist/public/static/alternative/PretendardGOV-${w}.ttf`)).href;
const browser = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
].find(p => p && existsSync(p));
if (!browser) throw new Error('No Chromium browser found; set BROWSER=/path/to/chrome');

const tmp = mkdtempSync(path.join(tmpdir(), 'kfm-og-'));
const files = readdirSync(imagesDir).filter(f => f.endsWith('.svg') && f !== 'fallback.svg');
for (const file of files) {
  const svg = readFileSync(path.join(imagesDir, file), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: P; font-weight: 400; src: url('${font('Regular')}'); }
    @font-face { font-family: P; font-weight: 700; src: url('${font('Bold')}'); }
    @font-face { font-family: P; font-weight: 800; src: url('${font('ExtraBold')}'); }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { background: #F7F7F8; font-family: P, sans-serif; color: #1F2328; position: relative; }
    .bar { position: absolute; inset: 0 0 auto 0; height: 8px; background: #087F5B; }
    .text { position: absolute; left: 80px; top: 120px; width: 560px; }
    .eyebrow { font-weight: 700; font-size: 22px; letter-spacing: 0.14em; color: #087F5B; }
    h1 { margin: 22px 0 0; font-weight: 800; font-size: 58px; line-height: 1.12; letter-spacing: -0.02em; }
    p { margin: 22px 0 0; font-size: 28px; line-height: 1.4; color: #3F444A; }
    .url { position: absolute; left: 80px; bottom: 70px; font-size: 22px; color: #6B7280; }
    .art { position: absolute; right: 70px; top: 85px; width: 460px; height: 460px; border-radius: 28px;
           background: #F8F6F0; display: flex; align-items: center; justify-content: center; }
    .art svg { width: 88%; height: auto; }
  </style></head><body>
    <div class="bar"></div>
    <div class="text">
      <div class="eyebrow">K-FOOD MAP</div>
      <h1>The other side of <span style="white-space:nowrap">K-food.</span></h1>
      <p>Every dietary claim says how sure we are.</p>
    </div>
    <div class="url">kfoodmap.vercel.app</div>
    <div class="art">${svg}</div>
  </body></html>`;
  const htmlPath = path.join(tmp, file.replace(/\.svg$/, '.html'));
  writeFileSync(htmlPath, html);
  const out = path.join(outDir, file.replace(/\.svg$/, '.png'));
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,630', `--screenshot=${out}`, '--allow-file-access-from-files', pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore', timeout: 90_000 });
  console.log(path.relative(root, out));
}
