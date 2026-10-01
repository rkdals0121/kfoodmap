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
