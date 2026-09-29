// Rasterizes the app icon SVGs (scripts/icons/) to the PNGs the manifest
// and iOS need, with a headless Chromium browser (Edge or Chrome; set
// BROWSER to its path if neither default exists). Run after changing an
// icon:  node scripts/app-icons.mjs
//
// The icon: a white map pin on brand green, its head carrying a crescent
// that cradles a leaf — halal and vegan as one mark (two separate glyphs
// read as a pair of eyes). The square variant fills the canvas (iOS and
// Android apply their own mask); the maskable one keeps the mark inside
// the 80% safe zone. public/favicon.svg is the rounded variant, as is.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
].find(p => p && existsSync(p));
if (!browser) throw new Error('No Chromium browser found; set BROWSER=/path/to/chrome');

const jobs = [
  ['icon-square.svg', 180, 'public/apple-touch-icon.png'],
  ['icon-square.svg', 192, 'public/icon-192.png'],
  ['icon-square.svg', 512, 'public/icon-512.png'],
  ['icon-maskable.svg', 512, 'public/icon-maskable-512.png'],
];
const tmp = mkdtempSync(path.join(tmpdir(), 'kfm-icons-'));
for (const [src, size, out] of jobs) {
  const svg = readFileSync(path.join(root, 'scripts/icons', src), 'utf8')
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
  const html = path.join(tmp, `${size}-${src}.html`);
  writeFileSync(html, `<html><body style="margin:0;overflow:hidden">${svg}</body></html>`);
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${size},${size}`, `--screenshot=${path.join(root, out)}`, pathToFileURL(html).href,
  ], { stdio: 'ignore', timeout: 90_000 });
  console.log(out);
}
