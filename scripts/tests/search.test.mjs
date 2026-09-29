import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch } from '../../src/filters.js';

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
