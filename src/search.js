// What the list and the map show for a search and a set of chips, and what
// to offer when that is little or nothing. Pure: App.jsx hands in the
// places and the state, and this file is what the tests exercise.
//
// The order of the fallbacks matters and each was earned by a search that
// went wrong (docs/MOBILE-AUDIT-2026-10-04.ko.md):
//   1. the text as typed;
//   2. a station ("Seoul Station exit 1", "서울역", "江南駅") → the records
//      that say "<Area> Station"; if the chips rule those out, nothing in
//      the list and the nearest matches measured from the station; if the
//      station is not on record, its area;
//   3. several words that some records carry as a phrase → those records;
//   4. nothing found anywhere, chips or no chips, and a word one letter off
//      a well-known area → that area.
// A fallback never fires because the chips emptied the list: "Mangwon" +
// Halal is no reason to show Gangwon.
import { matchesDietary } from './data/verification.js';
import { fuzzyQuery, romaniseQuery } from './data/area-names.js';
import {
  DIETARY_CHIPS, TRAIT_GROUPS, OPEN_NOW, OPEN_AT, SAVED_ONLY, SHARED_LIST, FULLY_VEGAN,
  matchesFullyVegan, matchesSearch, matchesArea, matchesAreaWhole, matchesPhrase,
} from './filters.js';
import { getOpenStatus, coordsOf, haversineKm } from './utils.js';

// The longest search the box accepts. A page of pasted text built a regular
// expression too large to compile and took the whole app down.
export const MAX_QUERY = 80;

const EXIT_TAIL = /\s*(?:exit|出口)?\s*\d+\s*(?:번\s*출구|번|出口)?$/i;
const ENDS_IN_STATION = /(?:\bstation|\bstn\.?|역|駅|站)$/i;
const CJK_STATION = /^(\S+?)(?:입구|入口)?(?:역|駅|站)$/;
const LATIN_STATION = /^(.*?\S)\s+(?:subway\s+)?station$/i;

/**
 * The station a query names, or null: { area, phrase }. "Seoul Station
 * exit 1", "seoul stn", "서울 역", "서울역 1번 출구" are all Seoul Station.
 * A word that merely ends in 역 ("미역", seaweed) is not a station: the
 * part before it has to be a place we can name.
 */
