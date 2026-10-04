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
import { cardById } from '../src/data/staff-cards.js';

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

// The app's stylesheet fixes the page in place (body { overflow: hidden }):
// the app scrolls inside itself. Static text is a page and has to scroll —
// with scripts off or slow, a guide of 26 places showed three and a half.
// Inside #root, so the rule goes when React renders.
const STATIC_SCROLL = '<style>html,body{overflow:auto!important;height:auto!important}</style>';

function replacements(place) {
  // displayName, not split('('): that cut "Nimat (니맛), Culinary Square T2"
  // to "Nimat", the same bug the app fixed for its own views.
  const name = escapeHtml(displayName(place.name));
  // What a search result or a KakaoTalk preview shows: the claim with how
  // sure the record is, where, then the place's own line. The same words
  // as the page; nothing the record does not say.
  const lead = [...claimLines(place), place.zone].filter(Boolean).join(' · ');
  const full = [lead, place.vibe].filter(Boolean).join('. ');
  const description = escapeHtml(full.length > 158 ? `${full.slice(0, 155).replace(/\s+\S*$/, '')}…` : full);
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

// The app's own words for a dietary value and for how sure the record is
// (i18n/locales/en.js `dietary.*`, `trust.*`), for the static text below.
const CLAIM_WORD = {
  halal: { certified: 'Halal-certified', friendly: 'Halal-friendly', porkFree: 'Pork-free' },
  vegan: { full: 'Fully vegan', options: 'Vegan options' },
};
const SURE_WORD = { confirmed: 'Confirmed', supported: 'Reported', inferred: 'Our reading' };
const claimLines = (place) => ['vegan', 'halal']
  .map(k => place.dietary?.[k])
  .map((fact, i) => (fact && SURE_WORD[fact.confidence] && CLAIM_WORD[i === 0 ? 'vegan' : 'halal'][fact.value]
    ? `${CLAIM_WORD[i === 0 ? 'vegan' : 'halal'][fact.value]} (${SURE_WORD[fact.confidence]})`
    : null))
  .filter(Boolean);
const knownText = (fact) => (fact && fact.confidence !== 'unknown' && typeof fact.value === 'string' ? fact.value : null);

// What a place page says before the script runs, in place of the loading
// screen: the name, where it is, and each dietary claim with how sure the
// record is — the same words the app shows, and no more. A search engine
// reads this; a visitor sees it for the second the app takes to start.
function placeBody(place) {
  const claims = claimLines(place);
  const address = knownText(place.address);
  return `<div id="root"><main style="max-width:640px;margin:0 auto;padding:24px;background:#F7F7F8;color:#1F2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.5">`
    + STATIC_SCROLL
    + `<p style="margin:0;font-size:13px;font-weight:700"><a href="/" style="display:inline-block;padding:12px 0;color:#087F5B;text-decoration:none">K-Food Map · Vegan and halal food across Korea</a></p>`
    + `<h1 style="margin:0 0 4px;font-size:26px">${escapeHtml(place.name)}</h1>`
    + `<p style="margin:0 0 12px;color:#3F444A">${escapeHtml(place.zone ?? '')}</p>`
    + (claims.length ? `<p style="margin:0 0 12px;font-weight:600">${claims.map(escapeHtml).join(' · ')}</p>` : '')
    + (place.vibe ? `<p style="margin:0 0 12px">${escapeHtml(place.vibe)}</p>` : '')
    + (address ? `<p style="margin:0 0 12px;color:#3F444A">${escapeHtml(address)}</p>` : '')
    + `<p style="margin:0;font-size:13px;color:#616875">Confirmed: checked against a primary source. Reported: a source says so. Our reading: our best guess. If your diet is strict, ask staff before you order.</p>`
    // Where to go from here, for a reader without the app and for a
    // crawler: the guides this place is listed in.
    + (guidesOf(place).length ? `<p style="margin:16px 0 0;font-size:14px">${guidesOf(place).map(g => `<a href="/find/${g.slug}" style="display:inline-block;padding:12px 12px 12px 0;color:#087F5B">${g.diet.word} food in ${g.area}</a>`).join('')}</p>` : '')
    + `</main></div>`;
}

// schema.org data for the same page: what the place is and where. The diet
// is left out on purpose — the vocabulary has no way to say "reported, not
// confirmed", and a bare claim there would be stronger than the record.
function placeJsonLd(place) {
  const address = knownText(place.address);
  const c = place.coordinates?.value;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: displayName(place.name),
    url: `${SITE_URL}/place/${place.id}`,
    ...(address ? { address: { '@type': 'PostalAddress', streetAddress: address, addressCountry: 'KR' } } : {}),
    ...(c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } } : {}),
  };
  // "<" cannot end the script element early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

