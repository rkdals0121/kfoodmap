import test from 'node:test';
import assert from 'node:assert/strict';
import { sealText } from '../../src/data/seal-text.js';

test('a seal carries the first Hangul word, cut like a seal', () => {
  assert.deepEqual(sealText('Balwoo Gongyang (발우공양)'), { chars: ['발', '우', '공', '양'], cols: 2 });
  assert.deepEqual(sealText('Bonjuk (본죽 송도신도시점)'), { chars: ['본', '죽'], cols: 2 });
  assert.equal(sealText('Loving Hut (러빙헛 서신점)').cols, 3);
  assert.equal(sealText('Sanchon (산촌)').chars.join(''), '산촌');
});

test('no Korean name, or a word too long to cut, gives the initial', () => {
  assert.deepEqual(sealText('Plant Cafe & Kitchen'), { chars: ['P'], cols: 1 });
  assert.deepEqual(sealText('X (가나다라마바사아자차)'), { chars: ['가'], cols: 1 });
});
