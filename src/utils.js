// Shared helpers for distance and opening hours.

// Extension is explicit so data QA scripts can import this under plain Node.
import i18next from 'i18next';
// Initialises i18next for Node callers too (see src/i18n/index.js's header).
import './i18n/index.js';
import { isKnown } from './data/verification.js';

// Opening-hours wording comes from the locale files (hours.*), so it follows
// the chosen language. Read at call time, never at module load.
const tr = (key, params) => i18next.t(`hours.${key}`, params);

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
  // Rounded to 50 m; 0.99 km would otherwise print as "1000 m".
  if (km < 0.975) return `${Math.max(Math.round(km * 20) * 50, 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Opening hours are Korean wall-clock times, so "open now" is asked of the
// clock in Korea, not the device: someone planning from London at 1 pm was
// told a Seoul lunch place was open when it was 9 pm there (2026-10-02).
// Korea has no daylight saving, so UTC+9 is exact. Returns a Date whose UTC
// fields read as Korean local time; use only the getUTC* getters on it.
const KST_OFFSET_MIN = 540;
const inKorea = (now) => new Date(now.getTime() + KST_OFFSET_MIN * 60000);

/** The time in Korea now, as "9:05 PM" — for a visitor whose device is elsewhere. */
export function koreaClock(now = new Date()) {
  const k = inKorea(now);
  return fromMinutes(k.getUTCHours() * 60 + k.getUTCMinutes());
}

/** Is this device's clock on Korean time? If not, hours need saying so. */
export const deviceOnKoreaTime = (now = new Date()) => now.getTimezoneOffset() === -KST_OFFSET_MIN;

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

const fromMinutes = (total) => {
  const mins = ((total % 1440) + 1440) % 1440;
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
  // A close at or before the opening time runs past midnight ("6:00 PM – 2:00 AM").
  const isOpen = closes > opens ? cur >= opens && cur < closes : cur >= opens || cur < closes;
  return isOpen
    ? { open: true, label: tr('open'), detail: tr('until', { time: parts[1] }) }
    : { open: false, label: tr('closed'), detail: tr('opens', { time: parts[0] }) };
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
  const k = inKorea(now);
  const cur = k.getUTCHours() * 60 + k.getUTCMinutes();

  if (!weekly) return raw ? statusFromRaw(raw, cur) : null;

  // A slot whose close is at or before its opening ("10:00"–"01:00") runs past
  // midnight. Until 2026-09-29 such slots never matched, so 25 slots at late
  // kebab and pub kitchens showed "Closed" through their whole evening.
  const span = (slot) => {
    const from = toMinutes(slot.from);
    let to = toMinutes(slot.to);
    if (from == null || to == null) return null;
    if (to <= from) to += 1440;
    let lo = slot.lastOrder ? toMinutes(slot.lastOrder) : null;
    if (lo != null && lo < from) lo += 1440;
    return { from, to, lo };
  };
  const openResult = (t, lo, at) => {
    if (lo != null && at >= lo) {
      return { open: true, label: tr('open'), detail: tr('lastOrderPassed', { time: fromMinutes(t) }) };
    }
    return {
      open: true,
      label: tr('open'),
      detail: lo != null
        ? tr('untilLastOrder', { time: fromMinutes(t), lastOrder: fromMinutes(lo) })
        : tr('until', { time: fromMinutes(t) }),
    };
  };

  // Just after midnight, yesterday's late slot may still be running.
  const yesterday = weekly[DAY_KEYS[(k.getUTCDay() + 6) % 7]];
  for (const slot of Array.isArray(yesterday) ? yesterday : []) {
    const sp = span(slot);
    if (sp && sp.to > 1440 && cur + 1440 < sp.to) return openResult(sp.to, sp.lo, cur + 1440);
  }

  const today = weekly[DAY_KEYS[k.getUTCDay()]];
  if (!today) return null; // day not recorded — say nothing

  // When it next opens, looking ahead day by day. Stops at the first day
  // whose hours aren't recorded: past that we don't know, so we say nothing
  // rather than skip over it to a later day.
  const nextOpening = () => {
    for (let d = 1; d <= 7; d++) {
      const day = weekly[DAY_KEYS[(k.getUTCDay() + d) % 7]];
      if (!Array.isArray(day)) return null;
      const first = day.map(s => toMinutes(s.from)).filter(m => m != null).sort((a, b) => a - b)[0];
      if (first == null) continue;
      return d === 1
        ? tr('opensTomorrow', { time: fromMinutes(first) })
        : tr('opensDay', { day: tr(`day.${DAY_KEYS[(k.getUTCDay() + d) % 7]}`), time: fromMinutes(first) });
    }
    return null;
  };

  if (today.length === 0) {
    const next = nextOpening();
    // "Closed · opens tomorrow 5:00 PM" — the label already says closed.
    return { open: false, label: tr('closed'), detail: next ?? tr('closedToday') };
  }

  for (const slot of today) {
    const sp = span(slot);
    if (sp && cur >= sp.from && cur < sp.to) return openResult(sp.to, sp.lo, cur);
  }

  const next = today
    .map(s => toMinutes(s.from))
    .filter(m => m != null && m > cur)
    .sort((a, b) => a - b)[0];
  if (next != null) return { open: false, label: tr('closed'), detail: tr('opens', { time: fromMinutes(next) }) };
  return { open: false, label: tr('closed'), detail: nextOpening() ?? tr('closedForToday') };
}

/** Today's printed hours, e.g. "11:30 AM – 3:00 PM, 6:00 PM – 8:20 PM". */
export function todaysHours(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const { weekly } = hoursFact.value;
  if (!weekly) return hoursFact.value.raw ?? null;
  const today = weekly[DAY_KEYS[inKorea(now).getUTCDay()]];
  if (!today) return null;
  if (today.length === 0) return tr('closedWord');
  return today.map(s => `${fromMinutes(toMinutes(s.from))} – ${fromMinutes(toMinutes(s.to))}`).join(', ');
}

// Directions deep links. They name only the destination, so the map app
// routes from where the phone actually is. They used to pass the app's map
// centre as the origin, which is not the visitor's position: after a pan,
// or from a shared link (the map starts over Seoul), a Busan place was
// routed from Seoul. No routing call is made here (§2.1).
export function directionsUrl(place) {
  const { lat, lng } = coordsOf(place);
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}` });
  return `https://www.google.com/maps/dir/?${params}`;
}

