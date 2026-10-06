import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { restaurants } = await import(pathToFileURL(root + '/src/data/restaurants.js'));
for (const lang of ['ko', 'ja', 'zh-Hans', 'zh-Hant', 'id']) {
  const { STORIES } = await import(pathToFileURL(root + `/src/data/story-${lang}.js`));
  const rows = restaurants.filter(r => STORIES[r.id]).map(r => ({ id: r.id, name: r.name, en_story: r.story, tr_story: STORIES[r.id].story, ...(STORIES[r.id].esg ? { en_esg: r.esg_point, tr_esg: STORIES[r.id].esg } : {}) }));
  const per = Math.ceil(rows.length / 8);
  for (let i = 0; i < 8; i++) writeFileSync(`${out}/${lang}-${i}.json`, JSON.stringify(rows.slice(i * per, (i + 1) * per), null, 1));
  console.log(lang, rows.length, per);
}
