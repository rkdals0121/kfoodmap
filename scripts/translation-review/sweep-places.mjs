// Place pages, one after another, at phone widths, languages and text sizes
// in turn: text standing outside its button or cell, a line ending inside
// something read as one piece (a time, a price, a phone number), wording
// that leaked from another language.
//
//   node scripts/translation-review/sweep-places.mjs <base url> [from] [upto]
//   node scripts/translation-review/sweep-places.mjs https://kfoodmap.vercel.app 0 150
//
// Prints one line per page that has something to say, and nothing for the
// rest. About four seconds a page. Run it over a hundred pages or so before
// a change to the place page goes out: on 2026-10-10 a date kept on one
// line stood 25 px outside its cell on a 320 px phone for seven hours, and
// only this found it.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restaurants } from '../../src/data/restaurants.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) { console.error('usage: node scripts/translation-review/sweep-places.mjs <base url> [from] [upto]'); process.exit(1); }
const from = Number(process.argv[3] ?? 0);
const upto = Number(process.argv[4] ?? 100);
const detector = (name) => readFileSync(join(here, 'detectors', name), 'utf8');
const found = `[...${detector('btnspill.js')}, ...(${detector('breaks.js')}).filter(x=>!/claim-explain__text|in DD$|detail-body|story/.test(x)), ...(${detector('leaks.js')}).filter(x=>!x.startsWith("TWICE"))]`;
// width, language, text size
const combos = [[360, 'en', ''], [320, 'ko', 'larger'], [390, 'ja', ''], [360, 'id', 'larger'], [320, 'zh-Hans', ''], [390, 'zh-Hant', 'larger'], [280, 'en', ''], [360, 'ko', ''], [390, 'id', ''], [320, 'ja', 'larger'], [1280, 'en', ''], [768, 'ko', '']];
const ids = restaurants.map(r => r.id).sort().slice(from, upto);
const steps = ids.map((id, k) => {
  const [w, lang, size] = combos[k % combos.length];
  return {
    url: `${base}/place/${id}`, w, h: 700, dpr: 1, lang, load: 2800,
    pre: size ? `localStorage.setItem('kfm-text-size','${size}');` : "localStorage.removeItem('kfm-text-size');",
    js: `document.querySelectorAll('.detail-sheet [aria-expanded=false]').forEach(e=>e.click()); await new Promise(r=>setTimeout(r,500)); const a=${found}; return a.length||document.documentElement.scrollWidth>innerWidth ? {id:${JSON.stringify(id)}, at:${JSON.stringify(`${w} ${lang} ${size}`.trim())}, found:a, width:document.documentElement.scrollWidth} : undefined`,
  };
});
const work = mkdtempSync(join(tmpdir(), 'kfm-regress-'));
writeFileSync(join(work, 'sweep.json'), JSON.stringify(steps));
const run = spawnSync(process.execPath, [join(here, 'shot.mjs'), join(work, 'sweep.json')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
rmSync(work, { recursive: true, force: true });
const said = (run.stdout + run.stderr).trim();
console.log(said === '' ? `${ids.length} pages: nothing found` : `${said}\n${ids.length} pages, ${said.split('\n').length} with something found`);
