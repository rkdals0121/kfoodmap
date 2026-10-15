import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_CARDS, STAFF_ANSWERS, MENU_WORDS, CARD_EXTRAS, cardById, cardForPlace, cardLines, extrasFor, extrasAsked } from '../../src/data/staff-cards.js';
import { leftOutQuery } from '../../src/filters.js';
import en from '../../src/i18n/locales/en.js';

// A line's meaning lives in the locale files (cardText.*), keyed by `key`.
const meaning = (l) => en.cardText[l.key];

// (An extra may reuse a card's own line, the same object: counted once.)
const lines = [...new Set([
  ...STAFF_CARDS.flatMap(c => [...c.statement, ...c.questions]),
  ...CARD_EXTRAS.flatMap(x => [...Object.values(x.replace ?? {}), ...[].concat(x.statement ?? []), ...(x.questions ?? [])]),
  ...STAFF_ANSWERS,
  ...MENU_WORDS,
])];

test('every line has Korean, a romanisation and its English meaning', () => {
  for (const l of lines) {
    assert.match(l.ko, /[가-힣]/, JSON.stringify(l));
    assert.ok(l.roman && /^[\x20-\x7E·]+$/.test(l.roman), `roman: ${l.ko}`);
    assert.ok(meaning(l) && meaning(l).length > 1, `no cardText.${l.key} for ${l.ko}`);
  }
});

