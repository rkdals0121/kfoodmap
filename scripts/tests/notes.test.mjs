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

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/notes');
const SHARDS = 16;
const shardOf = (id) => [...String(id)].reduce((n, ch) => (n + ch.charCodeAt(0)) % SHARDS, 0);
const shown = (f) => (f && (f.confidence === 'supported' || f.confidence === 'inferred') && typeof f.evidence === 'string' && f.evidence.trim() ? plainNote(f.evidence) : null);
export const noteHash = (r) => createHash('sha1').update(`${shown(r.dietary?.vegan) ?? ''}|${shown(r.dietary?.halal) ?? ''}`).digest('hex').slice(0, 8);

test('every translated note belongs to a place, to its file and to its current English', async () => {
  const byId = new Map(restaurants.map(r => [r.id, r]));
  for (const file of readdirSync(dir).filter(f => /^notes-.+-\d+\.js$/.test(f))) {
    const shard = Number(file.match(/-(\d+)\.js$/)[1]);
    const { NOTES } = await import(pathToFileURL(path.join(dir, file)).href);
    for (const [id, entry] of Object.entries(NOTES)) {
      const where = `${file}/${id}`;
      const place = byId.get(id);
      assert.ok(place, `${where}: no such place`);
      assert.equal(shardOf(id), shard, `${where}: in the wrong file`);
      assert.equal(entry.of, noteHash(place), `${where}: the English note changed — retranslate this entry or remove it`);
      for (const key of ['vegan', 'halal']) {
        assert.equal(Boolean(entry[key]), Boolean(shown(place.dietary?.[key])), `${where}: ${key} note present on one side only`);
        // A link in the note is the way to the source: it must survive.
        for (const url of (shown(place.dietary?.[key]) ?? '').match(/https?:\/\/[^\s)'"”’,]+/g) ?? []) {
          assert.ok(entry[key].includes(url.replace(/[.;:]+$/, '')), `${where}: ${key} lost ${url}`);
        }
        assert.doesNotMatch(entry[key] ?? '', /`/, where);
      }
    }
  }
});
