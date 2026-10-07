// Shared helpers for distance and opening hours.

// Extension is explicit so data QA scripts can import this under plain Node.
import i18next from 'i18next';
// Initialises i18next for Node callers too (see src/i18n/index.js's header).
import { dateLocale } from './i18n/index.js';
import { isKnown } from './data/verification.js';
import { listComma } from './i18n/punct.js';

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
  // Indonesian writes the decimal with a comma: "1,9 km".
  if (km < 10) return `${i18next.language === 'id' ? km.toFixed(1).replace('.', ',') : km.toFixed(1)} km`;
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
  // A locale that tells the time on a 24-hour clock says so (`hours.clock`):
  // Indonesian writes 19.30, and "7:30 PM" there is a foreigner's time.
  if (tr('clock') === '24') return tr('time24', { time: `${String(h).padStart(2, '0')}.${m}` });
  // Chinese tells a restaurant's hours on the 24-hour clock with a colon
  // (22:00): "下午10:00" and "上午1:00" read as translated English.
  if (tr('clock') === '24c') return tr('time24', { time: `${String(h).padStart(2, '0')}:${m}` });
  // The 12-hour reading, worded by the locale: "10:30 AM", "오전 10:30".
  // Japanese writes the first hour of each half as 0 (午前0:30, 午後0:30):
  // "午前12:00" reads as noon there.
  // Korean says midnight and noon by name: "오전 12:00" is read as noon by
  // some and midnight by others.
  // …midnight only as the end of a day ("자정까지"): as a start, "내일 자정에
  // 열어요" is read a day late, so an opening at 00:00 keeps its clock time.
  if (tr('clock') === '12k' && h === 0 && total >= 1440) return m === '00' ? '자정' : `밤 12:${m}`;
  if (tr('clock') === '12k' && h === 0) return `오전 0:${m}`;
  if (tr('clock') === '12k' && h === 12) return `낮 12:${m}`;
  const hour = tr('clock') === '12h0' ? h % 12 : ((h + 11) % 12) + 1;
  return tr(h < 12 ? 'timeAm' : 'timePm', { time: `${hour}:${m}` });
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

export const CLOSING_SOON_MIN = 30;
const MAX_BREAK_MIN = 300;

/** The class for an open/closed label: green, amber when closing soon, grey. */
export const statusClass = (status) => (status.soon ? 'is-soon' : status.open ? 'is-open' : 'is-closed');

/**
 * hoursFact → { open, label, detail } | null when we can't say.
 *
 * Never guesses. A day absent from `weekly` means we don't know that day's
 * hours, and returns null rather than assuming the venue is shut.
 */
