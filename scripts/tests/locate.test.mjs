import test from 'node:test';
import assert from 'node:assert/strict';
import { inKorea, readPosition, readError, isCoarse } from '../../src/data/locate.js';
import { restaurants } from '../../src/data/restaurants.js';
import { coordsOf } from '../../src/utils.js';

const pos = (latitude, longitude, accuracy = 20) => ({ coords: { latitude, longitude, accuracy } });

test('every place on the map is inside the Korea box', () => {
  const outside = restaurants.filter(r => !inKorea(coordsOf(r))).map(r => r.id);
  assert.deepEqual(outside, []);
});

test('a position in Korea is used; one abroad is not', () => {
  assert.deepEqual(readPosition(pos(37.5665, 126.978)), { state: 'located', location: { lat: 37.5665, lng: 126.978, accuracy: 20 } });
  assert.equal(readPosition(pos(33.25, 126.56)).state, 'located'); // Seogwipo
  assert.equal(readPosition(pos(35.6762, 139.6503)).state, 'outside'); // Tokyo
  assert.equal(readPosition(pos(51.5, -0.12)).state, 'outside'); // London
  assert.equal(readPosition(pos(39.03, 125.75)).state, 'outside'); // Pyongyang
});

test('a missing or broken position is unavailable, never a guess', () => {
  assert.equal(readPosition(null).state, 'unavailable');
  assert.equal(readPosition({ coords: { latitude: NaN, longitude: 127 } }).state, 'unavailable');
});

test('only a refusal is "denied"', () => {
  assert.equal(readError({ code: 1 }).state, 'denied');
  assert.equal(readError({ code: 2 }).state, 'unavailable');
  assert.equal(readError({ code: 3 }).state, 'unavailable');
});

test('a position good to a few kilometres is coarse', () => {
  assert.equal(isCoarse({ accuracy: 30 }), false);
  assert.equal(isCoarse({ accuracy: 5000 }), true);
  assert.equal(isCoarse({ accuracy: null }), false);
});