test('every cardText key belongs to a line, and every line has its own key', () => {
  const keys = lines.map(l => l.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(Object.keys(en.cardText).filter(k => !keys.includes(k)), []);
});

test('Korean lines are unique within a list (they are used as keys)', () => {
  const lists = [...STAFF_CARDS.map(c => [...c.statement, ...c.questions]), STAFF_ANSWERS, MENU_WORDS];
  for (const list of lists) {
    const ko = list.map(l => l.ko);
    assert.equal(new Set(ko).size, ko.length);
  }
});

test('a card never promises safety or says what a kitchen serves', () => {
  for (const l of lines) assert.doesNotMatch(meaning(l), /\bsafe\b|guarantee/i, meaning(l));
});

test('statements are in the polite formal register; questions end as questions', () => {
  for (const c of STAFF_CARDS) {
    for (const q of c.questions) assert.match(q.ko, /\?/, q.ko);
    assert.match(c.statement[0].ko, /^안녕하세요\./);
  }
});

test('a place with only a halal claim opens the Muslim card; anything else the vegan one', () => {
  const f = (value) => ({ value, confidence: 'supported' });
  assert.equal(cardForPlace({ dietary: { halal: f('friendly') } }), 'muslim');
  assert.equal(cardForPlace({ dietary: { vegan: f('options'), halal: f('friendly') } }), 'muslim');
  assert.equal(cardForPlace({ dietary: { vegan: f('full'), halal: f('friendly') } }), 'vegan');
  assert.equal(cardForPlace({ dietary: { vegan: f('full') } }), 'vegan');
  assert.equal(cardForPlace({ dietary: { halal: f('none') } }), 'vegan');
  assert.equal(cardForPlace({}), 'vegan');
  assert.equal(cardById('nope').id, 'vegan');
});

test('a vegetarian who eats no egg shows a card that says so', () => {
  const veg = cardById('vegetarian');
  const plain = cardLines(veg, []);
  assert.ok(plain.statement.some(l => l.ko.includes('달걀과 우유·유제품은 먹습니다')));
  const noEgg = cardLines(veg, ['egg']);
  assert.ok(!noEgg.statement.some(l => l.ko.includes('달걀과 우유·유제품은 먹습니다')), 'still says egg is eaten');
  assert.ok(noEgg.statement.some(l => l.ko.includes('달걀은 먹지 않습니다')));
  assert.ok(noEgg.questions.some(l => l.ko.startsWith('달걀이 들어가나요')));
  assert.ok(noEgg.questions.some(l => l.key === 'vegeQ5NoEgg') && !noEgg.questions.some(l => l.key === 'vegeQ5'));
  assert.ok(noEgg.words.has('word9'));
  // The last line is still the question.
  assert.equal(noEgg.statement.at(-1).key, 'vegeS5');
  const jain = cardLines(veg, ['egg', 'pungent', 'roots']);
  assert.ok(jain.statement.some(l => l.key === 'extraNoPungent') && jain.statement.some(l => l.key === 'extraNoRoots'));
  // A card offers only what it does not already say: the vegan card says no egg.
  assert.deepEqual(extrasFor('vegan', ['egg', 'roots']), ['roots']);
  // (Egg as an allergen: the allergy card's line, on the Muslim card too.)
  assert.deepEqual(extrasFor('muslim', ['egg', 'pungent']), ['egg']);
});

test('a search that leaves something out opens the card that says so', () => {
  assert.deepEqual(extrasAsked('vegetarian no egg'), ['egg']);
  assert.deepEqual(extrasAsked('eggless'), ['egg']);
  assert.deepEqual(extrasAsked('jain'), ['egg', 'pungent', 'roots']);
  // (Both left out, as the search reads it: "no onion" alone does not say no chives.)
  assert.deepEqual(extrasAsked('no onion no garlic', leftOutQuery('no onion no garlic').items), ['pungent']);
  assert.deepEqual(extrasAsked('no onion', leftOutQuery('no onion').items), []);
  assert.deepEqual(extrasAsked('onion rings garlic bread', leftOutQuery('onion rings garlic bread').items), []);
  assert.deepEqual(extrasAsked('vegetarian no-egg', leftOutQuery('vegetarian no-egg').items), ['egg']);
  assert.deepEqual(extrasAsked('egg and dairy free', leftOutQuery('egg and dairy free').items), ['egg', 'milk']);
  assert.deepEqual(extrasAsked('without any wheat', leftOutQuery('without any wheat').items), ['wheat']);
  assert.deepEqual(extrasAsked('오신채 없는'), ['pungent']);
  // A vegetarian who eats egg (蛋奶素), and eggplant, are not "no egg".
  assert.deepEqual(extrasAsked('蛋奶素'), []);
  assert.deepEqual(extrasAsked('eggplant'), []);
  assert.deepEqual(extrasAsked('vegan'), []);
});

test('someone who cannot eat wheat has a card, and the other cards can say it too', () => {
  const wheat = cardById('wheat');
  assert.equal(wheat.id, 'wheat');
  // The wheat that matters in a Korean kitchen is in the sauces and pastes.
  assert.ok(wheat.statement.some(l => /간장/.test(l.ko) && /고추장/.test(l.ko) && /된장/.test(l.ko)));
  assert.ok(wheat.questions.some(l => /기름/.test(l.ko) && /물/.test(l.ko)));
  const veg = cardLines(cardById('vegetarian'), ['wheat']);
  assert.ok(veg.statement.some(l => l.key === 'extraNoWheat') && veg.words.has('word15'));
  assert.deepEqual(extrasFor('muslim', ['wheat', 'egg']), ['wheat', 'egg']);
  assert.deepEqual(extrasFor('wheat', ['wheat', 'egg', 'roots']), ['egg']);
  assert.deepEqual(extrasFor('allergy', ['wheat', 'shellfish']), ['wheat', 'shellfish']);
  assert.ok(extrasAsked('gluten free').includes('wheat'));
  assert.ok(extrasAsked('セリアック').includes('wheat'));
  assert.ok(!extrasAsked('vegan').includes('wheat'));
});

test('"pure veg" is a vegetarian who eats no egg; "whole wheat bread" is not the wheat card', () => {
  assert.ok(extrasAsked('pure veg').includes('egg'));
  assert.ok(!extrasAsked('pure vegan').includes('egg'));
  assert.ok(!extrasAsked('whole wheat bread').includes('wheat'));
  assert.ok(extrasAsked('wheat free').includes('wheat') && extrasAsked('no wheat').includes('wheat'));
});

test('wheat added to another card says all the wheat card says about oil, water, batter and barley', () => {
  for (const id of ['vegan', 'vegetarian', 'muslim']) {
    const l = cardLines(cardById(id), ['wheat']);
    const ko = [...l.statement, ...l.questions].map(x => x.ko).join(' ');
    for (const w of ['기름이나 물', '튀김 기름', '보리차', '튀김옷']) assert.ok(ko.includes(w), `${id}: ${w}`);
    assert.equal(l.statement.at(-1).ko, '제가 먹을 수 있는 메뉴가 있을까요?');
  }
});

test('each card shows the menu words that are its own', () => {
  const shown = (id, extras = []) => MENU_WORDS.filter(w => w.cards.includes(id) || cardLines(cardById(id), extras).words.has(w.key)).map(w => w.key);
  assert.ok(!shown('wheat').includes('word1') && !shown('wheat').includes('word6'));
  assert.ok(!shown('muslim').includes('word1'));
  assert.ok(shown('muslim', ['wheat']).includes('word15'));
  for (const w of MENU_WORDS) assert.ok(Array.isArray(w.cards) && w.cards.length > 0, w.key);
});

test('the five pungent: said left out, not a label that has them, nor one of them alone in Korean', () => {
  const asked = (q) => extrasAsked(q, leftOutQuery(q).items);
  for (const q of ['五辛素', '植物五辛素', '五辛蛋奶素', '含五辛', '오신채 들어간 채식', '양파 없는', '마늘 빼고', 'tanpa bawang putih', 'onion rings garlic bread']) assert.ok(!asked(q).includes('pungent'), q);
  for (const q of ['不吃五辛', '無五辛 首爾', '오신채 없는', '양파 마늘 없는', 'no onion/garlic', 'no onion garlic', 'jain']) assert.ok(asked(q).includes('pungent'), q);
});

test('a food named is not a food left out: root vegetables and gluten', () => {
  const asked = (q) => extrasAsked(q, leftOutQuery(q).items);
  for (const q of ['root vegetable curry', '根菜カレー', '뿌리채소 요리', '채식 뿌리채소']) assert.ok(!asked(q).includes('roots'), q);
  assert.ok(!asked('글루텐 들어간 빵').includes('wheat'));
  for (const q of ['jain', 'no root vegetables', '뿌리채소 없는']) assert.ok(asked(q).includes('roots'), q);
  for (const q of ['gluten free', '글루텐 프리', 'グルテンフリー']) assert.ok(asked(q).includes('wheat'), q);
});

test('a food allergy has a card: the allergens chosen, where they hide, and the question', () => {
  const allergy = cardById('allergy');
  assert.equal(allergy.id, 'allergy');
  const plain = cardLines(allergy, []);
  assert.ok(plain.statement.length === allergy.statement.length);
  const shell = cardLines(allergy, ['shellfish']);
  assert.ok(shell.statement.some(l => /갑각류/.test(l.ko) && /새우젓/.test(l.ko)));
  assert.ok(shell.questions.some(l => /새우나 게/.test(l.ko)));
  assert.match(shell.statement[shell.statement.length - 1].ko, /메뉴가 있을까요\?/);
  assert.deepEqual(extrasFor('allergy', ['shellfish', 'egg', 'pungent']), ['shellfish', 'egg']);
  // From a search, in any language the search reads.
  for (const q of ['えび なし', 'shellfish allergy', '새우 알레르기', '虾过敏', '甲殻類アレルギー']) assert.ok(extrasAsked(q, leftOutQuery(q).items).includes('shellfish'), q);
  assert.ok(extrasAsked('alergi udang').includes('shellfish'));
  assert.deepEqual(extrasAsked('shrimp fried rice', leftOutQuery('shrimp fried rice').items), []);
});

test('an allergen on another card is said as an allergy; no card says "I have a nut allergy" unless chosen', () => {
  const muslimEgg = cardLines(cardById('muslim'), ['egg']);
  assert.ok(muslimEgg.statement.some(l => l.key === 'allergyS2'));
  assert.ok(muslimEgg.questions.some(l => l.key === 'allergyQ3'));
  assert.equal(muslimEgg.statement.at(-1).key, 'muslimS4');
  // The vegetarian's own egg is a diet, not an allergy.
  assert.ok(!cardLines(cardById('vegetarian'), ['egg']).statement.some(l => l.key === 'allergyS2'));
  for (const c of STAFF_CARDS) assert.ok(!cardLines(c, []).questions.some(l => /알레르기가 있습니다/.test(l.ko)), c.id);
  assert.ok(cardLines(cardById('vegan'), ['nuts']).statement.some(l => /땅콩/.test(l.ko)));
});

