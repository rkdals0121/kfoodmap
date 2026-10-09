// src/search.js against the real records. Counts change as places are
// added, so these assert relations — two spellings find the same places, a
// fallback names what it did — not numbers. Each case is a search that once
// went wrong (docs/MOBILE-AUDIT-2026-10-04.ko.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';
import { searchPlaces, stationOf, MAX_QUERY } from '../../src/search.js';

const places = restaurants.filter(r => !isQuarantined(r));
const go = (query, filters = []) => searchPlaces({ places, query, filters });
const ids = (r) => r.filteredRestaurants.map(p => p.id).sort().join(',');

test('a station is read in every way it is written', () => {
  assert.deepEqual(stationOf('Seoul Station'), { area: 'Seoul', phrase: 'Seoul station' });
  for (const q of ['Seoul Station exit 1', 'seoul stn', 'seoul stn.', '서울역', '서울 역', '서울역 1번 출구', '首尔站', 'ソウル駅']) {
    assert.equal(stationOf(q)?.area.toLowerCase(), 'seoul', q);
  }
  assert.equal(stationOf('홍대입구역')?.area, 'Hongdae');
  assert.equal(stationOf('弘大入口站')?.area, 'Hongdae');
  // Seaweed and trade end in 역 and are not stations.
  assert.equal(stationOf('미역'), null);
  assert.equal(stationOf('무역'), null);
  assert.equal(stationOf('Itaewon'), null);
  assert.equal(stationOf('subway station'), null);
});

test('a station finds the same places however it is written', () => {
  const base = go('Seoul Station');
  assert.ok(base.filteredRestaurants.length > 0 && base.filteredRestaurants.length < 20, 'the station, not the city');
  for (const q of ['Seoul Station exit 1', 'seoul stn', '서울역', '서울 역', '서울역 1번 출구', '首尔站']) {
    assert.equal(ids(go(q)), ids(base), q);
    assert.equal(go(q).matchQuery, 'Seoul Station', q);
  }
});

test('a station whose places fall outside the chips: the nearest that match, from the station', () => {
  const r = go('Seoul Station', ['Halal']);
  // Not every halal place in Seoul.
  assert.ok(r.filteredRestaurants.length < 10);
  if (r.filteredRestaurants.length === 0) {
    assert.ok(r.nearest.length > 0);
    assert.equal(r.nearestFrom, 'Seoul Station');
    assert.ok(r.nearest.every(x => x.km <= 4));
  }
});

test('chips emptying a search are no reason to guess another area', () => {
  // Mangwon is one letter from Gangwon and has no halal place on record.
  const r = go('Mangwon', ['Halal']);
  assert.equal(r.matchQuery, 'Mangwon');
  assert.ok(r.filteredRestaurants.every(p => !/Gangwon/i.test(p.zone)));
  // The typo is still read when the word finds nothing at all.
  assert.equal(go('myongdong').matchQuery, 'Myeongdong');
  assert.equal(go('myongdong station').matchQuery, 'Myeongdong');
});

test('nearest matches are measured from the area searched, never from a shared word', () => {
  const r = go('Haeundae', ['Halal']);
  if (r.filteredRestaurants.length === 0 && r.nearest.length > 0) {
    assert.equal(r.nearestFrom, 'Haeundae');
    assert.ok(r.nearest.every(x => /Busan/.test(x.place.zone)), 'Haeundae is in Busan');
  }
  // "cafe" is in a street's name; that street is not where to measure from.
  assert.notEqual(go('cafe', ['Halal']).nearestFrom, 'cafe');
});

test('spellings, widths, accents and punctuation', () => {
  const itaewon = ids(go('Itaewon'));
  for (const q of ['ｉｔａｅｗｏｎ', 'İtaewon', 'Itaewon.', '이태원', '梨泰院']) assert.equal(ids(go(q)), itaewon, q);
  assert.equal(ids(go('café')), ids(go('cafe')));
  assert.equal(ids(go('kimbap')), ids(go('gimbap')));
  assert.equal(ids(go('no pork')), ids(go('pork-free')));
  assert.equal(ids(go('pork free')), ids(go('pork-free')));
  assert.ok(go('Seoul, Itaewon').filteredRestaurants.length > 0);
  assert.ok(go('Itaewon, Seoul').filteredRestaurants.length >= go('Itaewon').filteredRestaurants.length);
  assert.equal(ids(go('홍대입구')), ids(go('Hongdae')));
  assert.equal(ids(go('Lotte World Tower')), ids(go('Lotte World')));
  // The island is not the city: 제주도 and 济州岛 are all of Jeju.
  for (const q of ['제주도', '济州岛', '済州島']) assert.equal(ids(go(q)), ids(go('Jeju')), q);
  assert.ok(go('濟州市').filteredRestaurants.length < go('Jeju').filteredRestaurants.length);
  assert.equal(ids(go('寺院料理')), ids(go('temple')));
  assert.equal(ids(go('広安里')), ids(go('Gwangalli')));
});

test('a place looked up by a name that ends in "Station" is that place', () => {
  const r = go('Kervan Famille Station');
  assert.equal(r.filteredRestaurants.length, 1);
  assert.equal(r.matchQuery, 'Kervan Famille Station');
});

test('nothing typed, or only signs, is every place; a page of pasted text does not throw', () => {
  for (const q of ['', ' ', '(', '-', '.']) assert.equal(go(q).filteredRestaurants.length, places.length, JSON.stringify(q));
  assert.doesNotThrow(() => go('x'.repeat(9000)));
  assert.doesNotThrow(() => go('ab '.repeat(4000)));
  for (const q of ['?', '\\', '*', '.*', '[', '$', '^', '+', '|', 'constructor', '__proto__']) assert.doesNotThrow(() => go(q), q);
  assert.ok(MAX_QUERY <= 100);
});

