import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, matchesArea } from '../../src/filters.js';

const place = {
  name: 'Kervan Turkish Restaurant (케르반) COEX',
  vibe: 'Turkish grill under the mall',
  zone: 'Samseong, Seoul',
  address: { value: '513 Yeongdong-daero, Gangnam-gu, Seoul (Starfield COEX Mall B1, H105)' },
};

test('an empty query matches everything', () => {
  assert.equal(matchesSearch(place, ''), true);
  assert.equal(matchesSearch(place, '   '), true);
});

test('the district in the address is searchable, not just the neighbourhood label', () => {
  assert.equal(matchesSearch(place, 'Gangnam'), true);
});

test('hyphens and spaces do not matter', () => {
  assert.equal(matchesSearch(place, 'gangnam gu'), true);
  assert.equal(matchesSearch(place, 'Gangnamgu'), true);
  assert.equal(matchesSearch(place, 'yeongdong daero'), true);
});

test('the Korean name is searchable', () => {
  assert.equal(matchesSearch(place, '케르반'), true);
});

test('an unknown address does not break search', () => {
  assert.equal(matchesSearch({ ...place, address: { value: null } }, 'Samseong'), true);
  assert.equal(matchesSearch({ ...place, address: { value: null } }, 'Busan'), false);
});

test('several words match across fields, each somewhere', () => {
  const busan = { name: 'Soban', zone: 'Seo-gu, Busan', story: 'Korean home cooking, fully vegan.', address: { value: '1 Road' } };
  assert.equal(matchesSearch(busan, 'Busan korean'), true);
  assert.equal(matchesSearch(busan, 'Busan halal'), false);
  assert.equal(matchesSearch(place, 'Turkish Samseong'), true);
});

const at = (zone, address, name = 'X') => ({ name, zone, address: { value: address }, dietary: {}, traits: [] });

test('a search word must start a word, not sit inside one', () => {
  assert.equal(matchesSearch(at('Iseo-myeon, Wanju', '1 Gil, Iseo-myeon, Wanju-gun'), 'Seomyeon'), false);
  assert.equal(matchesSearch(at('Mapo-gu, Seoul', '1 Ro, Mapo-gu, Seoul'), 'mapo gu'), true);
  assert.equal(matchesSearch(at('Mapo-gu, Seoul', '1 Ro, Mapo-gu, Seoul'), 'mapogu'), true);
});

test('Seomyeon and Hongdae find the places their addresses name differently', () => {
  assert.equal(matchesSearch(at('Jeonpo-dong, Busanjin-gu, Busan', '2 Ro, Busanjin-gu, Busan (Jeonpo-dong)'), 'Seomyeon'), true);
  assert.equal(matchesArea(at('Seogyo-dong, Mapo-gu, Seoul', '3 Ro, Mapo-gu, Seoul (Seogyo-dong)'), 'hongdae'), true);
});

test('two-letter words do not make every address an area match', () => {
  assert.equal(matchesArea(at('Jung-gu, Seoul', '1 Ro, Jung-gu, Seoul'), 'mapo gu'), false);
});

test('a diet word finds what its chip finds', () => {
  const p = { name: 'Y', zone: 'Z', address: { value: 'A' }, traits: [],
    dietary: { halal: { value: 'friendly', confidence: 'supported', source: 'x' } } };
  assert.equal(matchesSearch(p, 'halal'), true);
});

test('an area typed in Korean, Japanese or Chinese finds the romanised area', async () => {
  const { romaniseQuery, romanisedArea, AREA_NAMES } = await import('../../src/data/area-names.js');
  const busan = at('Jeonpo-dong, Busanjin-gu, Busan', '2 Ro, Busanjin-gu, Busan');
  for (const q of ['부산', '釜山', 'プサン']) {
    assert.equal(matchesSearch(busan, q), true, q);
    assert.equal(matchesArea(busan, q), true, q);
  }
  assert.equal(matchesSearch(at('Myeongdong, Seoul', '1 Ro, Jung-gu, Seoul'), '明洞'), true);
  assert.equal(matchesSearch(at('Myeongdong, Seoul', '1 Ro, Jung-gu, Seoul'), '釜山'), false);
  assert.equal(romanisedArea('首爾'), 'Seoul');
  assert.equal(romaniseQuery('Busan vegan'), null);
  assert.equal(romaniseQuery('釜山 ヴィーガン'), 'Busan ヴィーガン');
  // No name is listed under two areas.
  const all = Object.values(AREA_NAMES).flat();
  assert.equal(new Set(all).size, all.length);
});

