// The Korean stories (src/data/story-ko.js) are translations of the
// records' English text. A translation left behind by an edited record
// would say something the record no longer does, so each carries a hash
// of the English it was made from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { restaurants } from '../../src/data/restaurants.js';
import { STORY_KO } from '../../src/data/story-ko.js';

const hashOf = (r) => createHash('sha1').update(`${r.story}|${typeof r.esg_point === 'string' ? r.esg_point : ''}`).digest('hex').slice(0, 8);

test('every Korean story belongs to a place and to its current English text', () => {
  const byId = new Map(restaurants.map(r => [r.id, r]));
  for (const [id, entry] of Object.entries(STORY_KO)) {
    const place = byId.get(id);
    assert.ok(place, `${id}: no such place`);
    assert.equal(entry.of, hashOf(place), `${id}: the English story or sustainability line changed — retranslate this entry or remove it`);
    assert.ok(typeof entry.story === 'string' && /[가-힣]/.test(entry.story), `${id}: empty story`);
    assert.equal(Boolean(entry.esg), typeof place.esg_point === 'string', `${id}: sustainability line present in one language only`);
  }
});

test('the Korean stories keep to the map\'s wording', () => {
  for (const [id, entry] of Object.entries(STORY_KO)) {
    // The polite informal style of the rest of the Korean interface.
    assert.doesNotMatch(entry.story, /습니다|합니다/, id);
    // No reference to a record by its id.
    assert.doesNotMatch(entry.story, /`/, id);
  }
});
