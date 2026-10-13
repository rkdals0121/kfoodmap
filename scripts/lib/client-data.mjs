// What of src/data/restaurants.js the browser downloads up front.
//
// The list, the map, the filters, search, the Journal and Discover need a
// place's name, area, position, hours, dietary badges, traits, vibe and
// story — not the audit trail or the practical details only the detail view
// shows. Those were most of the main bundle (measured 2026-09-29: at 269
// places the chunk was 1.79 MB raw / 405 kB gzip; at 651 it was 2.37 MB /
// 433 kB even without evidence text).
//
// So the bundle carries each place without
//   - `evidence`, `url`, `method` and `lastCheckedAt` on any fact — the
//     audit trail behind each badge, which only the detail view shows — and
//   - DETAIL_ONLY fields, which nothing outside RestaurantDetail reads,
// and the detail view fetches the full record from /place-data/<id>.json
// when it opens (src/hooks/usePlaceRecord.js). Value, confidence and source
// of every remaining fact stay in the bundle, so every badge in the list
// renders exactly as before.
//
// scripts/tests/client-data.test.mjs fails if any other file starts reading
// a stripped field — such a reader must fetch the full record first.
export const DETAIL_ONLY = ['menus', 'transit', 'phone', 'officialUrl', 'instagram', 'timeline'];
export const AUDIT_KEYS = ['evidence', 'url', 'method', 'lastCheckedAt'];

function stripEvidence(value) {
  if (Array.isArray(value)) return value.map(stripEvidence);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (AUDIT_KEYS.includes(k)) continue;
      out[k] = stripEvidence(v);
    }
    return out;
  }
  return value;
}

export function clientRecord(r) {
  const out = stripEvidence(r);
  for (const k of DETAIL_ONLY) delete out[k];
  // The one word of `transit` the list needs: the name of the nearest
  // station, so that a search for a station the lists of names do not know
  // (반월당역, 중앙로역) can find the places whose page says it is theirs.
  // Only within a kilometre (a quarter of an hour on foot): the page of a
  // place 7 km from its "nearest" station names it too, and that place is
  // not at the station. Some ten bytes a place.
  const near = r.transit?.value;
  out.nearStation = near?.station && near.distanceM <= 1000 ? near.station : null;
  return out;
}

// Kept for callers that only want the evidence gone.
export const withoutEvidence = stripEvidence;

// The module the browser gets in place of restaurants.js. A JSON.parse of a
// string literal is also cheaper for the browser to parse than the same data
// as an object literal.
export function clientModule(restaurants) {
  const json = JSON.stringify(restaurants.map(clientRecord));
  return `export const restaurants = JSON.parse(${JSON.stringify(json)});\n`;
}

/** The full record served at /place-data/<id>.json. */
export const placeDataFile = (r) => ({ fileName: `place-data/${r.id}.json`, source: JSON.stringify(r) });
