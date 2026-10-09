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
import { koAddressHas as koAddressWord } from './data/address-ko.js';
import { romaniseQuery, COOKING, AREA_NAMES } from './data/area-names.js';

export const DIETARY_CHIPS = ['Vegan', 'Halal'];

// "Open now" is a chip like the others (AND-ed, cleared with them) but it is
// answered by the clock, not by a trait, so it stays out of CHIP_GROUPS and
// its data test. A place whose hours are not recorded never matches: the
// filter promises "open", and unknown is not open.
export const OPEN_NOW = 'Open now';
// The same question typed into the search box ("halal open now", "지금 영업",
// "営業中"): no place's notes hold those words, so it found nothing. The list
// offers the chip instead (BottomSheetList), and the words are taken out.
// (With what trails the words in each language — "営業中のお店", "现在营业的店",
// "지금 영업하는 곳" — so that taking them out leaves no stray particle; not
// "영업중단", closed for good.)
const OPEN_NOW_TYPED = /\bopen\s+(?:right\s+)?now\b|(?:지금\s*)?영업\s*(?:중(?!단)(?:인)?|하는)(?:\s*(?:곳|가게|식당|맛집))?|지금\s*영업|(?:いま|今)?営業中(?:の(?:お店|店|レストラン))?|(?:(?:现在|現在)(?:营业|營業)中?|(?:营业|營業)中)(?:的(?:店|餐厅|餐廳|地方))?|(?:yang\s+)?buka\s+sekarang/gi;
export const asksOpenNow = (query) => { OPEN_NOW_TYPED.lastIndex = 0; return OPEN_NOW_TYPED.test(String(query ?? '')); };
export const withoutOpenNow = (query) => String(query ?? '').replace(OPEN_NOW_TYPED, ' ').replace(/\s+/g, ' ').trim();
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
// fold: what makes two spellings of one word equal — case, full-width
// letters from a Japanese keyboard (ｉｔａｅｗｏｎ), accents (café, İtaewon).
// Hangul is taken apart and put back together by the two normalisations
// and comes out as it went in.
// Remembered: every keystroke asks for the same few thousand fields again.
const FOLDED = new Map();
const fold = (s) => {
  let out = FOLDED.get(s);
  if (out !== undefined) return out;
  out = (/[\u0080-\uffff]/.test(s)
    ? s.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
    : s).toLowerCase();
  if (FOLDED.size > 20000) FOLDED.clear();
  FOLDED.set(s, out);
  return out;
};
const squash = (s) => fold(s).replace(/[\s-]+/g, '');
// Punctuation typed with a search ("Itaewon, Seoul", "Hongik Univ.") is
// not part of any word.
const unpunct = (s) => String(s ?? '').replace(/[,.;:!?，。、！？]+/g, ' ');

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
  // …and in languages the app does not speak but its visitors do.
  helal: 'Halal', 'حلال': 'Halal', 'ฮาลาล': 'Halal',
  // (A reader of one of these has the page put into their language by the
  // browser, and types the word as they know it: Russian, Kazakh, Uzbek,
  // Hindi, Bengali; Thai, Spanish, Portuguese, Italian, German, French,
  // Arabic and Vietnamese for vegan.)
  'халяль': 'Halal', 'халал': 'Halal', 'ҳалол': 'Halal', halol: 'Halal', 'हलाल': 'Halal', 'হালাল': 'Halal',
  'веган': 'Vegan', 'วีแกน': 'Vegan', 'มังสวิรัติ': 'Vegan', vegano: 'Vegan', vegana: 'Vegan', vegane: 'Vegan', veganisch: 'Vegan',
  vegetalien: 'Vegan', 'نباتي': 'Vegan', thuanchay: 'Vegan',
  // "Muslim-friendly" is what Korean tourism lists call these places.
  // The labels on the cards and chips, as written there: typed back, they
  // found nothing ("完全ヴィーガン", "vegan sepenuhnya", "全素": 0 places).
  fullyvegan: FULLY_VEGAN, '완전비건': FULLY_VEGAN, '完全ヴィーガン': FULLY_VEGAN, '完全ビーガン': FULLY_VEGAN,
  '全纯素': FULLY_VEGAN, '全純素': FULLY_VEGAN, '全素': FULLY_VEGAN, vegansepenuhnya: FULLY_VEGAN, sepenuhnyavegan: FULLY_VEGAN,
  veganoptions: 'Vegan', 'ヴィーガン対応あり': 'Vegan', '有纯素选项': 'Vegan', '有純素選項': 'Vegan',
  halalfriendly: 'Halal', ramahhalal: 'Halal', 'ハラールフレンドリー': 'Halal', '할랄프렌들리': 'Halal', '清真友好': 'Halal', '清真友善': 'Halal',
  muslim: 'Halal', muslimfriendly: 'Halal', '무슬림': 'Halal', '무슬림프렌들리': 'Halal', '무슬림친화': 'Halal', 'ムスリム': 'Halal', 'ムスリムフレンドリー': 'Halal', 'ムスリム対応': 'Halal', '穆斯林': 'Halal', '穆斯林友好': 'Halal',
};
// "Pork-free" is a halal level the Halal chip leaves out (it is not halal),
// so it is reached by typing it — in any of these wordings.
// The whole search asks for pork-free places (search.js: the Halal chip then
// steps aside, since pork-free is by definition not in it).
// …or one of its words does ("Seoul pork-free", "pork free places").
export const isPorkFreeQuery = (query) => {
  const words = unpunct(query).trim().split(/\s+/).filter(Boolean);
  if (PORK_FREE_WORDS.has(squash(words.join(' ')))) return true;
  return words.some((w, i) => PORK_FREE_WORDS.has(squash(w))
    || (i + 1 < words.length && PORK_FREE_WORDS.has(squash(`${w} ${words[i + 1]}`))));
};
const PORK_FREE_WORDS = new Set(['porkfree', 'nopork', 'withoutpork', 'tanpababi', '豚肉不使用', '豚肉なし', 'ポークフリー', '不含猪肉', '无猪肉', '不含豬肉', '돼지고기없음', '돼지고기없는', '돼지고기없는곳', '포크프리']);
const dietWordMatch = (r, w) => {
  // Object.hasOwn: typing "constructor" must not find Object.prototype's.
  if (Object.hasOwn(DIET_WORDS, w)) return DIET_WORDS[w] === FULLY_VEGAN ? matchesFullyVegan(r) : matchesDietary(r, DIET_WORDS[w]);
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
const WORD_START = new Map();
function startsWord(text, q) {
  if (typeof text !== 'string' || q === '') return false;
  if (!/^[a-z0-9]/.test(q)) return squash(text).includes(q);
  // One pattern per search word, kept: built afresh for every field of
  // every place, a search took 60 ms at first and 1.5 s after a hundred
  // different searches in one visit (the engine's own store of compiled
  // patterns stops keeping up).
  let re = WORD_START.get(q);
  if (!re) {
    re = new RegExp('(?:^|[^a-z0-9])' + [...q].map(escapeRe).join('[\\s-]*'));
    if (WORD_START.size > 500) WORD_START.clear();
    WORD_START.set(q, re);
  }
  return re.test(fold(text));
}

// Areas visitors name that addresses don't: Seomyeon is Bujeon-dong (and
// the Jeonpo café street beside it), Hongdae is the streets around Hongik
// University. Matched against the area and address only.
const AREA_ALIASES = {
  seomyeon: ['bujeon-dong', 'jeonpo-dong'],
  hongdae: ['seogyo-dong', 'donggyo-dong', 'sangsu-dong'],
  // A sight searched by name, in the area it stands in.
  lotteworld: ['jamsil'],
};
// Where a place is, for matching an area word: its area line and address.
// A township that shares its name with a district or city on the map is
// not that place: Yongsan-myeon in Yeongdong county came up for "Yongsan"
// (Seoul), Daejeon-myeon in Damyang for "Daejeon". The township and the
// road named after it are left out of the text; the county and province
// around them still find the place.
const TOWNSHIP = /\b([a-z]+)-(?:myeon|eup|ri)\b/g;
const AREA_TEXT = new WeakMap();
const areaText = (r) => {
  let text = AREA_TEXT.get(r);
  if (text === undefined) {
    text = `${r.zone} ${r.address?.value ?? ''}`.toLowerCase();
    const namesakes = [...text.matchAll(TOWNSHIP)].map(m => m[1]).filter(stem => AREA_KEYS.has(stem));
    for (const stem of new Set(namesakes)) text = text.replace(new RegExp(`\\b${stem}-(?:myeon|eup|ri|ro|gil|daero)\\b`, 'g'), ' ');
    AREA_TEXT.set(r, text);
  }
  return text;
};
// An area's own name is matched as a whole word: by its opening letters
// "Daejeon" was also Daejeong-eup on Jeju, and "Gyeonggi" a shop on
// Gyeonggijeon-gil in Jeonju. Any other word (one still being typed) is
// matched from its start. ("Sinchonyeok-ro" is the road of Sinchon
// station: "yeok" after the name is still the area.)
const WHOLE_WORD = new Map();
function inArea(r, w) {
  const text = areaText(r);
  if (!AREA_WORDS.has(w)) return startsWord(text, w);
  let re = WHOLE_WORD.get(w);
  if (!re) {
    re = new RegExp('(?:^|[^a-z0-9])' + [...w].map(escapeRe).join('[\\s-]*') + '(?:yeok)?(?![a-z])');
    WHOLE_WORD.set(w, re);
  }
  return re.test(text);
}
// By prefix, so "Lotte World Tower" and "lotte world seoul" are Lotte World.
const aliasMatch = (r, w) => Object.keys(AREA_ALIASES).some(k => w.startsWith(k) && AREA_ALIASES[k].some(a => areaText(r).includes(a)));

function dietPairs(parts) {
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    const pair = i + 1 < parts.length ? squash(`${parts[i]} ${parts[i + 1]}`) : '';
    // …and so do two words that are one area ("lotte world").
    if (pair && (PORK_FREE_WORDS.has(pair) || Object.hasOwn(DIET_WORDS, pair) || Object.hasOwn(AREA_ALIASES, pair))) { out.push(pair); i += 1; } else out.push(squash(parts[i]));
  }
  return out;
}