test('an area and a diet word in another language combine', () => {
  const p = { name: 'Y', zone: 'Seomyeon, Busan', address: { value: '1 Ro, Busanjin-gu, Busan' }, traits: [],
    dietary: { vegan: { value: 'full', confidence: 'supported', source: 'x' } } };
  assert.equal(matchesSearch(p, '釜山 ヴィーガン'), true);
  assert.equal(matchesSearch(p, '부산 비건'), true);
  assert.equal(matchesSearch(p, '釜山 ハラール'), false);
});

test('a shared list keeps only real place ids, in order, once each, and is capped', async () => {
  const { parseSharedList, sharedListUrl, MAX_SHARED } = await import('../../src/filters.js');
  const known = ['balwoo', 'eid', 'plant-cafe'];
  assert.deepEqual(parseSharedList('eid,balwoo,eid,nope, plant-cafe ', known), ['eid', 'balwoo', 'plant-cafe']);
  assert.deepEqual(parseSharedList('', known), []);
  assert.deepEqual(parseSharedList(null, known), []);
  assert.deepEqual(parseSharedList('<script>,../etc,EID', known), []);
  const many = Array.from({ length: 200 }, (_, i) => `p${i}`);
  assert.equal(parseSharedList(many.join(','), many).length, MAX_SHARED);
  assert.equal(sharedListUrl('https://x.test', ['a', 'b']), 'https://x.test/?list=a,b');
});

test('words that name Object.prototype members are just words', () => {
  const p = at('Itaewon, Seoul', '1 Ro, Yongsan-gu, Seoul');
  for (const q of ['constructor', '__proto__', 'toString', 'seoul constructor', 'hasOwnProperty']) {
    assert.doesNotThrow(() => matchesSearch(p, q), q);
    assert.doesNotThrow(() => matchesArea(p, q), q);
  }
  assert.equal(matchesSearch(p, 'constructor'), false);
});

test('a one-letter word is dropped, not required', () => {
  const busan = at('Seomyeon, Busan', '1 Ro, Busanjin-gu, Busan');
  assert.equal(matchesSearch(busan, 'busan v'), true);
  assert.equal(matchesSearch(busan, '부산시'), true);
  assert.equal(matchesSearch(busan, '釜山市'), true);
  assert.equal(matchesSearch(busan, 'seoul v'), false);
});

test('every suggested area finds places, in English and in Korean', async () => {
  const { areaSuggestions } = await import('../../src/data/area-names.js');
  const { restaurants } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const active = restaurants.filter(r => !isQuarantined(r));
  for (const lang of ['en', 'ko']) {
    for (const area of areaSuggestions(lang)) {
      assert.ok(active.filter(r => matchesSearch(r, area)).length >= 3, `${lang}: ${area}`);
    }
  }
});

test('older Latin spellings find the area: Pusan, Cheju, Kangnam, Myungdong', async () => {
  const { romaniseQuery } = await import('../../src/data/area-names.js');
  const { matchesSearch } = await import('../../src/filters.js');
  const at = (area, address) => ({ id: 'x', name: 'Somewhere', zone: area, address: { value: address }, dietary: {}, traits: [] });
  assert.equal(romaniseQuery('Pusan'), 'Busan');
  assert.equal(romaniseQuery('cheju vegan'), 'Jeju vegan');
  assert.equal(romaniseQuery('KANGNAM'), 'Gangnam');
  // The current spelling is not "romanised" again.
  assert.equal(romaniseQuery('Busan'), null);
  assert.equal(romaniseQuery('myeongdong'), null);
  assert.equal(matchesSearch(at('Haeundae, Busan', '1 Ro, Haeundae-gu, Busan'), 'Pusan'), true);
  assert.equal(matchesSearch(at('Myeongdong, Seoul', '1 Ro, Jung-gu, Seoul'), 'Myungdong'), true);
  assert.equal(matchesSearch(at('Myeongdong, Seoul', '1 Ro, Jung-gu, Seoul'), 'Pusan'), false);
});
