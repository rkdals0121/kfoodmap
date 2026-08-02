// Build-time prerendering for crawler-visible per-restaurant meta.
//
// No headless browser: this just copies the already-built dist/index.html
// once per active restaurant with <title>/og:*/canonical swapped to that
// restaurant's data. Every <script> tag is untouched, so a human opening
// the link gets the full interactive SPA — only non-JS link-preview
// crawlers (KakaoTalk, Facebook, Twitter) see a difference, which is the
// point: today they all see the same generic homepage card.
//
// Run as part of `npm run build` (see package.json), never standalone —
// it reads dist/index.html, which only exists after `vite build`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { restaurants } from '../src/data/restaurants.js';
import { isQuarantined } from '../src/data/verification.js';

const SITE_URL = 'https://kfoodmap.vercel.app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Each entry finds one existing tag in the built index.html template and
// replaces its content/href with this restaurant's value. Driven by a table
// rather than one .replace() call per tag, so adding a tag later (e.g.
// twitter:card) is a one-line addition, not a new repeated block.
// Maps a restaurant's illustration (/images/foo.svg) to its rasterized
// 1200x630 og card (/og/foo.png), generated once by
// scripts/rasterize-og-images.mjs. Crawlers require a raster format and
// silently drop an SVG og:image, which is why the tag pointed at nothing
// usable before (HANDOFF §7 #22). Falls back to the shared card if a
// restaurant ever has no illustration.
function ogImageFor(place) {
  const svg = place.image ?? '';
  const match = svg.match(/^\/images\/(.+)\.svg$/);
  return `${SITE_URL}/og/${match ? match[1] : 'fallback'}.png`;
}

function replacements(place) {
  const name = escapeHtml(place.name.split('(')[0].trim());
  const description = escapeHtml(place.vibe);
  const url = `${SITE_URL}/place/${place.id}`;

  return [
    [/<title>.*<\/title>/, `<title>${name} · K-Food Map</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${name} · K-Food Map" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImageFor(place)}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
  ];
}

function pageFor(place) {
  return replacements(place).reduce(
    (html, [pattern, value]) => html.replace(pattern, () => value),
    template,
  );
}

const active = restaurants.filter(r => !isQuarantined(r));

for (const place of active) {
  const dir = path.join(distDir, 'place', place.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), pageFor(place), 'utf8');
}

// Generated here rather than kept as a static file in public/, for the same
// reason the pages above are generated: the URL set IS the active-restaurant
// set, so deriving both from `active` makes it impossible for the sitemap to
// list a quarantined place or miss a newly-added one. A hand-maintained
// public/sitemap.xml would silently drift the first time the data changed.
//
// Quarantined restaurants are absent by construction — they have no page to
// point at, and listing an unverified venue for crawlers is the same
// discovery-surface exposure §2.14 excludes them from everywhere else.
function sitemapXml() {
  const urls = ['', ...active.map(place => `place/${place.id}`)];
  const entries = urls
    .map(p => `  <url><loc>${SITE_URL}/${p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml(), 'utf8');
writeFileSync(
  path.join(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  'utf8',
);

console.log(`Prerendered ${active.length} place page(s) into dist/place/ (of ${restaurants.length} total).`);
console.log(`Wrote sitemap.xml (${active.length + 1} URLs) and robots.txt.`);
