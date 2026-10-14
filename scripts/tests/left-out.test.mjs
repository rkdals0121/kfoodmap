// "no egg", "egg-free", "without the onion or garlic": what a search asks to
// be left out, and the texts that say so (src/filters.js leftOutQuery,
// saysLeftOut). Sentences as the records write them, and some made up to
// hold the rules down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leftOutQuery, saysLeftOut } from '../../src/filters.js';

test('what a search asks to be left out', () => {
  const read = (q) => leftOutQuery(q);
  assert.deepEqual(read('vegetarian no egg').items, ['egg']);
  assert.deepEqual(read('vegetarian no egg').rest, ['vegetarian']);
  assert.deepEqual(read('no egg or fish').items, ['egg', 'fish']);
  assert.deepEqual(read('no egg, fish').items, ['egg', 'fish']);
  assert.deepEqual(read('fish and egg free').items.sort(), ['egg', 'fish']);
  assert.deepEqual(read('without the egg').items, ['egg']);
  assert.deepEqual(read('free of dairy').items, ['dairy']);
  assert.deepEqual(read('hold the cheese').items, ['cheese']);
  assert.deepEqual(read('no added egg').items, ['egg']);
  assert.deepEqual(read('no fish-sauce').items, ['fish sauce']);
  assert.deepEqual(read('no-fish-sauce').items, ['fish sauce']);
  assert.deepEqual(read('no meat stock').items, ['meat stock']);
  assert.deepEqual(read('nondairy').items, ['dairy']);
  assert.deepEqual(read('eggless').items, ['egg']);
  assert.deepEqual(read('glutenfree').items, ['gluten']);
  assert.deepEqual(read('lactose free').items, ['dairy']);
  assert.deepEqual(read('no alliums').items, ['onion']);
  assert.deepEqual(read('no oyster').items, ['oyster']);
  assert.deepEqual(read('plastic free').items, ['plastic']);
  // Not left out: levels the records carry, alcohol, names, words of "free" or "less" that mean something else.
  for (const q of ['no pork', 'no meat', 'pork free', 'halal no alcohol', 'alcohol free', 'non halal', 'non vegetarian', 'no 1 bakery', 'noodle', 'nonsan', 'none', 'north', 'free wifi', 'kimchi free refill', 'egg free of charge', 'chicken less spicy', 'less sugar', 'mapo-gu', 'egg', 'eggplant']) {
    assert.deepEqual(read(q).items, [], q);
  }
});

test('a text says it is left out — and what does not say so', () => {
  const cases = [
    ['Some dishes come with egg, and the chef leaves it out if you say you are vegan.', 'egg', true],
    ['A fried egg is offered as a free extra on the bibimbap, so say you want it without.', 'egg', true],
    ['The pita bread and the cheese sauce both contain milk, so ask for them to be left off.', 'milk', true],
    ['Both the cold-broth and the spicy mixed makguksu are vegan if you ask for them without the egg.', 'spicy', false],
    ['It bakes without white flour, white sugar, butter or milk.', 'milk', true],
    ['It bakes without white flour, white sugar, butter or milk.', 'butter', true],
    ['It bakes without white flour, white sugar, butter or milk.', 'sugar', false],
    ['No raw fish or shellfish is served.', 'shellfish', false],
    ['Made without refined flour or sugar.', 'sugar', false],
    ['No pork is served, though the chicken comes from a halal butcher.', 'chicken', false],
    ['Skip the kimchi, which contains fish sauce.', 'fish', false],
    ['Tell the staff you eat no meat, fish or egg.', 'egg', false],
    ['Ask the staff whether the broth is made without anchovy.', 'anchovy', false],
    ['Confirm with the staff that your table has no meat or fish sauce.', 'fish sauce', false],
    ['If you avoid egg, ask for the plain version.', 'egg', false],
    ['It is not a nut-free kitchen.', 'nut', false],
    ['Kimchi free refills with every meal.', 'kimchi', false],
    ['A fried egg free of charge comes on every bowl.', 'egg', false],
    ['A sugar-free rice bagel made from Korean rice flour and coconut sugar.', 'sugar', false],
    ['Ask for no egg on the bibimbap.', 'egg', true],
    ['Its cakes are made with no eggs, milk or butter.', 'butter', true],
    ['Temple food cooked without the five pungent vegetables.', 'onion', true],
    ['Dishes can be made without allium.', 'garlic', true],
    ['A vegan bakery that bakes without butter, eggs or milk.', 'egg', true],
    ['Soy milk replaces dairy here.', 'soy', false],
    ['Uses no egg yolk: only whites.', 'egg', false],
    ['There is no English menu, eggs and spam come on top.', 'egg', false],
  ];
  for (const [text, x, want] of cases) assert.equal(saysLeftOut(text, x), want, `${x}: ${text}`);
});