// nameDay: the answer is for a time the reader picked, not now, so the next
// opening is a named day — "tomorrow" counted from Monday read as Monday.
export function getOpenStatus(hoursFact, now = new Date(), { nameDay = false } = {}) {
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
  // Does another slot start the moment this one ends (a 24-hour place's
  // "00:00–24:00" followed by the next day's "00:00")? Then it is not
  // closing. A midnight close whose next day is not recorded is not called
  // "soon" either: we do not know that it shuts.
  const continuesAt = (day, t) => {
    const next = weekly[DAY_KEYS[(day + Math.floor(t / 1440)) % 7]];
    if (!Array.isArray(next)) return t % 1440 === 0;
    return next.some(sl => toMinutes(sl.from) === t % 1440);
  };
  // `reopen`: when a later slot starts today (dinner after lunch), in
  // minutes. Said once this slot is ending, so "Closes soon" before a break
  // is not read as closed for the day.
  const openResult = (t, lo, at, day, from, reopen = null) => {
    const again = reopen != null ? ` · ${tr('reopens', { time: fromMinutes(reopen) })}` : '';
    if (lo != null && at >= lo) {
      // orderable: false — the doors are open, the kitchen is not (the
      // "Open now" filter leaves these out). Named for what it is, in
      // amber: "Open" here sent people to a kitchen that had stopped.
      return { open: true, orderable: false, soon: true, label: tr('lastOrderOver'), detail: tr('closesAt', { time: fromMinutes(t) }) + again };
    }
    // A whole-day slot ("00:00–24:00") that the next day continues is a
    // 24-hour place: "until 12:00 AM" read as closing at midnight.
    if (from != null && t - from >= 1440 && continuesAt(day, t)) {
      return { open: true, soon: false, label: tr('open'), detail: tr('allDay') };
    }
    // Within half an hour of the last order, or of closing where no last
    // order is recorded, "Open" alone sends people to a kitchen that is
    // about to stop: say which of the two it is. Still open, still orderable.
    const soon = lo != null
      ? lo - at <= CLOSING_SOON_MIN
      : t - at <= CLOSING_SOON_MIN && !continuesAt(day, t);
    return {
      open: true,
      soon,
      label: tr(!soon ? 'open' : lo != null ? 'lastOrderSoon' : 'closingSoon'),
      detail: (lo != null
        ? tr('untilLastOrder', { time: fromMinutes(t), lastOrder: fromMinutes(lo) })
        : tr('until', { time: fromMinutes(t) })) + (soon ? again : ''),
    };
  };

  // Just after midnight, yesterday's late slot may still be running.
  const yesterday = weekly[DAY_KEYS[(k.getUTCDay() + 6) % 7]];
  for (const slot of Array.isArray(yesterday) ? yesterday : []) {
    const sp = span(slot);
    if (sp && sp.to > 1440 && cur + 1440 < sp.to) return openResult(sp.to, sp.lo, cur + 1440, (k.getUTCDay() + 6) % 7, sp.from);
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
      return d === 1 && !nameDay
        ? tr('opensTomorrow', { time: fromMinutes(first) })
        : tr('opensDay', { day: tr(`day.${DAY_KEYS[(k.getUTCDay() + d) % 7]}`), time: fromMinutes(first) });
    }
    return null;
  };

  if (today.length === 0) {
    const next = nextOpening();
    // "Closed · opens tomorrow 5:00 PM". With no next opening on record the
    // label stands alone: "Closed · closed today" said it twice.
    // For a day the reader picked: the day-off word ("휴무", "Closed").
    const dayOff = tr('closedWord');
    return { open: false, label: nameDay ? dayOff.charAt(0).toUpperCase() + dayOff.slice(1) : tr('closedTodayLabel'), detail: next };
  }

  for (const slot of today) {
    const sp = span(slot);
    if (sp && cur >= sp.from && cur < sp.to) {
      const reopen = today
        .map(s => toMinutes(s.from))
        .filter(m => m != null && m >= sp.to)
        .sort((a, b) => a - b)[0] ?? null;
      // A slot that runs straight on (24 hours in two halves) is no break.
      return openResult(sp.to, sp.lo, cur, k.getUTCDay(), sp.from, reopen != null && reopen > sp.to ? reopen : null);
    }
  }

  const next = today
    .map(s => toMinutes(s.from))
    .filter(m => m != null && m > cur)
    .sort((a, b) => a - b)[0];
  if (next != null) {
    // Between two of today's slots (lunch over, dinner to come) is a break,
    // the word on the door ("브레이크 타임"), not a place shut for the day.
    // Only a real break: a gap of a few hours. A record that writes a late
    // night as "00:00–02:00" and "18:00–24:00" is closed all afternoon.
    const ended = Math.max(...today.map(s => span(s)).filter(sp => sp && sp.to <= cur).map(sp => sp.to), -1);
    const onBreak = ended >= 0 && next - ended <= MAX_BREAK_MIN;
    return { open: false, onBreak, label: tr(onBreak ? 'onBreak' : 'closed'), detail: tr('opens', { time: fromMinutes(next) }) };
  }
  return { open: false, label: tr('closed'), detail: nextOpening() };
}

/** A clock time as the app prints it: 750 → "12:30 PM". */
export const formatClock = (minutes) => fromMinutes(minutes);

/** The weekday in Korea right now, 0 (Sunday) to 6. */
export const koreaToday = (now = new Date()) => inKorea(now).getUTCDay();

/**
 * The next moment it is `minutes` past midnight on weekday `day` in Korea
 * (today counts, even if the time has passed: the weekly record is the same).
 * For "Open at…": the same question as "Open now", asked of another time.
 */
export function koreaDateAt(day, minutes, now = new Date()) {
  const k = inKorea(now);
  const cur = k.getUTCHours() * 60 + k.getUTCMinutes();
  const days = (day - k.getUTCDay() + 7) % 7;
  return new Date(now.getTime() + (days * 1440 + minutes - cur) * 60000);
}

/** True only when today (in Korea) is recorded as a day off. */
export function closedAllDay(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return false;
  const day = hoursFact.value.weekly?.[DAY_KEYS[inKorea(now).getUTCDay()]];
  return Array.isArray(day) && day.length === 0;
}

