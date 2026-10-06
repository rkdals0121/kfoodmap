import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { restaurants } = await import(pathToFileURL(root + '/src/data/restaurants.js'));
const { plainNote } = await import(pathToFileURL(root + '/src/data/note-terms.js'));
const { NOTE_SHARDS } = await import(pathToFileURL(root + '/src/data/note-shard.js'));
for (const lang of ['ko', 'ja', 'zh-Hans', 'zh-Hant', 'id']) {
  const all = {};
  for (let n = 0; n < NOTE_SHARDS; n++) Object.assign(all, (await import(pathToFileURL(root + `/src/data/notes/notes-${lang}-${n}.js`))).NOTES);
  const rows = [];
  for (const r of restaurants) {
    const e = all[r.id];
    if (!e) continue;
    const row = { id: r.id, name: r.name };
    for (const k of ['vegan', 'halal']) if (e[k]) { row[`en_${k}`] = plainNote(r.dietary?.[k]?.evidence ?? ''); row[`tr_${k}`] = e[k]; }
    if (e.cert) { const c = r.dietary.halalCertClaim; for (const k of ['body', 'note']) if (e.cert[k]) { row[`en_cert_${k}`] = plainNote(c[k]); row[`tr_cert_${k}`] = e.cert[k]; } }
    if (e.timeline) { row.en_timeline = r.timeline.map(t => t.event ?? t.text ?? t.label ?? JSON.stringify(t)); row.tr_timeline = e.timeline; }
    rows.push(row);
  }
  const size = (r) => JSON.stringify(r).length;
  const total = rows.reduce((n, r) => n + size(r), 0);
  const parts = 14; let i = 0, acc = 0, cur = [];
  const flush = () => { writeFileSync(`${out}/${lang}-${String(i).padStart(2, '0')}.json`, JSON.stringify(cur, null, 1)); i++; cur = []; acc = 0; };
  for (const r of rows) { cur.push(r); acc += size(r); if (acc > total / parts) flush(); }
  if (cur.length) flush();
  console.log(lang, rows.length, 'files', i, 'chars', total);
}
