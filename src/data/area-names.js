import { ADDRESS_KO } from './address-ko.js';

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
  Busan: ['부산', '釜山', 'プサン', 'ブサン'],
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
  // Neighbourhoods a guidebook in Japanese or Chinese writes in its own
  // letters; the records' addresses hold the romanised word.
  Ikseon: ['益善洞'],
  Yeonnam: ['延南洞'],
  Jeonpo: ['田浦洞', '田浦'],
  Aewol: ['涯月'],
  Seongsan: ['城山日出峰', '城山'],
  Jagalchi: ['チャガルチ'],
  // Kinds of cooking, searched in the reader's own words for them: the
  // records say "temple" and "vegetarian".
  temple: ['사찰음식', '寺院料理', '寺庙料理', '寺廟料理', '寺刹料理', '精進料理', '寺庙', '寺廟', '寺院', '斋菜', '齋菜', '素斋', '素齋'],
  vegetarian: ['ベジタリアン', '素食', '蔬食', '吃素', '菜食', '채식', '채식주의'],
  cafe: ['カフェ', '咖啡店', '咖啡馆', '咖啡館', '咖啡廳', '咖啡厅', '카페'],
  bakery: ['ベーカリー', 'パン屋', '面包店', '麵包店', '빵집', '베이커리'],
  dessert: ['デザート', 'スイーツ', '甜点', '甜點', '甜品', '디저트'],
  cake: ['ケーキ', '蛋糕', '케이크'],
  coffee: ['コーヒー', '咖啡', '커피'],
  brunch: ['ブランチ', '早午餐', '브런치'],
  prayer: ['기도실', '礼拝室', '礼拜室', '祈祷室', '祈禱室'],
  mosque: ['모스크', 'モスク', '清真寺'],
  airport: ['공항', '空港', '机场', '機場'],
  // Kinds of kitchen, as the records' own lines name them in English.
  indonesian: ['인도네시아', 'インドネシア', '印度尼西亚', '印度尼西亞', '印尼'],
  indian: ['인도', 'インド', '印度'],
  turkish: ['터키', '튀르키예', 'トルコ', '土耳其'],
  // "nepal" finds Nepal, Nepali and Nepalese.
  nepal: ['네팔', 'ネパール', '尼泊尔', '尼泊爾'],
  // (No short Korean words here — 한식, 국수, 만두: a name is also matched
  // as the start of a longer word, and 한식당 became "korean 당".)
  korean: ['韓国料理', '韩国料理', '韓國料理', '韩餐'],
  japanese: ['和食', '日本料理'],
  chinese: ['中華料理', '中餐', '中国料理', '中國料理'],
  dumpling: ['餃子', '饺子', 'ギョーザ', 'マンドゥ'],
  kimchi: ['キムチ', '泡菜', '辛奇'],
  uzbek: ['우즈벡', '우즈베크', '우즈베키스탄', 'ウズベク', '乌兹别克', '烏茲別克'],
  breakfast: ['朝食', '朝ごはん', 'モーニング', '早餐', '早饭', '早飯', '아침식사', '아침'],
  // Dishes, by the names a reader types for them: the records, their
  // stories and their English menu lines say "bibimbap", "gimbap", "tofu".
  // ("ビビンバ" found nothing, with the word on screen in the menu glosses.)
  bibimbap: ['비빔밥', 'ビビンバ', 'ビビンパ', '石锅拌饭', '石鍋拌飯', '拌饭', '拌飯'],
  naengmyeon: ['冷麺', '冷面', '冷麵'],
  hanjeongsik: ['韓定食', '韩定食'],
  gimbap: ['김밥', 'キンパ', 'キムパプ', '紫菜包饭', '紫菜包飯'],
  tteokbokki: ['떡볶이', 'トッポッキ', 'トッポギ', '炒年糕'],
  sundubu: ['순두부', 'スンドゥブ', '嫩豆腐'],
  tofu: ['두부', '豆腐'],
  // (No one-character names here — '면', '麺': a name is also matched as the
  // start of a longer word, and 麵包 is bread, 면목동 a neighbourhood.)
  noodle: ['麺類', '面条', '麵條'],
  curry: ['카레', '커리', 'カレー', '咖喱', '咖哩'],
  burger: ['버거', '햄버거', 'バーガー', 'ハンバーガー', '汉堡', '漢堡'],
  pizza: ['피자', 'ピザ', '披萨', '披薩'],
  pasta: ['파스타', 'パスタ', '意大利面', '義大利麵'],
  salad: ['샐러드', 'サラダ', '沙拉'],
  sandwich: ['샌드위치', 'サンドイッチ', 'サンド', '三明治'],
  bagel: ['베이글', 'ベーグル', '贝果', '貝果'],
  kebab: ['케밥', 'ケバブ'],
  lamb: ['양고기', 'ラム肉', '羊肉'],
  buffet: ['뷔페', 'ビュッフェ', 'バイキング', '自助餐'],
  hanok: ['한옥마을', '한옥', '韓屋村', '韩屋村', '韓屋', '韩屋'],
  bbq: ['바비큐', '焼肉', '烤肉'],
  samgyetang: ['삼계탕', 'サムゲタン', '参鸡汤', '參雞湯', '蔘雞湯'],
  chicken: ['치킨', 'チキン', '炸鸡', '炸雞'],
  Jamsil: ['롯데월드', 'ロッテワールド', '乐天世界', '樂天世界'],
};

