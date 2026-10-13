// The text size the app opens at: the reader's own choice, else the device's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeForRatio, readTextSize, TEXT_SIZES } from '../../src/textSize.js';

test('the device\'s type size is followed in three steps', () => {
  assert.equal(sizeForRatio(1), 'normal');
  assert.equal(sizeForRatio(1.1), 'normal');
  // A browser set to 18 px (1.125), an iPhone one step up from the default.
  assert.equal(sizeForRatio(1.125), 'large');
  // 20 px and over, or Dynamic Type at its largest ordinary sizes.
  assert.equal(sizeForRatio(1.3), 'larger');
  assert.equal(sizeForRatio(2), 'larger');
  for (const r of [0.8, 1, 1.2, 1.5]) assert.ok(TEXT_SIZES.includes(sizeForRatio(r)));
});

test('with no document and nothing stored the size is the usual one', () => {
  assert.equal(readTextSize(), 'normal');
});
