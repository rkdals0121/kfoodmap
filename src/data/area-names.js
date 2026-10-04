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

// Names worth reading in other scripts that are not areas of their own in
// the app (no guide page, no "Browse by area" link): stations and sights a
// visitor searches by, each given as the word the records use.
const ALSO_NAMED = {
  Anguk: ['안국', '安国', '安國'],
  'City Hall': ['시청', '市庁', '市厅', '市廳'],
  Mangwon: ['망원', '望遠', '望远'],
  Bukchon: ['북촌', '北村'],
  Namsan: ['남산', '南山'],
  COEX: ['코엑스'],
  Gwangalli: ['광안리', '広安里', '广安里', '廣安里', 'クァンアンリ'],
  Nampo: ['남포동', '남포', '南浦洞', '南浦', 'ナンポドン'],
  // Kinds of cooking, searched in the reader's own words for them: the
  // records say "temple" and "vegetarian".
  temple: ['사찰음식', '寺院料理', '寺庙料理', '寺廟料理', '寺刹料理', '精進料理', '寺庙', '寺廟', '斋菜', '齋菜'],
  vegetarian: ['ベジタリアン', '素食', '菜食', '채식'],
  cafe: ['カフェ', '咖啡店', '咖啡馆', '咖啡館', '咖啡廳', '카페'],
  bakery: ['ベーカリー', 'パン屋', '面包店', '麵包店', '빵집', '베이커리'],
  dessert: ['デザート', 'スイーツ', '甜点', '甜點', '甜品', '디저트'],
  cake: ['ケーキ', '蛋糕', '케이크'],
  coffee: ['コーヒー', '咖啡', '커피'],
  Jamsil: ['롯데월드', 'ロッテワールド', '乐天世界', '樂天世界'],
};

// The entries of ALSO_NAMED that are kinds of cooking, not places.
export const COOKING = new Set(['temple', 'vegetarian', 'cafe', 'bakery', 'dessert', 'cake', 'coffee']);

const TO_ROMAN = new Map([
  ...Object.entries(AREAS).flatMap(([roman, names]) => names.map(n => [n, roman])),
  ...Object.entries(ALSO_NAMED).flatMap(([roman, names]) => names.map(n => [n, roman])),
]);

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
  // Indonesian words for what the records say in English.
  roti: 'bread',
  kopi: 'coffee',
  kue: 'cake',
  kafe: 'cafe',
  manis: 'dessert',
  restoran: 'restaurant',
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
// …nor is a province, district or neighbourhood suffix ("제주도", "강남구",
// "성수동"), nor "입구" on a station's name ("홍대입구").
const CITY_SUFFIX = new Set(['市', '시', '市内', '시내', '도', '道', '구', '區', '区', '동', '洞', '입구', '入口', '岛', '島']);
const SI_IN_ADDRESS = new Set(['Jeju']);
// Only a city suffix narrows to the city: "제주도" and "济州岛" are the island.
const IS_CITY = new Set(['市', '시', '市内', '시내']);

const FILLER = new Set(['餐厅', '餐廳', '饭店', '飯店', '식당', '맛집', '음식점', '타워', 'レストラン', '店']);

export function romaniseQuery(query) {
  // NFKC: half-width kana (ﾌﾟｻﾝ) are the same names.
  const words = String(query ?? '').normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.flatMap((w) => {
    // "부산 맛집", "首尔 餐厅": a word for "restaurant" is no search term.
    if (FILLER.has(w)) { changed = true; return []; }
    const whole = TO_ROMAN.get(w) ?? LATIN_VARIANTS.get(w.toLowerCase());
    if (whole) { changed = true; return [whole]; }
    for (const [name, roman] of TO_ROMAN) {
      if (w.length > name.length && w.startsWith(name)) {
        changed = true;
        const rest = w.slice(name.length);
        // "濟州市", "제주시": the city suffix is not a second word. Jeju's
        // addresses say "Jeju-si" (the island also holds Seogwipo-si), so
        // there the suffix narrows; elsewhere it is simply dropped.
        if (CITY_SUFFIX.has(rest)) return [SI_IN_ADDRESS.has(roman) && IS_CITY.has(rest) ? `${roman}-si` : roman];
        // What follows may be a name too ("首尔素食" is Seoul + vegetarian),
        // or a word that adds nothing ("素食餐厅", "롯데월드타워").
        if (FILLER.has(rest)) return [roman];
        // "明洞素食餐厅": read the remainder the same way, once more.
        const more = romaniseQuery(rest);
        return more !== null ? [roman, ...more.split(' ').filter(Boolean)] : [roman, rest];
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
