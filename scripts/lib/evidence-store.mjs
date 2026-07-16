// Loading, hashing and resolution for the evidence layer.
//
// Node-side on purpose: evidence is audit data, not app data. Keeping it out of
// src/ keeps it out of the bundle, which is what lets the store grow to 500+
// restaurants without the app paying for it.
//
// Layout (repo root):
//   data/evidence/sources.json        one registry of sources, shared by all
//   data/evidence/<restaurantId>.json one file per restaurant
//
// One file per restaurant rather than one big index: diffs stay readable, two
// people can verify different restaurants without conflicting, and a reviewer
// opens exactly one file to audit one venue.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { IMMUTABLE_VERSION_FIELDS } from '../../src/data/evidence.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EVIDENCE_PATH = join(ROOT, 'data', 'evidence');
const SOURCES_FILE = 'sources.json';

/** Stable stringify: key order must not change a hash. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The content hash of an evidence version, over its frozen fields only.
 * Recomputed on every check: if a published version was edited in place, the
 * stored hash no longer matches and the edit is caught.
 */
export function hashVersion(version) {
  const frozen = {};
  for (const key of IMMUTABLE_VERSION_FIELDS) frozen[key] = version[key] ?? null;
  return createHash('sha256').update(canonical(frozen)).digest('hex').slice(0, 16);
}

export function loadSources() {
  const file = join(EVIDENCE_PATH, SOURCES_FILE);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Every evidence record, keyed by id, each tagged with the restaurant whose
 * file it came from (so an orphan or a cross-file id clash is locatable).
 */
export function loadEvidence() {
  if (!existsSync(EVIDENCE_PATH)) return { records: {}, duplicates: [] };
  const records = {};
  const duplicates = [];

  for (const file of readdirSync(EVIDENCE_PATH)) {
    if (!file.endsWith('.json') || file === SOURCES_FILE) continue;
    const restaurantId = basename(file, '.json');
    const parsed = JSON.parse(readFileSync(join(EVIDENCE_PATH, file), 'utf8'));
    for (const [id, record] of Object.entries(parsed.records ?? {})) {
      if (records[id]) duplicates.push({ id, files: [records[id].restaurantId, restaurantId] });
      records[id] = { ...record, id, restaurantId, declaredFor: parsed.restaurantId };
    }
  }
  return { records, duplicates };
}

/** The whole store, loaded once. */
export function loadStore() {
  const { records, duplicates } = loadEvidence();
  return { sources: loadSources(), records, duplicates };
}

/** Resolve a fact's ref to { record, version, source }, or null if broken. */
export function resolveRef(store, ref) {
  const record = store.records[ref.id];
  if (!record) return null;
  const version = (record.versions ?? []).find(v => v.version === ref.version);
  if (!version) return null;
  return { record, version, source: store.sources[record.sourceId] ?? null };
}

/** The newest version of a record, by version number. */
export const currentVersion = (record) =>
  [...(record.versions ?? [])].sort((a, b) => b.version - a.version)[0] ?? null;

/** Is this ref pinned to something older than the record's newest version? */
export function isStaleRef(store, ref) {
  const record = store.records[ref.id];
  if (!record) return false;
  const current = currentVersion(record);
  return Boolean(current) && current.version > ref.version;
}
