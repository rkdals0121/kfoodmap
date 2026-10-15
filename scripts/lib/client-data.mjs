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
// (one word of `transit` stays, as `nearStation`: see clientRecord),
// and the detail view fetches the full record from /place-data/<id>.json
// when it opens (src/hooks/usePlaceRecord.js). Value, confidence and source
// of every remaining fact stay in the bundle, so every badge in the list
// renders exactly as before.
//
// scripts/tests/client-data.test.mjs fails if any other file starts reading
// a stripped field — such a reader must fetch the full record first.
import { stationKey } from '../../src/data/station-ko.js';
import { saysNoAlcohol } from '../../src/filters.js';

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
  // The one word of `transit` the list needs: which station the place is
  // at, so that a search for a station (반월당역, "Anguk Station") finds the
  // places whose page says it is theirs. As the station's key (one name
  // however the record spells it: src/data/station-ko.js), and only within
  // a kilometre — the page of a place 7 km from its "nearest" station names
  // it too, and that place is not at the station. Left out when there is
  // none: some 12 kB over the whole list.
  const near = r.transit?.value;
  if (near?.station && near.distanceM <= 1000) out.nearStation = stationKey(near.station);
  // Whether a note says no alcohol is sold: most of those notes are
  // evidence text, which is not here — read from the full record, at build.
  out.noAlcoholSaid = saysNoAlcohol(r);
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