test('the count of places hidden for having no hours matches the list', () => {
  const now = new Date(Date.UTC(2026, 9, 5, 3, 0)); // Monday noon in Korea
  for (const q of ['', 'Itaewon', 'Seoul Station', '서울역']) {
    const off = searchPlaces({ places, query: q, filters: ['Halal', 'Open now'], openOn: true, now });
    const on = searchPlaces({ places, query: q, filters: ['Halal', 'Open now'], openOn: true, includeUnknown: true, now });
    assert.equal(on.filteredRestaurants.length - off.filteredRestaurants.length, off.unknownHours, q);
  }
});

test('a kind of cooking is searched, and is not an area', async () => {
  const { matchesArea, matchesAreaWhole } = await import('../../src/filters.js');
  assert.ok(go('사찰음식').filteredRestaurants.length > 1);
  for (const q of ['temple', '사찰음식', '寺院料理']) {
    assert.equal(places.some(r => matchesArea(r, q)), false, q);
    assert.equal(places.some(r => matchesAreaWhole(r, q)), false, q);
  }
  // A name after an area, and words that add nothing.
  assert.ok(go('首尔素食').filteredRestaurants.length > 0);
  const tower = go('롯데월드타워').filteredRestaurants;
  assert.ok(go('Lotte World').filteredRestaurants.every(p => tower.includes(p)));
  assert.equal(ids(go('ﾌﾟｻﾝ')), ids(go('Busan')));
  // A word for "restaurant" is dropped wherever it stands.
  for (const q of ['부산 맛집', '부산맛집', '釜山 レストラン']) assert.equal(ids(go(q)), ids(go('Busan')), q);
  assert.ok(go('明洞素食餐厅').filteredRestaurants.length > 0);
  // A question's small words are not required of the record.
  const n = (q) => go(q).filteredRestaurants.length;
  assert.ok(n('halal food near Itaewon') >= n('halal Itaewon'));
  assert.ok(n('makanan halal dekat Itaewon') >= n('halal Itaewon'));
  assert.ok(n('restaurants in Hongdae') >= n('Hongdae'));
  assert.ok(n('釜山 ランチ') >= n('Busan'));
  assert.equal(n('ブサン'), n('Busan'));
  assert.equal(n('不含猪肉餐厅'), n('不含猪肉'));
  assert.equal(n('ハラールレストラン'), n('ハラール'));
  // …but a name that merely ends so is searched as it is.
  const { romaniseQuery: roman } = await import('../../src/data/area-names.js');
  assert.equal(roman('아빠의양식당'), null);
  // (한식당 was once read as "한" with the 식당 taken off; it is now a word the
  // map knows whole: Korean food.)
  assert.equal(roman('한식당'), 'korean');
  assert.equal(roman('양식당'), null);
  // A layover's words.
  assert.ok(n('musala') > 0 && n('musala') === n('prayer'));
  assert.equal(n('기도실'), n('prayer'));
  assert.equal(n('masjid'), n('mosque'));
  assert.equal(n('bandara'), n('airport'));
  // A two-word diet phrase among other words is still the diet, never the
  // two words apart: nothing that serves pork under "no pork".
  const got = (q, f = []) => searchPlaces({ places, query: q, filters: f, now: new Date() }).filteredRestaurants;
  for (const q of ['seoul no pork', 'no pork belly', 'busan no pork']) {
    for (const r of got(q, ['Halal'])) assert.equal(r.dietary?.halal?.value, 'porkFree', `${q}: ${r.id}`);
  }
  assert.equal(n('서울 돼지고기 없는 식당'), n('Seoul pork-free'));
  assert.equal(n('이태원 무슬림 프렌들리'), n('이태원 할랄'));
  assert.equal(n('인도네시아 음식'), n('indonesian'));
  assert.ok(n('indonesian') > 0 && n('네팔') === n('nepal'));
  // As a Korean host types.
  assert.equal(n('돼지고기 없는 식당'), n('pork-free'));
  assert.equal(n('무슬림 프렌들리'), n('halal'));
  assert.equal(n('이태원 할랄 맛집 추천'), n('이태원 할랄'));
  assert.ok(n('인도 음식') >= 10 && n('인도 음식') === n('indian'));
  // "pork-free" typed with the Halal chip on is the pork-free places, as the note says.
  assert.equal(searchPlaces({ places, query: 'pork-free', filters: ['Halal'], now: new Date() }).filteredRestaurants.length, n('pork-free'));
  // A town with places but none halal: the nearest halal ones, not a dead end.
  assert.ok(searchPlaces({ places, query: 'Gyeongju', filters: ['Halal'], now: new Date() }).nearest.length > 0);
  assert.ok(searchPlaces({ places, query: 'Seogwipo', filters: ['Halal'], now: new Date() }).nearest.length > 0);
  // A district name six cities share has no middle to measure from.
  assert.equal(searchPlaces({ places, query: 'Seo-gu', filters: ['Halal', 'Vegan'], now: new Date() }).nearest.length, 0);
  assert.equal(searchPlaces({ places, query: 'Seoul pork-free', filters: ['Halal'], now: new Date() }).filteredRestaurants.length, n('Seoul pork-free'));
  // …and a station stays a station with them around it.
  assert.equal(ids(go('near Seoul Station')), ids(go('Seoul Station')));
  assert.equal(ids(go('서울역 근처')), ids(go('서울역')));
  assert.equal(ids(go('서울역 근처 맛집')), ids(go('서울역')));
  assert.ok(n('rumah makan halal Itaewon') >= n('halal Itaewon'));
  assert.equal(n('釜山のランチ'), n('Busan'));
  assert.equal(n('明洞附近美食'), n('明洞'));
  // Two neighbourhoods in one search: the places in either.
  assert.ok(n('Haeundae Seomyeon') >= Math.max(n('Haeundae'), n('Seomyeon')) && n('Haeundae Seomyeon') > 0);
  assert.equal(n('海雲台 西面'), n('Haeundae Seomyeon'));
});

