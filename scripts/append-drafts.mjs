// Appends reviewed draft entries to src/data/restaurants.js as one block.
//
//   node scripts/append-drafts.mjs --header "<comment line>" [--header ...] \
//        --only id1,id2 draft1.json [draft2.json ...]
//
// It only moves entries a person has already reviewed (review-drafts.mjs plus
// a read of every flagged and every halal entry); it decides nothing. --only
// names the accepted ids explicitly, so a held entry in the same draft file
// cannot slip in. Refuses an id that already exists or appears twice, and
// writes nothing if anything is wrong.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = new URL('../src/data/restaurants.js', import.meta.url);
const args = process.argv.slice(2);
const headers = [];
let only = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--header') headers.push(args[++i]);
  else if (args[i] === '--only') only = new Set(args[++i].split(',').map(s => s.trim()).filter(Boolean));
  else files.push(args[i]);
}
if (!files.length || !only || !headers.length) {
  console.error('Usage: node scripts/append-drafts.mjs --header "..." --only id1,id2 draft.json [...]');
  process.exit(2);
}

const { restaurants } = await import(PATH.href);
const existing = new Set(restaurants.map(r => r.id));
const picked = [];
const seen = new Set();
for (const f of files) {
  for (const e of JSON.parse(readFileSync(f, 'utf8'))) {
    if (!only.has(e.id)) continue;
    if (existing.has(e.id)) throw new Error(`${e.id} already exists in restaurants.js`);
    if (seen.has(e.id)) throw new Error(`${e.id} appears twice in the drafts`);
    seen.add(e.id);
    picked.push(e);
  }
}
const missing = [...only].filter(id => !seen.has(id));
if (missing.length) throw new Error(`not found in the drafts: ${missing.join(', ')}`);

const src = readFileSync(PATH, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const end = src.lastIndexOf(`${eol}];`);
if (end < 0) throw new Error('could not find the closing ]; of the restaurants array');
const indent = (s) => s.split('\n').map(l => '  ' + l).join(eol);
const block = [
  ...headers.map(h => `  // ${h}`),
  ...picked.map(e => indent(JSON.stringify(e, null, 2)) + ','),
].join(eol);
writeFileSync(PATH, src.slice(0, end) + eol + block + src.slice(end));
console.log(`Appended ${picked.length} entr${picked.length === 1 ? 'y' : 'ies'}: ${picked.map(e => e.id).join(', ')}`);
