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

/** The romanised area a typed word names, or null: "釜山" → "Busan". */
export const romanisedArea = (word) => TO_ROMAN.get(String(word ?? '').trim()) ?? null;

/**
 * A query with any area name it contains replaced by its romanisation, or
 * null if it contains none. Words are separated by spaces; a query with no
 * spaces ("明洞ハラール") is also checked for an area name at its start.
 */
export function romaniseQuery(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.flatMap((w) => {
    const whole = TO_ROMAN.get(w);
    if (whole) { changed = true; return [whole]; }
    for (const [name, roman] of TO_ROMAN) {
      if (w.length > name.length && w.startsWith(name)) { changed = true; return [roman, w.slice(name.length)]; }
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
