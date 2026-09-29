import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCopy } from '../../src/data/verification.js';
import { restaurants } from '../../src/data/restaurants.js';

const place = (story, halal = 'friendly') => ({ story, dietary: { halal: { value: halal } } });

test('an unqualified certification claim in a story is flagged', () => {
  assert.equal(validateCopy(place('EID is the only Korean restaurant certified by KMF.')).length, 1);
  assert.equal(validateCopy(place('A vegan-certified kitchen in COEX.')).length, 1);
});

test('reported, negated or self-certified wording passes', () => {
  assert.deepEqual(validateCopy(place("Seoul's tourism site describes it as KMF-certified.")), []);
  assert.deepEqual(validateCopy(place('No certificate has been sighted.')), []);
  assert.deepEqual(validateCopy(place('Halal-friendly rather than formally certified.')), []);
  assert.deepEqual(validateCopy(place('Self-certified halal by its owners.')), []);
});

test('a sighted certificate may be stated plainly', () => {
  assert.deepEqual(validateCopy(place('Certified by KMF.', 'certified')), []);
});

test('no active place asserts certification on its own authority', () => {
  for (const r of restaurants) assert.deepEqual(validateCopy(r), [], r.id);
});