// Naver's directions with an empty start ("-"), which Naver fills with the
// phone's location; a name search could land on another branch. Naver's
// web links carry Web Mercator metres (EPSG:3857), as in its own
// /p/directions/-/14135864.3,4515440.9,<name>,.../-/car links.
const toMercator = (lat, lng) => {
  const R = 6378137;
  const x = R * (lng * Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  return [x, y];
};
export function naverMapUrl(place) {
  const { lat, lng } = coordsOf(place);
  const [x, y] = toMercator(lat, lng);
  // Commas separate fields in Naver's and Kakao's link paths: strip them from the name.
  const name = encodeURIComponent(displayName(place.name).replace(/,/g, ' '));
  return `https://map.naver.com/p/directions/-/${x.toFixed(2)},${y.toFixed(2)},${name}/-/transit`;
}

// Kakao's route link starts from the phone's location too.
export function kakaoMapUrl(place) {
  const { lat, lng } = coordsOf(place);
  const name = encodeURIComponent(displayName(place.name).replace(/,/g, ' '));
  return `https://map.kakao.com/link/to/${name},${lat},${lng}`;
}

// Locale-aware date formatting. i18next's language codes ('en') aren't
// always the right Intl locale tag for date formatting (bare 'en' resolves
// to US month-day-year order) -- this maps each app language to the locale
// tag its dates should actually use. English keeps mapping to 'en-GB', the
// same tag the two former hardcoded call sites used, so today's rendered
// output is unchanged; a future language can add its own entry here (or, if
// its i18next code is already a correct locale tag, needs no entry at all).
const DATE_LOCALES = { en: 'en-GB' };

const localeForDates = (lang) => DATE_LOCALES[lang] ?? lang;

// A malformed/unmapped language tag (e.g. 'en_US' instead of 'en-US') makes
// Intl's locale matching throw RangeError rather than degrade — letting that
// escape from a render path would take down the whole detail page over a bad
// tag. Fall back to 'en-GB', the same tag English already resolves to, so
// today's output is unchanged in every case this can actually be reached.
function toLocaleDateStringSafe(date, locale, options) {
  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString('en-GB', options);
  }
}

export function formatLongDate(ts, lang) {
  if (!ts) return null;
  return toLocaleDateStringSafe(new Date(ts), localeForDates(lang), { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShortDate(ts, lang) {
  if (!ts) return null;
  return toLocaleDateStringSafe(new Date(ts), localeForDates(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The name to show on cards, stamps and headings: the stored name without
 * its Korean parenthetical, keeping anything after it. "Chick Peace (칙피스)
 * Seongsu" → "Chick Peace Seongsu", so branches of one chain stay apart in
 * the list; "Busan Jib KBBQ (Halal)" keeps its non-Korean parenthetical.
 * Until 2026-09-29 this was name.split('(')[0], which dropped the branch.
 */
/**
 * The Korean name a place's record carries in brackets — "Mahina Vegan Table
 * (마히나 비건 테이블)" → "마히나 비건 테이블" — or null. It is the name on the
 * sign and the one Naver Map, Kakao Map and a taxi driver know; the English
 * name often finds nothing there.
 */
export function koreanName(name) {
  const m = String(name ?? '').match(/\(([^)]*[가-힣][^)]*)\)/);
  return m ? m[1].trim() : null;
}

export function displayName(name) {
  return String(name)
    .replace(/\s*\([^)]*[가-힣][^)]*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