// A word that asks about certification is a question, not a search term:
// "KMF", "인증", "할랄 인증" and "ハラール認証" found nothing, where the
// halal places and the note that none has a certificate we have seen are
// the answer (BottomSheetList shows the note for these words). Taken out
// of the search once, before anything reads it (search.js): left in for
// the station and filler readings, "kmf seoul station" was all of Seoul.
const CERT_WORD = /^(ハラール|ハラル|清真|할랄|halal)?(?:kmf|certified|certificates?|certification|bersertifikat|sertifikat|sertifikasi|認証|认证|認證|인증)(?:書|서|证书|證書)?(?:店|餐厅|餐廳|식당|レストラン)?$/i;
export function stripCertWords(query) {
  const asked = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  const rest = asked.flatMap((w) => {
    const halves = w.split('-').filter(Boolean);
    if (!halves.some(h => CERT_WORD.test(unpunct(h).trim()))) return [w];
    return halves.flatMap((h) => { const m = CERT_WORD.exec(unpunct(h).trim()); return m ? (m[1] ? [m[1]] : []) : [h]; });
  });
  if (rest.length === asked.length && rest.every((w, k) => w === asked[k])) return String(query ?? '');
  // Certification is asked of halal places: "Itaewon 인증" and "kmf near
  // me" are the halal places there, unless another diet was named.
  const named = dietPairs(rest).some(w => Object.hasOwn(DIET_WORDS, w) || PORK_FREE_WORDS.has(w));
  return named ? rest.join(' ') : ['halal', ...rest].join(' ');
}
// The diet words of a search, as the chips they stand for, and the rest
// of it: "halal seoul station" is the Halal chip and "seoul station"
// (search.js reads a station only from the rest).
export function liftDietWords(query) {
  const parts = unpunct(query).trim().split(/\s+/).filter(Boolean);
  const chips = [];
  const rest = [];
  for (let i = 0; i < parts.length; i += 1) {
    const pair = i + 1 < parts.length ? squash(`${parts[i]} ${parts[i + 1]}`) : '';
    if (pair && Object.hasOwn(DIET_WORDS, pair)) { chips.push(DIET_WORDS[pair]); i += 1; } else if (Object.hasOwn(DIET_WORDS, squash(parts[i]))) chips.push(DIET_WORDS[squash(parts[i])]);
    else rest.push(parts[i]);
  }
  return { chips: [...new Set(chips)], rest: rest.join(' ') };
}
function searchCore(r, rawQuery) {
  const query = unpunct(rawQuery);
  const q = squash(query);
  // Nothing to search by (empty, or only signs such as "(" or "-"): every
  // place, as with an empty box.
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(q)) return true;
  // The whole search is a diet word ("halal", "no pork", "pork free"):
  // answered from the record's diet and nothing else — word by word,
  // "no pork" was every record with a "no" and a "pork" in it.
  if (Object.hasOwn(DIET_WORDS, q) || PORK_FREE_WORDS.has(q)) return dietWordMatch(r, q);
  // An alias answers the whole search when it is the whole search, or a
  // name of several words that opens it ("Lotte World Tower"). Not when
  // it is one word among others — "hongdae halal" and "hongdae bakery"
  // were every place around Hongdae, bakery or not — and not when a diet
  // word follows it ("lotte world halal", "hongdae-halal").
  const parts = dietPairs(query.trim().split(/[\s-]+/).filter(Boolean));
  const alias = Object.keys(AREA_ALIASES).find(k => q.startsWith(k));
  const asksDiet = parts.some(w => Object.hasOwn(DIET_WORDS, w) || PORK_FREE_WORDS.has(w));
  const firstWord = squash(query.trim().split(/[\s-]+/)[0] ?? '');
  if (alias && !asksDiet && aliasMatch(r, q) && (q === alias || firstWord !== alias)) return true;
  // The whole search is an area's name: answered by where the place is or
  // what it is called — not by a line saying it "moved from Itaewon".
  if (AREA_WORDS.has(q)) return inAreaOrName(r, q);
  // The halal level is searchable too, so "pork-free" finds every pork-free
  // place (the Halal filter leaves them out: pork-free is not halal).
  const halal = r.dietary?.halal;
  const fields = [r.name, r.vibe, r.zone, r.address?.value,
    halal && halal.confidence !== 'unknown' ? halal.value : null];
  if (fields.some(f => startsWord(f, q))) return true;
  // The address in Korean, by its own words ("용산구", "이태원로"): see koAddressHas.
  if (koAddressHas(r, q)) return true;
  // …or as it is written, punctuation and all: "A.A.A" is a bakery's name.
  const asTyped = squash(String(rawQuery ?? ''));
  if (asTyped !== q && fields.some(f => startsWord(f, asTyped))) return true;
  // Several words ("Busan korean", "itaewon vegan bakery"): every word must
  // appear somewhere in the place's name, area, address or story.
  // "no pork", "pork free", "무슬림 프렌들리": two words that are one diet
  // word stay together. Apart, "seoul no pork" was every Seoul record with a
  // "no" and a "pork" in its story — places that serve pork among them.
  // "hongdae-halal": a hyphen beside a diet word is a space
  // ("mapo-gu", "Jeju-si" and "pork-free" stay whole).
  const spaced = String(query).trim().split(/\s+/).flatMap((w) => {
    const halves = w.split('-').filter(Boolean);
    return halves.length > 1 && !PORK_FREE_WORDS.has(squash(w)) && !Object.hasOwn(DIET_WORDS, squash(w))
      && halves.some(h => Object.hasOwn(DIET_WORDS, squash(h))) ? halves : [w];
  });
  const words = dietPairs(spaced).filter(w => w.length >= 2);
  // Words of one letter are dropped, not required: "busan v" (mid-typing)
  // and "제주도" (split into Jeju + 도) are then judged on what is left.
  if (words.length === 0) return false;
  const haystack = [...fields, r.story].filter(f => typeof f === 'string').join(' ');
  if (words.length === 1) {
    // A single remaining word that the whole-query check above did not
    // match can only match here if the query had dropped words.
    const dropped = String(query).trim().split(/\s+/).length > 1;
    // …read as it would be alone: "busan v" is "busan", an area, not
    // every place with a Busan in its description.
    if (!dropped) return false;
    if (AREA_WORDS.has(words[0])) return inAreaOrName(r, words[0]);
    return fields.some(f => startsWord(f, words[0])) || dietWordMatch(r, words[0]) || aliasMatch(r, words[0]);
  }
  // A pork-free word is answered from the record alone, never from the text:
  // a story that says "uses no pork" about a halal kitchen, or "no pork
  // belly" about one that serves it, is not the pork-free level.
  // A word that names an area is answered by where the place is (or what
  // it is called), not by its story: "itaewon vegan" listed a shop that
  // "moved from Itaewon" to Hoehyeon and one that "began in Itaewon".
  // So is a diet word: "hongdae halal" listed six vegan bakeries with no
  // halal reading at all, for a "halal" in their stories ("not halal",
  // "no halal claim"). A name with the word in it still counts.
  return words.every(w => (PORK_FREE_WORDS.has(w) ? dietWordMatch(r, w)
    : Object.hasOwn(DIET_WORDS, w) ? dietWordMatch(r, w) || startsWord(r.name, w)
    : AREA_WORDS.has(squash(w)) ? inAreaOrName(r, w)
      : startsWord(haystack, w) || dietWordMatch(r, w) || aliasMatch(r, w) || koAddressHas(r, w)));
}
const AREA_WORDS = new Set(Object.keys(AREA_NAMES).map(name => squash(name)));
const AREA_KEYS = new Set(Object.keys(AREA_NAMES).map(name => name.toLowerCase()));
// …and in Korean (the first written form of each): see koAddressHas.
const AREA_KO = new Set(Object.values(AREA_NAMES).map(forms => forms[0]));
function koAddressHas(r, w) { return koAddressWord(r, w, AREA_KO.has(w)); }
const inAreaOrName = (r, w) => inArea(r, w) || aliasMatch(r, w) || koAddressHas(r, w) || startsWord(r.name, w);

