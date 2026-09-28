// Joins a place's full record (fetched when its detail opens) back onto the
// facts the bundle already has, which arrive without their `evidence` text
// (see scripts/lib/client-data.mjs).
//
// Walks the bundled record and the full record side by side and maps each
// bundled fact object to its evidence string. Keyed by object identity
// (a WeakMap), so the detail view can look up exactly the fact it is
// showing without knowing where in the record it lives.
export function pairEvidence(slim, full) {
  const map = new WeakMap();
  if (!slim || !full || slim.id !== full.id) return map;
  const walk = (a, b) => {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
    if (!Array.isArray(a) && typeof b.evidence === 'string') map.set(a, b.evidence);
    for (const k of Object.keys(a)) walk(a[k], b[k]);
  };
  walk(slim, full);
  return map;
}
