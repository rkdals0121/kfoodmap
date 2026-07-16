// Data-integrity primitives.
//
// Every fact carries two independent things, and collapsing them loses
// information we need:
//
//   confidence — how far we trust the value
//   source     — where the value came from
//
// "Official" is a source; "estimated" is a confidence. A single enum mixing
// them cannot say "community-reported and we confirmed it" or "official but
// three years stale". The UI collapses the pair into one badge; the data does
// not have to.
//
// Two rules govern the dataset:
//
//   1. Never state a value more strongly than its evidence. Where the source
//      is silent or contradicts itself, the answer is UNKNOWN.
//   2. Never chain. A value derived from another unconfirmed value is not
//      evidence — "plant-based, therefore halal" is exactly that mistake.
//
// Nuance is not inflation: nothing here is CONFIRMED yet, and refining the
// levels below that line does not move the ceiling.

/** How far we trust a value. */
export const CONFIDENCE = {
  /** Checked against a primary source: a registry, the operator, or a visit. */
  CONFIRMED: 'confirmed',
  /** A source states it outright, but nobody has checked it. */
  SUPPORTED: 'supported',
  /** Reasoned from context we trust. The reasoning is recorded in `evidence`. */
  INFERRED: 'inferred',
  /** We do not know. Never render as fact. */
  UNKNOWN: 'unknown',
};

/** Where a value came from. Independent of how much we trust it. */
export const SOURCE = {
  /** A registry or certifying body (KMF, city open data). */
  OFFICIAL: 'Official registry or certifying body',
  /** The restaurant itself — its site, its staff, a call. */
  OPERATOR: 'The restaurant',
  /**
   * Naver Place or Kakao Map, read through their official APIs. Korea's de
   * facto business registers: operators maintain their own listings, so this
   * is strong enough to carry CONFIRMED when both services agree.
   */
  MAP_SERVICE: 'Naver Place / Kakao Map',
  /**
   * A third-party restaurant directory (e.g. DiningCode) that aggregates other
   * listings. Useful, but a step removed from the operator — SUPPORTED at best.
   */
  DIRECTORY: 'Restaurant directory listing',
  /** Traveller reports. Needs moderation before it can carry CONFIRMED. */
  COMMUNITY: 'Traveller reports',
  /** Our own project research. */
  RESEARCH: 'Project research',
  /** The venue's name or branding, e.g. "…Halal Korean Food". Self-declared. */
  SELF_DECLARED: 'Venue name or branding',
  /** Geocoder lookup by name; may resolve to the wrong building. */
  GEOCODER: 'Geocoder lookup',
  /** Neighbourhood centre standing in for a real position. */
  AREA_FALLBACK: 'Neighbourhood centre placeholder',
};

/** Vegan assurance, strongest first. */
export const VEGAN = {
  /** The whole kitchen is plant-based. */
  FULL: 'full',
  /** Serves animal products, and has vegan dishes. */
  OPTIONS: 'options',
  /** Known to have nothing vegan. */
  NONE: 'none',
  UNKNOWN: 'unknown',
};

/**
 * Halal assurance, strongest first. CERTIFIED is the only level that may be
 * read as halal in the religious sense, and it requires a certificate on file
 * plus CONFIRMED confidence — never a name, a menu, or a vegan claim.
 */
export const HALAL = {
  CERTIFIED: 'certified',
  /** Caters to Muslim diners; no certificate on file. */
  FRIENDLY: 'friendly',
  /** Confirmed to serve no pork; says nothing about certification. */
  PORK_FREE: 'porkFree',
  /** Known to serve pork. */
  NONE: 'none',
  UNKNOWN: 'unknown',
};

/**
 * Wrap a value with its provenance.
 * @param {*} value
 * @param {{confidence: string, source?: string, lastCheckedAt?: string,
 *          evidence?: string, precision?: string, cert?: object}} meta
 */
export function fact(value, meta = {}) {
  const { confidence = CONFIDENCE.UNKNOWN, source = null, lastCheckedAt = null, ...rest } = meta;

  // An unknown fact carries no value, and a valueless fact cannot be known.
  if (confidence === CONFIDENCE.UNKNOWN || value === null || value === undefined) {
    return { value: null, confidence: CONFIDENCE.UNKNOWN, source: null, lastCheckedAt: null, ...rest };
  }
  return { value, confidence, source, lastCheckedAt, ...rest };
}

/** An explicitly unknown fact. `evidence` should say why we don't know. */
export const unknownFact = (evidence) => fact(null, { confidence: CONFIDENCE.UNKNOWN, evidence });

