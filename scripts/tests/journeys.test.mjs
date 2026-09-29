import test from 'node:test';
import assert from 'node:assert/strict';
import { journeys } from '../../src/data/journeys.js';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';

const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));

// TabPanel silently drops a journey whose stop is missing or quarantined, so
// a typo or a closure would make a whole journey vanish without a trace.
test('every journey stop exists and is active', () => {
  for (const j of journeys) {
    for (const id of j.stopIds) {
      assert.ok(byId[id], `${j.id}: no place "${id}"`);
      assert.equal(isQuarantined(byId[id]), false, `${j.id}: "${id}" is quarantined`);
    }
  }
});

test('journey ids are unique and every journey has at least two stops', () => {
  assert.equal(new Set(journeys.map(j => j.id)).size, journeys.length);
  for (const j of journeys) assert.ok(j.stopIds.length >= 2, j.id);
});

test('a journey never calls its stops certified', () => {
  // No place in the data is halal-certified; editorial copy must not say so.
  for (const j of journeys) assert.doesNotMatch(j.description, /\bcertified\b(?! by us)/i, j.id);
});
