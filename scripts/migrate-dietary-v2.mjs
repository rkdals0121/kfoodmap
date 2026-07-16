// One-time migration: restaurant data v1 -> v2 (P0 data-integrity sprint).
//
// Run:  node scripts/migrate-dietary-v2.mjs           (writes src/data/restaurants.js)
//       node scripts/migrate-dietary-v2.mjs --dry     (prints a decision report)
//
// This script is the migration record. Every dietary judgement below cites the
// evidence it rests on, taken verbatim from the v1 draft. Two rules govern it:
//
//   1. Never infer. A level is only assigned when the v1 draft states it.
//      Where the draft is silent or contradicts itself, the level is UNKNOWN.
//   2. Never chain. A value derived from another unverified value (e.g.
//      "plant-based, therefore halal") is inference, not evidence.
//
// Nothing in this dataset has been confirmed against a primary source, so no
// field is emitted as VERIFIED. That is the honest state today; P1 replaces
// ESTIMATED with VERIFIED as sources are gathered.

import { writeFileSync } from 'node:fs';
import { restaurants as v1 } from '../src/data/restaurants.js';

const DRY = process.argv.includes('--dry');
const OUT = new URL('../src/data/restaurants.js', import.meta.url);

// Guard: this transform only understands v1 records. Re-running it against
// already-migrated data would read undefined tags/coords and emit rubbish.
// (v1 is recoverable from git if a re-run is ever needed.)
if (!Array.isArray(v1[0]?.tags)) {
  console.error('Data is already v2 (no `tags` array) — nothing to migrate. Aborting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dietary decision table — the substance of this migration.
// `vegan` / `halal`: [level, evidence] or null for unknown (with a reason).
// ---------------------------------------------------------------------------

const D = {
  balwoo: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'v1 tagged Vegan; Buddhist temple course menu ("Michelin Temple Course")'],
    halal: [null, 'No halal information in the source'],
  },
  sanchon: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'v1 tagged Vegan; temple banchan / mountain-greens menu'],
    halal: [null, 'No halal information in the source'],
  },
  osegyehyang: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "convert rich Korean-Chinese classics into 100% vegan meals"'],
    halal: [null, 'No halal information in the source'],
  },
  'plant-cafe': {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'v1 tagged Vegan; source describes "hearty western-style vegan dining" with an in-house vegan bakery'],
    halal: [null, 'No halal information in the source'],
  },
  'monks-butcher': {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "modern, upscale vegan dining"; menu is entirely plant-based'],
    halal: [null, 'No halal information in the source'],
  },
  camouflage: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: menu is "completely free of animal products"'],
    halal: [null, 'No halal information in the source'],
  },
  eid: {
    vegan: [null, 'No vegan information in the source'],
    halal: ['friendly', 'ESTIMATED', 'SELF_DECLARED', 'Venue name declares halal ("EID Halal Korean Food")'],
    // The draft claims KMF certification. Recorded as an unverified claim only —
    // a certificate reference is required before HALAL.CERTIFIED may be used.
    halalCertClaim: { body: 'KMF (Korea Muslim Federation)', status: 'claimed in project draft; certificate not sighted' },
  },
  makan: {
    vegan: [null, 'No vegan information in the source'],
    halal: ['friendly', 'ESTIMATED', 'SELF_DECLARED', 'Venue name declares halal ("Makan Halal Korean Restaurant")'],
  },
  kampungku: {
    vegan: [null, 'No vegan information in the source'],
    halal: ['friendly', 'ESTIMATED', 'DRAFT', 'Source states menus are prepared "under a strict Halal standard"'],
  },
  'nono-shop': {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "Every vegan product and beverage sold here"'],
    halal: [null, 'No halal information in the source'],
  },
  'ggot-epida': {
    // Deliberately unknown: the prose is suggestive but the draft never tagged
    // it vegan, and "whole-plant cooking" is not a vegan-kitchen claim.
    vegan: [null, 'Source describes whole-plant cooking but never states the kitchen is vegan — not inferred'],
    halal: [null, 'No halal information in the source'],
  },
  maji: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "a fully plant-based menu"'],
    // FIX (audit C-2): v1 tagged this Halal purely on the reasoning
    // "plant-based therefore naturally halal". That is inference, and halal
    // concerns slaughter, cross-contamination and certification — not just
    // ingredients. Downgraded to unknown.
    halal: [null, 'v1 Halal tag was derived from the plant-based menu; certification never evidenced — inference removed'],
  },
  'chaeyuk-songdo': {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states pork is replaced with soy meat as a "vegan alternative"'],
    halal: [null, 'No halal information in the source'],
  },
  iryonghal: {
    // Downgraded: v1 tagged Vegan, but the prose only supports "meatless",
    // which does not exclude dairy or egg.
    vegan: ['options', 'ESTIMATED', 'DRAFT', 'Source says "vegetable-forward" and "meatless", not vegan — dairy/egg unclear, so the stronger claim is not made'],
    halal: [null, 'No halal information in the source'],
  },
  rim: {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "100% plant-based Italian cuisine"'],
    halal: [null, 'No halal information in the source'],
  },
  'meat-morning': {
    vegan: ['full', 'ESTIMATED', 'DRAFT', 'Source states: "vegan desserts" and "homemade plant-based Greek yogurt"'],
    halal: [null, 'No halal information in the source'],
  },
  arabesque: {
    vegan: [null, 'No vegan information in the source'],
    halal: ['friendly', 'ESTIMATED', 'DRAFT', 'Source states: "strictly Halal, alcohol-free Indian and Turkish delicacies"'],
  },
  'bombay-brau': {
    // FIX (audit C-1): v1 tagged Vegan while the menu lists chicken. The venue
    // caters to both diets; it is not a vegan kitchen.
    vegan: ['options', 'ESTIMATED', 'DRAFT', 'Menu lists "Vegan Dal Makhani" alongside "Halal Tandoori Chicken" — vegan dishes exist, the kitchen is not vegan'],
    halal: ['friendly', 'ESTIMATED', 'DRAFT', 'Menu lists "Halal Tandoori Chicken"; source states it caters to halal diets'],
  },
  gonghwachun: {
    vegan: ['none', 'ESTIMATED', 'DRAFT', 'Menu lists "Sweet and Sour Pork"'],
    halal: ['none', 'ESTIMATED', 'DRAFT', 'Menu lists "Sweet and Sour Pork"'],
  },
  akiya: {
    vegan: [null, 'No vegan information in the source'],
    halal: [null, 'No halal information in the source'],
  },
};

