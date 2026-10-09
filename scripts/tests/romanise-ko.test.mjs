// The Korean-to-roman spelling used to find a neighbourhood typed in Korean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { romaniseKorean } from '../../src/data/romanise-ko.js';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';
import { searchPlaces } from '../../src/search.js';

test('Korean words are spelt by the Revised Romanization, sound changes included', () => {
  for (const [ko, roman] of [['익선', 'ikseon'], ['신림', 'sillim'], ['종로', 'jongno'], ['독립', 'dongnip'], ['낙원', 'nagwon'],
    ['별내', 'byeollae'], ['신라', 'silla'], ['백마', 'baengma'], ['왕십리', 'wangsimni'], ['한남', 'hannam'], ['서교', 'seogyo'],
    ['역삼', 'yeoksam'], ['압구정', 'apgujeong'], ['묵호', 'mukho'], ['선릉', 'seolleung'], ['청량리', 'cheongnyangni'],
    ['대관령', 'daegwallyeong'], ['속리산', 'songnisan'], ['월곶', 'wolgot'], ['광희문', 'gwanghuimun'], ['울릉', 'ulleung']]) {
    assert.equal(romaniseKorean(ko), roman, ko);
  }
  assert.equal(romaniseKorean('Ikseon'), null);
  assert.equal(romaniseKorean(''), null);
});

test('a neighbourhood typed in Korean finds the places whose address names it', () => {
  const places = restaurants.filter(r => !isQuarantined(r));
  const found = (query) => searchPlaces({ places, query, selectedFilters: [], now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  for (const [ko, roman] of [['익선동', 'Ikseon-dong'], ['서교동', 'Seogyo-dong'], ['한남동', 'Hannam-dong'], ['신림동', 'Sillim-dong']]) {
    const list = found(ko);
    assert.ok(list.length > 0, `${ko} finds something`);
    assert.ok(list.every(r => `${r.address.value} ${r.zone ?? ''}`.includes(roman)), `${ko}: every place found is in ${roman}`);
  }
  // 우동 is a bowl of noodles before it is U-dong in Haeundae.
  assert.ok(found('우동').every(r => !/\bU-dong\b/.test(r.address.value) || /우동/.test(r.name)));
});

test('other place words typed in Korean are found by the word in the English address or zone', () => {
  const places = restaurants.filter(r => !isQuarantined(r));
  const found = (query) => searchPlaces({ places, query, selectedFilters: [], now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  for (const [ko, roman] of [['합정', 'Hapjeong'], ['해방촌', 'Haebangchon'], ['혜화', 'Hyehwa'], ['경리단길', 'Gyeongnidan']]) {
    const list = found(ko);
    assert.ok(list.length > 0, `${ko} finds something`);
    assert.ok(list.every(r => `${r.address.value} ${r.zone ?? ''}`.includes(roman)), `${ko}: every place found says ${roman}`);
  }
  // A road named after somewhere else is not that place.
  assert.ok(found('시흥').every(r => !/Siheung-daero/.test(r.address.value) || /Siheung(?!-daero)/.test(`${r.address.value} ${r.zone ?? ''}`)));
});

test('a food of one syllable beside a diet word is still searched for', () => {
  const places = restaurants.filter(r => !isQuarantined(r));
  const found = (query) => searchPlaces({ places, query, selectedFilters: [], now: new Date('2026-10-09T03:00:00Z') }).filteredRestaurants;
  const vegan = found('비건').length;
  assert.ok(found('비건 빵').length > 0 && found('비건 빵').length < vegan / 4, '"비건 빵" is not every vegan place');
  assert.ok(found('비건 빵').length <= found('빵').length);
  // One letter of a word still being typed is set aside as before.
  assert.equal(found('부산 v').length, found('부산').length);
});
