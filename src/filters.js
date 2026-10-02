// Filter-chip vocabulary shared by App.jsx (which applies it against
// restaurants.js) and the test suite (which checks it against
// src/i18n/labels.js). A single source of truth so a chip id added or
// renamed on one side is caught rather than silently matching nothing.
//
// Not restaurant data, and not part of the trust model in src/data/ (see
// verification.js's header) — just the chip vocabulary shared by the app
// and its test. Lives outside src/data/ on purpose.
//
// Dietary chips are answered by the structured dietary record (never a tag
// string); the rest are descriptive traits.
import { matchesDietary } from './data/verification.js';

export const DIETARY_CHIPS = ['Vegan', 'Halal'];

// "Open now" is a chip like the others (AND-ed, cleared with them) but it is
// answered by the clock, not by a trait, so it stays out of CHIP_GROUPS and
// its data test. A place whose hours are not recorded never matches: the
// filter promises "open", and unknown is not open.
export const OPEN_NOW = 'Open now';

// "Saved": only the places this visitor has saved, so a trip's shortlist
// can be seen on the map (the Journal lists them; it could not show where
// they are). Answered from the passport on this device, not from place data.
export const SAVED_ONLY = 'Saved';

// "Fully vegan": only kitchens recorded as all-vegan, leaving out places
// that offer vegan options on a mixed menu — the distinction HappyCow draws
// between "Vegan" and "Veg-options", and the one that spares a strict vegan
// from asking about every dish. The level is the record's own value at
// whatever confidence it holds; the claim mark on each card still says how
// sure that is.
export const FULLY_VEGAN = 'Fully vegan';
export const matchesFullyVegan = (r) => {
  const v = r.dietary?.vegan;
  return Boolean(v) && v.confidence !== 'unknown' && v.value === 'full';
};

// A group chip matches *any* trait in its set, which is the one place chips
// are not AND-ed. Sustainability exists because its two members are narrow
// enough that selecting both returns nothing — the group is the way to browse
// the axis, the members are still there to narrow within it.
export const TRAIT_GROUPS = {
  Sustainability: ['Zero-waste', 'Local Sourcing'],
};

// Free-text search over what a traveller would type: the place's name
// (English and the Korean in brackets), its vibe line, its neighbourhood,
// and its street address — so "Gangnam", "Mapo-gu" or "Busan" find the
// places there even when the neighbourhood label names a smaller area.
// Hyphens and spaces are ignored on both sides, so "mapo gu", "mapogu" and
// "Mapo-gu" all match.
const squash = (s) => s.toLowerCase().replace(/[\s-]+/g, '');

// Typing a diet word finds what its chip finds. Most visitors type "halal"
// rather than tap the chip, and the word alone matched only places with it
// in their name: 41 against the chip's 152 (critique 3, 2026-10-01).
// The same words in the languages the app speaks, so a reader who types
// the label they see on a chip finds what the chip finds. Compared after
// squash(), so no spaces or hyphens.
const DIET_WORDS = {
  halal: 'Halal', vegan: 'Vegan',
  'ハラール': 'Halal', 'ハラル': 'Halal', 'ヴィーガン': 'Vegan', 'ビーガン': 'Vegan',
  '清真': 'Halal', '纯素': 'Vegan', '純素': 'Vegan',
  '할랄': 'Halal', '비건': 'Vegan',
};
// "Pork-free" is a halal level the Halal chip leaves out (it is not halal),
// so it is reached by typing it — in any of these wordings.
const PORK_FREE_WORDS = new Set(['porkfree', 'nopork', 'tanpababi', '豚肉不使用', '不含猪肉', '无猪肉']);
const dietWordMatch = (r, w) => {
  if (DIET_WORDS[w] !== undefined) return matchesDietary(r, DIET_WORDS[w]);
  if (PORK_FREE_WORDS.has(w)) {
    const h = r.dietary?.halal;
    return Boolean(h) && h.confidence !== 'unknown' && h.value === 'porkFree';
  }
  return false;
};

// A search word has to start a word in the text, not sit inside one:
// "Seomyeon" matched Wanju's "Iseo-myeon" and nothing in Seomyeon itself
// (walkthrough 2, 2026-10-01). Hyphens and spaces stay optional, so
// "mapo gu" still finds "Mapo-gu". Hangul has no such word edge to lean
// on, so a Korean query matches anywhere.
const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function startsWord(text, q) {
  if (typeof text !== 'string' || q === '') return false;
  if (!/^[a-z0-9]/.test(q)) return squash(text).includes(q);
  const re = new RegExp('(?:^|[^a-z0-9])' + [...q].map(escapeRe).join('[\\s-]*'));
  return re.test(text.toLowerCase());
}

// Areas visitors name that addresses don't: Seomyeon is Bujeon-dong (and
// the Jeonpo café street beside it), Hongdae is the streets around Hongik
// University. Matched against the area and address only.
const AREA_ALIASES = {
  seomyeon: ['bujeon-dong', 'jeonpo-dong'],
  hongdae: ['seogyo-dong', 'donggyo-dong', 'sangsu-dong'],
};
const areaText = (r) => `${r.zone} ${r.address?.value ?? ''}`.toLowerCase();
const aliasMatch = (r, w) => (AREA_ALIASES[w] ?? []).some(a => areaText(r).includes(a));

export function matchesSearch(r, query) {
  const q = squash(query ?? '');
  if (q === '') return true;
  if (dietWordMatch(r, q) || aliasMatch(r, q)) return true;
  // The halal level is searchable too, so "pork-free" finds every pork-free
  // place (the Halal filter leaves them out: pork-free is not halal).
  const halal = r.dietary?.halal;
  const fields = [r.name, r.vibe, r.zone, r.address?.value,
    halal && halal.confidence !== 'unknown' ? halal.value : null];
  if (fields.some(f => startsWord(f, q))) return true;
  // Several words ("Busan korean", "itaewon vegan bakery"): every word must
  // appear somewhere in the place's name, area, address or story.
  const words = String(query).trim().split(/\s+/).map(squash).filter(w => w.length >= 2);
  if (words.length < 2) return false;
  const haystack = [...fields, r.story].filter(f => typeof f === 'string').join(' ');
  return words.every(w => startsWord(haystack, w) || dietWordMatch(r, w) || aliasMatch(r, w));
}

// Does a search word name this place's area (neighbourhood or address)?
// While searching, these places come first in the list and are where the
// map goes, so "Busan" shows Busan rather than Seoul's "Busan Jib".
export function matchesArea(r, query) {
  // The whole query first ("mapo gu" is Mapo-gu), then its longer words:
  // a two-letter "gu" or "ro" starts a word in nearly every address.
  const whole = squash(query ?? '');
  if (whole.length >= 2 && (startsWord(areaText(r), whole) || aliasMatch(r, whole))) return true;
  const words = String(query ?? '').trim().split(/\s+/).map(squash).filter(w => w.length >= 3);
  return words.some(w => startsWord(areaText(r), w) || aliasMatch(r, w));
}