// Coordinates: v1 kept geocoder hits at full precision and neighbourhood
// fallback centres at 3–4 dp. Precision tells us which is which.
const isGeocoded = (r) => String(r.lat).split('.')[1]?.length > 4;
// Street-level addresses start with a building number.
const hasStreetNumber = (r) => /\d/.test(r.address.split(',')[0]);

// ---------------------------------------------------------------------------

const q = (s) => JSON.stringify(s);

function factLiteral(valueLiteral, { status, source, evidence, extra = '' }) {
  const parts = [`status: STATUS.${status}`];
  if (source) parts.push(`source: SOURCE.${source}`);
  if (evidence) parts.push(`evidence: ${q(evidence)}`);
  if (extra) parts.push(extra);
  return `fact(${valueLiteral}, { ${parts.join(', ')} })`;
}

function unknownLiteral(reason) {
  return `unknownFact(${q(reason)})`;
}

function dietaryLiteral(id) {
  const d = D[id];
  if (!d) throw new Error(`No dietary decision recorded for "${id}"`);

  const build = (spec, kind) => {
    const [level, statusOrReason, source, evidence] = spec;
    if (level === null) return unknownLiteral(statusOrReason);
    const constant = kind === 'vegan' ? 'VEGAN' : 'HALAL';
    const key = { full: 'FULL', options: 'OPTIONS', none: 'NONE', certified: 'CERTIFIED', friendly: 'FRIENDLY', porkFree: 'PORK_FREE' }[level];
    return factLiteral(`${constant}.${key}`, { status: statusOrReason, source, evidence });
  };

  const lines = [
    `    vegan: ${build(d.vegan, 'vegan')},`,
    `    halal: ${build(d.halal, 'halal')},`,
  ];
  if (d.halalCertClaim) {
    lines.push(`    // Unverified certification claim — never treated as HALAL.CERTIFIED.`);
    lines.push(`    halalCertClaim: ${JSON.stringify(d.halalCertClaim)},`);
  }
  return `{\n${lines.join('\n')}\n  }`;
}