const ROOT = /<div id="root">[\s\S]*?<\/div><\/div>/;
if (!ROOT.test(template)) throw new Error('prerender: the #root loading screen is not where the template had it');

function pageFor(place) {
  return [
    ...replacements(place),
    [ROOT, placeBody(place)],
    [/<\/head>/, `  ${placeJsonLd(place)}\n  </head>`],
  ].reduce(
    (html, [pattern, value]) => html.replace(pattern, () => value),
    template,
  );
}

const active = restaurants.filter(r => !isQuarantined(r));


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
// The cards page before the app starts: the Korean a traveller came for,
// readable (and indexable) without the script. The app's own sheet has the
// questions, the likely answers and the large view.
const cardsBody = () => {
  const card = (c, heading) => `<h2 style="margin:20px 0 8px;font-size:18px">${heading}</h2>`
    + `<div style="padding:16px;background:#fff;border:2px solid #1F2328;border-radius:12px">${c.statement.map(l => `<p lang="ko" style="margin:0 0 8px;font-size:18px;font-weight:600;line-height:1.5">${escapeHtml(l.ko)}</p>`).join('')}</div>`;
  return `<div id="root"><main style="max-width:640px;margin:0 auto;padding:24px;background:#F7F7F8;color:#1F2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.5">`
    + STATIC_SCROLL
    + `<p style="margin:0;font-size:13px;font-weight:700"><a href="/" style="display:inline-block;padding:12px 0;color:#087F5B;text-decoration:none">K-Food Map · Vegan and halal food across Korea</a></p>`
    + `<h1 style="margin:0 0 8px;font-size:26px">Korean cards to show restaurant staff</h1>`
    + `<p style="margin:0;color:#3F444A">Most restaurant staff in Korea do not read English. Show one of these on your phone. The full page adds questions about hidden ingredients, the answers you may hear, and a large view to hold up.</p>`
    + card(cardById('vegan'), 'If you are vegan')
    + card(cardById('muslim'), 'If you are Muslim')
    + `<p style="margin:16px 0 0;font-size:13px;color:#616875">A card asks; it cannot promise what a kitchen serves. An unsure answer is best treated as a no.</p>`
    + `</main></div>`;
};

for (const [slug, title, index, description, body] of [
  ['discover', 'Food journeys and stories · K-Food Map', true, 'Half-day food journeys for vegan and Muslim visitors to Korea: every stop on the map, each dietary claim marked with how sure the record is, and the stories behind the places.', null],
  ['cards', 'Korean cards to show restaurant staff — vegan and Muslim travellers · K-Food Map', true, 'Polite Korean to show restaurant staff: “I am vegan”, “I am Muslim”, and questions about hidden ingredients such as fish sauce, pork stock and cooking wine.', cardsBody()],
  ['journal', 'Your food passport · K-Food Map', false, null, null],
  ['profile', 'Profile · K-Food Map', false, null, null],
]) {
  const url = `${SITE_URL}/${slug}`;
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    ...(description ? [
      [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`],
      [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`],
    ] : []),
    ...(body ? [[ROOT, body]] : []),
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

const guides = [];
for (const diet of DIETS) {
  for (const area of Object.keys(AREA_NAMES)) {
    const places = active
      .filter(r => matchesDietary(r, diet.chip) && matchesArea(r, area))
      .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
    if (places.length >= GUIDE_MIN) guides.push({ diet, area, places, slug: `${diet.slug}-${area.toLowerCase()}` });
  }
}

const guidesOf = (place) => guides.filter(g => g.places.includes(place));

for (const place of active) {
  const dir = path.join(distDir, 'place', place.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), pageFor(place), 'utf8');
}

