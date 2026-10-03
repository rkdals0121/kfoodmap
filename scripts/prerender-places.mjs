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
import { isQuarantined, matchesDietary } from '../src/data/verification.js';
import { matchesArea } from '../src/filters.js';
import { AREA_NAMES } from '../src/data/area-names.js';
import { displayName } from '../src/utils.js';

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
  // displayName, not split('('): that cut "Nimat (니맛), Culinary Square T2"
  // to "Nimat", the same bug the app fixed for its own views.
  const name = escapeHtml(displayName(place.name));
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

// /submit is a route too, so a direct load or reload must be a real file,
// the same as /place/:id. Generic meta; noindex because a form has nothing
// for a search engine, and deliberately absent from the sitemap.
{
  const url = `${SITE_URL}/submit`;
  const title = 'Suggest a restaurant · K-Food Map';
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    [/<\/head>/, `  <meta name="robots" content="noindex" />\n  </head>`],
  ].reduce((html, [pattern, value]) => html.replace(pattern, () => value), template);
  mkdirSync(path.join(distDir, 'submit'), { recursive: true });
  writeFileSync(path.join(distDir, 'submit', 'index.html'), page, 'utf8');
}

// /privacy is a real file for the same reason. Indexable (people search for
// a site's privacy policy), but not in the sitemap, which lists places.
{
  const url = `${SITE_URL}/privacy`;
  const title = 'Privacy Policy · K-Food Map';
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
  ].reduce((html, [pattern, value]) => html.replace(pattern, () => value), template);
  mkdirSync(path.join(distDir, 'privacy'), { recursive: true });
  writeFileSync(path.join(distDir, 'privacy', 'index.html'), page, 'utf8');
}

// The tabs have addresses too (/discover, /journal, /profile), so a reload or
// a shared link there is a real file. Journal and Profile are a visitor's own
// screens: noindex.
for (const [slug, title, index] of [
  ['discover', 'Food journeys and stories · K-Food Map', true],
  ['cards', 'Korean cards to show restaurant staff — vegan and Muslim travellers · K-Food Map', true],
  ['journal', 'Your food passport · K-Food Map', false],
  ['profile', 'Profile · K-Food Map', false],
]) {
  const url = `${SITE_URL}/${slug}`;
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    ...(index ? [] : [[/<\/head>/, `  <meta name="robots" content="noindex" />
  </head>`]]),
  ].reduce((html, [pattern, value]) => html.replace(pattern, () => value), template);
  mkdirSync(path.join(distDir, slug), { recursive: true });
  writeFileSync(path.join(distDir, slug, 'index.html'), page, 'utf8');
}

// Area guides: /find/halal-busan, /find/vegan-seoul … One page per diet and
// well-known area that has at least GUIDE_MIN places. The app itself needs
// none of this (the route just opens the map on that search and chip, see
// App.jsx `findView`); the pages exist so that someone searching the web for
// "halal food in Busan" can land somewhere, and so that every place page
// has a plain link pointing at it. Unlike the pages above these carry real
// content before the script runs: the list, as links, each with its claim
// in the app's own words — the dietary value and how sure the record is.
// Nothing is said that the record does not say.
const GUIDE_MIN = 3;
const DIETS = [
  { slug: 'halal', chip: 'Halal', word: 'Halal', fact: 'halal' },
  { slug: 'vegan', chip: 'Vegan', word: 'Vegan', fact: 'vegan' },
];
const CLAIM_WORD = {
  halal: { certified: 'Halal-certified', friendly: 'Halal-friendly' },
  vegan: { full: 'Fully vegan', options: 'Vegan options' },
};
const SURE_WORD = { confirmed: 'Confirmed', supported: 'Reported', inferred: 'Our reading' };

const guides = [];
for (const diet of DIETS) {
  for (const area of Object.keys(AREA_NAMES)) {
    const places = active
      .filter(r => matchesDietary(r, diet.chip) && matchesArea(r, area))
      .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
    if (places.length >= GUIDE_MIN) guides.push({ diet, area, places, slug: `${diet.slug}-${area.toLowerCase()}` });
  }
}

function guideBody(guide) {
  const { diet, area, places } = guide;
  const items = places.map((r) => {
    const fact = r.dietary[diet.fact];
    const claim = `${CLAIM_WORD[diet.fact][fact.value]} (${SURE_WORD[fact.confidence]})`;
    return `<li style="margin:0 0 10px"><a href="/place/${r.id}" style="color:#087F5B;font-weight:600">${escapeHtml(displayName(r.name))}</a><br><span style="font-size:14px;color:#3F444A">${escapeHtml(r.zone)} · ${claim}</span></li>`;
  }).join('');
  const others = guides
    .filter(g => g.diet === diet && g !== guide)
    .map(g => `<a href="/find/${g.slug}" style="color:#087F5B">${g.area}</a>`)
    .join(' · ');
  return `<div id="root"><main style="max-width:640px;margin:0 auto;padding:24px;background:#F7F7F8;color:#1F2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.5">`
    + `<p style="margin:0;font-size:13px;font-weight:700;color:#087F5B">K-Food Map</p>`
    + `<h1 style="margin:6px 0 8px;font-size:26px">${diet.word} food in ${area}</h1>`
    + `<p style="margin:0 0 16px;color:#3F444A">${places.length} places on the map. Each line says what the record says and how sure it is: Confirmed (checked against a primary source), Reported (a source says so) or Our reading (our best guess). Kitchens change — if your diet is strict, ask staff before you order.</p>`
    + `<p style="margin:0 0 16px"><a href="/#q=${area}&amp;f=${diet.chip}" style="display:inline-block;padding:12px 18px;background:#087F5B;color:#fff;border-radius:12px;font-weight:600;text-decoration:none">Open these on the map</a></p>`
    + `<ul style="margin:0;padding:0 0 0 18px">${items}</ul>`
    + (others ? `<p style="margin:20px 0 0;font-size:14px;color:#3F444A">${diet.word} food in other areas: ${others}</p>` : '')
    + `</main></div>`;
}

for (const guide of guides) {
  const { diet, area, places } = guide;
  const url = `${SITE_URL}/find/${guide.slug}`;
  const title = `${diet.word} food in ${area} — ${places.length} places · K-Food Map`;
  const description = `${places.length} ${diet.word.toLowerCase()} places in ${area}, Korea. Each dietary claim is marked Confirmed, Reported or Our reading, with its source.`;
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    // The loading screen inside #root gives way to the list; React replaces
    // either one when it starts.
    [/<div id="root">[\s\S]*?<\/div><\/div>/, guideBody(guide)],
  ].reduce((html, [pattern, value]) => {
    if (!pattern.test(html)) throw new Error(`prerender: guide template lost ${pattern}`);
    return html.replace(pattern, () => value);
  }, template);
  mkdirSync(path.join(distDir, 'find', guide.slug), { recursive: true });
  writeFileSync(path.join(distDir, 'find', guide.slug, 'index.html'), page, 'utf8');
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
  // The two public pages that are not places: the journeys and the staff
  // cards. Journal and Profile are a visitor's own screens (noindex).
  const urls = ['', 'discover', 'cards', ...guides.map(g => `find/${g.slug}`), ...active.map(place => `place/${place.id}`)];
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

console.log(`Prerendered ${active.length} place page(s) into dist/place/ (of ${restaurants.length} total) and ${guides.length} area guide(s) into dist/find/.`);
console.log(`Wrote submit/, privacy/, discover/, cards/, journal/, profile/ index.html, sitemap.xml (${active.length + 3 + guides.length} URLs) and robots.txt.`);
