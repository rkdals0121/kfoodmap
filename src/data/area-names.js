// Place names as a visitor types them. The records hold areas in English
// romanisation ("Myeongdong, Seoul"); someone using the app in Japanese,
// Chinese or Korean types 明洞, ソウル or 부산. Each entry maps the names a
// reader may type to the romanised word the records use, so the search
// finds the same places either way (src/filters.js).
//
// Only well-known cities and districts, in their standard written forms
// (Korean; Japanese kanji and kana; Simplified and Traditional Chinese).
// This is a search aid, not a fact about any place.
const AREAS = {
  Seoul: ['서울', 'ソウル', '首尔', '首爾'],
  Busan: ['부산', '釜山', 'プサン'],
  Incheon: ['인천', '仁川', 'インチョン'],
  Daegu: ['대구', '大邱', 'テグ'],
  Daejeon: ['대전', '大田', 'テジョン'],
  Gwangju: ['광주', '光州', 'クァンジュ'],
  Ulsan: ['울산', '蔚山', 'ウルサン'],
  Jeju: ['제주', '済州', '济州', '濟州', 'チェジュ'],
  Seogwipo: ['서귀포', '西帰浦', '西归浦', '西歸浦', 'ソギポ'],
  Suwon: ['수원', '水原', 'スウォン'],
  Jeonju: ['전주', '全州', 'チョンジュ'],
  Gyeongju: ['경주', '慶州', '庆州', 'キョンジュ'],
  Gangneung: ['강릉', '江陵', 'カンヌン'],
  Ansan: ['안산', '安山', 'アンサン'],
  Suncheon: ['순천', '順天', '顺天'],
  Gimhae: ['김해', '金海'],
  Yongin: ['용인', '龍仁', '龙仁'],
  Gyeonggi: ['경기', '京畿'],
  Gangwon: ['강원', '江原'],
  Itaewon: ['이태원', '梨泰院', 'イテウォン'],
  Myeongdong: ['명동', '明洞', 'ミョンドン'],
  Hongdae: ['홍대', '弘大', 'ホンデ'],
  Gangnam: ['강남', '江南', 'カンナム'],
  Gyeongbokgung: ['경복궁', '景福宮', '景福宫', 'キョンボックン'],
  Jamsil: ['잠실', '蚕室', '蠶室', 'チャムシル'],
  Insadong: ['인사동', '仁寺洞', 'インサドン'],
  Jongno: ['종로', '鍾路', '钟路', '鐘路', 'チョンノ'],
  Seongsu: ['성수', '聖水', '圣水', 'ソンス'],
  Dongdaemun: ['동대문', '東大門', '东大门', 'トンデムン'],
  Sinchon: ['신촌', '新村', 'シンチョン'],
  Mapo: ['마포', '麻浦', 'マポ'],
  Yongsan: ['용산', '龍山', '龙山', 'ヨンサン'],
  Haeundae: ['해운대', '海雲台', '海云台', '海雲臺', 'ヘウンデ'],
  Seomyeon: ['서면', '西面', 'ソミョン'],
};

const TO_ROMAN = new Map(
  Object.entries(AREAS).flatMap(([roman, names]) => names.map(n => [n, roman])),
);

// Older and informal Latin spellings still on maps, guidebooks and signs
// from before the 2000 Revised Romanization ("Pusan", "Cheju") or written
// by ear ("Myungdong"), mapped to the spelling the records use. Matched
// whole-word and case-blind; the query as typed is always tried first.
const LATIN_VARIANTS = new Map(Object.entries({
  // Dishes, in the other spellings in use: the records write "gimbap" in
  // some places and "kimbap" in others, and a visitor types either.
  kimbap: 'gimbap',
  gimbap: 'kimbap',
  ddukbokki: 'tteokbokki',
  dukbokki: 'tteokbokki',
  topokki: 'tteokbokki',
  tteokbokki: 'topokki',
  bibimbop: 'bibimbap',
  chapchae: 'japchae',
  mandoo: 'mandu',
  chigae: 'jjigae',
  kimchee: 'kimchi',
  pusan: 'Busan',
  inchon: 'Incheon',
  taegu: 'Daegu',
  taejon: 'Daejeon',
  kwangju: 'Gwangju',
  cheju: 'Jeju',
  sogwipo: 'Seogwipo',
  chonju: 'Jeonju',
  kyongju: 'Gyeongju',
  kyeongju: 'Gyeongju',
  kangnung: 'Gangneung',
  kangneung: 'Gangneung',
  kangnam: 'Gangnam',
  myungdong: 'Myeongdong',
  myeongdong: 'Myeongdong',
  jongro: 'Jongno',
  chongno: 'Jongno',
  shinchon: 'Sinchon',
  sungsu: 'Seongsu',
  seongsoo: 'Seongsu',
  dongdaemoon: 'Dongdaemun',
  haewundae: 'Haeundae',
  yongsan: 'Yongsan',
}).filter(([v, roman]) => v !== roman.toLowerCase()));

