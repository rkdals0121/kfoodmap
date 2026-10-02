import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../../src/utils.js';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';

test('the Korean parenthetical goes, the branch stays', () => {
  assert.equal(displayName('Chick Peace (칙피스) Seongsu'), 'Chick Peace Seongsu');
  assert.equal(displayName('Nimat (니맛), Culinary Square T2'), 'Nimat, Culinary Square T2');
  assert.equal(displayName('Busan Jib KBBQ (Halal)'), 'Busan Jib KBBQ (Halal)');
  assert.equal(displayName('Balwoo Gongyang (발우공양)'), 'Balwoo Gongyang');
});

test('no two active places share a display name in the same area', () => {
  const seen = new Map();
  for (const r of restaurants.filter(x => !isQuarantined(x))) {
    const key = `${displayName(r.name).toLowerCase()}|${r.zone}`;
    assert.ok(!seen.has(key), `${r.id} and ${seen.get(key)} both show as "${displayName(r.name)}" in ${r.zone}`);
    seen.set(key, r.id);
  }
});

test('koreanName reads the Korean name out of the brackets, or nothing', async () => {
  const { koreanName } = await import('../../src/utils.js');
  assert.equal(koreanName('Mahina Vegan Table (마히나 비건 테이블)'), '마히나 비건 테이블');
  assert.equal(koreanName('Kervan Turkish Restaurant (케르반) COEX'), '케르반');
  assert.equal(koreanName('Plant Cafe & Kitchen'), null);
  assert.equal(koreanName('Bakery (Seoul)'), null);
  assert.equal(koreanName(undefined), null);
});
