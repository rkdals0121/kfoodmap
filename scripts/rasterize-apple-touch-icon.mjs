// One-off: rasterizes public/favicon.svg into a 180x180 PNG for
// index.html's apple-touch-icon link (iOS's "Add to Home Screen" does
// not reliably read Web App Manifest icons the way Android/Chrome does).
// Not part of npm run build -- run manually, commit the output.
//
// Run: node scripts/rasterize-apple-touch-icon.mjs

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
const outPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
const SIZE = 180;

const svg = readFileSync(svgPath, 'utf8');

const html = `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .frame {
    width: ${SIZE}px; height: ${SIZE}px;
    display: flex; align-items: center; justify-content: center;
  }
  .frame svg { max-width: 100%; max-height: 100%; }
</style></head><body><div class="frame">${svg}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(html);
await page.locator('.frame').screenshot({ path: outPath, omitBackground: true });
await browser.close();

console.log(`Wrote ${outPath} (${SIZE}x${SIZE}, transparent background)`);
