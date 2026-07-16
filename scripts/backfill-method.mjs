// One-time backfill: give every CONFIRMED fact from batches 1–2 a verification
// method, so the whole dataset is auditable and not just the newest records.
//
// Run: node scripts/backfill-method.mjs [--dry]
//
// The method is derived from what was actually done at the time, which each
// fact already records in its own source + evidence. Nothing is invented:
//   • coordinates / address via map services — both were checked, and the
//     evidence says so ("Kakao Map agrees to within ~N m")
//   • transit — every one came from Kakao's walking-route API
//   • officialUrl / instagram via MAP_SERVICE — a single Naver Place lookup
//   • anything sourced to the OPERATOR — read off their own website
//
// Each confirmed meta block is located by index, then its field name is found
// by scanning back to the nearest `<field>: fact(`. Matching the two with one
// regex would let a lazy `[\s\S]*?` run past the end of a fact and attach a
// method to the wrong field.

import { readFileSync, writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const PATH = new URL('../src/data/restaurants.js', import.meta.url);
const src = readFileSync(PATH, 'utf8');

/** field name -> method, for facts sourced to a map service */
const MAP_METHOD = {
  coordinates: 'MAP_CROSSCHECK',
  address: 'MAP_CROSSCHECK',
  transit: 'ROUTING_API',
  officialUrl: 'MAP_LOOKUP',
  instagram: 'MAP_LOOKUP',
};

const BY_SOURCE = {
  OPERATOR: () => 'OPERATOR_SITE',
  GOVERNMENT: () => 'GOV_LISTING',
  DIRECTORY: () => 'DIRECTORY_LISTING',
  MAP_SERVICE: (field) => MAP_METHOD[field] ?? 'MAP_LOOKUP',
};

const FIELD_START = /\n {4,6}(\w+): fact\(/g;
const CONFIRMED_META = /\{ confidence: CONFIDENCE\.CONFIRMED, source: SOURCE\.(\w+)/g;

// Where each fact begins, so a meta block can be traced back to its field.
const fieldStarts = [...src.matchAll(FIELD_START)].map(m => ({ index: m.index, field: m[1] }));
const fieldAt = (index) => {
  let found = null;
  for (const f of fieldStarts) {
    if (f.index < index) found = f.field;
    else break;
  }
  return found;
};

const edits = [];
for (const m of src.matchAll(CONFIRMED_META)) {
  const sourceKey = m[1];
  const field = fieldAt(m.index);
  const tail = src.slice(m.index, m.index + 400);
  if (/method: METHOD\./.test(tail.split('}),')[0] ?? '')) continue; // already has one
  const pick = BY_SOURCE[sourceKey];
  if (!pick) continue;
  const method = pick(field);
  edits.push({ at: m.index + m[0].length, field, sourceKey, method });
}

if (DRY) {
  for (const e of edits) console.log(`  ${e.field.padEnd(12)} source=${e.sourceKey.padEnd(11)} -> METHOD.${e.method}`);
  console.log(`\n${edits.length} confirmed facts would gain a method.`);
} else {
  // Apply back-to-front so earlier indices stay valid.
  let out = src;
  for (const e of [...edits].reverse()) {
    out = out.slice(0, e.at) + `, method: METHOD.${e.method}` + out.slice(e.at);
  }
  out = out.replace(
    'import { fact, unknownFact, imageLead, CONFIDENCE, SOURCE,',
    'import { fact, unknownFact, imageLead, CONFIDENCE, SOURCE, METHOD,',
  );
  writeFileSync(PATH, out);
  console.log(`Added a verification method to ${edits.length} confirmed facts.`);
}
