// Data QA gate. Run: node scripts/check-data.mjs
//
// Keeps the dataset's rules mechanical instead of relying on a reviewer
// remembering them. Exits non-zero on any violation, so it can gate CI.

import { restaurants } from '../src/data/restaurants.js';
import {
  CONFIDENCE, HALAL, isKnown, validateDietary, dietaryBadges,
} from '../src/data/verification.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME = /^\d{1,2}:\d{2}$/;

const problems = [];
const note = (id, msg) => problems.push(`${id}: ${msg}`);

for (const r of restaurants) {
  const facts = {
    coordinates: r.coordinates,
    address: r.address,
    hours: r.hours,
    menus: r.menus,
    'dietary.vegan': r.dietary.vegan,
    'dietary.halal': r.dietary.halal,
    // Optional fields: only present once verified for that place.
    ...(r.phone ? { phone: r.phone } : {}),
    ...(r.officialUrl ? { officialUrl: r.officialUrl } : {}),
    ...(r.instagram ? { instagram: r.instagram } : {}),
    ...(r.transit ? { transit: r.transit } : {}),
  };

  // Hours must always keep their original text, so a structured reading can be
  // audited against what the source actually said.
  if (isKnown(r.hours)) {
    const h = r.hours.value;
    if (typeof h !== 'object' || !h.raw) note(r.id, 'hours must be { raw, weekly } with raw preserved');
    if (h.weekly) {
      for (const [day, slots] of Object.entries(h.weekly)) {
        if (!DAYS.includes(day)) note(r.id, `hours.weekly has unknown day "${day}"`);
        if (!Array.isArray(slots)) note(r.id, `hours.weekly.${day} must be an array ([] means closed)`);
        else for (const s of slots) {
          if (!TIME.test(s.from) || !TIME.test(s.to)) note(r.id, `hours.weekly.${day} slot needs HH:MM from/to`);
          if (s.lastOrder && !TIME.test(s.lastOrder)) note(r.id, `hours.weekly.${day} lastOrder must be HH:MM`);
        }
      }
    }
  }

  if (isKnown(r.transit)) {
    const t = r.transit.value;
    if (!t.station || !t.line) note(r.id, 'transit needs a station and line');
    if (!Number.isFinite(t.walkingMinutes)) note(r.id, 'transit needs walkingMinutes');
  }

  for (const [name, f] of Object.entries(facts)) {
    // The fact() invariant: unknown carries no value, a value is never unknown.
    if (f.confidence === CONFIDENCE.UNKNOWN && f.value !== null) note(r.id, `${name} is unknown but holds a value`);
    if (f.value === null && f.confidence !== CONFIDENCE.UNKNOWN) note(r.id, `${name} has no value but claims ${f.confidence}`);
    // A known fact must say where it came from and why we believe it.
    if (isKnown(f) && !f.source) note(r.id, `${name} is ${f.confidence} with no source`);
    // Anything CONFIRMED must record when it was checked.
    if (f.confidence === CONFIDENCE.CONFIRMED && !f.lastCheckedAt) note(r.id, `${name} is confirmed but has no lastCheckedAt`);
  }

  for (const p of validateDietary(r)) note(r.id, p);

  // A dietary badge must never be shown for a level we can't back.
  for (const b of dietaryBadges(r)) {
    if (!isKnown(b.fact)) note(r.id, `badge "${b.label}" rendered from an unknown fact`);
  }
}

const certified = restaurants.filter((r) => r.dietary.halal.value === HALAL.CERTIFIED);
const confirmed = restaurants.filter((r) =>
  [r.coordinates, r.address, r.hours, r.menus, r.dietary.vegan, r.dietary.halal]
    .some((f) => f.confidence === CONFIDENCE.CONFIRMED));

console.log(`Checked ${restaurants.length} places.`);
console.log(`  halal certified: ${certified.length}  (each needs a sighted certificate)`);
console.log(`  any field confirmed: ${confirmed.length}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nNo violations.');