// The entries of ALSO_NAMED that are kinds of cooking, not places.
export const COOKING = new Set(['temple', 'vegetarian', 'cafe', 'bakery', 'dessert', 'cake', 'coffee', 'brunch', 'breakfast', 'prayer', 'mosque', 'indian', 'indonesian', 'turkish', 'nepal', 'uzbek', 'korean', 'japanese', 'chinese', 'dumpling', 'kimchi',
  'bibimbap', 'gimbap', 'tteokbokki', 'sundubu', 'tofu', 'noodle', 'curry', 'burger', 'pizza', 'pasta', 'salad', 'sandwich', 'bagel', 'kebab', 'lamb', 'buffet', 'hanok', 'bbq', 'samgyetang', 'chicken']);

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
  gimbab: 'gimbap',
  kimbab: 'gimbap',
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
  sarapan: 'breakfast',
  nepalese: 'nepal',
  mandu: 'dumpling',
  gyoza: 'dumpling',
  // What a Muslim traveller looks for besides the food, in Indonesian.
  musala: 'prayer',
  mushola: 'prayer',
  musholla: 'prayer',
  mushalla: 'prayer',
  masjid: 'mosque',
  sholat: 'prayer',
  shalat: 'prayer',
  salat: 'prayer',
  bandara: 'airport',
  uzbekistan: 'uzbek',
  turkey: 'turkish',
  turkiye: 'turkish',
  'türkiye': 'turkish',
  // Indonesian words for what the records say in English.
  roti: 'bread',
  kopi: 'coffee',
  kue: 'cake',
  kafe: 'cafe',
  manis: 'dessert',
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
const TOWNSHIP_SUFFIX = { '면': 'myeon', '읍': 'eup', '리': 'ri' };
let TOWNSHIPS = null;
const isTownship = (word) => {
  TOWNSHIPS ??= new Set(Object.values(ADDRESS_KO).flatMap(a => String(a).split(' ').filter(x => /[읍면리]$/.test(x))));
  return TOWNSHIPS.has(word);
};
// Only a city suffix narrows to the city: "제주도" and "济州岛" are the island.
const IS_CITY = new Set(['市', '시', '市内', '시내']);

