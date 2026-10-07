// Scripted checks of the flows that broke before, against a running site:
//   node scripts/regress/run.mjs https://kfoodmap.vercel.app [name ...]
// Each file in steps/ is a list of steps for ../translation-review/shot.mjs
// (headless Chrome); what each prints is compared by eye with README.md.
// They press nothing that sends anything.
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) { console.error('usage: node scripts/regress/run.mjs <base url> [name ...]'); process.exit(1); }
const only = process.argv.slice(3);
const work = mkdtempSync(join(tmpdir(), 'kfm-regress-'));
for (const file of readdirSync(join(here, 'steps')).filter(f => f.endsWith('.json')).sort()) {
  const name = file.replace(/\.json$/, '');
  if (only.length > 0 && !only.includes(name)) continue;
  const steps = join(work, file);
  writeFileSync(steps, readFileSync(join(here, 'steps', file), 'utf8').replaceAll('{{BASE}}', base));
  const run = spawnSync(process.execPath, [join(here, '..', 'translation-review', 'shot.mjs'), steps], { encoding: 'utf8' });
  console.log(`== ${name}\n${(run.stdout + run.stderr).trim()}`);
}
