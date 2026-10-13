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

test('the list carries the name of a station within a kilometre, and a station search uses it', async () => {
  const { searchPlaces } = await import('../../src/search.js');
  const { restaurants: all } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const places = all.filter(r => !isQuarantined(r)).map(clientRecord);
  const full = new Map(all.map(r => [r.id, r]));
  for (const r of places) {
    const t = full.get(r.id).transit?.value;
    assert.equal(r.nearStation, t?.station && t.distanceM <= 1000 ? t.station : null, r.id);
  }
  const go = (query, filters = []) => searchPlaces({ places, query, filters, now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  // Stations no list of names knows, asked in Korean: the places whose station it is.
  for (const [ko, roman] of [['반월당역', 'Banwoldang'], ['합정역', 'Hapjeong'], ['혜화역', 'Hyehwa']]) {
    const found = go(ko);
    assert.ok(found.length > 0, ko);
    // …with the neighbourhood of that name, when there is one.
    assert.ok(places.filter(r => r.nearStation === roman).every(r => found.includes(r)), ko);
    assert.ok(found.every(r => r.nearStation === roman || `${r.zone} ${r.address?.value} ${r.vibe} ${r.name}`.includes(roman)), ko);
  }
  // A station that was found by its name in a place's text also lists the places beside it.
  assert.ok(go('안국역').length > go('안국역').filter(r => /Anguk Station/i.test(`${r.name} ${r.vibe} ${r.zone}`)).length);
  assert.deepEqual(go('안국역').map(r => r.id).sort(), go('Anguk Station').map(r => r.id).sort());
  assert.equal(go('없는역').length, 0);
});
