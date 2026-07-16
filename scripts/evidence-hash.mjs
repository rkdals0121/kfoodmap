// Stamp content hashes onto evidence versions.
//
// Run:  node scripts/evidence-hash.mjs          seal any version whose hash is
//                                               missing or "PLACEHOLDER"
//       node scripts/evidence-hash.mjs --check  report drift without writing
//       node scripts/evidence-hash.mjs --reseal <id>@<version>
//                                               deliberately re-seal one version
//
// A sealed version is immutable. If its frozen fields are edited afterwards the
// hash stops matching and check-data fails — that is the point. The escape
// hatch is --reseal, which is loud and names exactly what it rewrites, so an
// intentional correction is a visible act rather than a silent one.
//
// To record that the world changed, do not reseal: append a new version with
// supersedes set to the old one.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE_PATH, hashVersion } from './lib/evidence-store.mjs';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const reseal = args.find(a => a.startsWith('--reseal'))
  ? args[args.indexOf('--reseal') + 1]
  : null;

const [resealId, resealVersion] = reseal ? reseal.split('@') : [];

let sealed = 0;
let drift = 0;

for (const file of readdirSync(EVIDENCE_PATH)) {
  if (!file.endsWith('.json') || file === 'sources.json') continue;
  const path = join(EVIDENCE_PATH, file);
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  let touched = false;

  for (const [id, record] of Object.entries(parsed.records ?? {})) {
    for (const version of record.versions ?? []) {
      const actual = hashVersion(version);
      const unsealed = !version.hash || version.hash === 'PLACEHOLDER';
      const target = resealId === id && Number(resealVersion) === version.version;

      if (unsealed || target) {
        if (CHECK) {
          console.log(`  would seal   ${id}@${version.version} -> ${actual}`);
        } else {
          version.hash = actual;
          touched = true;
          sealed++;
          console.log(`  sealed       ${id}@${version.version} -> ${actual}`);
        }
      } else if (version.hash !== actual) {
        drift++;
        console.error(`  ✗ DRIFT      ${id}@${version.version}`);
        console.error(`      stored:  ${version.hash}`);
        console.error(`      actual:  ${actual}`);
        console.error('      A published version was edited. Append a new version instead,');
        console.error(`      or if the seal itself was wrong: --reseal ${id}@${version.version}`);
      }
    }
  }

  if (touched) writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
}

console.log(`\n${CHECK ? 'check' : 'seal'}: ${sealed} version(s) ${CHECK ? 'pending' : 'sealed'}, ${drift} drifted.`);
process.exit(drift > 0 ? 1 : 0);
