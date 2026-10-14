import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_CARDS, STAFF_ANSWERS, MENU_WORDS, CARD_EXTRAS, cardById, cardForPlace, cardLines, extrasFor, extrasAsked } from '../../src/data/staff-cards.js';
import en from '../../src/i18n/locales/en.js';

// A line's meaning lives in the locale files (cardText.*), keyed by `key`.
const meaning = (l) => en.cardText[l.key];

const lines = [
  ...STAFF_CARDS.flatMap(c => [...c.statement, ...c.questions]),
  ...CARD_EXTRAS.flatMap(x => [...Object.values(x.replace ?? {}), ...(x.statement ? [x.statement] : []), ...(x.questions ?? [])]),
  ...STAFF_ANSWERS,
  ...MENU_WORDS,
];

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
  assert.equal(cardForPlace({ dietary: { vegan: f('options'), halal: f('friendly') } }), 'vegan');
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
  assert.deepEqual(extrasFor('muslim', ['egg', 'pungent']), []);
});

test('a search that leaves something out opens the card that says so', () => {
  assert.deepEqual(extrasAsked('vegetarian no egg'), ['egg']);
  assert.deepEqual(extrasAsked('eggless'), ['egg']);
  assert.deepEqual(extrasAsked('jain'), ['egg', 'pungent', 'roots']);
  assert.deepEqual(extrasAsked('no onion no garlic'), ['pungent']);
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
  assert.deepEqual(extrasFor('muslim', ['wheat', 'egg']), ['wheat']);
  assert.deepEqual(extrasFor('wheat', ['wheat', 'egg', 'roots']), []);
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
