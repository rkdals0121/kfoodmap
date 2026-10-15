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

test('the second review: punctuation, full width, lists with meat or pork, places as fallbacks', async () => {
  const { restaurants } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const { searchPlaces } = await import('../../src/search.js');
  const places = restaurants.filter(r => !isQuarantined(r));
  const ids = (q) => searchPlaces({ places, query: q }).filteredRestaurants.map(r => r.id).sort().join(' ');
  const egg = ids('no egg');
  for (const q of ['no egg?', 'no egg.', 'egg free?', 'eggless?', 'vegan: no egg', 'ｎｏ ｅｇｇ', 'no, egg', 'no fried egg']) assert.equal(ids(q), egg, q);
  assert.equal(ids('no egg or dairy?'), ids('no egg or dairy'));
  // A place that does not say ham is left out is not "seoul no ham" (332 once).
  assert.ok(ids('seoul no ham').split(' ').filter(Boolean).length <= 2);
  assert.equal(ids('no butter or ham'), '');
  // Meat and pork in a list are what they are alone; the list reads on.
  assert.equal(ids('no meat or dairy'), ids('no dairy or meat'));
  assert.equal(ids('no egg or pork'), '');
  // A food is an ingredient after "no": not the places that serve lamb.
  assert.equal(ids('no lamb'), '');
  // Another script beside the left-out part.
  assert.equal(ids('ソウル no egg or dairy'), ids('seoul no egg or dairy'));
  // "no onion garlic", "no onion/garlic": a list.
  assert.deepEqual(leftOutQuery('no onion garlic').items, ['onion', 'garlic']);
  assert.deepEqual(leftOutQuery('no onion/garlic').items, ['onion', 'garlic']);
  // "no egg bibimbap": the dish is the rest.
  assert.deepEqual(leftOutQuery('no egg bibimbap').rest, ['bibimbap']);
  assert.deepEqual(leftOutQuery('no tomatoes').items, ['tomato']);
  assert.deepEqual(leftOutQuery('no octopus').items, ['octopus']);
});

test('more texts that do not say the kitchen leaves it out', () => {
  const no = [
    ['There is no gluten-free option.', 'gluten'],
    ['It is not really gluten-free.', 'gluten'],
    ['It is unclear if the noodles are egg-free.', 'egg'],
    ['Visitors who eat no egg should go elsewhere.', 'egg'],
    ['Nothing here is made without egg.', 'egg'],
    ['Egg free with any order over 10,000 won.', 'egg'],
    ['Is the cake egg-free? Ask the staff.', 'egg'],
    ['It bakes non bread and samsa.', 'bread'],
    ['The noodles without the egg, and the buckwheat pancake without the kimchi.', 'buckwheat'],
    ['Rice breads and gluten-free breads.', 'bread'],
    ['The pita and the cheese sauce served with the vegan falafel both contain milk, so ask for them to be left off.', 'falafel'],
  ];
  for (const [t, x] of no) assert.equal(saysLeftOut(t, x), false, `${x}: ${t}`);
  const yes = [
    ['It can be made vegan by leaving out the egg.', 'egg'],
    ['The vegan roll: ham, fish cake and imitation crab left out.', 'ham'],
    ['Dishes are made with egg, and the chef leaves it out on request.', 'egg'],
    ['Skip the cheese topping and it is vegan.', 'cheese'],
  ];
  for (const [t, x] of yes) assert.equal(saysLeftOut(t, x), true, `${x}: ${t}`);
});

test('the last review: words of the question beside it, levels before the next free, services', async () => {
  const { restaurants } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const { searchPlaces } = await import('../../src/search.js');
  const places = restaurants.filter(r => !isQuarantined(r));
  const ids = (q) => searchPlaces({ places, query: q }).filteredRestaurants.map(r => r.id).sort().join(' ');
  const gf = ids('gluten free');
  for (const q of ['gluten free food', 'gluten free restaurants', 'gluten free 맛집', 'best gluten free food', 'gluten free near me', 'gluten free nearby']) assert.equal(ids(q), gf, q);
  const egg = ids('no egg');
  for (const q of ['no egg near me', 'no egg places', 'egg free restaurant']) assert.equal(ids(q), egg, q);
  assert.equal(ids('meat-free, egg-free'), ids('egg-free, meat-free'));
  assert.deepEqual(leftOutQuery('meat free and egg free').items, ['egg']);
  assert.deepEqual(leftOutQuery('corkage free').items, []);
  assert.deepEqual(leftOutQuery('free free free').items, []);
});