export const isKnown = (f) => Boolean(f) && f.confidence !== CONFIDENCE.UNKNOWN && f.value !== null;
export const isConfirmed = (f) => Boolean(f) && f.confidence === CONFIDENCE.CONFIRMED;
/** We have a value, but nobody has checked it against a primary source. */
export const needsCheck = (f) => isKnown(f) && !isConfirmed(f);

/**
 * Collapse confidence × source into the one badge a reader can act on.
 * `tone` drives styling; `detail` is the long-form explanation.
 */
export function trustBadge(f) {
  if (!isKnown(f)) return { label: 'Unknown', tone: 'none', detail: f?.evidence ?? 'Not established.' };

  if (f.confidence === CONFIDENCE.CONFIRMED) {
    if (f.source === SOURCE.OFFICIAL) return { label: 'Official', tone: 'strong', detail: 'Confirmed against an official registry.' };
    if (f.source === SOURCE.COMMUNITY) return { label: 'Community-checked', tone: 'medium', detail: 'Reported by travellers and checked by us.' };
    return { label: 'Confirmed', tone: 'strong', detail: 'Confirmed with the restaurant.' };
  }
  if (f.confidence === CONFIDENCE.SUPPORTED) {
    return { label: 'Reported', tone: 'medium', detail: `Stated by a source, not yet confirmed. ${f.evidence ?? ''}`.trim() };
  }
  return { label: 'Inferred', tone: 'weak', detail: `Our reading, not a stated fact. ${f.evidence ?? ''}`.trim() };
}

/** Human labels for dietary levels. Absent levels intentionally render nothing. */
export const VEGAN_LABEL = {
  [VEGAN.FULL]: 'Fully vegan',
  [VEGAN.OPTIONS]: 'Vegan options',
};
export const HALAL_LABEL = {
  [HALAL.CERTIFIED]: 'Halal certified',
  [HALAL.FRIENDLY]: 'Halal-friendly',
  [HALAL.PORK_FREE]: 'Pork-free',
};

/** Dietary badges a card/detail may show, in priority order. */
export function dietaryBadges(place) {
  const out = [];
  const v = place.dietary?.vegan;
  const h = place.dietary?.halal;
  if (isKnown(v) && VEGAN_LABEL[v.value]) out.push({ key: 'vegan', label: VEGAN_LABEL[v.value], fact: v });
  if (isKnown(h) && HALAL_LABEL[h.value]) out.push({ key: 'halal', label: HALAL_LABEL[h.value], fact: h });
  return out;
}

/** Does this place satisfy a dietary filter chip? Unknown never matches. */
export function matchesDietary(place, chip) {
  if (chip === 'Vegan') {
    const v = place.dietary?.vegan;
    return isKnown(v) && (v.value === VEGAN.FULL || v.value === VEGAN.OPTIONS);
  }
  if (chip === 'Halal') {
    const h = place.dietary?.halal;
    return isKnown(h) && (h.value === HALAL.CERTIFIED || h.value === HALAL.FRIENDLY);
  }
  return false;
}

/**
 * The weakest dietary confidence on a place — what any caveat must speak to.
 * A single INFERRED level drags the whole record down, because that is the one
 * a traveller would be most surprised by.
 */
export function dietaryConfidence(place) {
  const known = [place.dietary?.vegan, place.dietary?.halal].filter(isKnown);
  if (known.length === 0) return CONFIDENCE.UNKNOWN;
  const rank = { [CONFIDENCE.INFERRED]: 0, [CONFIDENCE.SUPPORTED]: 1, [CONFIDENCE.CONFIRMED]: 2 };
  return known.reduce((worst, f) => (rank[f.confidence] < rank[worst] ? f.confidence : worst), CONFIDENCE.CONFIRMED);
}

/**
 * Data QA: dietary rules a record must never break. Returns a list of problems.
 * Run from scripts/check-data.mjs; keeps the never-infer rules mechanical
 * rather than relying on reviewer memory.
 */
export function validateDietary(place) {
  const problems = [];
  const h = place.dietary?.halal;

  if (h?.value === HALAL.CERTIFIED) {
    if (!isConfirmed(h)) problems.push('halal CERTIFIED requires CONFIRMED confidence');
    if (!h.cert) problems.push('halal CERTIFIED requires a `cert` reference');
  }
  // Halal may never be inferred: the levels turn on slaughter, cross-
  // contamination and certification, none of which can be read off context.
  if (h && h.confidence === CONFIDENCE.INFERRED && h.value !== HALAL.NONE && h.source !== SOURCE.SELF_DECLARED) {
    problems.push('halal may only be INFERRED from the venue’s own declaration');
  }
  if (place.dietary?.halalCertClaim && h?.value === HALAL.CERTIFIED) {
    problems.push('a claimed certificate must stay a claim until sighted — do not use CERTIFIED');
  }
  return problems;
}
