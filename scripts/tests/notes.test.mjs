// The translated research notes (src/data/notes/) are tied to the English
// they were made from: a note left behind by an edited record would
// explain a claim with what the record no longer says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { restaurants } from '../../src/data/restaurants.js';
import { plainNote } from '../../src/data/note-terms.js';
import { noteShard as shardOf, NOTE_SHARDS as SHARDS } from '../../src/data/note-shard.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/notes');
const shown = (f) => (f && (f.confidence === 'supported' || f.confidence === 'inferred') && typeof f.evidence === 'string' && f.evidence.trim() ? plainNote(f.evidence) : null);
const certHash = (r) => {
  const c = r.dietary?.halalCertClaim;
  return createHash('sha1').update(`${c?.body ? plainNote(c.body) : ''}|${c?.note ? plainNote(c.note) : ''}|${(r.timeline ?? []).map(t => t.event).join('|')}`).digest('hex').slice(0, 8);
};
export const noteHash = (r) => createHash('sha1').update(`${shown(r.dietary?.vegan) ?? ''}|${shown(r.dietary?.halal) ?? ''}`).digest('hex').slice(0, 8);

test('every translated note belongs to a place, to its file and to its current English', async () => {
  const byId = new Map(restaurants.map(r => [r.id, r]));
  const files = readdirSync(dir).filter(f => /^notes-.+-\d+\.js$/.test(f));
  // Five languages, sixteen files each: a pattern that matched nothing would pass everything.
  assert.equal(files.length, 5 * SHARDS);
  let entries = 0;
  for (const file of files) {
    const shard = Number(file.match(/-(\d+)\.js$/)[1]);
    const { NOTES } = await import(pathToFileURL(path.join(dir, file)).href);
    for (const [id, entry] of Object.entries(NOTES)) {
      const where = `${file}/${id}`;
      entries += 1;
      const place = byId.get(id);
      assert.ok(place, `${where}: no such place`);
      assert.equal(shardOf(id), shard, `${where}: in the wrong file`);
      assert.equal(entry.of, noteHash(place), `${where}: the English note changed — retranslate this entry or remove it`);
      // The lengths the page checks before it shows a translation (RestaurantDetail).
      assert.deepEqual(entry.n, [(shown(place.dietary?.vegan) ?? '').length, (shown(place.dietary?.halal) ?? '').length], `${where}: note lengths`);
      for (const key of ['vegan', 'halal']) {
        assert.equal(Boolean(entry[key]), Boolean(shown(place.dietary?.[key])), `${where}: ${key} note present on one side only`);
        // A link in the note is the way to the source: it must survive.
        for (const url of (shown(place.dietary?.[key]) ?? '').match(/https?:\/\/[^\s)'"”’,]+/g) ?? []) {
          assert.ok(entry[key].includes(url.replace(/[.;:]+$/, '')), `${where}: ${key} lost ${url}`);
        }
        assert.doesNotMatch(entry[key] ?? '', /`/, where);
      }
      // The certification line and the timeline, where the record has them.
      const claim = place.dietary?.halalCertClaim;
      assert.equal(Boolean(entry.cert?.body), Boolean(claim?.body), `${where}: certification body on one side only`);
      assert.equal(Boolean(entry.cert?.note), Boolean(claim?.note), `${where}: certification note on one side only`);
      assert.equal(entry.timeline?.length ?? 0, place.timeline?.length ?? 0, `${where}: timeline length`);
      if (entry.cert || entry.timeline) assert.deepEqual(entry.n2, [plainNote(claim?.body ?? '').length, plainNote(claim?.note ?? '').length, place.timeline?.length ?? 0], `${where}: certification and timeline lengths`);
      if (entry.cert || entry.timeline) assert.equal(entry.of2, certHash(place), `${where}: the certification line or timeline changed — retranslate or remove`);
    }
  }
  assert.ok(entries > 3000, `only ${entries} entries`);
});