const FILLER = new Set(['餐厅', '餐廳', '饭店', '飯店', '식당', '맛집', '음식점', '타워', 'レストラン', '店', 'restoran', 'toko', 'kedai', 'warung', 'rumah',
  // "halal food near Itaewon", "makanan halal dekat Itaewon", "釜山 ランチ":
  // asked as a question, every word had to be found in the record, and
  // "near" or "dekat" is in none.
  'near', 'nearby', 'in', 'at', 'around', 'the', 'food', 'restaurant', 'restaurants', 'places', 'lunch', 'dinner', 'breakfast',
  // "halal near me", "best vegan in seoul", "where to eat in busan": the
  // rest of a question. ("me" alone started "menu" and "meat" in the
  // stories, and "halal near me" was 58 places of the 152.)
  'me', 'my', 'best', 'top', 'good', 'great', 'where', 'to', 'eat', 'eating', 'find', 'for', 'a', 'an', 'some', 'any', 'and', 'or', 'with',
  // "ソウル ヴィーガン おすすめ", "首尔 素食 推荐", "restoran halal terbaik di
  // Seoul": the same words of a question in the other languages (each
  // found nothing: the word is in no record).
  // A whole sentence, as spoken to a phone: "where can i find halal in
  // myeongdong", "is there vegan food in jeju", "할랄 음식점 알려줘",
  // "明洞でハラールを食べたい", "釜山有清真吗", "ada halal di busan?".
  'can', 'i', 'is', 'there', 'are', 'show', 'want', 'looking', 'please', 'what', 'here', 'which', 'need',
  '추천해줘', '추천해주세요', '알려줘', '알려주세요', '있어', '있어요', '있나요', '먹을', '곳', '찾아줘', '어디야', '어디에', '어디서',
  'を', 'が', 'は', '食べたい', '食べられる', '教えて', 'ください', 'ありますか',
  '在', '吃', '想吃', '吗', '嗎', '请问', '請問', '哪儿',
  'cari', 'mencari', 'ada', 'ingin', 'mau', 'tolong', 'apa',
  'recommended', 'recommendation', 'recommendations', 'popular', 'famous', 'delicious', 'tasty',
  'おすすめ', 'オススメ', 'お勧め', '人気', '美味しい', 'おいしい', '有名', 'どこ', '近くの',
  '推荐', '推薦', '好吃', '哪里', '哪裡', '人气', '人氣', '有名的', '的',
  'terbaik', 'enak', 'rekomendasi', 'dimana', 'mana', 'yang', 'untuk', 'saya', 'terdekat', 'populer', 'terkenal',
  '맛있는', '유명한', '어디', '인기', '좋은',
  // …and the particles that glue an area to them: "ソウルでおすすめの…",
  // "서울에서 맛있는…", "首尔有什么好吃的…".
  'で', 'にある', 'に', '에서', '에', '의', '有什么', '有什麼', '有',
  'dekat', 'sekitar', 'di', 'makanan', 'masakan', 'makan', 'tempat', 'sini', 'terdekat',
  'ランチ', 'ディナー', 'グルメ', 'ごはん', '食事', '近く', '周辺', 'の', 'フード', '食品', '朝ごはん', 'モーニング', '朝食', '早餐', 'sarapan', '아침', '손님', '외국인',
  '附近', '美食', '午餐', '晚餐', '근처', '주변', '점심', '저녁', '밥집', '추천', '음식', '요리', '料理', 'cuisine']);

// Of those, the words of a question (not "restaurant", "food", "the", which
// many places carry in their names). A place whose own name has such a word
// — "Yang Good", "Great Himalaya" — is found by it: see search.js.
const QUESTION = new Set(['me', 'my', 'best', 'top', 'good', 'great', 'where', 'to', 'eat', 'eating', 'find', 'for', 'some', 'any', 'and', 'or', 'with',
  'can', 'i', 'is', 'there', 'are', 'show', 'want', 'looking', 'please', 'what', 'here', 'which', 'need', 'cari', 'ada', 'mau', 'apa',
  'recommended', 'popular', 'famous', 'delicious', 'tasty', 'terbaik', 'enak', 'mana', 'yang', 'untuk', 'saya']);
export const questionWords = (query) => String(query ?? '').toLowerCase().split(/\s+/).filter(w => QUESTION.has(w));

