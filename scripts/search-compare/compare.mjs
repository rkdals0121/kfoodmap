// The search before a change against the search after it: every place name,
// each word of a name, every area, every address word and every search
// quoted in the tests is run through both, and the ones whose results (or
// whose reading of the query) differ are printed. Run by ./run.sh, which
// puts the committed `src` in ./old and the working `src` in ./new.
// A search rule goes out only when what differs here is what was meant.
import { readFileSync } from 'node:fs';
const load = async (d) => {
  const { restaurants } = await import(`./${d}/src/data/restaurants.js`);
  const { isQuarantined } = await import(`./${d}/src/data/verification.js`);
  const { searchPlaces } = await import(`./${d}/src/search.js`);
  const an = await import(`./${d}/src/data/area-names.js`);
  const places = restaurants.filter(r => !isQuarantined(r));
  return { go: (q, f = []) => searchPlaces({ places, query: q, filters: f }), an, places };
};
const O = await load('old'), N = await load('new');
const qs = new Set();
const add = (q) => { const s = String(q ?? '').trim(); if (s) qs.add(s); };
for (const p of N.places) {
  add(p.name); for (const part of String(p.name).split(/[()]/)) add(part);
  for (const w of String(p.name).split(/[\s()·,]+/)) if (w.length >= 2) add(w);
  add(p.zone); for (const part of String(p.zone ?? '').split(/[,()]/)) add(part);
  for (const w of String(p.address?.value ?? '').split(/[\s,]+/)) if (w.length >= 3) add(w);
}
for (const [k, v] of Object.entries(N.an.AREAS ?? {})) { add(k); for (const a of [].concat(v ?? [])) if (typeof a === 'string') add(a); for (const d of ['halal', 'vegan', 'restaurant', 'best vegan', 'halal near']) add(`${k} ${d}`); }
const tests = readFileSync('./new/scripts/tests/search-places.test.mjs', 'utf8');
for (const m of tests.matchAll(/'([^'\n]{2,60})'/g)) add(m[1]);
for (const m of tests.matchAll(/"([^"\n]{2,60})"/g)) add(m[1]);
let diff = 0;
for (const q of qs) {
  for (const f of [[]]) {
    const a = O.go(q, f), b = N.go(q, f);
    const A = a.filteredRestaurants.map(p => p.id).join(','), B = b.filteredRestaurants.map(p => p.id).join(',');
    if (A !== B || a.matchQuery !== b.matchQuery) { diff += 1; if (diff <= 40) console.log(`## ${JSON.stringify(q)} [${f}] old ${a.filteredRestaurants.length} new ${b.filteredRestaurants.length} mq ${a.matchQuery}|${b.matchQuery}`); }
  }
}
console.log(`${qs.size} queries x 1, ${diff} differ`);
