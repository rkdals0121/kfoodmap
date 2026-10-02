import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_CARDS, STAFF_ANSWERS, MENU_WORDS, cardById, cardForPlace } from '../../src/data/staff-cards.js';
import en from '../../src/i18n/locales/en.js';

// A line's meaning lives in the locale files (cardText.*), keyed by `key`.
const meaning = (l) => en.cardText[l.key];

const lines = [
  ...STAFF_CARDS.flatMap(c => [...c.statement, ...c.questions]),
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