test('a name with its own punctuation, and a lone sight, are found', () => {
  assert.equal(go('A.A.A').filteredRestaurants.length, 1);
  const tower = go('N Seoul Tower', ['Halal']);
  if (tower.filteredRestaurants.length === 0) assert.ok(tower.nearest.length > 0, 'nearest from the tower');
  assert.equal(go('🍜').filteredRestaurants.length, 0);
});

test('one search stays quick', () => {
  const t0 = performance.now();
  for (const q of ['Seoul Station', 'Haeundae', 'zzzqqq', 'vegan restaurant near seoul station open now please']) go(q, ['Halal']);
  // Generous: a slow CI machine, four searches. It was 400 ms before the
  // text matches were shared between the fallbacks.
  assert.ok(performance.now() - t0 < 1500);
});

test('"N without the filters" is the number the same search shows with the chips off', () => {
  for (const [q, f] of [['Seoul Station', ['Vegan', 'Halal']], ['Plant Cafe', ['Halal', 'Vegan']], ['cake', ['Halal']], ['korean bbq', ['Vegan', 'Halal']]]) {
    const r = go(q, f);
    if (r.filteredRestaurants.length === 0) assert.equal(r.withoutFilters, go(q).filteredRestaurants.length, q);
  }
  // The reader's own lists are not filters to suggest dropping.
  assert.equal(searchPlaces({ places, query: 'itaewon', filters: ['Saved'], bookmarkedIds: [] }).withoutFilters, 0);
  // Words for "restaurant" add nothing, in Indonesian too.
  assert.equal(ids(go('restoran halal')), ids(go('halal')));
  assert.equal(ids(go('咖啡厅')), ids(go('cafe')));
});

test('the suggestions under the search box search as the areas they name, in every language', async () => {
  const { areaSuggestions, romaniseQuery } = await import('../../src/data/area-names.js');
  const en = areaSuggestions('en');
  for (const lang of ['ja', 'zh-Hans', 'zh-Hant', 'ko']) {
    const names = areaSuggestions(lang);
    assert.equal(names.length, en.length, lang);
    names.forEach((name, i) => assert.equal(romaniseQuery(name), en[i], `${lang} ${name}`));
  }
});

// The Korean address is matched by its own words, whole — as a substring
// "광주" found every address in Jeollanam-do (written under
// "전남광주통합특별시"), "대구" found Busan's 해운대구, and "층" most of the map.
test('a Korean address word finds its own district, not one that contains it', async () => {
  const { koAddressHas, koArea } = await import('../../src/data/address-ko.js');
  const { restaurants: all } = await import('../../src/data/restaurants.js');
  const areasOf = (word) => new Set(all.filter(r => koAddressHas(r, word)).map(r => koArea(r)));
  for (const a of areasOf('광주')) assert.match(a, /^(광주 |경기 광주시)/, a);
  for (const a of areasOf('대구')) assert.match(a, /^대구 /, a);
  for (const a of areasOf('동구')) assert.match(a, / 동구$/, a);
  assert.ok(areasOf('용산구').has('서울 용산구'));
  assert.ok(all.some(r => koAddressHas(r, '이태원로')), 'a road is found without its side-street number');
  for (const word of ['층', '로', '구', '1층', '지하']) assert.equal(all.filter(r => koAddressHas(r, word)).length, 0, word);
});

// An area's name is answered by where a place is (or what it is called):
// "itaewon vegan" listed a shop whose story says it "moved from Itaewon".
test('an area word does not match a place that only mentions the area', () => {
  const active = restaurants.filter(r => !isQuarantined(r));
  const found = searchPlaces({ places: active, query: 'itaewon vegan', filters: [] }).filteredRestaurants;
  assert.ok(found.length >= 5);
  for (const r of found) assert.match(`${r.zone} ${r.address?.value ?? ''} ${r.name}`, /itaewon|hannam|yongsan/i, r.id);
  assert.ok(!found.some(r => r.id === 'nono-shop'), 'Nono Shop moved to Hoehyeon');
});

// "hongdae halal" listed six vegan bakeries with no halal reading: the
// Hongdae alias answered for the whole search, and "halal" was looked for
// in stories that say "not halal" (live audit, 2026-10-07).
test('a diet word beside an area is answered from the record', async () => {
  const { matchesDietary } = await import('../../src/data/verification.js');
  for (const q of ['hongdae halal', 'ホンデ ハラール', '弘大 清真', 'seomyeon halal', 'itaewon halal']) {
    const found = go(q).filteredRestaurants;
    for (const r of found) assert.ok(matchesDietary(r, 'Halal') || /halal/i.test(r.name), `${q}: ${r.id}`);
  }
  assert.ok(go('hongdae halal').filteredRestaurants.length >= 3);
  assert.ok(go('hongdae bakery').filteredRestaurants.length < go('hongdae').filteredRestaurants.length);
  // A sight's name of several words is still the area it stands in.
  assert.equal(ids(go('lotte world tower')), ids(go('lotte world')));
});

