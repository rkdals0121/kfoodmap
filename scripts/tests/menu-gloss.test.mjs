// Menu glosses (src/data/menu-<lang>.js) are keyed by the menu item's name
// as a record writes it. A key no record has is a gloss for nothing; and a
// gloss must not say "vegan" or "halal" of a dish whose name does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { MENU as en } from '../../src/data/menu-en.js';
import { MENU as ja } from '../../src/data/menu-ja.js';
import { MENU as ko } from '../../src/data/menu-ko.js';
import { MENU as zhHans } from '../../src/data/menu-zh-Hans.js';
import { MENU as zhHant } from '../../src/data/menu-zh-Hant.js';
import { MENU as id } from '../../src/data/menu-id.js';

const names = new Set(restaurants.flatMap(r => (Array.isArray(r.menus?.value) ? r.menus.value.map(m => m.name) : [])));
// Each diet word in a gloss needs its own word in the name: "vegan" is not
// licensed by "vegetarian", "veggie" or "plant" (eggplant).
const VEGAN = /비건|vegan|ヴィーガン|ビーガン|纯素|純素|全素/i;
const HALAL = /할랄|halal|ハラール|ハラル|清真/i;
const NAME_VEGAN = /비건|vegan|\bvg\b/i;
const NAME_HALAL = /할랄|halal/i;

test('every menu gloss is for a menu item on record and adds no diet word', () => {
  let count = 0;
  for (const [lang, glosses] of Object.entries({ en, ko, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, id })) {
    for (const [name, gloss] of Object.entries(glosses)) {
      assert.ok(names.has(name), `${lang}: no menu item named "${name}"`);
      assert.ok(typeof gloss === 'string' && gloss.trim(), `${lang}: empty gloss for "${name}"`);
      if (VEGAN.test(gloss)) assert.ok(NAME_VEGAN.test(name), `${lang}: "${gloss}" says vegan, "${name}" does not`);
      if (HALAL.test(gloss)) assert.ok(NAME_HALAL.test(name), `${lang}: "${gloss}" says halal, "${name}" does not`);
      count += 1;
    }
  }
  assert.ok(count > 5000, `only ${count} glosses`);
});
