// Data-integrity primitives.
//
// Rule of the dataset: a value may only be stated as strongly as its evidence.
// "unknown" is always preferable to a guess, and nothing is ever inferred from
// another unverified value (no chaining). Dietary claims in particular can
// cause real harm — a Muslim or vegan traveller acting on a wrong badge — so
// they are only ever as strong as a citable source allows.

/** How much we trust a value. */
export const STATUS = {
  /** Confirmed against a primary source (on-site, official registry, operator). */
  VERIFIED: 'verified',
  /** Taken from project research that has not been confirmed. Treat as a lead. */
  ESTIMATED: 'estimated',
  /** We do not know. Never render as fact. */
  UNKNOWN: 'unknown',
};

/** Where a value came from. Extend as real sources are added in P1. */
export const SOURCE = {
  /** Internal research draft compiled during the project. Not verified. */
  DRAFT: 'Project research draft — not independently verified',
  /** The venue's own name/branding (e.g. "…Halal Korean Food"). Self-declared. */
  SELF_DECLARED: 'Venue self-declaration (name or branding)',
  /** Geocoder lookup by name; may resolve to the wrong building. */
  GEOCODER: 'Geocoder lookup — approximate',
  /** Neighbourhood centre used because geocoding failed. Not a real position. */
  AREA_FALLBACK: 'Neighbourhood fallback centre — not the venue position',
};

/** Vegan assurance, strongest first. */
export const VEGAN = {
  /** Entire kitchen is plant-based. */
  FULL: 'full',
  /** Serves animal products, but has vegan dishes. */
  OPTIONS: 'options',
  /** Known to have nothing vegan. */
  NONE: 'none',
  UNKNOWN: 'unknown',
};

/**
 * Halal assurance, strongest first. Only CERTIFIED may be presented as halal
 * in the religious sense, and it requires a real certificate reference —
 * it must never be derived from a menu, a name, or a vegan claim.
 */
export const HALAL = {
  /** Certified by a recognised body; requires `cert` details. */
  CERTIFIED: 'certified',
  /** Caters to Muslim diners but no certificate on file. */
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
 * @param {{status: string, source?: string, lastCheckedAt?: string, evidence?: string, precision?: string, cert?: object}} meta
 */
export function fact(value, meta = {}) {
  const { status = STATUS.UNKNOWN, source = null, lastCheckedAt = null, ...rest } = meta;

  // An unknown fact carries no value, and a valueless fact cannot be known.
  if (status === STATUS.UNKNOWN || value === null || value === undefined) {
    return { value: null, status: STATUS.UNKNOWN, source: null, lastCheckedAt: null, ...rest };
  }
  return { value, status, source, lastCheckedAt, ...rest };
}

/** An explicitly unknown fact. `evidence` should say why we don't know. */
export const unknownFact = (evidence) => fact(null, { status: STATUS.UNKNOWN, evidence });

export const isKnown = (f) => Boolean(f) && f.status !== STATUS.UNKNOWN && f.value !== null;
export const isVerified = (f) => Boolean(f) && f.status === STATUS.VERIFIED;
/** True when we have a value but nobody has confirmed it. */
export const needsCheck = (f) => Boolean(f) && f.status === STATUS.ESTIMATED;

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
