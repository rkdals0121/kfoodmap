// Shared helpers for distance and opening hours.

// Extension is explicit so data QA scripts can import this under plain Node.
import { isKnown } from './data/verification.js';

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

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "11:30 AM" or "11:30" → minutes since midnight, null if unparseable
function toMinutes(str) {
  const ampm = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (/pm/i.test(ampm[3])) h += 12;
    return h * 60 + parseInt(ampm[2], 10);
  }
  const h24 = str.match(/^(\d{1,2}):(\d{2})$/);
  return h24 ? parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10) : null;
}

const fromMinutes = (mins) => {
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, '0');
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${((h + 11) % 12) + 1}:${m} ${suffix}`;
};

// Fall back to reading a free-text range like "11:30 AM – 9:30 PM". Only used
// for places whose hours haven't been structured yet.
function statusFromRaw(raw, cur) {
  const parts = String(raw).split('–').map(s => s.trim());
  if (parts.length !== 2) return null;
  const opens = toMinutes(parts[0]);
  const closes = toMinutes(parts[1]);
  if (opens == null || closes == null) return null;
  return cur >= opens && cur < closes
    ? { open: true, label: 'Open', detail: `until ${parts[1]}` }
    : { open: false, label: 'Closed', detail: `opens ${parts[0]}` };
}

/**
 * hoursFact → { open, label, detail } | null when we can't say.
 *
 * Never guesses. A day absent from `weekly` means we don't know that day's
 * hours, and returns null rather than assuming the venue is shut.
 */
export function getOpenStatus(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const { raw, weekly } = hoursFact.value;
  const cur = now.getHours() * 60 + now.getMinutes();

  if (!weekly) return raw ? statusFromRaw(raw, cur) : null;

  const today = weekly[DAY_KEYS[now.getDay()]];
  if (!today) return null; // day not recorded — say nothing

  if (today.length === 0) return { open: false, label: 'Closed', detail: 'closed today' };

  for (const slot of today) {
    const from = toMinutes(slot.from);
    const to = toMinutes(slot.to);
    if (from == null || to == null) continue;
    if (cur >= from && cur < to) {
      const lo = slot.lastOrder ? toMinutes(slot.lastOrder) : null;
      // Once last order has passed, "open until close" would mislead someone
      // deciding whether it's worth the trip.
      if (lo != null && cur >= lo) {
        return { open: true, label: 'Open', detail: `last order passed, closes ${fromMinutes(to)}` };
      }
      return {
        open: true,
        label: 'Open',
        detail: slot.lastOrder
          ? `until ${fromMinutes(to)} · last order ${fromMinutes(lo)}`
          : `until ${fromMinutes(to)}`,
      };
    }
  }

  const next = today
    .map(s => toMinutes(s.from))
    .filter(m => m != null && m > cur)
    .sort((a, b) => a - b)[0];
  return next != null
    ? { open: false, label: 'Closed', detail: `opens ${fromMinutes(next)}` }
    : { open: false, label: 'Closed', detail: 'closed for today' };
}

/** Today's printed hours, e.g. "11:30 AM – 3:00 PM, 6:00 PM – 8:20 PM". */
export function todaysHours(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const { weekly } = hoursFact.value;
  if (!weekly) return hoursFact.value.raw ?? null;
  const today = weekly[DAY_KEYS[now.getDay()]];
  if (!today) return null;
  if (today.length === 0) return 'Closed today';
  return today.map(s => `${fromMinutes(toMinutes(s.from))} – ${fromMinutes(toMinutes(s.to))}`).join(', ');
}

// A directions deep link into Google Maps. With an origin (the current map
// centre — the area the user is looking at) it opens a routed trip rather than
// just dropping a pin they then have to route from themselves. Without one it
// falls back to the previous pin behaviour, so a missing origin never breaks
// the link. No runtime routing call is made here — the map app does the
// routing — so this stays inside the no-backend constraint (§2.1).
export function directionsUrl(place, origin = null) {
  const { lat, lng } = coordsOf(place);
  const destination = `${lat},${lng}`;
  if (origin && Number.isFinite(origin[0]) && Number.isFinite(origin[1])) {
    const params = new URLSearchParams({
      api: '1',
      origin: `${origin[0]},${origin[1]}`,
      destination,
    });
    return `https://www.google.com/maps/dir/?${params}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destination}`;
}
