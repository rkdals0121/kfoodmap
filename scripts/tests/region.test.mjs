import test from 'node:test';
import assert from 'node:assert/strict';
import { regionOf, groupByRegion } from '../../src/data/region.js';
import { restaurants } from '../../src/data/restaurants.js';

const at = (value) => ({ address: { value } });

test('the province, the last region word, names the region', () => {
  assert.equal(regionOf(at('27 Itaewon-ro, Yongsan-gu, Seoul')), 'Seoul');
  assert.equal(regionOf(at('12 Gyeongan-ro, Gwangju-si, Gyeonggi-do')), 'Gyeonggi');
  assert.equal(regionOf(at('3 Nohyeong-ro, Jeju-si, Jeju-do (Nohyeong-dong)')), 'Jeju');
  assert.equal(regionOf(at('1 Jeonju-ro, Jeonbuk State')), 'Jeolla');
  assert.equal(regionOf(at('somewhere')), null);
  assert.equal(regionOf({}), null);
});

test('every place in the data has a region', () => {
  const missing = restaurants.filter(r => regionOf(r) === null).map(r => r.id);
  assert.deepEqual(missing, []);
});

test('groups put the biggest region first and unknown last', () => {
  const items = ['Busan', 'Seoul', 'nowhere', 'Seoul'].map(v => ({ place: at(v) }));
  assert.deepEqual(groupByRegion(items).map(g => [g.region, g.items.length]),
    [['Seoul', 2], ['Busan', 1], [null, 1]]);
});
