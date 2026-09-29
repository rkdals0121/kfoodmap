import test from 'node:test';
import assert from 'node:assert/strict';
import { pinKind } from '../../src/data/pin-kind.js';

const f = (value, confidence = 'supported') => ({ value, confidence });
const place = (vegan, halal) => ({ dietary: { vegan, halal } });

test('pins name the diet by kind', () => {
  assert.equal(pinKind(place(f('full'), undefined)), 'vegan');
  assert.equal(pinKind(place(f('options'), f('friendly'))), 'both');
  assert.equal(pinKind(place(undefined, f('certified', 'confirmed'))), 'halal');
});

test('pork-free is not halal, and unknown or none says nothing', () => {
  assert.equal(pinKind(place(undefined, f('porkFree'))), 'other');
  assert.equal(pinKind(place(f('full', 'unknown'), f('friendly', 'unknown'))), 'other');
  assert.equal(pinKind(place(f('none'), f('none'))), 'other');
  assert.equal(pinKind({}), 'other');
});
