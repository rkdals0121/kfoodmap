// A look at the deployed site from outside, after a deploy: `npm run smoke`
// (or `npm run smoke -- http://localhost:4173` against a local build).
//
// It asks for the pages a visitor and a search engine ask for, and checks
// that each answers with what the build was supposed to put there: the
// app's own files, a place page with its content and structured data, an
// area guide with its list, a sitemap that matches the data. It reads
// only — nothing is submitted and no account is touched. It does not run
// the app; `npm test` and a look in a browser cover that.
import { restaurants } from '../src/data/restaurants.js';
import { isQuarantined } from '../src/data/verification.js';

const BASE = (process.argv[2] ?? 'https://kfoodmap.vercel.app').replace(/\/$/, '');
const active = restaurants.filter(r => !isQuarantined(r));
const sample = active[0];

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const get = async (path) => {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  return { status: res.status, type: res.headers.get('content-type') ?? '', text: await res.text() };
};

const home = await get('/');
check('home answers', home.status === 200);
const chunks = [...home.text.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
check('home names its scripts', chunks.length >= 3, `${chunks.length} found`);
for (const c of chunks) {
  const js = await get(c);
  // A host that answers a missing file with the app's HTML would pass a
  // status check and break the app: the type is the test.
  check(`script ${c.split('/').pop()}`, js.status === 200 && /javascript/.test(js.type), `${js.status} ${js.type}`);
}
check('home links to the area guides', /href="\/find\/[a-z]+-[a-z]+"/.test(home.text));

for (const path of ['/discover', '/cards', '/journal', '/profile', '/privacy', '/submit']) {
  const page = await get(path);
  check(`${path} answers`, page.status === 200 && page.text.includes('<div id="root">'));
}

const place = await get(`/place/${sample.id}`);
check('a place page answers', place.status === 200);
check('…with its own title', place.text.includes('· K-Food Map</title>') && !place.text.includes('<title>K-Food Map ·'));
check('…with its content before the script', /<h1[^>]*>[^<]+<\/h1>/.test(place.text));
const ld = place.text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
let ldOk = false;
try { ldOk = JSON.parse(ld[1])['@type'] === 'Restaurant'; } catch { /* reported below */ }
check('…with structured data that parses', ldOk);

const guide = await get('/find/halal-seoul');
const guideLinks = [...guide.text.matchAll(/href="(\/place\/[a-z0-9-]+)"/g)].map(m => m[1]);
check('an area guide answers', guide.status === 200 && /<h1[^>]*>Halal food in Seoul<\/h1>/.test(guide.text));
check('…listing places', guideLinks.length >= 3, `${guideLinks.length} links`);
check('…each claim with its confidence', /\((Confirmed|Reported|Our reading)\)/.test(guide.text));
if (guideLinks[0]) check('…and its first link works', (await get(guideLinks[0])).status === 200, guideLinks[0]);

const sitemap = await get('/sitemap.xml');
const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const places = urls.filter(u => u.includes('/place/')).length;
check('sitemap answers', sitemap.status === 200 && urls.length > 0, `${urls.length} URLs`);
check('sitemap lists every active place', places === active.length, `${places} of ${active.length}`);
check('sitemap lists the area guides', urls.some(u => u.includes('/find/')));

const manifest = await get('/manifest.webmanifest');
check('web app manifest answers', manifest.status === 200 && manifest.text.includes('"K-Food Map"'));
check('service worker answers', (await get('/sw.js')).status === 200);

console.log(failed === 0 ? `\nAll checks passed against ${BASE}.` : `\n${failed} check(s) failed against ${BASE}.`);
process.exit(failed === 0 ? 0 : 1);
