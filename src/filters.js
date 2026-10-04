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
import { romaniseQuery } from './data/area-names.js';

export const DIETARY_CHIPS = ['Vegan', 'Halal'];

// "Open now" is a chip like the others (AND-ed, cleared with them) but it is
// answered by the clock, not by a trait, so it stays out of CHIP_GROUPS and
// its data test. A place whose hours are not recorded never matches: the
// filter promises "open", and unknown is not open.
export const OPEN_NOW = 'Open now';
// Open at a chosen weekday and time (planning ahead); never on with OPEN_NOW.
export const OPEN_AT = 'Open at';

// "Saved": only the places this visitor has saved, so a trip's shortlist
// can be seen on the map (the Journal lists them; it could not show where
// they are). Answered from the passport on this device, not from place data.
export const SAVED_ONLY = 'Saved';

// A list someone shared: /?list=id,id,id opens the map on just those
// places. The ids are public place ids chosen by the sender; nothing about
// the sender travels with them.
export const SHARED_LIST = 'Shared list';
export const MAX_SHARED = 60;

/** The ids in a ?list= value that name a place we have, in order, no repeats. */
export function parseSharedList(value, knownIds) {
  if (typeof value !== 'string' || value === '') return [];
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds);
  const out = [];
  for (const id of value.split(',')) {
    const clean = id.trim();
    if (/^[a-z0-9-]{1,80}$/.test(clean) && known.has(clean) && !out.includes(clean)) out.push(clean);
    if (out.length >= MAX_SHARED) break;
  }
  return out;
}

