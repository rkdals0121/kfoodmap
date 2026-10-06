// node rvl_apply.mjs <lang> [--write] [--skip=key1,key2]   (run from the repo root)
import { readFileSync, writeFileSync } from 'node:fs';
const RV = 'WORK/rvl/';
const lang = process.argv[2];
const write = process.argv.includes('--write');
const skip = new Set((process.argv.find(a => a.startsWith('--skip='))?.slice(7) ?? '').split(',').filter(Boolean));
const rows = Object.fromEntries(JSON.parse(readFileSync(`${RV}${lang}.json`, 'utf8')).map(r => [r.key, r]));
const fixes = JSON.parse(readFileSync(`${RV}fix-${lang}.json`, 'utf8'));
const p = `src/i18n/locales/${lang}.js`;
const src = readFileSync(p, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(nl);
const marks = (s) => [...String(s).matchAll(/\{\{[^}]+\}\}|<\/?\d+>/g)].map(m => m[0]).sort().join('|');
const lit = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
let done = 0;
const bad = [];
for (const f of fixes) {
  if (skip.has(f.key)) continue;
  const row = rows[f.key];
  if (!row || typeof row.tr !== 'string') { bad.push([f.key, 'no such string key']); continue; }
  if (marks(f.tr) !== marks(row.en)) { bad.push([f.key, 'markup differs']); continue; }
  const last = f.key.split('.').pop();
  const re = new RegExp(`^(\\s*)(${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|'${last}'|"${last}"): (.*),\\s*(//.*)?$`);
  const hits = [];
  lines.forEach((line, i) => {
    const m = re.exec(line);
    if (!m) return;
    let v;
    try { v = Function(`return ${m[3]}`)(); } catch { return; }
    if (v === row.tr) hits.push([i, m]);
  });
  if (hits.length !== 1) { bad.push([f.key, `lines found: ${hits.length}`]); continue; }
  const [i, m] = hits[0];
  lines[i] = `${m[1]}${m[2]}: ${lit(f.tr)},${m[4] ? ` ${m[4]}` : ''}`;
  done += 1;
  console.log(`${f.key} (${f.kind})\n   - ${row.tr}\n   + ${f.tr}`);
}
console.log(lang, 'fixes', fixes.length, 'applied', done, 'bad', bad.length);
for (const b of bad) console.log(' !', b.join(' | '));
if (write) { writeFileSync(p, lines.join(nl)); console.log('written'); }
