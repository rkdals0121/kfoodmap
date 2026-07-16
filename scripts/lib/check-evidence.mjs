// Validation for the evidence layer.
//
// These rules exist so that "the evidence is sound" is something a machine
// asserts on every run, not something a reviewer has to remember. Each returns
// a flat list of problem strings; check-data prints them and exits non-zero.

import { CONFIDENCE } from '../../src/data/verification.js';
import { EVIDENCE_STATUS, IMMUTABLE_VERSION_FIELDS, refsOf } from '../../src/data/evidence.js';
import { hashVersion, currentVersion, resolveRef } from './evidence-store.mjs';

const METHODS = new Set([
  'OPERATOR_SITE', 'GOV_LISTING', 'MAP_LOOKUP', 'MAP_CROSSCHECK',
  'ROUTING_API', 'DIRECTORY_LISTING', 'CORROBORATED',
]);

const CONFIDENCE_RANK = {
  [CONFIDENCE.INFERRED]: 1,
  [CONFIDENCE.SUPPORTED]: 2,
  [CONFIDENCE.CONFIRMED]: 3,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today in Seoul. Every date in this dataset is a Korean calendar date —
 * the venues, the sources and the people checking them are all in KST — so
 * comparing against a UTC "today" would call this morning's work the future
 * for nine hours a day.
 */
export const todayInSeoul = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

/** Every fact on a restaurant that can carry evidence, with a readable path. */
export function factsOf(restaurant) {
  const out = [];
  for (const key of ['coordinates', 'address', 'hours', 'menus', 'phone', 'officialUrl', 'instagram', 'transit']) {
    if (restaurant[key]) out.push({ path: key, fact: restaurant[key] });
  }
  for (const key of ['vegan', 'halal']) {
    if (restaurant.dietary?.[key]) out.push({ path: `dietary.${key}`, fact: restaurant.dietary[key] });
  }
  return out;
}

/** Refs that live outside facts (editorial copy still needs sourcing). */
const extraRefsOf = (restaurant) => (restaurant.storyRefs ?? []).map(ref => ({ path: 'storyRefs', ref }));

export function checkEvidence(store, restaurants, today = todayInSeoul()) {
  const problems = [];
  const note = (where, msg) => problems.push(`${where}: ${msg}`);

  // --- duplicate evidence ids -------------------------------------------
  for (const dup of store.duplicates) {
    note('evidence', `duplicate id "${dup.id}" defined in ${dup.files.join(' and ')}`);
  }

  // --- record- and version-level rules ----------------------------------
  for (const [id, record] of Object.entries(store.records)) {
    const where = `evidence ${id}`;

    if (!record.url) note(where, 'record has no url — evidence must be locatable');
    if (!record.title) note(where, 'record has no title');
    if (!record.sourceId) note(where, 'record names no source');
    else if (!store.sources[record.sourceId]) note(where, `source "${record.sourceId}" is not in sources.json`);
    if (record.declaredFor && record.declaredFor !== record.restaurantId) {
      note(where, `file declares restaurantId "${record.declaredFor}" but is named for "${record.restaurantId}"`);
    }

    const versions = [...(record.versions ?? [])].sort((a, b) => a.version - b.version);
    if (versions.length === 0) note(where, 'record has no versions');

    versions.forEach((v, i) => {
      const vWhere = `${where}@${v.version}`;

      // --- invalid version chains ---
      if (v.version !== i + 1) note(vWhere, `versions must run 1..n without gaps; found ${v.version} at position ${i + 1}`);
      const expectedSupersedes = i === 0 ? null : versions[i - 1].version;
      if ((v.supersedes ?? null) !== expectedSupersedes) {
        note(vWhere, `supersedes should be ${expectedSupersedes === null ? 'null' : expectedSupersedes}, found ${JSON.stringify(v.supersedes ?? null)}`);
      }
      // Only the newest version may be active; older ones are history.
      const isNewest = i === versions.length - 1;
      if (!isNewest && v.status !== EVIDENCE_STATUS.SUPERSEDED) {
        note(vWhere, `is not the newest version, so status must be "superseded" (found "${v.status}")`);
      }
      if (isNewest && v.status === EVIDENCE_STATUS.SUPERSEDED) {
        note(vWhere, 'is the newest version but marked superseded — nothing supersedes it');
      }

      // --- unsupported methods ---
      if (!v.method) note(vWhere, 'has no method');
      else if (!METHODS.has(v.method)) note(vWhere, `unsupported method "${v.method}"`);

      // --- confidence ceiling ---
      if (!CONFIDENCE_RANK[v.confidence]) note(vWhere, `confidence must be inferred|supported|confirmed, found "${v.confidence}"`);
      if (!Object.values(EVIDENCE_STATUS).includes(v.status)) note(vWhere, `unknown status "${v.status}"`);

      // --- impossible timestamps ---
      for (const field of ['capturedAt', 'checkedAt']) {
        const value = v[field];
        if (!value) note(vWhere, `has no ${field}`);
        else if (!ISO_DATE.test(value)) note(vWhere, `${field} "${value}" is not YYYY-MM-DD`);
        else if (value > today) note(vWhere, `${field} "${value}" is in the future`);
      }
      if (v.capturedAt && v.checkedAt && v.capturedAt > v.checkedAt) {
        note(vWhere, `capturedAt ${v.capturedAt} is after checkedAt ${v.checkedAt} — evidence cannot be checked before it was captured`);
      }
      if (i > 0) {
        const prev = versions[i - 1];
        if (prev.capturedAt && v.capturedAt && v.capturedAt < prev.capturedAt) {
          note(vWhere, `captured ${v.capturedAt}, before the version it supersedes (${prev.capturedAt})`);
        }
      }

      if (!v.retrievedBy) note(vWhere, 'has no retrievedBy — an audit needs to know who fetched this');
      if (!v.excerpt) note(vWhere, 'has no excerpt — evidence must record what the source actually said');
      if (!v.license?.type) note(vWhere, 'has no license.type (use "unknown" if not established)');

      // --- immutable version violations ---
      if (!v.hash || v.hash === 'PLACEHOLDER') {
        note(vWhere, 'is unsealed — run `node scripts/evidence-hash.mjs`');
      } else {
        const actual = hashVersion(v);
        if (actual !== v.hash) {
          note(vWhere, `was edited after publication (hash ${v.hash} != ${actual}). Append a new version instead of rewriting history; frozen fields are ${IMMUTABLE_VERSION_FIELDS.join(', ')}`);
        }
      }
    });
  }

  // --- reference-level rules --------------------------------------------
  const referenced = new Set();

  for (const restaurant of restaurants) {
    const refs = [
      ...factsOf(restaurant).flatMap(({ path, fact }) => refsOf(fact).map(ref => ({ path, ref, fact }))),
      ...extraRefsOf(restaurant),
    ];

    for (const { path, ref, fact } of refs) {
      const where = `${restaurant.id}.${path}`;
      referenced.add(ref.id);

      // --- broken references ---
      const resolved = resolveRef(store, ref);
      if (!resolved) {
        note(where, `references ${ref.id}@${ref.version}, which does not exist`);
        continue;
      }

      // A fact may not claim more than its evidence can bear.
      if (fact) {
        const ceiling = Math.max(...refsOf(fact).map(r => {
          const res = resolveRef(store, r);
          return res ? (CONFIDENCE_RANK[res.version.confidence] ?? 0) : 0;
        }));
        const claimed = CONFIDENCE_RANK[fact.confidence] ?? 0;
        if (claimed > ceiling) {
          note(where, `is ${fact.confidence}, but its strongest evidence only supports ${
            Object.keys(CONFIDENCE_RANK).find(k => CONFIDENCE_RANK[k] === ceiling) ?? 'nothing'
          }`);
        }
      }

      // A pinned ref that has fallen behind is not an error — it is the point —
      // but it must be visible.
      const current = currentVersion(resolved.record);
      if (current && current.version > ref.version) {
        note(where, `pins ${ref.id}@${ref.version} while v${current.version} exists — re-verify, then move the pin (this is a warning by design, not a silent re-point)`);
      }
    }
  }

  // --- orphan evidence ---------------------------------------------------
  for (const id of Object.keys(store.records)) {
    if (!referenced.has(id)) note(`evidence ${id}`, 'is referenced by no fact — either cite it or remove it');
  }

  return problems;
}