test('the body said of an ingredient, temple food in Chinese, alcohol left out by any wording', async () => {
  const { restaurants } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const { searchPlaces } = await import('../../src/search.js');
  const places = restaurants.filter(r => !isQuarantined(r));
  const ids = (q) => searchPlaces({ places, query: q }).filteredRestaurants.map(r => r.id).sort().join(' ');
  assert.equal(ids('lactose intolerant'), ids('dairy free'));
  assert.equal(ids('allergic to egg'), ids('no egg'));
  assert.equal(ids('egg allergy'), ids('no egg'));
  assert.equal(ids('佛教素食'), ids('寺廟料理'));
  assert.equal(ids('素菜'), ids('素食'));
  const halal = ids('halal no alcohol');
  for (const q of ['halal tanpa alkohol', 'halal without alcohol', '술 없는 할랄', '술 안 파는 할랄', '清真 无酒']) assert.equal(ids(q), halal, q);
  for (const id of ids('halal tanpa alkohol busan').split(' ').filter(Boolean)) assert.ok(ids('halal busan').includes(id), id);
});

test('"allergic to" and "allergy to" are of an ingredient only', async () => {
  const { leftOutQuery } = await import('../../src/filters.js');
  assert.deepEqual(leftOutQuery('allergy to egg').items, ['egg']);
  assert.deepEqual(leftOutQuery('allergic to the egg').items, ['egg']);
  for (const q of ['allergic to cats', 'allergic to pollen', 'allergic to dogs']) assert.deepEqual(leftOutQuery(q).items, [], q);
});

test('leaving an ingredient out, said in the other languages of the map, is read as in English', async () => {
  const { searchPlaces } = await import('../../src/search.js');
  const { restaurants } = await import('../../src/data/restaurants.js');
  const { isQuarantined } = await import('../../src/data/verification.js');
  const places = restaurants.filter(r => !isQuarantined(r));
  const ids = (q) => searchPlaces({ places, query: q }).filteredRestaurants.map(r => r.id).sort().join(' ');
  const egg = ids('vegetarian no egg');
  assert.ok(egg.length > 0);
  for (const q of ['vegetarian tanpa telur', '달걀 없는 채식', '계란 빼고 채식', '卵なし ベジタリアン', '素食 无蛋', '素食 不吃蛋']) assert.equal(ids(q), egg, q);
  const gluten = ids('gluten free');
  for (const q of ['bebas gluten', '글루텐 프리', 'グルテンフリー', '无麸质']) assert.equal(ids(q), gluten, q);
  for (const q of ['tanpa bawang putih', '마늘 없는']) assert.equal(ids(q), ids('no garlic'), q);
  assert.deepEqual(leftOutQuery('素食 无蛋无奶').items.sort(), ['egg', 'milk']);
  // A dish or a name that holds the word is not a word left out.
  for (const q of ['계란말이', '蛋糕', 'kacang', '파스타 없는', 'gula aren']) assert.deepEqual(leftOutQuery(q).items, [], q);
  // Every word of a list, and a question is not "no".
  for (const [q, items] of [['不吃蛋奶', ['egg', 'milk']], ['鱼、蛋过敏', ['fish', 'egg']], ['卵、小麦なし', ['egg', 'gluten']], ['밀, 달걀 없는', ['gluten', 'egg']], ['tanpa telur dan susu', ['egg', 'dairy']], ['不吃蒜葱', ['garlic', 'scallion']], ['우유 못 먹어요', ['milk']], ['와이파이 없는', []], ['비밀 없는', []], ['우리밀 없는', []], ['대파 빼고', ['scallion']], ['有没有虾', []], ['要不要蛋', []], ['要不加葱的', ['scallion']], ['我要没有虾的菜', ['shrimp']], ['无糖奶茶', []]]) assert.deepEqual(leftOutQuery(q).items, items, q);
  // Wheat keeps the reading it had: gluten free.
  for (const q of ['小麦なし', '밀가루없는']) assert.equal(ids(q), ids('gluten free'), q);
  assert.equal(ids('有没有酒'), '');
});