// The query without those words, for the checks that read it whole (is it
// a station?). The query itself when nothing would be left.
// "있어?", "busan?": the mark at the end of a question is not part of the word.
const bare = (word) => word.toLowerCase().replace(/[?!.,？！。]+$/, '');
export function stripFillers(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  const kept = words.filter(w => !FILLER.has(bare(w)));
  return kept.length > 0 && kept.length < words.length ? kept.join(' ') : String(query ?? '');
}
// Written without spaces ("釜山のランチ", "明洞附近美食"), such words follow
// the place's name one after another: peeled from the front, longest first.
const GLUED_FILLERS = [...FILLER].filter(w => /[\u0080-\uFFFF]/.test(w)).sort((a, b) => b.length - a.length);
const peel = (text) => {
  let rest = text;
  for (;;) {
    const f = GLUED_FILLERS.find(w => rest.startsWith(w));
    if (!f) return rest;
    rest = rest.slice(f.length);
  }
};

const GLUE_HEADS = new Set(['할랄', '비건', '채식', '무슬림', '清真', '纯素', '純素', '素食', '不含猪肉', '不含豬肉', 'ハラール', 'ハラル', 'ヴィーガン', 'ビーガン', '豚肉不使用']);
const peelEnd = (text) => {
  let rest = text;
  for (;;) {
    const f = GLUED_FILLERS.find(w => rest.length > w.length && rest.endsWith(w));
    if (!f) return rest;
    rest = rest.slice(0, -f.length);
  }
};

// "Suwon City", "Jeju Island", "Gyeonggi Province": after an area's name,
// the kind of place it is adds nothing ("Incheon City Hall" and "Suwon city
// centre" are other matters).
// "Jeju City" is Jeju-si, the city — not the island with Seogwipo in it.
const KIND_OF = new RegExp(`\\b(${Object.keys(AREAS).join('|')})\\s+(city|island|province)\\b(?!\\s+(?:hall|cent))`, 'gi');

