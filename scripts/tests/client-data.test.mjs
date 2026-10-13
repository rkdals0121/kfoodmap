import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restaurants } from '../../src/data/restaurants.js';
import { clientRecord, clientModule, placeDataFile, DETAIL_ONLY, AUDIT_KEYS } from '../lib/client-data.mjs';

const keysOf = (v, out = new Set()) => {
  if (Array.isArray(v)) v.forEach(x => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
};

test('the bundled copy carries no audit trail and no detail-only field', () => {
  const slim = restaurants.map(clientRecord);
  for (const k of AUDIT_KEYS) assert.equal(keysOf(slim).has(k), false, k);
  for (const r of slim) for (const k of DETAIL_ONLY) assert.equal(k in r, false, `${r.id}.${k}`);
});

test('everything the list, map and filters read is still in the bundle', () => {
  for (let i = 0; i < restaurants.length; i++) {
    const full = restaurants[i], slim = clientRecord(full);
    for (const k of ['id', 'name', 'zone', 'category', 'traits', 'vibe', 'story']) assert.deepStrictEqual(slim[k], full[k], `${full.id}.${k}`);
    assert.deepStrictEqual(slim.coordinates.value, full.coordinates.value);
    assert.deepStrictEqual(slim.address.value, full.address.value);
    assert.deepStrictEqual(slim.hours.value, full.hours.value);
    assert.equal(slim.dietary.vegan.value, full.dietary.vegan.value);
    assert.equal(slim.dietary.vegan.confidence, full.dietary.vegan.confidence);
    assert.equal(slim.dietary.halal.value, full.dietary.halal.value);
    assert.equal(slim.dietary.halal.confidence, full.dietary.halal.confidence);
    assert.deepStrictEqual(slim.lifecycle, full.lifecycle === undefined ? undefined : clientRecord({ l: full.lifecycle }).l);
  }
});

test('the bundled module evaluates to exactly the slim records', async () => {
  const mod = await import('data:text/javascript,' + encodeURIComponent(clientModule(restaurants)));
  assert.deepStrictEqual(mod.restaurants, restaurants.map(clientRecord));
});

test('the per-place file is the whole record, evidence included', () => {
  for (const r of restaurants) assert.deepStrictEqual(JSON.parse(placeDataFile(r).source), JSON.parse(JSON.stringify(r)));
});

test('only the detail view reads stripped fields — anything else must fetch the record first', () => {
  const files = [];
  const collect = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) collect(p);
      else if (/\.(jsx?|mjs)$/.test(name)) files.push(p);
    }
  };
  collect(fileURLToPath(new URL('../../src', import.meta.url)));
  const allowed = ['data/restaurants.js', 'data/verification.js', 'components/RestaurantDetail.jsx'];
  // `.url` is left out of the pattern: auth code reads URLs of its own.
  const pattern = new RegExp(`\\.(evidence|method|lastCheckedAt|${DETAIL_ONLY.join('|')})\\b`);
  const readers = files
    .filter(f => !allowed.some(a => f.replaceAll('\\', '/').endsWith(a)))
    // Translated text, not code: a note quoting "www.instagram.com" reads no field.
    .filter(f => !/\/data\/(?:notes\/notes-|story-|menu-)[^/]+\.js$/.test(f.replaceAll('\\', '/')))
    .filter(f => pattern.test(readFileSync(f, 'utf8')));
  assert.deepEqual(readers, []);
});

test('the list carries the key of a station within a kilometre, and a station search uses it', async () => {
  const { searchPlaces } = await import('../../src/search.js');
  const { stationKey } = await import('../../src/data/station-ko.js');
  const { restaurants: all } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const places = all.filter(r => !isQuarantined(r)).map(clientRecord);
  const full = new Map(all.map(r => [r.id, r]));
  for (const r of places) {
    const t = full.get(r.id).transit?.value;
    assert.equal(r.nearStation ?? null, t?.station && t.distanceM <= 1000 ? stationKey(t.station) : null, r.id);
    assert.equal('transit' in r, false);
  }
  // One key for the spellings the records use.
  assert.equal(stationKey('Myeong-dong'), stationKey('Myeongdong'));
  assert.equal(stationKey('Seoul Nat’l Univ.'), stationKey("Seoul Nat'l Univ. Station"));
  const go = (query, filters = []) => searchPlaces({ places, query, filters, now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  const ids = (list) => list.map(r => r.id).sort().join(',');
  // Stations no list of names knows, asked in Korean: the places whose station it is.
  for (const ko of ['반월당역', '합정역', '혜화역', '선릉역', '을지로입구역', '동묘역']) {
    const found = go(ko);
    assert.ok(found.length > 0, ko);
    assert.ok(places.filter(r => r.nearStation === stationKey(ko)).every(r => found.includes(r)) || ko === '동묘역', ko);
  }
  // However a station is written, the same places.
  for (const group of [['안국역', 'Anguk Station', '安国駅', 'anguk station'], ['명동역', 'Myeongdong Station', '明洞駅'], ['방배역', 'Bangbae Station'], ['서울대입구역', "Seoul Nat'l Univ. Station"], ['홍대입구역 3번 출구', '홍대입구역']]) {
    for (const q of group.slice(1)) assert.equal(ids(go(q)), ids(go(group[0])), `${q} = ${group[0]}`);
  }
  // More than the places that name the station in their own text.
  assert.ok(go('안국역').length > go('안국역').filter(r => /Anguk Station/i.test(`${r.name} ${r.vibe} ${r.zone}`)).length);
  // Two stations of one name are not one place; a city beside it says which.
  const km = (a, b) => Math.hypot((a.coordinates.value.lat - b.coordinates.value.lat) * 111, (a.coordinates.value.lng - b.coordinates.value.lng) * 88);
  for (const q of ['시청역', '중앙로역']) { const found = go(q); assert.ok(found.length > 0 && found.every(r => km(r, found[0]) < 10), q); }
  assert.ok(go('대전 중앙로역').every(r => /Daejeon/.test(r.address.value)) && go('대전 중앙로역').length > 0);
  assert.ok(go('대구 중앙로역').every(r => /Daegu/.test(r.address.value)) && go('대구 중앙로역').length > 0);
  // A story that names another station is not this one.
  assert.ok(go('Eonju Station').every(r => !/Jeonju/.test(r.address.value)));
  assert.equal(go('없는역').length, 0);
});

test('a station beside other words, a station that is a neighbourhood, and words that only look like stations', async () => {
  const { searchPlaces } = await import('../../src/search.js');
  const { restaurants: all } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const places = all.filter(r => !isQuarantined(r)).map(clientRecord);
  const go = (query, filters = []) => searchPlaces({ places, query, filters, now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  const ids = (list) => list.map(r => r.id).sort().join(',');
  // The station is where, the rest is what: never fewer than the words found by themselves.
  assert.ok(go('이태원역 케밥').length >= 5);
  assert.ok(go('이태원역 케밥').every(r => /kebab/i.test(`${r.name} ${r.vibe} ${r.story}`)));
  assert.equal(ids(go('안국역 한식')), ids(go('Anguk Station korean')));
  // A station whose name is a neighbourhood keeps the neighbourhood.
  assert.ok(go('성수역').length >= go('성수').length);
  // However it is written.
  assert.equal(ids(go('hongik univ station')), ids(go('Hongik Univ. Station')));
  assert.equal(ids(go('강남역 10번 출구')), ids(go('강남역')));
  // Not stations: a region, a word that happens to end so.
  assert.equal(go('지역 맛집').length, 0);
  assert.equal(go('무역센터 카페').length, 0);
});