function guideBody(guide) {
  const { diet, area, places } = guide;
  const items = places.map((r) => {
    const fact = r.dietary[diet.fact];
    const claim = `${CLAIM_WORD[diet.fact][fact.value]} (${SURE_WORD[fact.confidence]})`;
    return `<li style="margin:0"><a href="/place/${r.id}" style="display:block;padding:8px 0;color:#087F5B;font-weight:600;text-decoration:none">${escapeHtml(displayName(r.name))}<br><span style="font-size:14px;font-weight:400;color:#3F444A">${escapeHtml(r.zone)} · ${claim}</span></a></li>`;
  }).join('');
  const others = guides
    .filter(g => g.diet === diet && g !== guide)
    .map(g => `<a href="/find/${g.slug}" style="display:inline-block;padding:12px 8px;color:#087F5B">${g.area}</a>`)
    .join('');
  return `<div id="root"><main style="max-width:640px;margin:0 auto;padding:24px;background:#F7F7F8;color:#1F2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.5">`
    + STATIC_SCROLL
    + `<p style="margin:0;font-size:13px;font-weight:700;color:#087F5B">K-Food Map</p>`
    + `<h1 style="margin:6px 0 8px;font-size:26px">${diet.word} food in ${area}</h1>`
    + `<p style="margin:0 0 16px;color:#3F444A">${places.length} places on the map. Each line says what the record says and how sure it is: Confirmed (checked against a primary source), Reported (a source says so) or Our reading (our best guess). Kitchens change — if your diet is strict, ask staff before you order.</p>`
    + `<p style="margin:0 0 16px"><a href="/#q=${area}&amp;a=1&amp;f=${diet.chip}" style="display:inline-block;padding:12px 18px;background:#087F5B;color:#fff;border-radius:12px;font-weight:600;text-decoration:none">Open these on the map</a></p>`
    + `<ul style="margin:0;padding:0 0 0 18px">${items}</ul>`
    + (others ? `<p style="margin:20px 0 0;font-size:14px;color:#3F444A"><a href="/find/${diet.slug}" style="display:inline-block;padding:12px 0;color:#087F5B">${diet.word} food in Korea</a><br>Other areas: ${others}</p>` : '')
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
    // The same list for a search engine, as a list of pages: order and
    // addresses only, no dietary claim (see placeJsonLd).
    [/<\/head>/, `  <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${diet.word} food in ${area}`,
      numberOfItems: places.length,
      itemListElement: places.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/place/${r.id}`, name: displayName(r.name) })),
    }).replace(/</g, '\\u003c')}</script>
  </head>`],
  ].reduce((html, [pattern, value]) => {
    if (!pattern.test(html)) throw new Error(`prerender: guide template lost ${pattern}`);
    return html.replace(pattern, () => value);
  }, template);
  mkdirSync(path.join(distDir, 'find', guide.slug), { recursive: true });
  writeFileSync(path.join(distDir, 'find', guide.slug, 'index.html'), page, 'utf8');
}