// One slot as printed: "11:30 AM – 3:00 PM", or "24 hours" for a whole day
// ("00:00–24:00", which printed as "12:00 AM – 12:00 AM").
const slotText = (sl) => {
  const from = toMinutes(sl.from);
  const to = toMinutes(sl.to);
  if (from != null && to != null && (to - from >= 1440 || (from === 0 && (to === 0 || to === 1440)))) return tr('allDay');
  // An end at or before its start is past midnight: said as the status
  // line says it ("자정", not "오전 12:00").
  return `${fromMinutes(from)} – ${fromMinutes(from != null && to != null && to <= from ? to + 1440 : to)}`;
};

// A last order earlier on the clock than the slot's start is after midnight.
const lateOrder = (sl) => {
  const from = toMinutes(sl.from);
  const lo = toMinutes(sl.lastOrder);
  return from != null && lo != null && lo < from ? lo + 1440 : lo;
};

/** Today's printed hours, e.g. "11:30 AM – 3:00 PM, 6:00 PM – 8:20 PM". */
export function todaysHours(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const { weekly } = hoursFact.value;
  if (!weekly) return hoursFact.value.raw ?? null;
  const today = weekly[DAY_KEYS[inKorea(now).getUTCDay()]];
  if (!today) return null;
  if (today.length === 0) return tr('closedWord');
  return today.map(slotText).join(listComma());
}

/**
 * The week's hours, Monday first, for the detail page: one row per day with
 * its printed hours, "closed", or null where that day is not recorded (said
 * as such, never guessed). `today` marks the current day in Korea. Null when
 * the record has no day-by-day schedule.
 */
export function weekHours(hoursFact, now = new Date()) {
  if (!isKnown(hoursFact)) return null;
  const { weekly } = hoursFact.value;
  if (!weekly) return null;
  const todayKey = DAY_KEYS[inKorea(now).getUTCDay()];
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((key) => {
    const slots = weekly[key];
    // Each slot's last order where the record has one (lunch and dinner
    // each have their own): what someone arriving late needs.
    const text = !Array.isArray(slots)
      ? null
      : slots.length === 0
        // The day-off word ("휴무", "定休日"), capitalised where the script
        // has capitals ("Closed"), not the "closed now" label.
        ? tr('closedWord').charAt(0).toUpperCase() + tr('closedWord').slice(1)
        : slots.map(sl => (sl.lastOrder
          ? `${slotText(sl)} (${tr('lastOrderAt', { time: fromMinutes(lateOrder(sl)) })})`
          : slotText(sl))).join(listComma());
    return { key, day: tr(`day.${key}`), text, today: key === todayKey };
  });
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

const localeForDates = (lang) => dateLocale(lang);

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

const KO_BRANCH = {
  Itaewon: '이태원', COEX: '코엑스', Seongsu: '성수', Sinsa: '신사', Godeok: '고덕', Mangwon: '망원',
  'Gyeongridan-gil': '경리단길', Kebab: '케밥', Bakery: '베이커리', 'Vegan Bakery': '비건 베이커리', 'Vegan Cafe': '비건 카페',
  "Seoul Nat'l Univ. Station": '서울대입구역', "I'Park Mall Yongsan": '아이파크몰 용산', 'Famille Station': '파미에스테이션',
  'Terminal 1': '제1터미널', 'Nami Island': '남이섬', 'Terminal 1 East Food Court': '제1터미널 동편 푸드코트',
};
export function displayName(name) {
  // In Korean the name is the one on the sign: "EID Halal Korean Food (이드)"
  // is 이드, and "Kervan (케르반) Famille Station" is 케르반 Famille Station.
  // Records without a Korean name keep the romanised one.
  if (i18next.language === 'ko' && koreanName(name)) {
    return String(name)
      .replace(/^.*?\(([^)]*[가-힣][^)]*)\)/, '$1')
      // What follows the Korean name says which branch ("미스터케밥
      // Itaewon"): in Korean too, where it is a name with a set spelling.
      .replace(/^([^A-Za-z]*?[가-힣][^A-Za-z]*?)\s*,?\s+([A-Za-z].*)$/, (whole, head, tail) => (KO_BRANCH[tail] ? `${head.trim()} ${KO_BRANCH[tail]}` : whole))
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return String(name)
    .replace(/\s*\([^)]*[가-힣][^)]*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