// The words on the chips and cards, typed back, find what they label.
test('a diet label typed as it is shown finds its places', () => {
  const full = ids(go('fully vegan'));
  assert.ok(go('fully vegan').filteredRestaurants.length > 50);
  for (const q of ['完全ヴィーガン', '완전 비건', '全素', '全純素', '全纯素', 'vegan sepenuhnya']) assert.equal(ids(go(q)), full, q);
  const halal = ids(go('halal'));
  for (const q of ['ハラールフレンドリー', 'halal-friendly', 'ramah halal', '할랄 프렌들리', '清真友善', '清真友好']) assert.equal(ids(go(q)), halal, q);
});

// The same slip one step on (code review, 2026-10-07): an alias of two
// words, or a hyphen in place of the space, let the diet word go unread.
test('a diet word after a two-word area, or after a hyphen, is still read', async () => {
  const { matchesDietary } = await import('../../src/data/verification.js');
  for (const q of ['lotte world halal', 'hongdae-halal', 'lotteworld halal']) {
    const found = go(q).filteredRestaurants;
    assert.ok(found.length > 0, q);
    for (const r of found) assert.ok(matchesDietary(r, 'Halal') || /halal/i.test(r.name), `${q}: ${r.id}`);
  }
  assert.equal(ids(go('hongdae-halal')), ids(go('hongdae halal')));
  assert.equal(ids(go('lotte world halal')), ids(go('jamsil halal')));
});

// Functional pass, 2026-10-07.
test('a letter typed after an area does not widen it; a certification word is a question', () => {
  for (const q of ['busan v', 'v busan', 'busan 1']) assert.equal(ids(go(q)), ids(go('busan')), q);
  const halal = ids(go('halal'));
  for (const q of ['KMF', '인증', '認証', '할랄 인증', 'ハラール 認証', 'ハラール認証', '清真认证', 'certified', 'certificate', 'halal certified', 'halal certification', 'sertifikat halal', 'bersertifikat']) assert.equal(ids(go(q)), halal, q);
  assert.equal(ids(go('Itaewon 인증')), ids(go('Itaewon halal')));
  // …taken out before the station and filler readings see it.
  assert.equal(ids(go('kmf seoul station')), ids(go('halal seoul station')));
  assert.equal(ids(go('kmf restaurant')), halal);
  assert.equal(ids(go('비건 인증')), ids(go('비건')));
});

// Every keystroke is a search. After a hundred or so different ones in a
// visit each took over a second: a pattern was compiled for every field of
// every place, and the engine's store of compiled patterns stopped keeping
// up. One pattern per word now, kept (2026-10-07).
test('search is as quick after many different searches as at first', () => {
  for (let k = 0; k < 400; k += 1) go(`word${k} seoul`);
  const t0 = performance.now();
  for (const q of ['Seoul Station', 'Haeundae', 'zzzqqq', 'vegan restaurant near seoul station open now please']) go(q, ['Halal']);
  assert.ok(performance.now() - t0 < 1500);
});

// A diet word typed beside a station is the chip and the station (live
// regression, 2026-10-07): "halal seoul station" was every halal place in
// Seoul, "seoul station halal" another list again.
test('a diet word beside a station gives what the chip and the station give', () => {
  const chip = go('seoul station', ['Halal']);
  for (const q of ['halal seoul station', 'seoul station halal', 'kmf seoul station', '서울역 할랄']) {
    const r = go(q);
    assert.equal(ids(r), ids(chip), q);
    assert.deepEqual(r.nearest.map(n => n.place.id), chip.nearest.map(n => n.place.id), q);
  }
  assert.equal(ids(go('vegan seoul station')), ids(go('seoul station', ['Vegan'])));
});

test('an area shown by its Japanese or Chinese name is one of its written forms, and finds the same places', async () => {
  const { AREA_NAMES, AREA_SHOWN, shownArea } = await import('../../src/data/area-names.js');
  for (const [language, names] of Object.entries(AREA_SHOWN)) {
    for (const [area, name] of Object.entries(names)) {
      assert.ok(AREA_NAMES[area]?.includes(name), `${language} ${area} ${name}`);
      for (const chip of ['Vegan', 'Halal']) {
        assert.equal(ids(go(name, [chip])), ids(go(area, [chip])), `${language} ${name} ${chip}`);
        // …and as Discover asks: the area alone.
        assert.equal(ids(searchPlaces({ places, query: name, filters: [chip], areaOnly: true })), ids(searchPlaces({ places, query: area, filters: [chip], areaOnly: true })), `${language} ${name} ${chip} area`);
      }
    }
  }
  assert.equal(shownArea('Myeongdong', 'ja'), '明洞');
  assert.equal(shownArea('Myeongdong', 'ko'), '명동');
  assert.equal(shownArea('Myeongdong', 'en'), 'Myeongdong');
  assert.equal(shownArea('Sokcho', 'ja'), 'Sokcho');
});

test('a township is not the district or city it shares a name with', () => {
  const has = (q, id) => go(q).filteredRestaurants.some(p => p.id === id);
  // 용산면, Yeongdong county; 대전면, Damyang.
  for (const q of ['Yongsan', 'yongsan-gu', '용산', '용산구']) assert.equal(has(q, 'loving-hut-yeongdong'), false, q);
  for (const q of ['Daejeon', '대전']) assert.equal(has(q, 'off-the-cuff-damyang'), false, q);
  // …and each is still found where it is.
  for (const q of ['Yeongdong', '영동', 'Chungcheongbuk-do']) assert.equal(has(q, 'loving-hut-yeongdong'), true, q);
  for (const q of ['Damyang', '담양']) assert.equal(has(q, 'off-the-cuff-damyang'), true, q);
  // A township that is nobody's namesake is found by its name.
  assert.ok(go('Aewol').filteredRestaurants.length > 0);
  assert.equal(ids(go('애월')), ids(go('Aewol')));
});