// One page per diet for the whole country: /find/halal, /find/vegan. Not a
// list of every place (hundreds) but the way in to the area guides, each
// with its count, most first.
const hubs = DIETS.map(diet => ({
  diet,
  total: active.filter(r => matchesDietary(r, diet.chip)).length,
  areas: guides.filter(g => g.diet === diet).sort((a, b) => b.places.length - a.places.length),
}));
for (const hub of hubs) {
  const { diet, total, areas } = hub;
  const url = `${SITE_URL}/find/${diet.slug}`;
  const title = `${diet.word} food in Korea — ${total} places by area · K-Food Map`;
  const description = `${total} ${diet.word.toLowerCase()} places across Korea, by city and neighbourhood. Each dietary claim is marked Confirmed, Reported or Our reading, with its source.`;
  const items = areas.map(g => `<li style="margin:0"><a href="/find/${g.slug}" style="display:block;padding:11px 0;color:#087F5B;font-weight:600;text-decoration:none">${diet.word} food in ${g.area} <span style="font-weight:400;color:#3F444A">· ${g.places.length} places</span></a></li>`).join('');
  const body = `<div id="root"><main style="max-width:640px;margin:0 auto;padding:24px;background:#F7F7F8;color:#1F2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.5">`
    + STATIC_SCROLL
    + `<p style="margin:0;font-size:13px;font-weight:700;color:#087F5B">K-Food Map</p>`
    + `<h1 style="margin:6px 0 8px;font-size:26px">${diet.word} food in Korea</h1>`
    + `<p style="margin:0 0 16px;color:#3F444A">${total} places on the map, each researched one at a time. Every dietary claim says how sure the record is: Confirmed, Reported or Our reading. An area can sit inside another (Itaewon is in Yongsan, in Seoul), so the counts overlap.</p>`
    + `<p style="margin:0 0 16px"><a href="/#f=${diet.chip}" style="display:inline-block;padding:12px 18px;background:#087F5B;color:#fff;border-radius:12px;font-weight:600;text-decoration:none">Open all of them on the map</a></p>`
    + `<ul style="margin:0;padding:0 0 0 18px">${items}</ul>`
    + `</main></div>`;
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    [ROOT, body],
  ].reduce((html, [pattern, value]) => html.replace(pattern, () => value), template);
  mkdirSync(path.join(distDir, 'find', diet.slug), { recursive: true });
  writeFileSync(path.join(distDir, 'find', diet.slug, 'index.html'), page, 'utf8');
}

// The home page links to the guides, under its loading screen: a way in for
// a crawler (home → guide → place) and for a browser without JavaScript.
// The most-populated areas only; every guide links to the rest. React
// replaces the whole of #root when it starts, as on every other page.
{
  const links = DIETS.map((diet) => {
    const top = guides.filter(g => g.diet === diet).sort((a, b) => b.places.length - a.places.length).slice(0, 8);
    return `<p style="margin:6px 0 0;font-size:13px;color:#616875"><a href="/find/${diet.slug}" style="display:inline-block;padding:12px 6px 12px 0;color:#087F5B;font-weight:600">${diet.word} food in Korea</a>`
      + top.map(g => `<a href="/find/${g.slug}" style="display:inline-block;padding:12px 6px;color:#087F5B">${g.area}</a>`).join('') + '</p>';
  }).join('');
  const END = '</p></div></div>';
  if (!template.includes(END)) throw new Error('prerender: the home loading screen no longer ends where the guide links go');
  const home = template.replace(END, () => `</p><nav aria-label="Browse by area" style="margin-top:14px">${links}</nav></div></div>`);
  writeFileSync(path.join(distDir, 'index.html'), home, 'utf8');
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
  const urls = ['', 'discover', 'cards', ...hubs.map(h => `find/${h.diet.slug}`), ...guides.map(g => `find/${g.slug}`), ...active.map(place => `place/${place.id}`)];
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
console.log(`Wrote submit/, privacy/, discover/, cards/, journal/, profile/ index.html, sitemap.xml (${active.length + 3 + guides.length + hubs.length} URLs) and robots.txt.`);