export function romaniseQuery(query) {
  const asked = String(query ?? '');
  const named = asked.replace(KIND_OF, (whole, name, kind) => (kind.toLowerCase() === 'city' && [...SI_IN_ADDRESS].some(a => a.toLowerCase() === name.toLowerCase()) ? `${name}-si` : name));
  if (named !== asked) return romaniseQuery(named) ?? named;
  // NFKC: half-width kana (ﾌﾟｻﾝ) are the same names.
  const words = String(query ?? '').normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.flatMap((w) => {
    // "부산 맛집", "首尔 餐厅": a word for "restaurant" is no search term.
    if (FILLER.has(bare(w))) { changed = true; return []; }
    const whole = TO_ROMAN.get(w) ?? LATIN_VARIANTS.get(w.toLowerCase());
    if (whole) { changed = true; return [whole]; }
    // "noodles", "burgers", "dumplings": also the word without its
    // plural (a word is matched from its start, so "noodle" finds both;
    // "noodles" found 27 places of the 38).
    // Only a kind of food the map knows by name: from any word, "fries"
    // was "frie" (fried, friendly — 161 places) and "Las Vegas" was vegan.
    const one = /^[a-z]{3,}(?:ch|sh|x|ss)es$/i.test(w) ? w.slice(0, -2) : /^[a-z]{3,}[a-rt-z]s$/i.test(w) ? w.slice(0, -1) : null;
    if (one && (COOKING.has(one.toLowerCase()) || LATIN_VARIANTS.has(one.toLowerCase()))) { changed = true; return [one]; }
    for (const [name, roman] of TO_ROMAN) {
      if (w.length > name.length && w.startsWith(name)) {
        changed = true;
        const rest = w.slice(name.length);
        // "濟州市", "제주시": the city suffix is not a second word. Jeju's
        // addresses say "Jeju-si" (the island also holds Seogwipo-si), so
        // there the suffix narrows; elsewhere it is simply dropped.
        // "용산면", "대전면": a township that shares the name is its own
        // place (Yeongdong county, Damyang) — not Yongsan-gu, not Daejeon.
        // Only a township some record's address names: "수원리" and "제주읍"
        // are still Suwon and Jeju, and "두부면" (tofu noodles) is tofu.
        if (Object.hasOwn(TOWNSHIP_SUFFIX, rest) && isTownship(w)) return [`${roman}-${TOWNSHIP_SUFFIX[rest]}`];
        if (CITY_SUFFIX.has(rest)) return [SI_IN_ADDRESS.has(roman) && IS_CITY.has(rest) ? `${roman}-si` : roman];
        // What follows may be a name too ("首尔素食" is Seoul + vegetarian),
        // or a word that adds nothing ("素食餐厅", "롯데월드타워").
        const tail = peel(rest);
        if (tail === '') return [roman];
        // "明洞素食餐厅": read the remainder the same way, once more.
        const more = romaniseQuery(tail);
        return more !== null ? [roman, ...more.split(' ').filter(Boolean)] : [roman, tail];
      }
    }
    // "不含猪肉餐厅", "ハラールレストラン": such a word glued to the end of
    // any other is dropped too.
    // Only from a word known here — a diet, a kind of kitchen, an area:
    // from any word, a restaurant called "아빠의양식당" was also searched
    // as "아빠의양", and "한식당" as "한".
    // "近くのハラール", "附近的清真餐厅", "附近素食": the same words in front
    // of a diet or an area, written without a space — taken off the front,
    // then the end, when what is left is a word known here.
    const front = peel(w);
    if (front !== w && front !== '') {
      const inner = peelEnd(front) || front;
      if (GLUE_HEADS.has(inner) || TO_ROMAN.has(inner) || LATIN_VARIANTS.has(inner.toLowerCase())) { changed = true; return [TO_ROMAN.get(inner) ?? inner]; }
      // "在明洞吃清真": an area follows, and more after it.
      const more = romaniseQuery(front);
      if (more !== null) { changed = true; return more.split(' ').filter(Boolean); }
    }
    // "ヴィーガンカフェ", "비건카페", "清真咖啡店": a diet and a kind of place in
    // one word are two words.
    for (const diet of GLUE_HEADS) {
      if (w.length > diet.length && w.startsWith(diet) && TO_ROMAN.has(w.slice(diet.length))) { changed = true; return [diet, TO_ROMAN.get(w.slice(diet.length))]; }
    }
    const head = peelEnd(w);
    if (head !== w && (GLUE_HEADS.has(head) || TO_ROMAN.has(head) || LATIN_VARIANTS.has(head.toLowerCase()))) { changed = true; return [head]; }
    return [w];
  });
  // Nothing but such words ("restaurant"): no other reading to offer.
  return changed && out.length > 0 ? out.join(' ') : null;
}

export const AREA_NAMES = AREAS;
// Is this text, whole, the name of an area the map lists (in any script)?
const LISTED = new Set(Object.keys(AREAS).map(k => k.toLowerCase()));
export const isListedArea = (text) => { const t = String(text ?? '').trim(); return LISTED.has(t.toLowerCase()) || Object.hasOwn(AREAS, TO_ROMAN.get(t) ?? ''); };