test('the pork-free link searches by a word of the reader\'s language that the search reads', async () => {
  const source = (await import('node:fs')).readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const table = /PORK_FREE_SEARCH = (\{[^}]*\})/.exec(source);
  assert.ok(table, 'PORK_FREE_SEARCH');
  const words = Function(`return ${table[1]}`)();
  const english = ids(go(words.en));
  assert.ok(go(words.en).filteredRestaurants.length > 0);
  for (const [lang, word] of Object.entries(words)) assert.equal(ids(go(word)), english, `${lang} ${word}`);
  // …and with an area before it.
  assert.equal(ids(go(`Itaewon ${words.id}`)), ids(go('Itaewon pork-free')));
});

test('an Indonesian station is a station', () => {
  assert.deepEqual(stationOf('Stasiun Busan'), stationOf('Busan Station'));
  assert.deepEqual(stationOf('stasiun seoul'), stationOf('seoul station'));
  assert.equal(stationOf('stasiun'), null);
  assert.deepEqual(stationOf('Stasiun Seoul exit 1'), stationOf('Seoul Station exit 1'));
});

test('a dish is found by its name in the language of the reader', () => {
  for (const [typed, english] of [['ビビンバ', 'bibimbap'], ['ビビンパ', 'bibimbap'], ['拌飯', 'bibimbap'], ['豆腐', 'tofu'], ['カレー', 'curry'], ['咖哩', 'curry'], ['サラダ', 'salad'], ['羊肉', 'lamb'], ['韓屋村', 'hanok']]) {
    assert.ok(go(english).filteredRestaurants.length > 0, english);
    assert.equal(ids(go(typed)), ids(go(english)), typed);
  }
  assert.equal(ids(go('全州 ビビンバ')), ids(go('Jeonju bibimbap')));
  // A dish is not an area: the map does not go looking for a place called it.
  assert.equal(go('ビビンバ').areaOnly ?? false, false);
});

test('a dish name of one character does not rewrite longer words', () => {
  // 麵包 is bread, not noodles and a bun; 면목동 is a neighbourhood.
  assert.notEqual(ids(go('麵包')), ids(go('noodle')));
  const one = go('국수가').filteredRestaurants;
  assert.ok(one.length > 0 && one.length < 5, `국수가: ${one.length}`);
});


test('a township typed in Korean is the township, not its namesake district', () => {
  // 용산면 is in Yeongdong county, 대전면 in Damyang.
  assert.equal(ids(go('용산면')), ids(go('Yongsan-myeon')));
  assert.equal(go('용산면').filteredRestaurants.length, 1);
  assert.equal(go('대전면').filteredRestaurants.length, 1);
  assert.ok(go('용산').filteredRestaurants.length > 20);
});

test("an area's name is a whole word of the address", () => {
  // Daejeong-eup is on Jeju; Gyeonggijeon-gil is a street in Jeonju.
  assert.ok(go('Daejeon').filteredRestaurants.every(r => !/Daejeong/.test(r.address?.value ?? '')));
  assert.ok(go('Gyeonggi').filteredRestaurants.every(r => !/Jeonju/.test(r.address?.value ?? '')));
  // …and the road of Sinchon station is in Sinchon.
  assert.ok(go('Sinchon').filteredRestaurants.some(r => /Sinchonyeok-ro/.test(r.address?.value ?? '') && !/Sinchon/.test(r.zone)));
});

test('gimbap is found alike in every script', () => {
  const english = ids(go('gimbap'));
  for (const typed of ['kimbap', 'gimbab', 'kimbab', '김밥', 'キンパ', '紫菜包饭', '紫菜包飯']) assert.equal(ids(go(typed)), english, typed);
});

test('면, 읍 or 리 after a name is a township only where a record has one', () => {
  // 두부면 is tofu noodles; no record is in a "수원리" or a "제주읍".
  assert.ok(go('두부면').filteredRestaurants.length > 10);
  assert.ok(go('제주읍').filteredRestaurants.length > 10);
  assert.ok(go('수원리').filteredRestaurants.length > 10);
  // 남산면 is in Chuncheon (Nami Island), not the Namsan of Seoul.
  assert.ok(go('남산면').filteredRestaurants.length < go('남산').filteredRestaurants.length);
});

test('a question typed in English finds what its words name', () => {
  // "city", "island", "province" say what kind of place it is; "near me",
  // "best", "where to eat" are the rest of a question.
  assert.equal(ids(go('Suwon City')), ids(go('Suwon')));
  assert.equal(ids(go('Busan City')), ids(go('Busan')));
  assert.equal(ids(go('Jeju Island')), ids(go('Jeju')));
  assert.equal(ids(go('Gyeonggi Province')), ids(go('Gyeonggi')));
  assert.equal(ids(go('halal near me')), ids(go('halal')));
  assert.equal(ids(go('best vegan seoul')), ids(go('vegan seoul')));
  assert.equal(ids(go('where to eat halal in busan')), ids(go('halal busan')));
  // "Jeju City" is the city, not the island with Seogwipo in it.
  assert.equal(ids(go('Jeju City')), ids(go('제주시')));
  assert.ok(go('Jeju City').filteredRestaurants.length < go('Jeju').filteredRestaurants.length);
  // A place's own name with such a word in it is still found.
  assert.ok(go('eat anything').filteredRestaurants.some(r => /Eat Anything/.test(r.name)));
  assert.ok(go('City Hall').filteredRestaurants.length < 10);
});

