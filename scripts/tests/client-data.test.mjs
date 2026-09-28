import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restaurants } from '../../src/data/restaurants.js';
import { withoutEvidence, clientModule, placeDataFile } from '../lib/client-data.mjs';
import { pairEvidence } from '../../src/data/evidence-pairing.js';

const keysOf = (v, out = new Set()) => {
  if (Array.isArray(v)) v.forEach(x => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
};

test('the bundled copy carries no evidence text', () => {
  assert.equal(keysOf(withoutEvidence(restaurants)).has('evidence'), false);
});

test('the bundled module evaluates to the data minus evidence, nothing else changed', async () => {
  const mod = await import('data:text/javascript,' + encodeURIComponent(clientModule(restaurants)));
  assert.deepStrictEqual(mod.restaurants, withoutEvidence(restaurants));
  assert.equal(mod.restaurants.length, restaurants.length);
});

test('every piece of evidence comes back when the full record is paired on', () => {
  const slim = withoutEvidence(restaurants);
  for (let i = 0; i < restaurants.length; i++) {
    const full = JSON.parse(placeDataFile(restaurants[i]).source);
    const map = pairEvidence(slim[i], full);
    // Walk the original: every fact with evidence must be recoverable from
    // the matching bundled object.
    const walk = (orig, s) => {
      if (!orig || typeof orig !== 'object') return;
      if (!Array.isArray(orig) && typeof orig.evidence === 'string') {
        assert.equal(map.get(s), orig.evidence, `${restaurants[i].id}: evidence lost`);
      }
      for (const k of Object.keys(orig)) if (k !== 'evidence') walk(orig[k], s[k]);
    };
    walk(restaurants[i], slim[i]);
  }
});

test('a record for another place pairs nothing', () => {
  const slim = withoutEvidence(restaurants);
  const map = pairEvidence(slim[0], JSON.parse(placeDataFile(restaurants[1]).source));
  assert.equal(map.get(slim[0].coordinates), undefined);
});

test('only the trust badge reads .evidence — anything new must fetch it first', () => {
  const files = [];
  const collect = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) collect(p);
      else if (/\.(jsx?|mjs)$/.test(name)) files.push(p);
    }
  };
  collect(fileURLToPath(new URL('../../src', import.meta.url)));
  const allowed = ['data/restaurants.js', 'data/verification.js', 'data/evidence-pairing.js'];
  const readers = files
    .filter(f => !allowed.some(a => f.replaceAll('\\', '/').endsWith(a)))
    .filter(f => /\.evidence\b/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(readers, []);
});
