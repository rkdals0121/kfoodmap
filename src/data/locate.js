// "My location": where the visitor is, asked once per tap, used only in the
// browser. It centres the map and measures the distances shown on cards and
// place pages. It is never stored (no localStorage) and never sent to this
// app's server — src/data/privacy.js says so, and must keep saying what this
// file does.
//
// Pure helpers here; the browser call lives in App.jsx.

// Mainland Korea and its islands (Jeju, Ulleungdo, Dokdo, Baengnyeongdo),
// with a margin. A position outside it is not used: "9,412 km from you"
// helps nobody, and the map has nothing to show there.
const KOREA = { south: 32.8, north: 38.9, west: 124.4, east: 132.1 };

export function inKorea({ lat, lng }) {
  return lat >= KOREA.south && lat <= KOREA.north && lng >= KOREA.west && lng <= KOREA.east;
}

/**
 * What to do with a geolocation answer.
 *   { state: 'located', location: { lat, lng, accuracy } }
 *   { state: 'outside' }      — a position, but not in Korea
 *   { state: 'unavailable' }  — no usable position
 */
export function readPosition(position) {
  const c = position?.coords;
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return { state: 'unavailable' };
  const location = {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
  };
  return inKorea(location) ? { state: 'located', location } : { state: 'outside' };
}

/** GeolocationPositionError.code → our state. 1 is PERMISSION_DENIED. */
export function readError(error) {
  return { state: error?.code === 1 ? 'denied' : 'unavailable' };
}

// A desktop on Wi-Fi or an IP lookup can be kilometres off. Past this the
// dot is drawn as "about here" and distances are prefixed "about".
export const COARSE_ACCURACY_M = 1000;
export const isCoarse = (location) => location?.accuracy != null && location.accuracy > COARSE_ACCURACY_M;