test('the words of a question are no search terms in the other languages either', () => {
  for (const [asked, plain] of [['ソウル ヴィーガン おすすめ', 'ソウル ヴィーガン'], ['首尔清真餐厅推荐', '首尔 清真'], ['釜山 清真 好吃', '釜山 清真'],
    ['restoran halal terbaik di Seoul', 'halal Seoul'], ['rekomendasi vegan Seoul', 'vegan Seoul'], ['서울 맛있는 비건', '서울 비건']]) {
    assert.ok(go(plain).filteredRestaurants.length > 0, plain);
    assert.equal(ids(go(asked)), ids(go(plain)), asked);
  }
});

test('a plural finds what its singular finds, and a kind of cooking is found in every script', () => {
  for (const [many, one] of [['noodles', 'noodle'], ['burgers', 'burger'], ['salads', 'salad'], ['sandwiches', 'sandwich'], ['kebabs', 'kebab']]) {
    assert.equal(ids(go(many)), ids(go(one)), many);
  }
  assert.equal(ids(go('餃子')), ids(go('dumplings')));
  assert.equal(ids(go('mandu')), ids(go('dumpling')));
  assert.ok(go('韓国料理').filteredRestaurants.length > 100);
  assert.equal(ids(go('韩国料理')), ids(go('韓国料理')));
  assert.ok(go('中餐').filteredRestaurants.length >= go('chinese').filteredRestaurants.length);
  assert.ok(go('nepalese').filteredRestaurants.length > 10);
  // "korean food" is what says Korean, not the two records with the words side by side.
  assert.ok(go('korean food').filteredRestaurants.length > 100);
});

test('setting the words of a question aside does not lose a place named with them, nor read a word as a plural', () => {
  // A name narrows to its place, whatever words are in it.
  for (const name of ['The India', 'For You Restaurant', 'Warung Jaya', 'Royal Restaurant', 'Dubai Restaurant', 'Yang Good seoul', 'Yang Good Yeoksam', 'Great Himalaya', 'Eat Anything', 'Welcome to Dubai', 'Bread and Roses']) {
    assert.equal(go(name).filteredRestaurants.length, 1, name);
  }
  // "city" before "hall" or "centre" is not the kind of place.
  assert.equal(ids(go('Incheon City Hall')), ids(go('인천시청')));
  assert.ok(go('Incheon City Hall').filteredRestaurants.length > 20);
  assert.ok(go('Suwon city center').filteredRestaurants.length > 20);
  // Only a kind of food is read without its plural.
  for (const word of ['fries', 'Las Vegas', 'jeons', 'mills seoul']) assert.equal(go(word).filteredRestaurants.length, 0, word);
  assert.equal(go('Veggies').filteredRestaurants.length, 1);
  // …and a question is still a question.
  assert.equal(ids(go('halal near me')), ids(go('halal')));
});

test('a diet word of a language the app does not speak finds what the chip finds', () => {
  // A reader whose browser translates the page types the word as they know it.
  const halal = ids(go('halal'));
  for (const q of ['халяль', 'Халяль', 'халал', 'ҳалол', 'halol', 'हलाल', 'হালাল', 'حلال', 'ฮาลาล']) assert.equal(ids(go(q)), halal, q);
  const vegan = ids(go('vegan'));
  for (const q of ['веган', 'วีแกน', 'มังสวิรัติ', 'vegano', 'vegana', 'végane', 'veganisch', 'végétalien', 'thuần chay', 'نباتي']) assert.equal(ids(go(q)), vegan, q);
  assert.equal(ids(go('itaewon халяль')), ids(go('itaewon halal')));
});

test('"open now" typed into the search is recognised, and taken out', async () => {
  const { asksOpenNow, withoutOpenNow } = await import('../../src/filters.js');
  for (const q of ['open now', 'halal open now', 'Open right now itaewon', '이태원 지금 영업', '영업 중', '営業中', '现在营业', '營業中', 'buka sekarang']) assert.equal(asksOpenNow(q), true, q);
  // Asked twice in a row: a regex with the g flag remembers where it stopped.
  assert.equal(asksOpenNow('open now'), true);
  for (const q of ['open', 'now', 'itaewon', 'opening', 'known open', 'nowon']) assert.equal(asksOpenNow(q), false, q);
  assert.equal(withoutOpenNow('halal open now'), 'halal');
  assert.equal(withoutOpenNow('open now'), '');
  assert.equal(withoutOpenNow('이태원 지금 영업 중'), '이태원');
  assert.equal(withoutOpenNow('itaewon open now vegan'), 'itaewon vegan');
});

test('"open now" comes out of the search with what trails it', async () => {
  const { asksOpenNow, withoutOpenNow } = await import('../../src/filters.js');
  assert.equal(withoutOpenNow('ハラル 営業中のお店'), 'ハラル');
  assert.equal(withoutOpenNow('现在营业的店'), '');
  assert.equal(withoutOpenNow('지금 영업하는 곳'), '');
  assert.equal(withoutOpenNow('할랄 지금 영업 중인 곳'), '할랄');
  assert.equal(withoutOpenNow('yang buka sekarang itaewon'), 'itaewon');
  // "영업중단" is a place that has closed for good, not a question.
  assert.equal(asksOpenNow('영업중단'), false);
});

