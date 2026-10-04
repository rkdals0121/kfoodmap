// src/search.js against the real records. Counts change as places are
// added, so these assert relations — two spellings find the same places, a
// fallback names what it did — not numbers. Each case is a search that once
// went wrong (docs/MOBILE-AUDIT-2026-10-04.ko.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';
import { searchPlaces, stationOf, MAX_QUERY } from '../../src/search.js';

const places = restaurants.filter(r => !isQuarantined(r));
const go = (query, filters = []) => searchPlaces({ places, query, filters });
const ids = (r) => r.filteredRestaurants.map(p => p.id).sort().join(',');

test('a station is read in every way it is written', () => {
  assert.deepEqual(stationOf('Seoul Station'), { area: 'Seoul', phrase: 'Seoul station' });
  for (const q of ['Seoul Station exit 1', 'seoul stn', 'seoul stn.', '서울역', '서울 역', '서울역 1번 출구', '首尔站', 'ソウル駅']) {
    assert.equal(stationOf(q)?.area.toLowerCase(), 'seoul', q);
  }
  assert.equal(stationOf('홍대입구역')?.area, 'Hongdae');
  assert.equal(stationOf('弘大入口站')?.area, 'Hongdae');
  // Seaweed and trade end in 역 and are not stations.
  assert.equal(stationOf('미역'), null);
  assert.equal(stationOf('무역'), null);
  assert.equal(stationOf('Itaewon'), null);
  assert.equal(stationOf('subway station'), null);
});

test('a station finds the same places however it is written', () => {
  const base = go('Seoul Station');
  assert.ok(base.filteredRestaurants.length > 0 && base.filteredRestaurants.length < 20, 'the station, not the city');
  for (const q of ['Seoul Station exit 1', 'seoul stn', '서울역', '서울 역', '서울역 1번 출구', '首尔站']) {
    assert.equal(ids(go(q)), ids(base), q);
    assert.equal(go(q).matchQuery, 'Seoul Station', q);
  }
});

test('a station whose places fall outside the chips: the nearest that match, from the station', () => {
  const r = go('Seoul Station', ['Halal']);
  // Not every halal place in Seoul.
  assert.ok(r.filteredRestaurants.length < 10);
  if (r.filteredRestaurants.length === 0) {
    assert.ok(r.nearest.length > 0);
    assert.equal(r.nearestFrom, 'Seoul Station');
    assert.ok(r.nearest.every(x => x.km <= 4));
  }
});

test('chips emptying a search are no reason to guess another area', () => {
  // Mangwon is one letter from Gangwon and has no halal place on record.
  const r = go('Mangwon', ['Halal']);
  assert.equal(r.matchQuery, 'Mangwon');
  assert.ok(r.filteredRestaurants.every(p => !/Gangwon/i.test(p.zone)));
  // The typo is still read when the word finds nothing at all.
  assert.equal(go('myongdong').matchQuery, 'Myeongdong');
  assert.equal(go('myongdong station').matchQuery, 'Myeongdong');
});

test('nearest matches are measured from the area searched, never from a shared word', () => {
  const r = go('Haeundae', ['Halal']);
  if (r.filteredRestaurants.length === 0 && r.nearest.length > 0) {
    assert.equal(r.nearestFrom, 'Haeundae');
    assert.ok(r.nearest.every(x => /Busan/.test(x.place.zone)), 'Haeundae is in Busan');
  }
  // "cafe" is in a street's name; that street is not where to measure from.
  assert.notEqual(go('cafe', ['Halal']).nearestFrom, 'cafe');
});

test('spellings, widths, accents and punctuation', () => {
  const itaewon = ids(go('Itaewon'));
  for (const q of ['ｉｔａｅｗｏｎ', 'İtaewon', 'Itaewon.', '이태원', '梨泰院']) assert.equal(ids(go(q)), itaewon, q);
  assert.equal(ids(go('café')), ids(go('cafe')));
  assert.equal(ids(go('kimbap')), ids(go('gimbap')));
  assert.equal(ids(go('no pork')), ids(go('pork-free')));
  assert.equal(ids(go('pork free')), ids(go('pork-free')));
  assert.ok(go('Seoul, Itaewon').filteredRestaurants.length > 0);
  assert.equal(ids(go('홍대입구')), ids(go('Hongdae')));
  assert.equal(ids(go('Lotte World Tower')), ids(go('Lotte World')));
  // The island is not the city: 제주도 and 济州岛 are all of Jeju.
  for (const q of ['제주도', '济州岛', '済州島']) assert.equal(ids(go(q)), ids(go('Jeju')), q);
  assert.ok(go('濟州市').filteredRestaurants.length < go('Jeju').filteredRestaurants.length);
  assert.equal(ids(go('寺院料理')), ids(go('temple')));
  assert.equal(ids(go('広安里')), ids(go('Gwangalli')));
});

test('a place looked up by a name that ends in "Station" is that place', () => {
  const r = go('Kervan Famille Station');
  assert.equal(r.filteredRestaurants.length, 1);
  assert.equal(r.matchQuery, 'Kervan Famille Station');
});

test('nothing typed, or only signs, is every place; a page of pasted text does not throw', () => {
  for (const q of ['', ' ', '(', '-', '.']) assert.equal(go(q).filteredRestaurants.length, places.length, JSON.stringify(q));
  assert.doesNotThrow(() => go('x'.repeat(9000)));
  assert.doesNotThrow(() => go('ab '.repeat(4000)));
  for (const q of ['?', '\\', '*', '.*', '[', '$', '^', '+', '|', 'constructor', '__proto__']) assert.doesNotThrow(() => go(q), q);
  assert.ok(MAX_QUERY <= 100);
});

test('the count of places hidden for having no hours matches the list', () => {
  const now = new Date(Date.UTC(2026, 9, 5, 3, 0)); // Monday noon in Korea
  for (const q of ['', 'Itaewon', 'Seoul Station', '서울역']) {
    const off = searchPlaces({ places, query: q, filters: ['Halal', 'Open now'], openOn: true, now });
    const on = searchPlaces({ places, query: q, filters: ['Halal', 'Open now'], openOn: true, includeUnknown: true, now });
    assert.equal(on.filteredRestaurants.length - off.filteredRestaurants.length, off.unknownHours, q);
  }
});