function entryLiteral(r) {
  const traits = r.tags.filter((t) => t !== 'Vegan' && t !== 'Halal');

  const coords = factLiteral(`{ lat: ${r.lat}, lng: ${r.lng} }`, {
    status: 'ESTIMATED',
    source: isGeocoded(r) ? 'GEOCODER' : 'AREA_FALLBACK',
    evidence: isGeocoded(r)
      ? 'Geocoder hit; not confirmed as the venue entrance'
      : 'Neighbourhood centre used because geocoding did not resolve — may be off by ~100 m',
  });

  const address = factLiteral(q(r.address), {
    status: 'ESTIMATED',
    source: 'DRAFT',
    extra: `precision: ${q(hasStreetNumber(r) ? 'street' : 'area')}`,
    evidence: hasStreetNumber(r) ? undefined : 'Area-level only — no street address on file',
  });

  const hours = r.hours
    ? factLiteral(q(r.hours), { status: 'ESTIMATED', source: 'DRAFT' })
    : unknownLiteral('Opening hours never confirmed');

  const menus = factLiteral(
    `[\n${r.menus.map((m) => `      { name: ${q(m.name)}, price: ${q(m.price)} },`).join('\n')}\n    ]`,
    { status: 'ESTIMATED', source: 'DRAFT', evidence: 'Menu names and prices from the draft; most prices are approximate' },
  );

  return `  {
    id: ${q(r.id)},
    name: ${q(r.name)},
    zone: ${q(r.zone)},
    category: ${q(r.category)},

    coordinates: ${coords},
    address: ${address},
    hours: ${hours},
    menus: ${menus},

    dietary: ${dietaryLiteral(r.id)},
    traits: ${JSON.stringify(traits)},

    // Editorial copy from the project draft; claims inside are not verified.
    vibe: ${q(r.vibe)},
    story: ${q(r.story)},
    esg_point: ${q(r.esg_point)},

    image: ${q(r.image)},
    photo: null,
    coverImage: null,
    gallery: [],
  },`;
}

const header = `// Curated places for K-Food Map — schema v2 (P0 data-integrity sprint).
//
// Generated by scripts/migrate-dietary-v2.mjs; safe to hand-edit from here on.
//
// Every factual field carries its provenance via fact(): a value, how far we
// trust it (STATUS) and where it came from (SOURCE). Nothing here has been
// confirmed against a primary source yet, so no field is VERIFIED — the app
// says so rather than implying certainty it does not have.
//
// Removed in v2 because they could not be justified (see the P0 audit):
//   • rating / reviews  — invented figures presented as real scores
//   • food_mile         — invented kilometre figures presented as ESG data
// They are not replaced with new guesses. Unknown is the honest answer.
//
// Dietary levels are never inferred: see the decision table (with evidence)
// in scripts/migrate-dietary-v2.mjs.

// Extension is explicit so data QA scripts can import this under plain Node.
import { fact, unknownFact, STATUS, SOURCE, VEGAN, HALAL } from './verification.js';

export const restaurants = [
`;

const body = v1.map(entryLiteral).join('\n\n');
const output = `${header}${body}\n];\n`;

if (DRY) {
  console.log('=== DIETARY DECISIONS ===');
  for (const r of v1) {
    const d = D[r.id];
    const fmt = (spec) => (spec[0] === null ? `unknown  (${spec[1]})` : `${spec[0].padEnd(8)} (${spec[3]})`);
    const oldV = r.tags.includes('Vegan') ? 'Vegan' : '—';
    const oldH = r.tags.includes('Halal') ? 'Halal' : '—';
    console.log(`\n${r.id}  [v1: ${oldV}/${oldH}]`);
    console.log(`  vegan: ${fmt(d.vegan)}`);
    console.log(`  halal: ${fmt(d.halal)}`);
  }
  console.log('\n=== REMOVED FIELDS ===');
  console.log('  rating, reviews, food_mile removed from all', v1.length, 'entries');
} else {
  writeFileSync(OUT, output);
  console.log(`Wrote ${v1.length} entries to src/data/restaurants.js (v1 remains in git history).`);
}
