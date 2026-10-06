// Menu glosses (src/data/menu-<lang>.js) are keyed by the menu item's name
// as a record writes it. A key no record has is a gloss for nothing; and a
// gloss must not say "vegan" or "halal" of a dish whose name does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { MENU as en } from '../../src/data/menu-en.js';
import { MENU as ja } from '../../src/data/menu-ja.js';
import { MENU as zhHans } from '../../src/data/menu-zh-Hans.js';
import { MENU as zhHant } from '../../src/data/menu-zh-Hant.js';
import { MENU as id } from '../../src/data/menu-id.js';

const names = new Set(restaurants.flatMap(r => (Array.isArray(r.menus?.value) ? r.menus.value.map(m => m.name) : [])));
const DIET = /비건|vegan|ヴィーガン|ビーガン|纯素|純素|할랄|halal|ハラール|ハラル|清真/i;
const SAYS = /비건|vegan|할랄|halal|채식|vegetarian|veggie|veg\b|plant/i;

test('every menu gloss is for a menu item on record and adds no diet word', () => {
  for (const [lang, glosses] of Object.entries({ en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, id })) {
    for (const [name, gloss] of Object.entries(glosses)) {
      assert.ok(names.has(name), `${lang}: no menu item named "${name}"`);
      assert.ok(typeof gloss === 'string' && gloss.trim(), `${lang}: empty gloss for "${name}"`);
      if (DIET.test(gloss)) assert.ok(SAYS.test(name), `${lang}: "${gloss}" says more than "${name}"`);
    }
  }
});