// A slip of one letter in a long area name ("myongdong", "itaewan",
// "hongdea" is two, and is not guessed): six letters or more, Latin only,
// exactly one edit from a name the records use. Short names are left alone
// — one letter off "Mapo" or "Jeju" is too often another word.
const ROMAN_LOWER = Object.keys(AREAS).map(a => [a.toLowerCase(), a]);
const oneEditApart = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const rest = (s, n) => s.slice(n);
  return a.length === b.length
    ? rest(a, i + 1) === rest(b, i + 1)
    : a.length > b.length ? rest(a, i + 1) === rest(b, i) : rest(a, i) === rest(b, i + 1);
};
const nearArea = (word) => {
  const w = word.toLowerCase();
  if (w.length < 6 || !/^[a-z]+$/.test(w)) return null;
  const hits = ROMAN_LOWER.filter(([lower]) => lower.length >= 6 && oneEditApart(w, lower));
  return hits.length === 1 ? hits[0][1] : null;
};

/**
 * The query with a near-miss area name corrected ("myongdong vegan" →
 * "Myeongdong vegan"), or null when no word is one. NOT part of the
 * ordinary search: "mangwon", "icheon" and "yangsan" are real places one
 * letter from Gangwon, Incheon and Yongsan, and guessing on every search
 * mixed two regions. App.jsx uses this only when the search as typed finds
 * nothing at all.
 */
export function fuzzyQuery(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.map((w) => { const near = nearArea(w); if (near) { changed = true; return near; } return w; });
  return changed ? out.join(' ') : null;
}

/** The romanised area a typed word names, or null: "釜山" → "Busan". */
export const romanisedArea = (word) => TO_ROMAN.get(String(word ?? '').trim()) ?? null;

/**
 * A query with any area name it contains replaced by its romanisation, or
 * null if it contains none. Words are separated by spaces; a query with no
 * spaces ("明洞ハラール") is also checked for an area name at its start.
 */
const CITY_SUFFIX = new Set(['市', '시', '市内', '시내']);
const SI_IN_ADDRESS = new Set(['Jeju']);

export function romaniseQuery(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.flatMap((w) => {
    const whole = TO_ROMAN.get(w) ?? LATIN_VARIANTS.get(w.toLowerCase());
    if (whole) { changed = true; return [whole]; }
    for (const [name, roman] of TO_ROMAN) {
      if (w.length > name.length && w.startsWith(name)) {
        changed = true;
        const rest = w.slice(name.length);
        // "濟州市", "제주시": the city suffix is not a second word. Jeju's
        // addresses say "Jeju-si" (the island also holds Seogwipo-si), so
        // there the suffix narrows; elsewhere it is simply dropped.
        if (CITY_SUFFIX.has(rest)) return [SI_IN_ADDRESS.has(roman) ? `${roman}-si` : roman];
        return [roman, rest];
      }
    }
    return [w];
  });
  return changed ? out.join(' ') : null;
}

export const AREA_NAMES = AREAS;

// Areas offered as suggestions under the search box (FilterBar): the cities
// and districts with the most places, so a first-time visitor sees that
// the map is nationwide and what can be typed. Korean readers get the
// Korean name (always the first in each list above); everyone else the
// romanised one, which is what the records and street signs use.
const SUGGESTED = ['Seoul', 'Itaewon', 'Myeongdong', 'Hongdae', 'Gangnam', 'Insadong', 'Seongsu',
  'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Jeju', 'Suwon', 'Jeonju', 'Gyeongju', 'Gangneung', 'Ansan'];
export const areaSuggestions = (lang) => SUGGESTED.map(a => (lang === 'ko' ? AREAS[a][0] : a));
