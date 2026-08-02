// One-off: rasterizes each category illustration in public/images/ into a
// 1200x630 PNG under public/og/, for use as og:image in the per-restaurant
// pages scripts/prerender-places.mjs generates.
//
// Why this exists: link-preview crawlers (KakaoTalk, Facebook, Twitter)
// require a raster format -- they silently drop an og:image pointing at an
// SVG. The illustrations are SVG, so the tag was removed entirely rather
// than ship one that never renders (HANDOFF §7 #22). This restores it.
//
// The source SVGs are 400x300 (4:3); og:image wants 1200x630 (~1.91:1).
// Rather than crop the illustration to fit, each is scaled to fit inside
// the frame and centred on the SVG's own background colour, so the result
// reads as a deliberate card rather than a badly-cropped image.
//
// Not part of npm run build -- run manually, commit the output. Re-run if
// the illustrations ever change:
//   node scripts/rasterize-og-images.mjs

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const outDir = path.join(__dirname, '..', 'public', 'og');

const WIDTH = 1200;
const HEIGHT = 630;
// The illustrations' own canvas colour, so the letterboxed area is
// indistinguishable from the artwork's background rather than a grey band.
const BACKGROUND = '#F8F6F0';

mkdirSync(outDir, { recursive: true });

const svgFiles = readdirSync(imagesDir).filter(f => f.endsWith('.svg'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

for (const file of svgFiles) {
  const svg = readFileSync(path.join(imagesDir, file), 'utf8');
  const html = `<!doctype html><html><head><style>
    html, body { margin: 0; padding: 0; }
    .frame {
      width: ${WIDTH}px; height: ${HEIGHT}px;
      background: ${BACKGROUND};
      display: flex; align-items: center; justify-content: center;
    }
    .frame svg { width: 84%; height: 84%; }
  </style></head><body><div class="frame">${svg}</div></body></html>`;

  await page.setContent(html);
  const outPath = path.join(outDir, file.replace(/\.svg$/, '.png'));
  await page.locator('.frame').screenshot({ path: outPath });
}

await browser.close();

console.log(`Rasterized ${svgFiles.length} og:image(s) into public/og/ (${WIDTH}x${HEIGHT}).`);