/** The link for a list of place ids. */
export const sharedListUrl = (origin, ids) => `${origin}/?list=${ids.slice(0, MAX_SHARED).join(',')}`;

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
const PORK_FREE_WORDS = new Set(['porkfree', 'nopork', 'tanpababi', '豚肉不使用', '不含猪肉', '无猪肉', '不含豬肉', '돼지고기없음', '포크프리']);
const dietWordMatch = (r, w) => {
  // Object.hasOwn: typing "constructor" must not find Object.prototype's.
  if (Object.hasOwn(DIET_WORDS, w)) return matchesDietary(r, DIET_WORDS[w]);
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
const aliasMatch = (r, w) => Object.hasOwn(AREA_ALIASES, w) && AREA_ALIASES[w].some(a => areaText(r).includes(a));

function searchCore(r, query) {
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
  // Words of one letter are dropped, not required: "busan v" (mid-typing)
  // and "제주도" (split into Jeju + 도) are then judged on what is left.
  if (words.length === 0) return false;
  const haystack = [...fields, r.story].filter(f => typeof f === 'string').join(' ');
  if (words.length === 1) {
    // A single remaining word that the whole-query check above did not
    // match can only match here if the query had dropped words.
    const dropped = String(query).trim().split(/\s+/).length > 1;
    return dropped && (fields.some(f => startsWord(f, words[0])) || dietWordMatch(r, words[0]) || aliasMatch(r, words[0]));
  }
  return words.every(w => startsWord(haystack, w) || dietWordMatch(r, w) || aliasMatch(r, w));
}

// Does a search word name this place's area (neighbourhood or address)?
// While searching, these places come first in the list and are where the
// map goes, so "Busan" shows Busan rather than Seoul's "Busan Jib".
function areaCore(r, query) {
  // The whole query first ("mapo gu" is Mapo-gu), then its longer words:
  // a two-letter "gu" or "ro" starts a word in nearly every address.
  const whole = squash(query ?? '');
  if (whole.length >= 2 && (startsWord(areaText(r), whole) || aliasMatch(r, whole))) return true;
  const words = String(query ?? '').trim().split(/\s+/).map(squash).filter(w => w.length >= 3);
  return words.some(w => startsWord(areaText(r), w) || aliasMatch(r, w));
}

// A query is tried as typed and, when it contains a place name written in
// Korean, Japanese or Chinese, again with that name romanised (area-names.js)
// — "釜山 ヴィーガン" finds what "Busan vegan" finds.
export function matchesSearch(r, query) {
  if (searchCore(r, query)) return true;
  const roman = romaniseQuery(query);
  return roman !== null && searchCore(r, roman);
}

// The whole query names this place's area — not merely one of its words
// ("Lotte World" is no one's area just because an address has "World Cup
// buk-ro" in it). Used to decide where "nearest" is measured from.
const areaWhole = (r, query) => {
  const whole = squash(query ?? '');
  return whole.length >= 2 && (startsWord(areaText(r), whole) || aliasMatch(r, whole));
};
export function matchesAreaWhole(r, query) {
  if (areaWhole(r, query)) return true;
  const roman = romaniseQuery(query);
  return roman !== null && areaWhole(r, roman);
}

export function matchesArea(r, query) {
  if (areaCore(r, query)) return true;
  const roman = romaniseQuery(query);
  return roman !== null && areaCore(r, roman);
}

// The view — search text, chips, the "Open at…" time — kept in the address
// after the "#". A phone drops a background tab while the visitor is in
// Naver Map; coming back reloaded the app with every filter gone. In the
// fragment, not the query: a fragment is never sent to the server, so what
// someone searches for and which diet they filter by still leave the device
// only if they share the link themselves.
export function viewHash({ q = '', filters = [], planAt = null, area = false }) {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  // `a=1`: the text names an area and nothing else (an area guide, Discover's
  // "Browse by area"): places in that area only, not every place whose name
  // or story mentions it — "Busan" then leaves out Seoul's "Busan Jib".
  if (area && q.trim()) p.set('a', '1');
  // Not the shared list (it is in ?list=) and not "Saved": that is the
  // reader's own places, and the address may be copied to someone else.
  const f = filters.filter(id => id !== SHARED_LIST && id !== SAVED_ONLY);
  if (f.length > 0) p.set('f', f.join(','));
  if (f.includes(OPEN_AT) && planAt) p.set('at', `${planAt.day}-${planAt.minutes}`);
  const out = p.toString();
  return out ? `#${out}` : '';
}

/** The view a fragment names. Unknown chips are dropped, never trusted. */
export function parseViewHash(hash, validIds) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const q = (p.get('q') ?? '').slice(0, 80);
  let filters = [...new Set((p.get('f') ?? '').split(',').filter(id => validIds.includes(id)))];
  if (filters.includes(OPEN_NOW)) filters = filters.filter(id => id !== OPEN_AT);
  const m = /^([0-6])-(\d{1,4})$/.exec(p.get('at') ?? '');
  const minutes = m ? Number(m[2]) : NaN;
  const planAt = m && minutes < 1440 && minutes % 30 === 0 ? { day: Number(m[1]), minutes } : null;
  return { q, filters, planAt, area: q.trim() !== '' && p.get('a') === '1' };
}

// A search of several words is read word by word ("itaewon halal": both
// must appear somewhere). But "seoul station" is a place, and word by word
// it was every Seoul record that mentions any station — 255 of them. When
// some records carry the words as written, next to each other, those are
// what was meant (App.jsx narrows to them; with none, the word-by-word
// result stands).
export function matchesPhrase(r, query) {
  const phrase = String(query ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!phrase.includes(' ')) return false;
  // Whole words, in the name, the area, the address or the one-line
  // description. Not the story: "a
  // Busan vegan bakery" in one story made "busan vegan" that one bakery,
  // and without word ends "busan v" narrowed while it was being typed.
  const at = (text) => {
    const i = text.indexOf(phrase);
    if (i < 0) return false;
    const edge = (ch) => ch === undefined || !/[a-z0-9가-힣]/.test(ch);
    return edge(text[i - 1]) && edge(text[i + phrase.length]);
  };
  // A diet word is answered from the record's diet, not from the letters:
  // "vegan cafe" is every vegan place that is a café, not the four with
  // "Vegan Cafe" in their name.
  if (phrase.split(' ').some(w => Object.hasOwn(DIET_WORDS, squash(w)) || PORK_FREE_WORDS.has(squash(w)))) return false;
  return [r.name, r.zone, r.address?.value, r.vibe]
    .some(f => typeof f === 'string' && at(f.toLowerCase()));
}