// Does a search word name this place's area (neighbourhood or address)?
// While searching, these places come first in the list and are where the
// map goes, so "Busan" shows Busan rather than Seoul's "Busan Jib".
function areaCore(r, rawQuery) {
  const query = unpunct(rawQuery);
  // The whole query first ("mapo gu" is Mapo-gu), then its longer words:
  // a two-letter "gu" or "ro" starts a word in nearly every address.
  const whole = squash(query ?? '');
  if (whole.length >= 2 && (inArea(r, whole) || aliasMatch(r, whole) || koAddressHas(r, whole))) return true;
  const words = String(query ?? '').trim().split(/\s+/).map(squash);
  return words.some(w => (w.length >= 3 && (inArea(r, w) || aliasMatch(r, w))) || koAddressHas(r, w));
}

// A query is tried as typed and, when it contains a place name written in
// Korean, Japanese or Chinese, again with that name romanised (area-names.js)
// — "釜山 ヴィーガン" finds what "Busan vegan" finds.
// Asked once per place for the same search: read once, kept.
const ROMAN = new Map();
const romanOf = (query) => {
  if (!ROMAN.has(query)) { if (ROMAN.size > 200) ROMAN.clear(); ROMAN.set(query, romaniseQuery(query)); }
  return ROMAN.get(query);
};
export function matchesSearch(r, query) {
  if (searchCore(r, query)) return true;
  const roman = romanOf(query);
  if (roman === null) return false;
  if (searchCore(r, roman)) return true;
  // Once more: "gimbap" is also written "kimbap" in the records, and that
  // second spelling was tried for "gimbap" as typed but not for "gimbap"
  // as read from another script.
  const again = romanOf(roman);
  return again !== null && again !== query && searchCore(r, again);
}