test('"nearby" written against the diet word, without a space, is still the diet', () => {
  const halal = ids(go('halal'));
  for (const q of ['近くのハラール', '近くのハラールレストラン', '附近的清真餐厅', '附近清真', 'halal dekat sini', 'makanan halal di sekitar sini']) assert.equal(ids(go(q)), halal, q);
  assert.equal(ids(go('近くのヴィーガン')), ids(go('vegan')));
  assert.equal(ids(go('近くの明洞')), ids(go('Myeongdong')));
  // A name that only begins like such a word is left alone.
  assert.equal(go('아빠의양식당').filteredRestaurants.length, 1);
});

test('more ways a visitor writes the diet, in Japanese and Chinese', () => {
  const halal = ids(go('halal'));
  for (const q of ['ハラールフード', 'ムスリムフレンドリー', 'ムスリムフレンドリー レストラン', '清真食品']) assert.equal(ids(go(q)), halal, q);
  assert.equal(ids(go('豚肉なし')), ids(go('pork free')));
  for (const q of ['蔬食', '吃素']) assert.equal(ids(go(q)), ids(go('素食')), q);
});

test('a whole sentence, as spoken to a phone, is searched by what it names', () => {
  const halal = ids(go('halal'));
  for (const q of ['i want halal food', 'halal food please', 'what is halal near here', '할랄 음식점 알려줘']) assert.equal(ids(go(q)), halal, q);
  const myeongdong = ids(go('myeongdong halal'));
  for (const q of ['where can i find halal in myeongdong', '明洞でハラールを食べたい', '在明洞吃清真']) assert.equal(ids(go(q)), myeongdong, q);
  assert.equal(ids(go('is there vegan food in jeju')), ids(go('jeju vegan')));
  assert.equal(ids(go('부산에 비건 있어?')), ids(go('부산 비건')));
  assert.equal(ids(go('ada halal di busan?')), ids(go('busan halal')));
  // A place whose own name has such a word is still that place.
  for (const q of ['Base is Nice', 'base is nice', "Plantude I'Park Mall Yongsan"]) assert.equal(go(q).filteredRestaurants.length, 1, q);
});

test('"vegetarian" is asked of the same record as vegan, in each language', () => {
  const vegan = ids(go('vegan'));
  for (const q of ['vegetarian', '채식', '素食', 'ベジタリアン', 'vegetarian restaurant']) assert.equal(ids(go(q)), vegan, q);
  assert.equal(ids(go('경주 채식')), ids(go('경주 비건')));
  // "Veggie" is a word in names, and stays a search by name.
  assert.ok(go('veggie').filteredRestaurants.length < 20);
});

test('pork-free said in a phrase, a diet glued to a kind of place, a meal named', () => {
  const porkFree = ids(go('pork free'));
  for (const q of ['돼지고기 안 쓰는 집', '돼지고기 안 쓰는 식당', '豚肉を使わない店', '没有猪肉']) assert.equal(ids(go(q)), porkFree, q);
  assert.equal(ids(go('釜山のヴィーガンカフェ')), ids(go('busan vegan cafe')));
  assert.equal(ids(go('비건카페')), ids(go('비건 카페')));
  assert.equal(ids(go('vegan breakfast jeju')), ids(go('jeju vegan')));
  assert.equal(ids(go('대구 무슬림 손님 식당')), ids(go('대구 할랄')));
  // Names that only begin like a diet word are left alone.
  assert.equal(go('아빠의양식당').filteredRestaurants.length, 1);
});

test('"late night", "tonight", "24 hours" are the question "open now"', async () => {
  const { asksOpenNow, withoutOpenNow } = await import('../../src/filters.js');
  assert.equal(withoutOpenNow('late night halal itaewon'), 'halal itaewon');
  assert.equal(withoutOpenNow('24 hour halal'), 'halal');
  assert.equal(withoutOpenNow('심야 할랄'), '할랄');
  for (const q of ['latte', 'later', 'chocolate', 'translate', '24 seoul']) assert.equal(asksOpenNow(q), false, q);
});

test('a day and a meal named in the search are a plan', async () => {
  const { plannedTime } = await import('../../src/filters.js');
  // today = 5 (Friday)
  assert.deepEqual(plannedTime('halal saturday dinner daegu', 5), { day: 6, minutes: 1140, rest: 'halal daegu', sure: true });
  assert.deepEqual(plannedTime('tomorrow lunch vegan jeju', 5), { day: 6, minutes: 750, rest: 'vegan jeju', sure: true });
  assert.equal(plannedTime('토요일 저녁에 여는 곳', 5)?.rest, '');
  assert.equal(plannedTime('明日のランチ ヴィーガン ソウル', 5)?.rest, 'ヴィーガン ソウル');
  assert.equal(plannedTime('周六晚上 清真 首尔', 5)?.minutes, 1140);
  assert.equal(plannedTime('besok malam halal', 5)?.day, 6);
  // A weekday alone may be a name; a meal alone is no plan.
  assert.equal(plannedTime('Sun Hansik', 5), null);
  assert.equal(plannedTime('lunch', 5), null);
  assert.equal(plannedTime('Sunrise', 5), null);
});

test('a diet typed beside an area with none of it is answered with the nearest', () => {
  const typed = go('경주 할랄');
  assert.equal(typed.filteredRestaurants.length, 0);
  assert.ok(typed.nearest.length > 0);
  assert.deepEqual(typed.nearest.map(x => x.place.id), go('경주', ['Halal']).nearest.map(x => x.place.id));
});

