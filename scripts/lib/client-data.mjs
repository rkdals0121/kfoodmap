// What of src/data/restaurants.js the browser downloads up front.
//
// Every fact carries an `evidence` paragraph — the quote, which fetch it came
// from, why a field was left unknown. It is how the data is audited, and it
// was about a third of the main bundle (measured 2026-09-29: 269 places,
// 1.79 MB raw / 405 kB gzip, growing with every batch). Only one place in the
// UI reads it: the trust badge's tooltip in the detail view
// (verification.js trustBadge → RestaurantDetail's Trust).
//
// So the list, the map and the filters get the data without it, and the
// detail view fetches that one place's full record from
// /place-data/<id>.json when it opens (src/hooks/usePlaceEvidence.js). The
// source, URL, method, date and confidence of every fact stay in the bundle,
// so every badge and label renders exactly as before; only the tooltip text
// arrives a moment later.
export function withoutEvidence(value) {
  if (Array.isArray(value)) return value.map(withoutEvidence);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'evidence') continue;
      out[k] = withoutEvidence(v);
    }
    return out;
  }
  return value;
}

// The module the browser gets in place of restaurants.js. A JSON.parse of a
// string literal is also cheaper for the browser to parse than the same data
// as an object literal.
export function clientModule(restaurants) {
  const json = JSON.stringify(withoutEvidence(restaurants));
  return `export const restaurants = JSON.parse(${JSON.stringify(json)});\n`;
}

/** The full record served at /place-data/<id>.json. */
export const placeDataFile = (r) => ({ fileName: `place-data/${r.id}.json`, source: JSON.stringify(r) });
