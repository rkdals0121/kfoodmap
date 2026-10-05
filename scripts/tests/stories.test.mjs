// The Korean stories (src/data/story-ko.js) are translations of the
// records' English text. A translation left behind by an edited record
// would say something the record no longer does, so each carries a hash
// of the English it was made from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { restaurants } from '../../src/data/restaurants.js';
import { STORIES as ko } from '../../src/data/story-ko.js';
import { STORIES as ja } from '../../src/data/story-ja.js';
import { STORIES as zhHans } from '../../src/data/story-zh-Hans.js';
import { STORIES as zhHant } from '../../src/data/story-zh-Hant.js';
import { STORIES as id } from '../../src/data/story-id.js';

const ALL = { ko, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, id };
const SCRIPT = { ko: /[가-힣]/, ja: /[ぁ-んァ-ヶ]/, 'zh-Hans': /[一-鿿]/, 'zh-Hant': /[一-鿿]/, id: /[a-z]/ };

const hashOf = (r) => createHash('sha1').update(`${r.story}|${typeof r.esg_point === 'string' ? r.esg_point : ''}`).digest('hex').slice(0, 8);

test('every translated story belongs to a place and to its current English text', () => {
  const byId = new Map(restaurants.map(r => [r.id, r]));
  for (const [lang, stories] of Object.entries(ALL)) for (const [key, entry] of Object.entries(stories)) {
    const id = `${lang}/${key}`;
    const place = byId.get(key);
    assert.ok(place, `${id}: no such place`);
    assert.equal(entry.of, hashOf(place), `${id}: the English story or sustainability line changed — retranslate this entry or remove it`);
    assert.ok(typeof entry.story === 'string' && SCRIPT[lang].test(entry.story), `${id}: empty story`);
    assert.equal(Boolean(entry.esg), typeof place.esg_point === 'string', `${id}: sustainability line present in one language only`);
  }
});

test('the Korean stories keep to the map\'s wording', () => {
  for (const [id, entry] of Object.entries(ko)) {
    // The polite informal style of the rest of the Korean interface.
    assert.doesNotMatch(entry.story, /습니다|합니다/, id);
  }
  // No reference to a record by its id, in any language.
  for (const [lang, stories] of Object.entries(ALL)) for (const [key, entry] of Object.entries(stories)) {
    assert.doesNotMatch(entry.story, /`/, `${lang}/${key}`);
  }
});
