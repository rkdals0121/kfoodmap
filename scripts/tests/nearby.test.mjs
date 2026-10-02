import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyPlaces, NEARBY_MAX_KM } from '../../src/data/nearby.js';

const at = (id, lat, lng) => ({ id, coordinates: { value: { lat, lng } } });

test('nearest first, within the radius, never the place itself, capped', () => {
  const here = at('here', 37.5, 127.0);
  const all = [
    here,
    at('far', 37.6, 127.0),        // ~11 km
    at('b', 37.503, 127.0),        // ~330 m
    at('a', 37.501, 127.0),        // ~110 m
    at('c', 37.505, 127.0),        // ~560 m
    at('d', 37.506, 127.0),        // ~670 m
  ];
  const near = nearbyPlaces(here, all);
  assert.deepEqual(near.map(n => n.place.id), ['a', 'b', 'c']);
  assert.ok(near.every(n => n.km <= NEARBY_MAX_KM));
  assert.deepEqual(nearbyPlaces(here, [here, at('far', 37.6, 127.0)]), []);
  assert.deepEqual(nearbyPlaces(null, all), []);
});