// The whole query names this place's area — not merely one of its words
// ("Lotte World" is no one's area just because an address has "World Cup
// buk-ro" in it). Used to decide where "nearest" is measured from.
const areaWhole = (r, query) => {
  const whole = squash(unpunct(query));
  return whole.length >= 2 && (inArea(r, whole) || aliasMatch(r, whole) || koAddressHas(r, whole));
};
// A kind of cooking is not a place: "temple" starts a word in one address
// ("Templestay Information Center"), and the map went there for 사찰음식.
const isCooking = (q) => COOKING.has(squash(unpunct(q)));
export function matchesAreaWhole(r, query) {
  if (isCooking(query)) return false;
  if (areaWhole(r, query)) return true;
  const roman = romanOf(query);
  return roman !== null && !isCooking(roman) && areaWhole(r, roman);
}

export function matchesArea(r, query) {
  if (isCooking(query)) return false;
  if (areaCore(r, query)) return true;
  const roman = romanOf(query);
  return roman !== null && !isCooking(roman) && areaCore(r, roman);
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
const TIDIED = new Map();
const tidy = (t) => {
  let out = TIDIED.get(t);
  if (out !== undefined) return out;
  out = fold(unpunct(t)).replace(/\s+/g, ' ').trim();
  if (TIDIED.size > 20000) TIDIED.clear();
  TIDIED.set(t, out);
  return out;
};

export function matchesPhrase(r, query) {
  const phrase = tidy(query);
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
  // …including one written as two words ("no pork", "pork free").
  if (phrase.split(' ').some(w => Object.hasOwn(DIET_WORDS, squash(w)) || PORK_FREE_WORDS.has(squash(w)))
    || Object.hasOwn(DIET_WORDS, squash(phrase)) || PORK_FREE_WORDS.has(squash(phrase))) return false;
  // The name also without its bracketed Korean: "Kervan (케르반) Famille
  // Station" is "Kervan Famille Station" to whoever types it.
  return [r.name, String(r.name ?? '').replace(/\s*\([^)]*\)/g, ''), r.zone, r.address?.value, r.vibe]
    .some(f => typeof f === 'string' && at(tidy(f)));
}