export function stationOf(query) {
  let s = String(query ?? '').trim();
  const noExit = s.replace(EXIT_TAIL, '').trim();
  if (noExit !== s && ENDS_IN_STATION.test(noExit)) s = noExit;
  s = s.replace(/\bstn\.?$/i, 'station').replace(/\s+(역|駅|站)$/, '$1');
  const cjk = CJK_STATION.exec(s);
  if (cjk) {
    const roman = romaniseQuery(cjk[1]);
    // romaniseQuery leaves what it cannot name ("Hongdae 입구"): only a
    // clean romanisation is an area.
    if (roman && !/[\u0080-\uffff]/.test(roman)) return { area: roman, phrase: `${roman} station` };
    if (/^[A-Za-z][A-Za-z .'-]*$/.test(cjk[1])) return { area: cjk[1], phrase: `${cjk[1]} station` };
    return null;
  }
  const latin = LATIN_STATION.exec(s);
  if (latin && !/^subway$/i.test(latin[1])) return { area: latin[1], phrase: `${latin[1]} station` };
  return null;
}

const titled = (s) => s.replace(/(^|[ -])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export function searchPlaces({
  places, query = '', filters = [], areaOnly = false, openOn = false, includeUnknown = false,
  now = new Date(), bookmarkedIds = [], sharedIds = [],
}) {
  const raw = String(query ?? '').slice(0, MAX_QUERY).replace(/\s+/g, ' ').trim();

  // Filter chips (AND across chips). A dietary chip only matches on
  // evidence — an unknown dietary record never matches, so we never send
  // someone somewhere we can't vouch for. A group chip ORs within itself.
  const chips = (r) => filters.every((f) => {
    if (f === OPEN_NOW || f === OPEN_AT) return true; // asked last, in select()
    if (f === SAVED_ONLY) return bookmarkedIds.includes(r.id);
    if (f === SHARED_LIST) return sharedIds.includes(r.id);
    if (f === FULLY_VEGAN) return matchesFullyVegan(r);
    if (DIETARY_CHIPS.includes(f)) return matchesDietary(r, f);
    const group = TRAIT_GROUPS[f];
    return group ? r.traits.some(t => group.includes(t)) : r.traits.includes(f);
  });
  const openEnough = (r) => {
    if (!openOn) return 'yes';
    const status = getOpenStatus(r.hours, now);
    if (status === null) return 'unknown';
    // Open but past last order is no use to someone who wants to eat now.
    return status.open === true && status.orderable !== false ? 'yes' : 'no';
  };
  // The places that pass the chips and `pred`, and how many of them were
  // left out for having no recorded hours.
  const select = (pred) => {
    const list = [];
    let unknown = 0;
    for (const r of places) {
      if (!chips(r) || !pred(r)) continue;
      const open = openEnough(r);
      if (open === 'unknown') { unknown += 1; if (includeUnknown) list.push(r); } else if (open === 'yes') list.push(r);
    }
    return { list, unknown };
  };
  const byText = (q) => (r) => (areaOnly ? matchesArea(r, q) : matchesSearch(r, q));
  const onRecord = (q) => places.some(r => matchesSearch(r, q));
  const isArea = (q) => places.some(r => matchesAreaWhole(r, q));

  let result = select(byText(raw));
  let used = raw;
  // Set when a station is on record but nothing at it passes the chips: the
  // nearest that do are then measured from the station itself.
  let anchorPlaces = null;

  if (raw && !areaOnly) {
    const station = stationOf(raw);
    if (station) {
      const atStation = (r) => matchesPhrase(r, station.phrase);
      const label = station.phrase.toLowerCase() === raw.toLowerCase() ? raw : `${titled(station.area)} Station`;
      const named = select(atStation);
      const spots = named.list.length > 0 ? [] : places.filter(atStation);
      if (named.list.length > 0) {
        result = named;
        used = label;
      } else if (spots.length > 0 && filters.length > 0) {
        result = { list: [], unknown: named.unknown };
        used = label;
        anchorPlaces = spots;
      } else if (onRecord(station.area) || isArea(station.area)) {
        result = select(byText(station.area));
        used = station.area;
      } else {
        // "myongdong station": the area itself is a letter off.
        const guess = fuzzyQuery(station.area);
        if (guess) { result = select(byText(guess)); used = guess; }
      }
    } else {
      // "seoul station" typed where a place is named so, "korean bbq": the
      // records that say exactly that, when some but not all do.
      if (raw.includes(' ')) {
        const exact = select(r => matchesSearch(r, raw) && matchesPhrase(r, raw));
        if (exact.list.length > 0 && exact.list.length < result.list.length) result = exact;
      }
      // Nothing on record under these words at all: perhaps one letter off
      // an area ("myongdong"). Not when the chips are what emptied the list.
      if (result.list.length === 0 && !onRecord(raw)) {
        const guess = fuzzyQuery(raw);
        if (guess) {
          const again = select(byText(guess));
          if (again.list.length > 0 || isArea(guess)) { result = again; used = guess; }
        }
      }
    }
  }

  // Little or nothing under the chips: the nearest places that do match.
  // Measured from the station when one was named; else from the results
  // that are in the area searched; else from the area itself; else (a name
  // search) from the results. Never from a record that merely shares a word
  // with the search — "Lotte World" was once measured from World Cup buk-ro.
  let nearest = [];
  let nearestFrom = '';
  if (result.list.length < 3 && raw && filters.length > 0
    && !filters.includes(SAVED_ONLY) && !filters.includes(SHARED_LIST)) {
    // The search names an area when most of what it finds is found by its
    // area: "Itaewon" does, "cafe" (one street is called Cafe Street) does not.
    const inArea = places.filter(r => matchesAreaWhole(r, used));
    const area = inArea.length > 0 && inArea.length * 2 >= places.filter(r => matchesSearch(r, used)).length ? inArea : [];
    const found = result.list.filter(r => area.includes(r));
    const from = anchorPlaces ?? (found.length > 0 ? found : area.length > 0 ? area : result.list);
    const fromResults = !anchorPlaces && from !== area;
    const reach = anchorPlaces ? 4 : fromResults ? 5 : 40;
    const points = from.map(coordsOf);
    if (points.length > 0) {
      const lat = points.reduce((sum, c) => sum + c.lat, 0) / points.length;
      const lng = points.reduce((sum, c) => sum + c.lng, 0) / points.length;
      // "Seo-gu" is a district in six cities: its middle is a mountain.
      const spread = Math.max(...points.map(c => haversineKm(lat, lng, c.lat, c.lng)));
      if (spread <= 30) {
        nearest = places
          .filter(r => chips(r) && !result.list.includes(r) && openEnough(r) === 'yes')
          .map((r) => { const c = coordsOf(r); return { place: r, km: haversineKm(lat, lng, c.lat, c.lng) }; })
          .filter(x => x.km <= reach)
          .sort((a, b) => a.km - b.km)
          .slice(0, anchorPlaces ? 6 : 3);
        // '' when the distances are from the places found: the list then
        // says "close to these" rather than name an area.
        nearestFrom = fromResults ? '' : used;
      }
    }
  }

  return {
    filteredRestaurants: result.list,
    unknownHours: result.unknown,
    // The search as it was used. Equal to what was typed unless a fallback
    // rewrote it; the list then says "also searched as".
    matchQuery: used === raw ? query : used,
    nearest,
    nearestFrom,
  };
}