// The name an area is shown by in "Browse by area" (Discover), for readers
// of Japanese and Chinese: 明洞 is read at a glance where "Myeongdong" is
// sounded out. Each is one of the written forms above — the test holds
// that — and an area not listed here shows romanised, as before. The
// rows are the twelve areas with the most places, so the list runs past
// today's twelve.
const SHOWN = {
  ja: { Seoul: 'ソウル', Gyeonggi: '京畿', Jeju: '済州', Jongno: '鍾路', Mapo: '麻浦', Busan: '釜山', Suwon: '水原', Incheon: '仁川', Gangnam: '江南', Jeonju: '全州', Yongsan: '龍山', Daegu: '大邱', Itaewon: '梨泰院', Ansan: '安山', Myeongdong: '明洞', Dongdaemun: '東大門', Gwangju: '光州', Seongsu: '聖水', Gangwon: '江原', Daejeon: '大田', Seogwipo: '西帰浦', Ulsan: '蔚山', Hongdae: '弘大', Suncheon: '順天', Insadong: '仁寺洞', Sinchon: '新村', Yongin: '龍仁', Jamsil: '蚕室' },
  'zh-Hans': { Seoul: '首尔', Gyeonggi: '京畿', Jeju: '济州', Jongno: '钟路', Mapo: '麻浦', Busan: '釜山', Suwon: '水原', Incheon: '仁川', Gangnam: '江南', Jeonju: '全州', Yongsan: '龙山', Daegu: '大邱', Itaewon: '梨泰院', Ansan: '安山', Myeongdong: '明洞', Dongdaemun: '东大门', Gwangju: '光州', Seongsu: '圣水', Gangwon: '江原', Daejeon: '大田', Seogwipo: '西归浦', Ulsan: '蔚山', Hongdae: '弘大', Suncheon: '顺天', Insadong: '仁寺洞', Sinchon: '新村', Yongin: '龙仁', Jamsil: '蚕室' },
  'zh-Hant': { Seoul: '首爾', Gyeonggi: '京畿', Jeju: '濟州', Jongno: '鍾路', Mapo: '麻浦', Busan: '釜山', Suwon: '水原', Incheon: '仁川', Gangnam: '江南', Jeonju: '全州', Yongsan: '龍山', Daegu: '大邱', Itaewon: '梨泰院', Ansan: '安山', Myeongdong: '明洞', Dongdaemun: '東大門', Gwangju: '光州', Seongsu: '聖水', Gangwon: '江原', Daejeon: '大田', Seogwipo: '西歸浦', Ulsan: '蔚山', Hongdae: '弘大', Suncheon: '順天', Insadong: '仁寺洞', Sinchon: '新村', Yongin: '龍仁', Jamsil: '蠶室' },
};
export const AREA_SHOWN = SHOWN;
export const shownArea = (area, language) => (language === 'ko' ? AREAS[area]?.[0] : SHOWN[language]?.[area]) ?? area;

// Areas offered as suggestions under the search box (FilterBar): the cities
// and districts with the most places, so a first-time visitor sees that
// the map is nationwide and what can be typed. Korean readers get the
// Korean name (always the first in each list above); everyone else the
// romanised one, which is what the records and street signs use.
const SUGGESTED = ['Seoul', 'Itaewon', 'Myeongdong', 'Hongdae', 'Gangnam', 'Insadong', 'Seongsu',
  'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Jeju', 'Suwon', 'Jeonju', 'Gyeongju', 'Gangneung', 'Ansan'];
// …and readers of Japanese and Chinese theirs: typing "济" found no
// suggestion in a list that was all Latin letters. In the order of
// SUGGESTED; each is also in AREAS above, so it searches as the area.
const SUGGESTED_IN = {
  // Neighbourhoods in kana, as they are typed in Japanese; cities in kanji.
  ja: ['ソウル', 'イテウォン', 'ミョンドン', 'ホンデ', 'カンナム', 'インサドン', 'ソンス', '釜山', '仁川', '大邱', '大田', '光州', '蔚山', '済州', '水原', '全州', '慶州', '江陵', '安山'],
  'zh-Hans': ['首尔', '梨泰院', '明洞', '弘大', '江南', '仁寺洞', '圣水', '釜山', '仁川', '大邱', '大田', '光州', '蔚山', '济州', '水原', '全州', '庆州', '江陵', '安山'],
  'zh-Hant': ['首爾', '梨泰院', '明洞', '弘大', '江南', '仁寺洞', '聖水', '釜山', '仁川', '大邱', '大田', '光州', '蔚山', '濟州', '水原', '全州', '慶州', '江陵', '安山'],
};
export const areaSuggestions = (lang) => SUGGESTED_IN[lang] ?? SUGGESTED.map(a => (lang === 'ko' ? AREAS[a][0] : a));
