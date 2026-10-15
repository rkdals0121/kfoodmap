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
import { romaniseKorean } from './data/romanise-ko.js';
import { romaniseQuery, onlyFillers, COOKING, AREA_NAMES } from './data/area-names.js';

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
const OPEN_NOW_TYPED = /\b(?:(?:buka|makan)\s+)?malam\s+ini\b|\b(?:open\s+)?24\/7(?=\s|$|[?!.,])|\ball[- ]night\b|\b(?:still|currently)\s+open\b|\bopen\s+rn\b|(?:^|\s)24\s*시(?:\s*영업)?(?=\s|$|[?!.,])|새벽(?!\s*\d)(?:까지)?(?:\s*(?:여는|하는|영업하는|영업))?(?:\s*(?:곳|가게|식당|맛집))?(?![가-힣])|지금\s*열려\s*있는(?:\s*(?:곳|가게|식당|맛집))?|(?:いま|今)やってる(?:お店|店)?|まだ(?:開|あ)いて(?:い)?る(?:お店|店)?|夜遅くまで(?:営業(?:している)?|(?:開|あ)いて(?:い)?る|やってる)?(?:お店|店)?|(?:现在|現在)?(?:还|還)(?:开着|開著|在营业|在營業)(?:的(?:店|餐厅|餐廳)?)?|(?:现在|現在)(?:开门|開門|开着|開著)(?:的(?:店|餐厅|餐廳)?)?|通宵(?:营业|營業)?|\b(?:yang\s+)?masih\s+buka\b|\bopen\s+(?:right\s+)?now\b|\b(?:open\s+)?late(?:[- ]night)?\b|\btonight\b|\b(?:(?:buka|open)\s+)?24[- ]?(?:hours?|hrs?|h|jam)\b|24\s*시간(?:\s*(?:영업\s*(?:중(?:인)?|하는)?|하는|여는))?(?:\s*(?:곳|가게|식당|맛집))?|심야|야식|늦게까지(?:\s*(?:여는|하는|영업하는))?(?:\s*(?:곳|식당|가게))?|深夜(?:営業)?|24\s*時間(?:営業)?|24\s*小[时時](?:营业|營業)?|(?:buka\s+)?(?:sampai\s+)?(?:larut|tengah)\s+malam|\bbuka\s+(?:sampai\s+)?malam\b|\bopen\s+(?:at|till|until)\s+(?:night|late)\b|밤늦게(?:까지)?(?:\s*(?:여는|하는|영업하는))?(?:\s*(?:곳|식당|가게))?|(?:지금\s*)?영업\s*(?:중(?!단)(?:인)?|하는)(?:\s*(?:곳|가게|식당|맛집))?|지금\s*영업|지금\s*(?:여는|문\s*연|열린|하는)(?:\s*(?:곳|가게|식당|맛집)|(?![가-힣]))|(?:いま|今|現在)?営業中(?:の(?:お店|店|レストラン))?|(?:いま|今)(?:、)?(?:開|あ)いて(?:い)?る(?:お店|店|ところ)?|(?:(?:现在|現在)(?:营业|營業)中?|(?:营业|營業)中)(?:的(?:店|餐厅|餐廳|地方)?)?|(?:yang\s+)?buka\s+sekarang/gi;
export const asksOpenNow = (query) => { OPEN_NOW_TYPED.lastIndex = 0; return OPEN_NOW_TYPED.test(String(query ?? '')); };
// Of those words, the ones that ask for late or round-the-clock hours, not for
// this minute: "24時間", "夜遅くまで", "late night", "새벽까지". The list still
// offers "Open now" for them, but the keyboard's Search key does not press
// it — at seven in the evening it answered "open late" with everything open.
const LATE_TYPED = /\blate\b|\b(?:to)?night\b|\bmalam\b|오늘\s*밤|밤에|今夜|今晚|\ball[- ]night\b|심야|야식|늦게|새벽|深夜|夜遅く|通宵|\b(?:larut|tengah)\s+malam\b|\bsampai\s+malam\b/i;
// "24시", "24 hours", "24-hour", "24/7", "24時間", "24小时", "24 jam": round the
// clock. (Not "24시까지" or "10시-24시", which end at midnight; not "124시".)
const ALL_DAY_TYPED = /(?:^|[^\d~–-])24[- ]?(?:시(?!까지)간?|時間|小[时時]|jam\b|hours?\b|hrs?\b|h\b|\/\s*7)/i;
export const asks24Hours = (query) => ALL_DAY_TYPED.test(String(query ?? ''));
export const asksLateHours = (query) => asks24Hours(query) || LATE_TYPED.test(String(query ?? ''));
export const withoutOpenNow = (query) => String(query ?? '').replace(OPEN_NOW_TYPED, ' ').replace(/\s+/g, ' ').trim();
// A day named in the search — "halal saturday dinner", "tomorrow lunch
// vegan jeju", "토요일 저녁에 여는 곳", "明日のランチ", "周六晚上", "besok malam":
// no place's notes hold those words either. It is the "Open at…" chip's
// question, with its day and time already said. `today` is the weekday in
// Korea (0 = Sunday). Null when no day is named: "lunch" alone is no plan.
// Each is read only as a word of its own: after a space (or the start, or a
// particle) and before one. "오늘통닭", "내일도 칼국수", "明日 朝鮮料理" and
// "今日 夜市" hold the letters and are names of other things.
// Chinese and Japanese run a day and a meal together ("周六晚上",
// "明天中午清真"): a meal word of two letters or more may follow a day
// directly, and needs no gap after it. One letter (朝, 夜, 昼) still does.
const MEAL_JOINED = '晚上|晚餐|中午|午餐|早上|早餐|下午|ランチ|ディナー|朝ごはん|朝食|夕食|夕方|午後|晩ごはん';
const WORD = (alternatives, joined) => new RegExp(`(^|[\\sのにはでも的，、,])(?:(?:${alternatives})(?=$|[\\sのにはでも的에은는，、,?!.]|${MEAL_JOINED}|营业|營業|営業(?=$|[\\sの])|开门|開門)${joined ? `|(?:${joined})` : ''})`, 'i');
// (Whole names and the longer short forms only: "sun", "mon", "sat" and
// "thu" open the names of places — Sun Hansik, Mon Cher, Thu Duc.)
const DAY_SAID = [
  [WORD('(?:on\\s+)?sunday|일요일|日曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))[日天]|(?:hari\\s+)?minggu(?!\\s+(?:depan|ini|lalu))'), 0],
  [WORD('(?:on\\s+)?monday|월요일|月曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))一|(?:hari\\s+)?senin'), 1],
  [WORD('(?:on\\s+)?tue(?:s|sday)|화요일|火曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))二|(?:hari\\s+)?selasa'), 2],
  [WORD('(?:on\\s+)?wed(?:s|nesday)|수요일|水曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))三|(?:hari\\s+)?rabu'), 3],
  [WORD('(?:on\\s+)?thu(?:rs|rsday)|목요일|木曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))四|(?:hari\\s+)?kamis'), 4],
  [WORD('(?:on\\s+)?fri(?:day)?|금요일|金曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))五|(?:hari\\s+)?jum.?at'), 5],
  [WORD('(?:on\\s+)?saturday|토요일|土曜日?|(?:(?:这|這|本|今|下|来|來)?(?:周|週|星期|礼拜|禮拜))六|(?:hari\\s+)?sabtu'), 6],
];
const DAY_FROM_NOW = [
  [WORD('day\\s+after\\s+tomorrow|모레|明後日|[后後]天|lusa'), 2],
  [WORD('tomorrow|내일|明日|明天|besok'), 1],
  [WORD('today|오늘|今日|今天|hari\\s+ini'), 0],
];
const MEAL_SAID = [
  [WORD('breakfast|morning|아침|朝|pagi|sarapan', '朝ごはん|朝食|早上|早餐'), 540],
  [WORD('lunch(?:time)?|noon|점심|お?昼(?:ごはん)?|(?:makan\\s+)?siang', 'ランチ|中午|午餐'), 750],
  [WORD('afternoon|오후|sore', '午後|下午'), 900],
  [WORD('dinner|evening|night|저녁|밤|夜|(?:makan\\s+)?malam', 'ディナー|夕方|夕食|晩ごはん|晚上|晚餐'), 1140],
];
// What is left around them: "open", "여는 곳", "に開いている店", "营业的店".
const PLAN_REST = /\b(?:open|opens|opening)\b|(?:에\s*)?(?:여는|영업하는|문\s*여는)(?:\s*(?:곳|식당|가게))?|영업(?![가-힣]|\s*안)|(?:に|の)?(?:開いている|営業している|営業中|営業(?=$|[\sの]))(?:の?(?:お店|店))?|(?:营业|營業|开门|開門)(?:的(?:店|餐厅|餐廳))?|\b(?:yang\s+)?buka\b/gi;
// "This", "next", "이번 주", "来週の", "and": said with a day, and no search
// word — beside the day only.
const DAY_STOOD = '\uE000';
const WHICH_BEFORE = /(?:this|next|coming|이번\s*주?|다음\s*주|今週|来週|來週|这周|這週|下周|下週)(?:の|에)?\s*\uE000/gi;
const WHICH_AFTER = /\uE000\s*(?:this|next)\s+week\b|\uE000\s*minggu\s+(?:ini|depan)\b/gi;
const BETWEEN_DAYS = /\uE000\s*(?:and|&|or|-|–|,|、|と|和|및|dan)\s*(?=\uE000)/gi;
export function plannedTime(query, today = 0) {
  // "Open now", "late", "tonight" beside a day are the same question, not
  // a search — taken out first ("halal open now today" was left as "halal now").
  let rest = ` ${withoutOpenNow(String(query ?? ''))} `;
  // Indonesian: "akhir minggu" is the weekend, no one day; "malam minggu" is
  // the night before Sunday, as "malam jumat" is Thursday night.
  if (/\bakhir\s+(?:minggu|pekan)\b/i.test(rest)) return null;
  rest = rest.replace(/\bmalam\s+minggu\b/gi, 'sabtu malam').replace(/\bmalam\s+sabtu\b/gi, 'jumat malam').replace(/\bmalam\s+jum'?at\b/gi, 'kamis malam');
  if (/\bminggu\s+(?:depan|ini|lalu)\b/i.test(rest) && !DAY_SAID.slice(1).some(([said]) => said.test(rest)) && !DAY_FROM_NOW.some(([said]) => said.test(rest))) return null;
  // "토요일 새벽" is the small hours of Saturday — Friday's late night, not
  // ten on Saturday evening — and no hour the chip can be set to by a word.
  if (/새벽/.test(rest) || /새벽/.test(String(query ?? ''))) {
    if (DAY_SAID.some(([said]) => said.test(` ${query} `)) || DAY_FROM_NOW.slice(0, 2).some(([said]) => said.test(` ${query} `))) return null;
  }
  let day = null;
  let isToday = false;
  // (Where a day stood is marked, so that "this", "next", "and" go only from
  // beside it: "next door tomorrow lunch" keeps its "next".)
  for (const [said, n] of DAY_FROM_NOW) { if (said.test(rest)) { if (day === null) { day = (today + n) % 7; isToday = n === 0; } rest = rest.replace(said, `$1${DAY_STOOD}`); } }
  // Every day named goes from what is searched ("saturday and sunday"); the
  // first one read is the one offered.
  for (const [said, n] of DAY_SAID) { while (said.test(rest)) { if (day === null) day = n; rest = rest.replace(said, `$1${DAY_STOOD}`); } }
  if (day === null) return null;
  rest = rest.replace(WHICH_BEFORE, DAY_STOOD).replace(WHICH_AFTER, DAY_STOOD).replace(BETWEEN_DAYS, DAY_STOOD).split(DAY_STOOD).join(' ');
  let minutes = 750;
  // A day alone may be a name ("Sunday Bakery", "Today Kitchen"): with a
  // meal or "open" beside it, it is a plan beyond doubt.
  let sure = false;
  for (const [said, at] of MEAL_SAID) { if (said.test(rest)) { minutes = at; rest = rest.replace(said, '$1 '); sure = true; break; } }
  PLAN_REST.lastIndex = 0;
  if (PLAN_REST.test(rest)) sure = true;
  // "Friday late night", "tomorrow late night halal", "besok larut malam":
  // another day's night is a plan (today's is the "Open now" question).
  // (At ten, not seven: of the places open on a Friday at 7 pm, one in ten is
  // still open at half past ten.)
  if (!isToday && asksOpenNow(query)) { if (!sure) minutes = 1320; sure = true; }
  rest = rest.replace(PLAN_REST, ' ').replace(/\s+(?:の|に|で|에|은|는|的)(?=\s)/g, ' ').replace(/(^|\s)[-–.,·?!？！]+(?=\s|$)/g, ' ').replace(/[?!？！.]+\s*$/, '').replace(/\s+/g, ' ').trim();
  // "Open now today", "오늘 심야": today, and now — the "Open now" question
  // with a word to spare, not a plan for another hour.
  // What is left may be no search at all: "오늘 심야 식당", "saturday dinner
  // restaurants" (식당 alone would be the seven places with 식당 in their name).
  if (onlyFillers(rest)) rest = '';
  if (isToday && asksOpenNow(query)) return { day, minutes, rest, sure: false, now: true };
  return { day, minutes, rest, sure };
}
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
  // …and as they are mistyped.
  '하랄': 'Halal', '할날': 'Halal', '할럴': 'Halal', '핼랄': 'Halal', '베지테리안': 'Vegan', '베지테리언': 'Vegan', '베지터리언': 'Vegan', '베지터리안': 'Vegan',
  hallal: 'Halal', halaal: 'Halal', halall: 'Halal', halel: 'Halal', hala1: 'Halal',
  vegitarian: 'Vegan', vegeterian: 'Vegan', vegatarian: 'Vegan', vegetarain: 'Vegan', vegiterian: 'Vegan', veggan: 'Vegan', veagan: 'Vegan', vegen: 'Vegan',
  // "Vegetarian", in each language: what a vegetarian can eat is asked of the
  // same record (a vegan dish is one), and the word alone found 32 places by
  // their descriptions — every one of them among the Vegan chip's 521, with
  // "경주 채식" finding none of Gyeongju's four.
  vegetarian: 'Vegan', vegetarisch: 'Vegan', vegetariano: 'Vegan', vegetariana: 'Vegan', vegetarien: 'Vegan',
  '채식': 'Vegan', '채식주의': 'Vegan', '채식주의자': 'Vegan', '素食': 'Vegan', '素菜': 'Vegan', '維根': 'Vegan', '维根': 'Vegan', '素食主义': 'Vegan', '素食主義': 'Vegan', '素食者': 'Vegan', '蛋奶素': 'Vegan', '奶蛋素': 'Vegan', lactoovo: 'Vegan', '净素': 'Vegan', '淨素': 'Vegan', '蔬食': 'Vegan', '吃素': 'Vegan', 'ベジタリアン': 'Vegan', '菜食': 'Vegan',
  // "Plant-based", "meatless", "no meat": the same question again ("plant
  // based" found 64 places by their descriptions, "meatless" none).
  plantbased: 'Vegan', meatless: 'Vegan', meatfree: 'Vegan', nomeat: 'Vegan', withoutmeat: 'Vegan', tanpadaging: 'Vegan', vegetaris: 'Vegan', nabati: 'Vegan',
  '식물성': 'Vegan', '고기없는': 'Vegan', 'プラントベース': 'Vegan', '植物性': 'Vegan', '植物基': 'Vegan', '肉なし': 'Vegan', '无肉': 'Vegan', '無肉': 'Vegan',
  'ハラール': 'Halal', 'ハラル': 'Halal', 'ヴィーガン': 'Vegan', 'ビーガン': 'Vegan', 'ヴィガン': 'Vegan', 'ビガン': 'Vegan',
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
  // "Pure veg" is how India says vegetarian (no meat, fish or egg): word by
  // word it was Pureun Deli. Hindi too.
  pureveg: 'Vegan', purevegetarian: 'Vegan', 'शाकाहारी': 'Vegan',
  // "Muslim-friendly" is what Korean tourism lists call these places.
  // The labels on the cards and chips, as written there: typed back, they
  // found nothing ("完全ヴィーガン", "vegan sepenuhnya", "全素": 0 places).
  fullyvegan: FULLY_VEGAN, '완전비건': FULLY_VEGAN, '완전비건만': FULLY_VEGAN, '비건전용': FULLY_VEGAN, '비건전문': FULLY_VEGAN, veganonly: FULLY_VEGAN, '완전채식': FULLY_VEGAN, '完全菜食': FULLY_VEGAN, '完全ヴィーガン': FULLY_VEGAN, '完全ビーガン': FULLY_VEGAN,
  '全纯素': FULLY_VEGAN, '全純素': FULLY_VEGAN, '全素': FULLY_VEGAN, vegansepenuhnya: FULLY_VEGAN, sepenuhnyavegan: FULLY_VEGAN,
  veganoptions: 'Vegan', 'ヴィーガン対応': 'Vegan', 'ビーガン対応': 'Vegan', 'ベジタリアン対応': 'Vegan', 'ベジ': 'Vegan', '비건옵션': 'Vegan', '비건가능': 'Vegan', '채식가능': 'Vegan', 'ヴィーガン対応あり': 'Vegan', '有纯素选项': 'Vegan', '有純素選項': 'Vegan',
  halalfriendly: 'Halal', ramahhalal: 'Halal', ramahmuslim: 'Halal', 'ハラールフレンドリー': 'Halal', '할랄프렌들리': 'Halal', '清真友好': 'Halal', '清真友善': 'Halal',
  muslim: 'Halal', muslimfriendly: 'Halal', '무슬림': 'Halal', '무슬림프렌들리': 'Halal', '무슬림친화': 'Halal', 'ムスリム': 'Halal', 'ムスリムフレンドリー': 'Halal', 'ムスリム対応': 'Halal', '穆斯林': 'Halal', '穆斯林友好': 'Halal',
};
// "Pork-free" is a halal level the Halal chip leaves out (it is not halal),
// so it is reached by typing it — in any of these wordings.
// The whole search asks for pork-free places (search.js: the Halal chip then
// steps aside, since pork-free is by definition not in it).
// …or one of its words does ("Seoul pork-free", "pork free places").
export const isPorkFreeQuery = (query) => {
  // (As the search reads it: "tidak ada babi", "돼지고기 안 쓰는 집" are the
  // level too, and the Halal chip goes off for them as for "pork-free".)
  const words = unpunct(porkFreeSaid(query)).trim().split(/\s+/).filter(Boolean);
  if (PORK_FREE_WORDS.has(squash(words.join(' ')))) return true;
  return words.some((w, i) => PORK_FREE_WORDS.has(squash(w))
    || (i + 1 < words.length && PORK_FREE_WORDS.has(squash(`${w} ${words[i + 1]}`))));
};
const PORK_FREE_WORDS = new Set(['porkfree', 'nopork', 'withoutpork', 'tanpababi', 'bebasbabi', '豚肉不使用', '豚肉なし', 'ポークフリー', '不含猪肉', '无猪肉', '不含豬肉', '돼지고기없음', '돼지고기없는', '돼지고기없는곳', '포크프리']);
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
// "돼지고기 안 쓰는 집", "豚肉を使わない店", "没有猪肉": pork-free said in three
// or four words. Put as the one word the records' level is searched by.
const PORK_FREE_SAID = [
  [/돼지고기(?:를|가|는)?\s*(?:안\s*(?:쓰는|넣는|들어간|들어가는|파는|먹는)|빼고|없이|없는)(?:\s*(?:집|식당|곳|가게|음식점|음식))?/g, '돼지고기없는'],
  [/豚肉(?:を|は)?(?:使わない|使っていない|なし|抜き|不使用)(?:の?(?:店|お店|レストラン))?/g, '豚肉不使用'],
  [/(?:没有|不用|不含|无|無|沒有|不要|不吃|不加)(?:猪|豬)肉(?:的(?:店|餐厅|餐廳))?/g, '不含猪肉'],
  // ("tidak ada babi": left as words, the list offered the search without
  // "tidak" — "ada babi", with pork.)
  [/\b(?:tidak|tak|gak|nggak|enggak)\s+(?:ada|pakai|pake|memakai|menggunakan|mengandung)\s+(?:daging\s+)?babi\b|\bnon[- ]?babi\b|\btanpa\s+daging\s+babi\b/gi, 'tanpa babi'],
  // Two words that are one thing, said as the records say it: Indonesian puts
  // the kind after the noun ("makanan korea" is Korean food — "korea" alone
  // found Korea University), and a name is sometimes typed in its syllables.
  [/\b(?:makanan|masakan|kuliner)\s+korea\b/gi, 'korean'],
  [/\bayam\s+goreng\b/gi, 'fried chicken'],
  [/\bmakanan\s+laut\b/gi, 'seafood'],
  // (The chip's own name, typed with its gap.)
  [/제로\s+웨이스트/g, '제로웨이스트'],
  [/\bdaging\s+sapi\b/gi, 'beef'],
  [/\bes\s+krim\b/gi, 'ice cream'],
  [/\bmyeong\s+dong\b(?![-\w])/gi, 'myeongdong'],
  [/\bitae\s+won\b/gi, 'itaewon'],
];
// ("有没有猪肉" — is there pork? — is a question: notAQuestion, below.)
export const porkFreeSaid = (query) => PORK_FREE_SAID.reduce((q, [said, word]) => q.replace(said, ` ${word} `), notAQuestion(query)).replace(/\s+/g, ' ').trim();

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
// Whether a place's story speaks of the word as something the place serves:
// a whole word ("pho" is not "phone"; a plural counts either way), in a
// sentence about what is served, sold or made there, and not one saying the
// place is without it — "no meat or seafood", "instead of beef". Words about
// the record itself or its opening days are no dish: "sunday" was the twenty
// places whose story says "closed Sundays".
const SAYS_WITHOUT = /\b(?:no|not|non|never|without|free|instead|avoids?|excludes?|excluding|neither|nor|rather\s+than|cannot|closed|closes)\b|n't\b/i;
const SAYS_SERVED = /\b(?:serv(?:es?|ing|ed)|menu|dish(?:es)?|sells?|makes?|bak(?:es?|ing)|offers?|cooks?|grills?|speciali[sz]es?|includes?|covers?|lists?|plates?|bowls?|sold|made|baked|choices?|options?|such\s+as|food\s+is|curries|snacks)\b/i;
const NOT_A_DISH = new Set(['open', 'opens', 'close', 'check', 'hour', 'hours', 'instagram', 'kakao', 'naver', 'google', 'happycow', 'krw', 'won', 'moved', 'business', 'visitor', 'visitors', 'unknown', 'people', 'person', 'nothing', 'how', 'help', 'date', 'dates', 'live', 'baby', 'list', 'lists', 'listing', 'menu', 'dish', 'dishes', 'place', 'places', 'street', 'floor', 'station', 'exit', 'building', 'year', 'years', 'month', 'day', 'days', 'week', 'time', 'price', 'prices', 'page', 'site', 'website', 'review', 'reviews', 'map', 'maps', 'says', 'said', 'record', 'recorded', 'confirmed', 'reported', 'serves', 'serve', 'makes', 'sells', 'offers', 'also', 'with', 'and', 'from', 'its', 'has', 'are', 'was', 'for', 'that', 'this', 'which', 'such', 'some', 'most', 'many']);
const storyWords = new Map();
/** The word a story is asked about: lower case, no mark at its end; '' when it is none. */
export function storyWord(word) {
  const w = fold(word).trim().replace(/[?!.,;:]+$/, '');
  return /^[a-z][a-z'-]{2,}$/.test(w) && !NOT_A_DISH.has(w) && plannedTime(w) === null && plannedTime(`${w} lunch`) === null ? w : '';
}
export function mentionsInStory(r, word) {
  const w = storyWord(word);
  if (w === '' || typeof r.story !== 'string') return false;
  let said = storyWords.get(w);
  if (!said) {
    // "biryanis" asks about biryani, "samosa" finds "samosas".
    const stem = (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w).replace(/[-']/g, '.?');
    said = new RegExp(`\\b${stem}(?:e?s)?\\b`, 'i');
    if (storyWords.size > 200) storyWords.clear();
    storyWords.set(w, said);
  }
  return r.story.split(/[.!?;]\s+/).some(sentence => said.test(sentence) && SAYS_SERVED.test(sentence) && !SAYS_WITHOUT.test(sentence));
}
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
// (Not 면, 국, 전, 차: they are also the ends of other words — 두부면 is read
// as tofu with a 면 left over, 제주도 as Jeju with a 도.)
// (Nor 밥 and 술, which say "a meal" and "a drink" more than they name a dish.)
const ONE_SYLLABLE_FOOD = new Set(['빵', '죽', '떡', '탕', '찜', '쌈', '콩', '묵', '面', '麺', '麵', '茶']);
// "no egg", "egg-free", "without onion", "eggless": an ingredient asked to be
// left out. Word by word, "vegetarian no egg" was the vegetarian places with
// a word starting "no" and one starting "egg" — those that serve egg, and
// those with eggplant (walk-through, 2026-10-14). Such a question is answered
// by a text that says the ingredient is left out, never by one that names it
// — for any ingredient: "no oyster", "no ham" were the places that serve them.
// (Not alcohol, whose note says how it is answered; not pork or meat, which
// are levels the records carry: "no pork", "no meat".) A sauce or a stock is
// a thing of its own: "no fish sauce" is not "no fish".
const LEFT_OUT = new Set(['egg', 'dairy', 'milk', 'gluten', 'wheat', 'nut', 'peanut', 'soy', 'onion', 'garlic', 'sugar', 'lactose', 'msg', 'sesame', 'shellfish', 'fish', 'seafood', 'honey', 'butter', 'cheese', 'gelatin', 'chive', 'leek', 'scallion',
  'beef', 'chicken', 'shrimp', 'anchovy', 'ghee', 'cream', 'mayo', 'mayonnaise', 'mushroom', 'tofu', 'kimchi',
  'fish sauce', 'soy sauce', 'oyster sauce', 'fish stock', 'anchovy stock', 'meat stock', 'meat broth', 'beef broth', 'bone broth', 'seafood broth']);
// Other words for the same thing: what the records say for them.
const LEFT_OUT_SAME = { laktosa: 'dairy', allium: 'onion', alliums: 'onion', 'five pungent': 'onion', 'pungent vegetables': 'onion', osinchae: 'onion', lactose: 'dairy', 'egg yolk': 'egg', yolk: 'egg', yolks: 'egg' };
const ALLIUMS = new Set(['onion', 'garlic', 'chive', 'leek', 'scallion']);
const COMPOUND = new Map([...LEFT_OUT, ...Object.keys(LEFT_OUT_SAME)].filter(x => x.includes(' ')).map(x => [x.replace(' ', ''), x]));
const stemOf = (w) => {
  if (Object.hasOwn(LEFT_OUT_SAME, w)) return LEFT_OUT_SAME[w];
  const glued = COMPOUND.get(w);
  if (glued) return LEFT_OUT_SAME[glued] ?? glued;
  return [w, w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y')].find(s => LEFT_OUT.has(s)) ?? null;
};
// Words that are not an ingredient after "no": words of the question. Meat
// and pork are levels the records carry, and alcohol is answered by its note:
// in a list they stay as they were said ("no meat or egg" is the Vegan word
// and egg left out), and the rest of the list is read on.
const NOT_AN_INGREDIENT = /^(?:please|food|foods|dish|dishes|menu|menus|option|options|place|places|restaurants?|cafes?|shops?|near|me|here|thanks|only|more|other|sake|soju|beer|wine|drinks?|added|extra|the|any|charge|cost|and|or|nor|using|free|less|no|without|non|allergic|allergy|allergies|intolerant|intolerance|corkage|tax|duty|smoke|smoking|delivery|parking|wifi|refill|refills|entry|admission|shipping|child|children|kids|pet|pets|though|which|that|this|these|those|its|it|is|are|was|were|but|with|from|into|for|to|of|in|on|at|by|as|so|if|when|while|then|than|very|too|also|just|all|some|one)$/;
const KEPT_AS_SAID = /^(?:meat|meats|pork|alcohol|alcoholic|liquor|alkohol)$/;
// A kind of place is not an ingredient ("no korean", "no bakery"); a food is
// ("no lamb", "no noodles": those listed the places that serve them).
const PLACE_KIND = /^(?:korean|japanese|chinese|indian|indonesian|turkish|nepal|uzbek|thai|vietnamese|italian|mexican|western|asian|halal|vegan|vegetarian|temple|bakery|bakeries|cafe|cafes|restaurant|buffet|hanok|brunch|breakfast|lunch|dinner|dessert|desserts|bar|pub|market|cuisine|fusion|street|prayer|mosque)$/;
// After "and" / "or" a dish or a quality is what is wanted, not left out:
// "no egg and bread" is bread with no egg.
const WANTED = /^(?:breads?|noodles?|kimbap|gimbap|bibimbap|rice|soups?|stews?|cakes?|cookies?|snacks?|desserts?|pasta|pizza|burgers?|sandwich(?:es)?|salads?|curry|curries|bowls?|meals?|cheap|spicy|mild|good|nice|tasty|delicious|healthy|open|now|today|tonight|near|nearby)$/;
// "no fried egg", "no green onion": the word before is the ingredient's.
const MODIFIER = /^(?:fried|raw|boiled|green|spring|whole|cooked|fresh|hard|soft|poached|scrambled|white|brown|red|sweet|dried|smoked|grilled)$/;
const LEAD = /^(?:no|without|non|minus|excluding|hold|skip)$/;
const JOIN = /^(?:and|or|nor|&|,)$/;
const SKIP = /^(?:the|any|added|extra|using)$/;
// "free" that is not "left out": "kimchi free refills", "egg free of charge".
const FREE_OTHERWISE = /^(?:refills?|of|for|charge|parking|wifi|delivery|entry|admission|shipping|tasting|samples?|with)$/;
const LESS_OTHERWISE = /^(?:spicy|sweet|salty|oily|greasy|hot|sour)$/;
// One thing, as a cook would say it: "tomatoes" is tomato, "radishes"
// radish, "octopus" and "hummus" themselves.
const singular = (w) => (/(?:us|is|ss)$/.test(w) ? w
  : /oes$/.test(w) ? w.slice(0, -2)
    : /(?:sh|ch|x|z|ss)es$/.test(w) ? w.slice(0, -2)
      : /ies$/.test(w) ? `${w.slice(0, -3)}y`
        : w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);
/**
 * What a search asks to be left out, and the rest of it: { items, rest }.
 * "vegetarian no egg or fish" → { items: ['egg', 'fish'], rest: ['vegetarian'] }.
 */
// Asked once per search, not once per place: kept.
const LEFT_OUT_READ = new Map();
// "vegetarian tanpa telur", "달걀 없는 채식", "卵なし ベジタリアン", "素食 无蛋":
// the same question as "vegetarian no egg" (49 places), and each was 0 — the
// words for an ingredient and for leaving it out are read in the other five
// languages of the map, as "no egg". (Only these ingredients, and only beside
// such a word: "계란말이", "蛋糕", "kacang" in a name stay as typed.)
const ABROAD_INGREDIENT = [
  ['egg', 'telur|달걀|계란|卵|たまご|玉子|鸡蛋|雞蛋|蛋'],
  ['dairy', 'susu|유제품|乳製品|乳制品|奶制品|奶製品'],
  // (奶 alone — "蛋奶", "无奶" — is dairy, as "no egg no dairy" reads.)
  ['milk', '우유|牛乳|牛奶'],
  ['dairy', '奶'],
  ['gluten', 'gluten|글루텐|グルテン|麸质|麩質'],
  // (Wheat as gluten: "小麦なし", "밀가루없는" were "gluten free" before.)
  ['gluten', 'gandum|밀가루|밀|小麦粉|小麦|小麥'],
  ['peanut', 'kacang tanah|땅콩|ピーナッツ|落花生|花生'],
  ['nut', 'kacang|견과류|견과|ナッツ|坚果|堅果'],
  ['soy', 'kedelai|대두|大豆|黄豆|黃豆'],
  ['garlic', 'bawang putih|마늘|にんにく|ニンニク|大蒜|蒜'],
  ['onion', 'bawang bombay|bawang merah|bawang|양파|오신채|玉ねぎ|たまねぎ|タマネギ|洋葱|洋蔥|五辛|五葷|五荤'],
  ['scallion', '대파|쪽파|실파|葱|蔥|ねぎ|ネギ'],
  ['sugar', 'gula|설탕|砂糖|糖'],
  ['sesame', 'wijen|참깨|ごま|胡麻|芝麻'],
  ['seafood', 'makanan laut|해산물|魚介|海鲜|海鮮'],
  ['fish sauce', 'kecap ikan|젓갈|액젓|魚醤|鱼露|魚露'],
  ['fish', 'ikan|생선|魚|鱼'],
  ['honey', 'madu|꿀|はちみつ|蜂蜜'],
  ['butter', 'mentega|버터|バター|黄油|牛油'],
  ['cheese', 'keju|치즈|チーズ|奶酪|起司|芝士'],
  ['shrimp', 'udang|새우|えび|エビ|虾|蝦'],
  ['shellfish', '갑각류|甲殻類|甲壳类|甲殼類'],
  ['mushroom', 'jamur|버섯|きのこ|キノコ|蘑菇'],
  ['msg', 'micin|vetsin|화학조미료|化学調味料|味精'],
];
const ABROAD_WORDS = ABROAD_INGREDIENT.flatMap(([en, words]) => words.split('|').map(w => [w, en])).sort((a, b) => b[0].length - a[0].length);
const ABROAD_ALT = ABROAD_WORDS.map(([w]) => w).join('|');
const ABROAD_EN = new Map(ABROAD_WORDS);
// One ingredient or several: "蛋奶", "卵、小麦", "밀, 달걀", "鱼和虾".
const ABROAD_LIST = `(?:${ABROAD_ALT})(?:(?:\\s*(?:[、,，・/和与與及や]|와|과|및|と|dan|atau)\\s*|\\s+)(?:${ABROAD_ALT}))*`;
// (In Chinese the words also run together — "不吃蛋奶" — but only to the end
// of the phrase: "无糖奶茶" is sugar-free milk tea, not "no milk".)
const ABROAD_RUN = `(?:${ABROAD_ALT})(?:(?:\\s*(?:[、,，/和与與及])\\s*)?(?:${ABROAD_ALT}))*(?=$|[\\s,，、。.!?！？的了吧呢无無不没沒免]|过敏|過敏)`;
const ABROAD_LEFT_OUT = [
  // Indonesian: "tanpa telur", "bebas gluten", "tidak pakai bawang".
  new RegExp(`\\b(?:tanpa|bebas|tidak (?:pakai|pake|memakai|mengandung)|nggak pakai|gak pakai|non)\\s+(${ABROAD_LIST})\\b`, 'gi'),
  // Korean: "달걀 없는", "계란 빼고", "마늘 안 들어간", "글루텐 프리".
  new RegExp(`(${ABROAD_LIST})\\s*(?:을|를|이|가|은|는)?\\s*(?:없는|없이|없음|없고|빼고|빼서|빼 ?주세요|뺀|제외|안\\s*(?:들어간|들어가는|넣은|넣고|먹는|먹어요|먹습니다)|못\\s*먹|안\\s*(?:쓰는|써요|씁니다)|(?:들어가지|넣지|쓰지)\\s*않|프리|알레르기|알러지)`, 'g'),
  // Korean "무설탕", "무글루텐".
  /무(설탕|글루텐)/g,
  // Japanese: "卵なし", "にんにく抜き", "小麦不使用", "グルテンフリー".
  new RegExp(`(${ABROAD_LIST})\\s*(?:なし|無し|抜き|ぬき|不使用|フリー|を?使わない|を?食べない|が?入っていない|アレルギー)`, 'g'),
  // Chinese: "无蛋", "不含麸质", "不吃五辛", "不要蒜", "去葱"…, and "花生过敏".
  new RegExp(`(?:无|無|不含|不吃|不要|不加|不放|免|没有|沒有)\\s*(${ABROAD_RUN})`, 'g'),
  new RegExp(`(${ABROAD_RUN})\\s*(?:过敏|過敏)`, 'g'),
];
const ABROAD_ONE = new RegExp(ABROAD_ALT, 'gi');
// (Only the same verb twice is a question: "要不加葱的" is "without scallion".)
export const notAQuestion = (text) => String(text ?? '').replace(/(有)(?:没|沒)有|(要)不要|(吃)不吃|(加)不加/g, (m, a, b, c, d) => a ?? b ?? c ?? d);
function inEnglishLeftOut(text) {
  let out = notAQuestion(text);
  for (const re of ABROAD_LEFT_OUT) {
    out = out.replace(re, (whole, list, at, all) => {
      // (Korean: "비밀 없는", "우리밀 없는" end in 밀 but are other words.)
      if (/^[가-힣]/.test(whole) && /[가-힣]$/.test(String(all).slice(0, at))) return whole;
      const ens = [...String(list).matchAll(ABROAD_ONE)].map(m => ABROAD_EN.get(m[0]) ?? ABROAD_EN.get(m[0].toLowerCase())).filter(Boolean);
      return ens.length > 0 ? ` ${ens.map(en => `no ${en}`).join(' ')} ` : whole;
    });
  }
  return out;
}
export function leftOutQuery(query) {
  const key = String(query ?? '');
  let read = LEFT_OUT_READ.get(key);
  if (!read) {
    if (LEFT_OUT_READ.size > 200) LEFT_OUT_READ.clear();
    read = readLeftOut(key);
    LEFT_OUT_READ.set(key, read);
  }
  return read;
}
function readLeftOut(query) {
  // As the other readings of a search see it: full-width letters from a
  // Japanese keyboard folded, a question mark or a full stop no part of a
  // word ("no egg?" read as the word "egg?"). A comma, "&", "/" and "+" join.
  const raw = inEnglishLeftOut(fold(String(query ?? ''))).replace(/[.;:!?。！？"“”‘’()（）「」『』…]+/g, ' ')
    .replace(/[，、]/g, ',').replace(/\s*[,/+]\s*/g, ' , ').replace(/&/g, ' & ');
  // A hyphen is a space where it joins "no", "non", "free" or "less", or an
  // ingredient of two words ("fish-sauce"); elsewhere ("mapo-gu") it stays.
  const tokens = raw.trim().split(/\s+/).filter(Boolean).flatMap((w) => {
    const halves = w.split('-').filter(Boolean);
    return halves.length > 1 && (halves.some(h => /^(?:no|non|free|less|and|or)$/.test(h)) || COMPOUND.has(halves.join(''))) ? halves : [w.replace(/-$/, '')];
  });
  // The ingredient at i, or null. `after` is "first after a lead", "after and/or".
  const item = (i, generic, after) => {
    if (i >= tokens.length) return null;
    const two = i + 1 < tokens.length ? stemOf(`${tokens[i]} ${tokens[i + 1]}`) : null;
    if (two) return [two, 2];
    const one = stemOf(tokens[i]);
    if (one) return [one, 1];
    if (MODIFIER.test(tokens[i]) && i + 1 < tokens.length) {
      const next = item(i + 1, generic, after);
      if (next) return [next[0], next[1] + 1];
    }
    const w = tokens[i];
    if (!generic || !/^[a-z]{3,}$/.test(w) || NOT_AN_INGREDIENT.test(w) || KEPT_AS_SAID.test(w) || PLACE_KIND.test(w)
      || Object.hasOwn(DIET_WORDS, w) || AREA_WORDS.has(w) || FILLER_WORD.test(w) || /ing$/.test(w)
      || (after === 'join' && (WANTED.test(w) || COOKING.has(singular(w))))) return null;
    return [singular(w), 1];
  };
  const items = [];
  const said = [];
  const used = new Set();
  const take = (at, n, x) => { items.push(x); for (let k = at; k < at + n; k += 1) used.add(k); };
  for (let i = 0; i < tokens.length; i += 1) {
    if (used.has(i)) continue;
    const w = tokens[i];
    // "no egg", "without the egg or fish", "free of dairy", "hold the cheese",
    // "skip the kimchi".
    // (…and "allergic to egg".)
    const lead = LEAD.test(w) ? 1 : (w === 'free' && /^(?:of|from)$/.test(tokens[i + 1] ?? '')) || (/^(?:allergic|allergy)$/.test(w) && tokens[i + 1] === 'to' && Boolean(stemOf(tokens[i + 2] === 'the' ? tokens[i + 3] ?? '' : tokens[i + 2] ?? ''))) ? 2 : 0;
    if (lead) {
      let j = i + lead;
      while (SKIP.test(tokens[j] ?? '') || tokens[j] === ',') j += 1;
      // ("no meat", "no pork", "non halal" by themselves: answered as before.)
      const first = item(j, w !== 'non', 'lead');
      const level = !first && KEPT_AS_SAID.test(tokens[j] ?? '') ? tokens[j] : null;
      if (!first && !level) continue;
      const got = [];
      const levels = level ? [level] : [];
      let k = j + (first ? first[1] : 1);
      if (first) got.push([j, first[1], first[0]]);
      // ("no onion garlic", "no egg dairy": known ingredients side by side are
      // a list too; any other word after them is the rest — "no egg bibimbap".)
      for (let two = k < tokens.length ? stemOf(`${tokens[k]} ${tokens[k + 1] ?? ''}`) : null, one = stemOf(tokens[k] ?? '');
        (two || one) && !JOIN.test(tokens[k] ?? '');
        two = k < tokens.length ? stemOf(`${tokens[k]} ${tokens[k + 1] ?? ''}`) : null, one = stemOf(tokens[k] ?? '')) {
        const n = two ? 2 : 1;
        got.push([k, n, two ?? one]);
        k += n;
      }
      while (JOIN.test(tokens[k] ?? '')) {
        let m = k + 1;
        while (SKIP.test(tokens[m] ?? '') || JOIN.test(tokens[m] ?? '')) m += 1;
        const next = item(m, true, 'join');
        if (next) { got.push([m, next[1], next[0]]); k = m + next[1]; continue; }
        if (KEPT_AS_SAID.test(tokens[m] ?? '')) { levels.push(tokens[m]); k = m + 1; continue; }
        break;
      }
      if (got.length === 0) continue;
      for (let m = i; m < k; m += 1) used.add(m);
      for (const [at, n, x] of got) take(at, n, x);
      for (const l of levels) said.push('no', l);
      i = k - 1;
      continue;
    }
    // "egg free", "fish and egg free", "gluten free busan"; "egg less" only
    // for an ingredient ("chicken less spicy" is not).
    // ("lactose intolerant", "peanut allergy": the body, said of a known
    // ingredient, asks the same — "lactose intolerant" found nothing.)
    if ((w === 'free' && !FREE_OTHERWISE.test(tokens[i + 1] ?? '')) || (w === 'less' && !LESS_OTHERWISE.test(tokens[i + 1] ?? '')) || /^(?:intolerant|intolerance|allergy|allergies|allergic)$/.test(w)) {
      const back = (end) => {
        if (end < 0 || used.has(end)) return null;
        const two = end >= 1 ? stemOf(`${tokens[end - 1]} ${tokens[end]}`) : null;
        if (two) return [two, 2];
        const one = stemOf(tokens[end]);
        if (one) return [one, 1];
        if (KEPT_AS_SAID.test(tokens[end])) return ['', 1];
        return w === 'free' ? item(end, true, 'lead') : null;
      };
      const got = [];
      const levels = [];
      let j = i - 1;
      let one = back(j);
      while (one) {
        if (one[0]) got.push([j - one[1] + 1, one[1], one[0]]); else levels.push(j);
        j -= one[1];
        if (!JOIN.test(tokens[j] ?? '')) break;
        one = back(j - 1);
        if (one) used.add(j);
        j -= 1;
      }
      if (got.length > 0 || levels.length > 0) {
        used.add(i);
        for (const [at, n, x] of got) take(at, n, x);
        for (const at of levels) { said.push('no', tokens[at]); used.add(at); }
      }
      continue;
    }
    // Glued: "noegg", "nondairy", "eggless", "glutenfree", "nofishsauce".
    const glued = [/^non([a-z]+)$/, /^no([a-z]+)$/, /^([a-z]+?)(?:free|less)$/].map(re => re.exec(w)?.[1]).find(x => x && stemOf(x));
    if (glued) take(i, 1, stemOf(glued));
  }
  return { items: [...new Set(items)], rest: [...tokens.filter((t, i) => !used.has(i) && !JOIN.test(t)), ...said] };
}
const FILLER_WORD = /^(?:restaurant|restaurants|food|place|places)$/;

const SAYS_LEFT_OUT = new Map();
// The text says it is left out: "no eggs", "no meat, fish, eggs or dairy",
// "egg-free", "eggless", "without onion", "leave out the egg", "skip the
// kimchi", "ham, fish cake and imitation crab left out", "the chef leaves it
// out"; for an onion or garlic, "excluding the five pungent alliums" too.
// ("Ask for no egg on the bibimbap", "say you want it without fish": a dish
// the record says can be had without it — a lead, and the list's note says
// to ask.)
// Not:
//  - "no fish sauce" for fish, "soy milk" for soy, "cream cheese" for cream;
//  - "without white sugar" for sugar, nor "no raw fish or shellfish" for
//    shellfish (the word before may cover both);
//  - a list run on into a clause — "no pork is served, though the chicken…",
//    "without the kimchi, which contains fish", "the noodles without the
//    egg, and the buckwheat pancake" — nor "non bread … beef samsa";
//  - what the visitor is to say or ask: "tell the staff you eat no egg",
//    "ask whether it is made without fish stock", "confirm that your table
//    has no fish sauce", "if you avoid egg", "visitors who eat no egg";
//  - "not gluten-free", "there is no gluten-free option", "nothing here is
//    made without egg", "kimchi free refills", "egg free of charge";
//  - "a sugar-free bagel made with coconut sugar"; a question in the text.
const NOT_A_PART = '(?![\\s-]+(?:sauce|stock|broth|cake|paste|oil|ball|powder|milk|cream|curd|cheese|yolk|whites?|substitutes?)s?\\b)';
const LIST_LEAD = '(?:(?:the|any|added)\\s+)?';
const LIST_LATER = '(?:(?:any|added)\\s+)?';
const LIST_ITEM = '(?!or\\b|and\\b|the\\b)[a-z]+(?:[\\s-](?!or\\b|and\\b)[a-z]+)?';
const LIST_SEP = '(?:\\s*,\\s*(?:or\\s+|and\\s+)?|\\s+(?:or|and)\\s+)';
const NOT_FREE = '(?!\\s+(?:of charge|refills?|for|with any)\\b)';
const PRONOUN_TAIL = '(?:leaves? it out|left (?:it|them) (?:out|off)|(?:want|ask for) (?:it|them) without\\b|(?:it|them) to be left (?:out|off))';
const COVERED_BY_BEFORE = /\b(?:white|refined|raw|brown)\s+[a-z]+\s+(?:and|or)\s+(?:(?:the|any|added)\s+)?$/;
const NOT_THE_KITCHEN = new RegExp([
  '\\b(?:ask|asking|check|checking|confirm|find out|make sure)\\b[^.;:!?]{0,30}\\b(?:whether|if|which)\\b',
  '\\bconfirm\\b[^.;:!?]{0,40}\\bthat\\b',
  "\\b(?:you|i|we)\\b[^.;:!?]{0,20}\\b(?:eat|do not eat|don't eat)\\s*$",
  '\\b(?:you|who|i|we)\\s*$',
  "\\b(?:who|people|visitors|anyone|those)\\b[^.;:!?]{0,30}\\b(?:eats?|wants?|needs?|avoids?)\\s*$",
  '\\bif you\\b[^.;:!?]{0,40}\\b(?:need|want)\\s*$',
  "\\b(?:does not|doesn't|do not|don't) say\\b[^.;:!?]*\\b(?:whether|if)\\b",
  '\\bunclear\\b[^.;:!?]*\\b(?:whether|if)\\b',
  "\\b(?:nothing|cannot|can't|never)\\b[^.;:!?]{0,30}\\b(?:made|cooked|served|be had)\\s*$",
  "\\b(?:not|isn't|no longer|never|nothing(?: here)? is)\\s+(?:(?:a|an|the|fully|entirely|completely|always|really|strictly|100%|certified|labelled)\\s+)*$",
  '\\b(?:there (?:is|are) )?no\\s+$',
].join('|'));
function saysLeftOut(text, x) {
  let re = SAYS_LEFT_OUT.get(x);
  if (!re) {
    const base = x.replace(/ /g, '[\\s-]+');
    const forms = /y$/.test(x) ? `${base.slice(0, -1)}(?:y|ies)` : `${base}(?:e?s)?`;
    const word = ALLIUMS.has(x) ? `(?:${forms}|five pungent|pungent vegetables|alliums?|osinchae)` : `(?:${forms})`;
    const between = `(${LIST_LEAD}(?:${LIST_ITEM}${LIST_SEP}${LIST_LATER}){0,5}?)`;
    re = {
      all: new RegExp(`\\b(?:no|without|excluding|excludes?|free of|free from|instead of|in place of|avoids?|omits?|leav(?:e|es|ing) (?:out|off)|left out|rules? out|replaces?|replacing|minus|skips? the|hold the)[\\s-]+${between}${word}\\b${NOT_A_PART}(?![\\s-]?(?:free|less)\\b)`
        + `|\\bnon-${word}\\b${NOT_A_PART}`
        + `|\\b${word}(?:[\\s-]?free|-?less)\\b${NOT_FREE}`
        // ("dairy- and egg-free"; "egg, milk and butter free". Not "breads
        // and gluten-free breads": a hyphened "-free" is its own word's.)
        + `|\\b${word}-(?:\\s*,\\s*|\\s+(?:and|or)\\s+)(?:[a-z]+-(?:\\s*,\\s*|\\s+(?:and|or)\\s+)){0,3}[a-z]+-free\\b${NOT_FREE}`
        + `|\\b${word}(?:\\s*,\\s*|\\s+(?:and|or)\\s+)(?:[a-z]+(?:\\s*,\\s*|\\s+(?:and|or)\\s+)){0,3}[a-z]+\\s+free\\b${NOT_FREE}`
        + `|\\b${word}\\b${NOT_A_PART}(?:${LIST_SEP}${LIST_ITEM}){0,5}\\s+(?:(?:are|is|was|were)\\s+)?(?:left out|left off|ruled out|omitted)\\b`
        + `|\\b${word}\\b${NOT_A_PART}(?:(?!\\bbut\\b|\\bthough\\b)[^.;,]){0,30}?\\b(?:left out|left off|ruled out|omitted)\\b`
        // ("…come with egg, and the chef leaves it out", "a fried egg is offered
        // …, so say you want it without", "both contain milk, so ask for them to
        // be left off": the ingredient is in the dish the pronoun stands for —
        // not "the spicy makguksu … ask for them without the egg", nor "served
        // with the vegan falafel … ask for them to be left off".)
        + `|(?:\\b(?:contains?|comes? with|(?:is |are )?made with|includes?|topped with)\\s+(?:(?:a|an|the|some)\\s+)?(?:[a-z]+\\s+)?${word}\\b${NOT_A_PART}|\\b${word}\\b${NOT_A_PART}\\s+(?:is|are)\\s+(?:offered|added|served|included|put))[^.;]{0,80}?\\b${PRONOUN_TAIL}`, 'g'),
      pronoun: new RegExp(`${PRONOUN_TAIL}$`),
      madeWith: new RegExp(`\\b(?:made|sweetened|baked|cooked|filled)\\s+(?:with|from)\\s+(?!no\\b|without\\b)(?:(?!\\bwithout\\b|\\bno\\b|\\binstead of\\b)[^.;,]){0,60}\\b${word}\\b`),
    };
    if (SAYS_LEFT_OUT.size > 300) SAYS_LEFT_OUT.clear();
    SAYS_LEFT_OUT.set(x, re);
  }
  if (typeof text !== 'string') return false;
  const t = fold(text);
  re.all.lastIndex = 0;
  for (let m = re.all.exec(t); m; m = re.all.exec(t)) {
    const start = Math.max(t.lastIndexOf('.', m.index), t.lastIndexOf('!', m.index), t.lastIndexOf('?', m.index)) + 1;
    const before = t.slice(start, m.index).split(/[;:]/).at(-1);
    if (NOT_THE_KITCHEN.test(before)) continue;
    if (m[1] !== undefined && COVERED_BY_BEFORE.test(m[1])) continue;
    // ("There is no English menu, eggs and spam come on top": past the comma
    // a new clause began.)
    if (m[1] && /,\s*$/.test(m[1]) && /^\s*(?:and\s+[a-z]+\s+)?(?:is|are|was|were|comes?|came|sits?|goes?|go)\b/.test(t.slice(m.index + m[0].length))) continue;
    const endAt = t.slice(m.index).search(/[.;!?]/);
    // (A question in the text — "Is the cake egg-free?" — says nothing.)
    if (endAt >= 0 && t[m.index + endAt] === '?') continue;
    const sentence = t.slice(start, endAt < 0 ? t.length : m.index + endAt);
    if (!re.pronoun.test(m[0]) && re.madeWith.test(sentence)) continue;
    return true;
  }
  return false;
}
export { saysLeftOut };
// "no alcohol", "halal tanpa alkohol", "술 없는 할랄", "无酒 清真": no field of
// the record says whether a place sells alcohol, but forty notes do — a
// tourism listing's "Alcohol for Sale Ⓧ", HalalRank's "No alcohol allowed",
// the owner, the menu. Word by word it was 0, 2, 58 or 152 places by the
// wording, and "alcohol free" two places whose notes say alcohol IS sold
// ("Pork Free … alcohol is sold"). Now: the places whose notes say no
// alcohol, the rest of the search asked of them as usual, and a note that
// says where that comes from.
const ALCOHOL_LEFT_OUT = new RegExp([
  '\\b(?:no|non|without|free of|zero)[\\s-]+(?:alcohol(?:ic)?(?:[\\s-]+drinks?)?|alkohol|liquor|booze)\\b',
  '\\balcohol[\\s-]?free\\b',
  '\\bnon[\\s-]?alcoholic\\b',
  '\\b(?:tanpa|bebas|tidak (?:ada|jual|menjual)|tak ada)\\s+(?:alkohol|alcohol|miras|minuman keras)\\b',
  '술\\s*(?:을|이)?\\s*(?:안\\s*(?:파는|나오는|팔고|팔아요)|없는|없이|금지)',
  '무알(?:코올|콜)', '논알(?:코올|콜)',
  '(?:お酒|アルコール)(?:なし|無し|を?出さない|提供なし)', 'ノンアルコール',
  '不(?:卖|賣|供应|供應)酒', '[无無]酒(?:精)?', '不含酒(?:精)?', '(?:没有|沒有|不要)酒',
].join('|'), 'gi');
// (Nor when what is left asks nothing of a place — "술 없는 식당", "alcohol
// free places" were the whole map — or is the drink itself: "alcohol free
// beer" is a drink, not the places with beer.)
const DRINK_LEFT = /\b(?:beers?|wines?|cocktails?|drinks?|beverages?|soju|sake|makgeolli|bir|minuman)\b|맥주|와인|칵테일|음료|소주|막걸리|ビール|ワイン|カクテル|ドリンク|飲み物|啤酒|葡萄酒|红酒|紅酒|鸡尾酒|雞尾酒|饮料|飲料/i;
// What is left after the alcohol words: null when none were said, or the
// search was of a drink ("alcohol free beer"); without polite words ("no
// alcohol, thanks!"). Fillers and meals are the search's own to read.
export function alcoholAsked(query) {
  const text = notAQuestion(query);
  const rest = text.replace(ALCOHOL_LEFT_OUT, ' ').replace(/\s+/g, ' ').trim();
  if (rest === text.trim()) return null;
  const polite = (t) => t.split(/\s+/).filter(w => !/^(?:please|pls|plz|thanks|thank|you|ok|okay|sold|served|allowed|is|here)$/i.test(w.replace(/[?!.,，、。？！]+/g, ''))).join(' ').replace(/^[\s,，、]+|[\s,，、]+$/g, '').trim();
  const bare = polite(rest).replace(/[?!.,，、。？！]+/g, ' ').trim();
  if (DRINK_LEFT.test(bare)) return null;
  return { rest: bare === '' ? '' : polite(rest) };
}
// (Said of selling, serving or allowing it: a menu that shows none, or a
// listing without an "alcohol" feature, says nothing of the bar — eleven
// places came in on "no pork … and no alcohol" on a partial menu.)
const NO_ALCOHOL_SAID = /Alcohol for Sale Ⓧ|\bno alcohol (?:is )?(?:allowed|served|sold)\b|\bserves? no (?:pork (?:and|or) no )?alcohol\b|\b(?:does not|doesn't|do not|don't) (?:sell|serve) alcohol|\bnot sell(?:ing)? alcohol|술을?\s*(?:사용하지|팔지|판매하지)/gi;
// (Read with the "no alcohol" sayings taken out: "no alcohol is served" is
// not "alcohol is served".)
// (Free corkage is alcohol at the table too.)
const ALCOHOL_SOLD_SAID = /콜키지|corkage|bring (?:their|your) own|Alcohol for Sale Ⓞ|alcohol is (?:sold|served)\b|\b(?:sells|serves) alcohol\b|whether alcohol is (?:sold|served) is not|Alcohol is not (?:addressed|listed)/i;
const noAlcoholMemo = new WeakMap();
const allStrings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out);
  return out;
};
export function saysNoAlcohol(r) {
  if (!r || typeof r !== 'object') return false;
  // (The browser's copy has no evidence text: the answer was read from the
  // full record when it was made — scripts/lib/client-data.mjs.)
  if (typeof r.noAlcoholSaid === 'boolean') return r.noAlcoholSaid;
  if (noAlcoholMemo.has(r)) return noAlcoholMemo.get(r);
  const text = allStrings(r).join(' \n ');
  NO_ALCOHOL_SAID.lastIndex = 0;
  const said = NO_ALCOHOL_SAID.test(text);
  NO_ALCOHOL_SAID.lastIndex = 0;
  const yes = said && !ALCOHOL_SOLD_SAID.test(text.replace(NO_ALCOHOL_SAID, ' '));
  noAlcoholMemo.set(r, yes);
  return yes;
}
// The search without any of those words, for the notes beside the list.
export function stripAlcoholWords(query) {
  return notAQuestion(query).replace(ALCOHOL_LEFT_OUT, ' ');
}
// Whether the search asked for no alcohol, in the words above.
export function asksAlcohol(query) {
  return alcoholAsked(query) !== null;
}
// A prayer room asked for, however punctuated ("prayer room?").
export function asksPrayer(query) {
  return PRAYER_ASKED.test(squash(unpunct(String(query ?? ''))));
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
  // (Nor before a prayer room: "lotte world prayer room" was three places
  // near Lotte World, none with one.)
  const asksPrayerToo = parts.some(w => PRAYER_ASKED.test(squash(w)));
  if (alias && !asksDiet && !asksPrayerToo && aliasMatch(r, q) && (q === alias || firstWord !== alias)) return true;
  // The whole search is an area's name: answered by where the place is or
  // what it is called — not by a line saying it "moved from Itaewon".
  if (AREA_WORDS.has(q)) return inAreaOrName(r, q);
  // The halal level is searchable too, so "pork-free" finds every pork-free
  // place (the Halal filter leaves them out: pork-free is not halal).
  const halal = r.dietary?.halal;
  const fields = [r.name, r.vibe, r.zone, r.address?.value,
    halal && halal.confidence !== 'unknown' ? halal.value : null];
  // A prayer room asked for by itself ("musholla", "prayer room", "기도실"):
  // the places whose text names one — eight, from Jeju to Busan; a single
  // word is otherwise not looked for in the stories, and it was the two in
  // Myeongdong whose one line says so (walk-through, 2026-10-15).
  if (PRAYER_ASKED.test(q)) return prayerSaid(r);
  // (…and with other words: "prayer room seoul", "halal musholla" — the
  // prayer words as above, the rest as any search. Word by word, "prayer
  // room seoul" missed the place whose text says "prayer facilities".)
  const prayerAt = asksPrayerToo ? parts.findIndex(w => PRAYER_ASKED.test(squash(w))) : -1;
  if (prayerAt >= 0) {
    const rest = parts.filter((w, i) => i !== prayerAt && !(i === prayerAt + 1 && /^(?:rooms?|spaces?|facilit(?:y|ies)|areas?)$/i.test(w)));
    if (rest.length > 0 && !rest.some(w => /^(?:times?|mats?|schedules?|call)$/i.test(w))) return prayerSaid(r) && searchCore(r, rest.join(' '));
  }
  // An ingredient asked to be left out ("vegetarian no egg", "fish and egg
  // free", "no oyster"): the places whose text says so, and the rest of the
  // search asked word by word of the name, area, address and story. (A place
  // called so still answers: "No Brand Burger".)
  const asked = leftOutQuery(rawQuery);
  if (asked.items.length > 0) {
    if (startsWord(r.name, q)) return true;
    const text = [...fields, r.story].filter(f => typeof f === 'string').join(' ');
    if (!asked.items.every(x => saysLeftOut(text, x))) return false;
    // ("gluten free food", "no egg near me", "gluten free 맛집": words that ask
    // for nothing are set aside, as in any other search — they made 38 places 0.)
    const restOf = (words) => dietPairs(words.filter(w => !REST_STOP.test(w) && !onlyFillers(w)).filter((w, i, all) => !(w === 'near' && all[i + 1] === 'me') && !(w === 'me' && all[i - 1] === 'near'))).filter(w => w.length >= 2 || ONE_SYLLABLE_FOOD.has(w));
    if (restOf(asked.rest).every(w => wordMatch(r, w, text))) return true;
    // The rest in another script ("ソウル no egg or dairy"): read in Latin
    // letters, the left-out part kept as it was read.
    const roman = asked.rest.length > 0 ? romanOf(asked.rest.join(' ')) : null;
    return roman !== null && restOf(roman.toLowerCase().split(/\s+/).filter(Boolean)).every(w => wordMatch(r, w, text));
  }
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
  // (A food that is one syllable in Korean is a word all the same: "비건 빵"
  // was every vegan place, 521 of them, with the 빵 thrown away.)
  // Only beside words the map knows (a diet, an area, a kind of place): next to
  // any other word it is set aside as before.
  const paired = dietPairs(spaced);
  const isDiet = (w) => Object.hasOwn(DIET_WORDS, w) || PORK_FREE_WORDS.has(w);
  // …or beside an area or a kind of place as well: "이태원 빵", "비건 빵 카페".
  const known = (w) => isDiet(w) || AREA_WORDS.has(squash(w)) || COOKING.has(w.toLowerCase());
  const words = paired.filter(w => w.length >= 2 || (ONE_SYLLABLE_FOOD.has(w) && paired.every(other => other === w || known(other))));
  // Words of one letter are dropped, not required: "busan v" (mid-typing)
  // and "제주도" (split into Jeju + 도) are then judged on what is left.
  const haystack = [...fields, r.story].filter(f => typeof f === 'string').join(' ');
  if (words.length === 0) return false;
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
  return words.every(w => wordMatch(r, w, haystack));
}
// One word of a search of several, asked of a place.
function wordMatch(r, w, haystack) {
  return PORK_FREE_WORDS.has(w) ? dietWordMatch(r, w)
    : Object.hasOwn(DIET_WORDS, w) ? dietWordMatch(r, w) || startsWord(r.name, w)
      : AREA_WORDS.has(squash(w)) ? inAreaOrName(r, w)
        : startsWord(haystack, w) || dietWordMatch(r, w) || aliasMatch(r, w) || koAddressHas(r, w);
}
const PRAYER_ASKED = /^(?:prayer(?:rooms?|spaces?|facilit(?:y|ies)|areas?)?|mush?[ao]l+a|musala)$/;
export function prayerSaid(r) {
  return PRAYER_SAID.test([r.vibe, r.story].filter(f => typeof f === 'string').join(' '));
}
const PRAYER_SAID = /\bprayer[\s-]+(?:rooms?|spaces?|facilit(?:y|ies)|areas?|mats?)\b|\bmush?[ao]l+a\b|\bmusala\b/i;
// Words said around a question that ask nothing of a place.
const REST_STOP = /^(?:please|pls|plz|thanks|thank|you)$/;
const AREA_WORDS = new Set(Object.keys(AREA_NAMES).map(name => squash(name)));
const AREA_KEYS = new Set(Object.keys(AREA_NAMES).map(name => name.toLowerCase()));
// …and in Korean (the first written form of each): see koAddressHas.
const AREA_KO = new Set(Object.values(AREA_NAMES).map(forms => forms[0]));
// A neighbourhood typed in Korean — 익선동, 서교동, 한남동: the Korean address
// on file is the road-name one and names no neighbourhood; the English one
// says "Ikseon-dong". The word is spelt as the records spell it and looked
// for there. (Two syllables or more before 동: 우동 is a bowl of noodles.)
const DONG_TYPED = /^([가-힣]{2,5})(?:제?\d+)?([동리읍면])$/;
const UNIT = { 동: 'dong', 리: 'ri', 읍: 'eup', 면: 'myeon' };
// So with a street — 경리단길, 황리단길 — found as that street ("…-gil"; 로 is
// "-ro" or "-daero"), not as the district or the town of the same name:
// 성동로 was every place in Seongdong-gu.
const STREET_TYPED = /^([가-힣]{2,6})([길로])$/;
// And with any other place word of two syllables or more that the lists
// above do not know — 해방촌, 판교, 혜화, 합정: found where the English address
// or zone holds that very word, as a name of its own. Not on the road named
// after it (시흥 is not Siheung-daero in Seoul), nor in the name of a
// building (세종 is not "Sejong Tower" in Seongsu).
const placeAsked = new Map();
function koPlaceHas(r, w) {
  if (!placeAsked.has(w)) {
    // A word the lists of names read (두부면 is tofu + noodles, 성수동 is
    // Seongsu) is theirs to answer.
    const free = romaniseQuery(w) === null && !AREA_KO.has(w);
    const unit = free ? DONG_TYPED.exec(w) : null;
    const street = free && !unit ? STREET_TYPED.exec(w) : null;
    const word = free && !unit && !street && w.length >= 2 ? romaniseKorean(w) : null;
    const named = (text) => text.charAt(0).toUpperCase() + text.slice(1);
    if (placeAsked.size > 200) placeAsked.clear();
    placeAsked.set(w, unit ? new RegExp(`\\b${romaniseKorean(unit[1])}\\d*-${UNIT[unit[2]]}\\b`, 'i')
      // (중앙대로 is "Jungang-daero": the 대 belongs to the kind of road.)
      : street ? new RegExp(`\\b${street[2] === '로' && street[1].length > 2 && street[1].endsWith('대') ? `${romaniseKorean(street[1].slice(0, -1))}-daero` : `${romaniseKorean(street[1])}-${street[2] === '길' ? 'gil' : 'ro'}`}\\b`, 'i')
        : word ? new RegExp(`\\b${named(word)}\\b(?!-(?:dae)?ro|-gil|\\s(?:buk|nam|dong|seo)-ro|\\s+(?!Station)[A-Z])`) : null);
  }
  const said = placeAsked.get(w);
  return said !== null && (said.test(r.address?.value ?? '') || said.test(r.zone ?? ''));
}
function koAddressHas(r, w) { return koAddressWord(r, w, AREA_KO.has(w)) || koPlaceHas(r, w); }
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
  // An ingredient left out is read once, as typed (searchCore reads the rest
  // in Latin letters itself): read again, "no egg or fish" was "no egg fish",
  // which asked only that fish be named.
  if (leftOutQuery(query).items.length > 0) return false;
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
