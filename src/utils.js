// Shared helpers for distance and opening hours.

import { isKnown } from './data/verification';

// Initial map view: frames the Seoul cluster (Jongno down to Itaewon)
export const MAP_CENTER = [37.5540, 126.9880];

/** Coordinates are stored as a fact(); every consumer reads them through here. */
export const coordsOf = (place) => place.coordinates.value;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(Math.round(km * 20) * 50, 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// "11:30 AM" → minutes since midnight, null if unparseable
function toMinutes(str) {
  const m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// hoursFact → { open, label, detail } | null when the hours aren't known.
// Never guesses: an unknown fact yields no status rather than a default.
export function getOpenStatus(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const parts = hoursFact.value.split('–').map(s => s.trim());
  if (parts.length !== 2) return null;
  const opens = toMinutes(parts[0]);
  const closes = toMinutes(parts[1]);
  if (opens == null || closes == null) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= opens && cur < closes
    ? { open: true, label: 'Open', detail: `until ${parts[1]}` }
    : { open: false, label: 'Closed', detail: `opens ${parts[0]}` };
}

export function directionsUrl(place) {
  const { lat, lng } = coordsOf(place);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