test('a day and a meal run together in Chinese and Japanese are a plan; a name is not', async () => {
  const { plannedTime } = await import('../../src/filters.js');
  assert.equal(plannedTime('周六晚上 清真 首尔', 5)?.rest, '清真 首尔');
  assert.equal(plannedTime('明天中午清真', 5)?.minutes, 750);
  assert.equal(plannedTime('周日营业的店', 5)?.sure, true);
  assert.equal(plannedTime('明日 朝鮮料理', 5)?.sure, false);
  assert.equal(plannedTime('今日 夜市', 5)?.sure, false);
  assert.equal(plannedTime('오늘통닭', 5), null);
  assert.equal(plannedTime('minggu depan', 5), null);
  assert.equal(plannedTime('weds lunch', 5)?.day, 3);
  assert.equal(plannedTime('Sunday Bakery', 5)?.sure, false);
});

test('words that name no place and no kind of place are no search', () => {
  const all = go('').filteredRestaurants.length;
  for (const q of ['맛집', '근처 맛집', 'レストラン', '餐厅', '附近', 'restaurants near me', 'near me', 'tempat makan', 'where to eat']) {
    assert.equal(go(q).filteredRestaurants.length, all, q);
  }
  // A place called so is still what was meant.
  assert.ok(go('restaurant').filteredRestaurants.length < all);
  assert.equal(ids(go('서울 맛집')), ids(go('서울')));
});

test('more wordings of the same questions', () => {
  const vegan = ids(go('vegan'));
  for (const q of ['plant based', 'plant-based', 'meatless', 'no meat', 'meat free', '식물성', '고기 없는 식당', 'プラントベース', '无肉', 'tanpa daging', '素食主义']) assert.equal(ids(go(q)), vegan, q);
  assert.equal(ids(go('plant based jeju')), ids(go('vegan jeju')));
  assert.equal(ids(go('ramah muslim')), ids(go('halal')));
  assert.equal(ids(go('bebas babi')), ids(go('no pork')));
  assert.equal(ids(go('makan siang halal')), ids(go('halal')));
  assert.equal(ids(go('我附近的清真餐厅')), ids(go('halal')));
  assert.equal(ids(go('한식당')), ids(go('korean')));
  // Names in the letters a guidebook writes them in.
  for (const [typed, roman] of [['汝矣島', 'Yeouido'], ['乙支路', 'Euljiro'], ['狎鴎亭', 'Apgujeong'], ['春川', 'Chuncheon'], ['束草', 'Sokcho'], ['大学路', 'Daehak-ro'], ['南大門市場', 'Namdaemun Market'], ['南山タワー', 'Namsan'], ['グルテンフリー', 'gluten free'], ['无麸质', 'gluten free']]) {
    assert.ok(go(typed).filteredRestaurants.length > 0, typed);
    assert.equal(ids(go(typed)), ids(go(roman)), `${typed} = ${roman}`);
  }
});

test('a day said with more around it; a street is not its district', async () => {
  const { plannedTime } = await import('../../src/filters.js');
  assert.deepEqual(plannedTime('next monday dinner halal', 5), { day: 1, minutes: 1140, rest: 'halal', sure: true });
  assert.equal(plannedTime('이번 주 토요일 저녁 할랄', 5)?.rest, '할랄');
  assert.equal(plannedTime('来週の土曜日 ランチ', 5)?.rest, '');
  assert.equal(plannedTime('saturday and sunday lunch halal', 5)?.rest, 'halal');
  assert.equal(plannedTime('下周六晚上清真', 5)?.rest, '清真');
  assert.equal(plannedTime('토요일은 여는 곳', 5)?.sure, true);
  // Indonesian: the night before Sunday; the weekend is no one day.
  assert.equal(plannedTime('malam minggu halal', 5)?.day, 6);
  assert.equal(plannedTime('akhir minggu makan malam halal', 5), null);
  // "Open now today" is the open-now question, with the day set aside.
  assert.deepEqual(plannedTime('halal open now today', 5), { day: 5, minutes: 750, rest: 'halal', sure: false, now: true });
  // Names that open with a short day.
  for (const q of ['sun hansik lunch', 'mon cher dinner', 'thu duc pho dinner']) assert.equal(plannedTime(q, 5), null, q);
  // 성동로 is a road, not every place in Seongdong-gu; 중앙대로 is "-daero".
  assert.ok(go('성동로').filteredRestaurants.every(r => /Seongdong-ro/.test(r.address.value) || /성동로/.test(JSON.stringify(r))));
  assert.ok(go('성동로').filteredRestaurants.length < go('성동구').filteredRestaurants.length);
  assert.equal(go('떡 카페').filteredRestaurants.length, go('카페').filteredRestaurants.length);
});

test('dishes and kitchens by their Korean names', () => {
  for (const [ko, en] of [['불고기', 'bulgogi'], ['만두', 'dumpling'], ['닭갈비', 'dakgalbi'], ['막걸리', 'makgeolli'], ['일식', 'japanese'], ['중국집', 'chinese'], ['태국 음식', 'thai'], ['포케', 'poke'], ['글루텐 프리', 'gluten free'], ['락토프리', 'dairy free']]) {
    assert.ok(go(ko).filteredRestaurants.length > 0, ko);
    assert.equal(ids(go(ko)), ids(go(en)), `${ko} = ${en}`);
  }
  // (Typed in English the two words are also read as a phrase, which narrows.)
  assert.ok(go('중동 음식').filteredRestaurants.length >= go('middle eastern').filteredRestaurants.length);
  assert.equal(ids(go('비건 옵션')), ids(go('vegan')));
  assert.equal(ids(go('채식 가능 한식')), ids(go('vegan korean')));
  assert.equal(ids(go('할랄 메뉴 있는 곳')), ids(go('halal')));
});
