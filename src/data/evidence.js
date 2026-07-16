// The evidence layer: how a fact points at the thing that proves it.
//
//   Restaurant → Fact → EvidenceRef → EvidenceRecord → EvidenceVersion → Source
//
// A fact says *what we believe and how strongly* (see verification.js). Evidence
// says *why*, in a form someone else can re-run: a URL, a method, a dated
// excerpt of what the page actually said, and who fetched it.
//
// Two rules shape the design:
//
//   1. Facts stay small. They carry a value, a confidence, the source's name
//      and a one-line summary for the UI — nothing an auditor would need to
//      page through. Everything heavy lives in evidence records, which are not
//      bundled into the app: they are audit data, read by scripts/, not by
//      React. That is what keeps this workable at 500 restaurants.
//
//   2. Evidence is immutable. A page that changes does not overwrite history;
//      it appends a new version. Facts pin the version they were established
//      from, so "which version was used?" always has an answer, and a stale
//      fact is visible rather than silently re-pointed at newer evidence.
//
// This module holds only what the bundled data needs (evidenceRef and the
// vocabularies). Loading, hashing and resolution live in
// scripts/lib/evidence-store.mjs, on the Node side.

/** Where an evidence record physically lives, relative to the repo root. */
export const EVIDENCE_DIR = 'data/evidence';

/** What kind of authority a source is. Drives `tier`. */
export const SOURCE_KIND = {
  OPERATOR: 'operator',
  GOVERNMENT: 'government',
  MAP: 'map',
  SNS: 'sns',
  DIRECTORY: 'directory',
  PRESS: 'press',
  REFERENCE: 'reference',
};

/**
 * Priority when sources disagree — lower wins. Mirrors the project's agreed
 * order. This ranks *whose word to take*; it does not by itself decide how
 * confident a fact may be (that is the evidence version's `confidence`).
 */
export const SOURCE_TIER = {
  [SOURCE_KIND.OPERATOR]: 1,
  [SOURCE_KIND.GOVERNMENT]: 2,
  [SOURCE_KIND.MAP]: 3,
  [SOURCE_KIND.SNS]: 4,
  [SOURCE_KIND.DIRECTORY]: 5,
  [SOURCE_KIND.PRESS]: 6,
  [SOURCE_KIND.REFERENCE]: 6,
};

/** Lifecycle of one evidence version. */
export const EVIDENCE_STATUS = {
  /** Current, and the page still said this when last checked. */
  ACTIVE: 'active',
  /** A later version replaced it. Kept for the audit trail, never deleted. */
  SUPERSEDED: 'superseded',
  /** We captured only part of what we needed (e.g. a JS-rendered page). */
  PARTIAL: 'partial',
  /** The URL no longer resolves. The excerpt is all that survives. */
  UNREACHABLE: 'unreachable',
  /** Another source contradicts this one and the conflict is unresolved. */
  DISPUTED: 'disputed',
};

/** Reuse terms for anything the evidence page carries (usually photos). */
export const LICENSE = {
  UNKNOWN: 'unknown',
  ALL_RIGHTS_RESERVED: 'allRightsReserved',
  KOGL_1: 'kogl-1',
  KOGL_2: 'kogl-2',
  KOGL_3: 'kogl-3',
  KOGL_4: 'kogl-4',
  CC_BY: 'cc-by',
  CC_BY_SA: 'cc-by-sa',
  PUBLIC_DOMAIN: 'publicDomain',
};

/**
 * A fact's pointer at one evidence version.
 *
 * The version is pinned on purpose. If someone later appends v2 to the same
 * record because the restaurant changed its hours, this fact still declares it
 * was established from v1 — so a reviewer can see the fact is behind its
 * evidence, instead of the fact silently inheriting a claim nobody re-checked.
 *
 * @param {string} id  evidence record id, e.g. "ev-gonghwachun-itour"
 * @param {number} version  the version this fact was established from
 * @param {string} [note]  why this evidence is cited here, if not obvious
 */
export function evidenceRef(id, version, note) {
  return note ? { id, version, note } : { id, version };
}

/** Every evidence reference on a fact, or [] if it predates the evidence layer. */
export const refsOf = (fact) => fact?.evidenceRefs ?? [];

/** Has this fact been migrated onto the evidence layer? */
export const hasEvidence = (fact) => refsOf(fact).length > 0;

/**
 * Fields of an evidence version that are frozen once published. The content
 * hash covers exactly these, so editing any of them in place is detectable —
 * that is what makes immutability enforced rather than merely documented.
 * `status` is deliberately outside: superseding a version must not rewrite it.
 */
export const IMMUTABLE_VERSION_FIELDS = [
  'version', 'method', 'confidence', 'capturedAt', 'checkedAt',
  'retrievedBy', 'excerpt', 'license', 'supersedes',
];
