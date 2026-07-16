// One-time migration: restaurant data v2 -> v3 (confidence model).
//
// Run:  node scripts/migrate-confidence-v3.mjs         (writes src/data/restaurants.js)
//       node scripts/migrate-confidence-v3.mjs --dry   (prints the confidence report)
//
// v2 had one level below "verified": ESTIMATED. It covered both
//
//   "the source says this kitchen is 100% vegan"        (a stated claim)
//   "we called it vegan because it's a temple"           (our own reading)
//
// which are not the same thing, and the flattening is why the app read as
// less knowledgeable than it is. v3 splits that line into SUPPORTED and
// INFERRED and keeps `source` as its own axis.
//
// The ceiling does not move: nothing becomes CONFIRMED here. Every judgement
// below cites the v2 evidence string it rests on.

import { writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const OUT = new URL('../src/data/restaurants.js', import.meta.url);

// v2 records import a STATUS export that v3's verification.js no longer has,
// so they cannot be loaded in place. Point --input at a v2 copy extracted from
// git (see docs/DATA.md); defaults to the live file for a same-schema re-run.
const inputArg = process.argv.find((a) => a.startsWith('--input='));
const INPUT = inputArg ? inputArg.slice('--input='.length) : '../src/data/restaurants.js';
const { restaurants: v2 } = await import(inputArg ? `file://${INPUT}` : INPUT);

if (!v2[0]?.dietary || !('status' in (v2[0].coordinates ?? {}))) {
  console.error('Expected v2 records (facts with a `status` field). Aborting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dietary confidence table.
//   SUPPORTED — the research states it outright, or a menu item evidences it.
//   INFERRED  — we reasoned from a tag, a category, or the venue's own name.
// ---------------------------------------------------------------------------

const VEGAN_CONFIDENCE = {
  // Reasoned from the temple category rather than a stated claim about the kitchen.
  balwoo: 'INFERRED',
  sanchon: 'INFERRED',
  // The research describes the kitchen itself as vegan.
  osegyehyang: 'SUPPORTED',
  'plant-cafe': 'SUPPORTED',
  'monks-butcher': 'SUPPORTED',
  camouflage: 'SUPPORTED',
  'nono-shop': 'SUPPORTED',
  maji: 'SUPPORTED',
  'chaeyuk-songdo': 'SUPPORTED',
  rim: 'SUPPORTED',
  'meat-morning': 'SUPPORTED',
  // Our own downgrade: the source says "meatless", we reasoned about dairy/egg.
  iryonghal: 'INFERRED',
  // Read off the menu.
  'bombay-brau': 'SUPPORTED',
  gonghwachun: 'SUPPORTED',
};

const HALAL_CONFIDENCE = {
  // Only the venue's own name backs these — self-declaration, not a claim we can cite.
  eid: 'INFERRED',
  makan: 'INFERRED',
  // The research states the kitchen's halal standard.
  kampungku: 'SUPPORTED',
  arabesque: 'SUPPORTED',
  // Read off the menu.
  'bombay-brau': 'SUPPORTED',
  gonghwachun: 'SUPPORTED',
};

// Non-dietary facts: the research states addresses, hours and menus outright
// (SUPPORTED). Positions we placed ourselves at a neighbourhood centre are our
// own approximation (INFERRED); a geocoder hit is a lookup result (SUPPORTED).
const SOURCE_MAP = {
  'Project research draft — not independently verified': 'RESEARCH',
  'Venue self-declaration (name or branding)': 'SELF_DECLARED',
  'Geocoder lookup — approximate': 'GEOCODER',
  'Neighbourhood fallback centre — not the venue position': 'AREA_FALLBACK',
};

const confidenceFor = (sourceKey) => (sourceKey === 'AREA_FALLBACK' ? 'INFERRED' : 'SUPPORTED');

// ---------------------------------------------------------------------------

const q = (s) => JSON.stringify(s);

function factLiteral(valueLiteral, { confidence, sourceKey, evidence, extra = '' }) {
  const parts = [`confidence: CONFIDENCE.${confidence}`];
  if (sourceKey) parts.push(`source: SOURCE.${sourceKey}`);
  if (evidence) parts.push(`evidence: ${q(evidence)}`);
  if (extra) parts.push(extra);
  return `fact(${valueLiteral}, { ${parts.join(', ')} })`;
}

function port(f, { valueLiteral, confidence, extra }) {
  if (f.confidence === 'unknown' || f.status === 'unknown') return `unknownFact(${q(f.evidence)})`;
  const sourceKey = SOURCE_MAP[f.source];
  if (!sourceKey) throw new Error(`Unmapped source: ${f.source}`);
  return factLiteral(valueLiteral, {
    confidence: confidence ?? confidenceFor(sourceKey),
    sourceKey,
    evidence: f.evidence,
    extra,
  });
}

function dietaryLiteral(r) {
  const lines = [];
  const v = r.dietary.vegan;
  const h = r.dietary.halal;

  lines.push(`      vegan: ${v.status === 'unknown'
    ? `unknownFact(${q(v.evidence)})`
    : port(v, { valueLiteral: `VEGAN.${{ full: 'FULL', options: 'OPTIONS', none: 'NONE' }[v.value]}`, confidence: VEGAN_CONFIDENCE[r.id] })},`);

  lines.push(`      halal: ${h.status === 'unknown'
    ? `unknownFact(${q(h.evidence)})`
    : port(h, { valueLiteral: `HALAL.${{ certified: 'CERTIFIED', friendly: 'FRIENDLY', porkFree: 'PORK_FREE', none: 'NONE' }[h.value]}`, confidence: HALAL_CONFIDENCE[r.id] })},`);

  if (r.dietary.halalCertClaim) {
    lines.push(`      // Unverified certification claim — never treated as HALAL.CERTIFIED.`);
    lines.push(`      halalCertClaim: ${JSON.stringify(r.dietary.halalCertClaim)},`);
  }
  return `{\n${lines.join('\n')}\n    }`;
}

function entryLiteral(r) {
  const { lat, lng } = r.coordinates.value;
  const coords = port(r.coordinates, { valueLiteral: `{ lat: ${lat}, lng: ${lng} }` });
  const address = port(r.address, { valueLiteral: q(r.address.value), extra: `precision: ${q(r.address.precision)}` });
  const hours = port(r.hours, { valueLiteral: q(r.hours.value) });
  const menus = port(r.menus, {
    valueLiteral: `[\n${r.menus.value.map((m) => `      { name: ${q(m.name)}, price: ${q(m.price)} },`).join('\n')}\n    ]`,
  });

  return `  {
    id: ${q(r.id)},
    name: ${q(r.name)},
    zone: ${q(r.zone)},
    category: ${q(r.category)},

    coordinates: ${coords},
    address: ${address},
    hours: ${hours},
    menus: ${menus},

    dietary: ${dietaryLiteral(r)},
    traits: ${JSON.stringify(r.traits)},

    // Editorial copy from the project draft; claims inside are not confirmed.
    vibe: ${q(r.vibe)},
    story: ${q(r.story)},
    esg_point: ${q(r.esg_point)},

    image: ${q(r.image)},
    photo: null,
    coverImage: null,
    gallery: [],
  },`;
}

const header = `// Curated places for K-Food Map — schema v3 (confidence model).
//
// Generated by scripts/migrate-confidence-v3.mjs; safe to hand-edit from here on.
//
// Each factual field carries a confidence (how far we trust it) and a source
// (where it came from) — two axes, because "official" and "estimated" answer
// different questions. See src/data/verification.js and docs/DATA.md.
//
// Nothing here is CONFIRMED: no field has been checked against a registry, the
// operator, or an on-site visit. SUPPORTED means a source states it; INFERRED
// means we read it from context and said so.
//
// Removed in v2 and still absent, because they could not be justified:
//   • rating / reviews  — invented figures presented as real scores
//   • food_mile         — invented kilometre figures presented as ESG data
//
// Dietary levels are never inferred from other unconfirmed values: see the
// decision tables in scripts/migrate-dietary-v2.mjs and this file's successor.

// Extension is explicit so data QA scripts can import this under plain Node.
import { fact, unknownFact, CONFIDENCE, SOURCE, VEGAN, HALAL } from './verification.js';

export const restaurants = [
`;

const output = `${header}${v2.map(entryLiteral).join('\n\n')}\n];\n`;

if (DRY) {
  const rows = [];
  for (const r of v2) {
    const v = r.dietary.vegan;
    const h = r.dietary.halal;
    rows.push({
      id: r.id,
      vegan: v.status === 'unknown' ? 'unknown' : `${v.value} / ${VEGAN_CONFIDENCE[r.id]}`,
      halal: h.status === 'unknown' ? 'unknown' : `${h.value} / ${HALAL_CONFIDENCE[r.id]}`,
    });
  }
  console.log('=== DIETARY CONFIDENCE (v2 "estimated" -> supported | inferred) ===');
  for (const row of rows) console.log(`  ${row.id.padEnd(16)} vegan: ${row.vegan.padEnd(22)} halal: ${row.halal}`);
  const tally = (m) => Object.values(m).reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {});
  console.log('\n  vegan:', JSON.stringify(tally(VEGAN_CONFIDENCE)));
  console.log('  halal:', JSON.stringify(tally(HALAL_CONFIDENCE)));
  console.log('\n  confirmed anywhere:', 0, '— the ceiling is unchanged');
} else {
  writeFileSync(OUT, output);
  console.log(`Wrote ${v2.length} entries to src/data/restaurants.js (v2 remains in git history).`);
}
