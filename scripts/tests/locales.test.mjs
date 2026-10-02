import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every locale file must be the same shape as English: the same keys, and in
// each string the same {{placeholders}} and <0></0> tags. A missing key would
// silently fall back to English mid-sentence; a missing placeholder would
// drop a number, a date or a name from a sentence.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/i18n/locales');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const load = async (f) => (await import(pathToFileURL(path.join(dir, f)).href)).default;

const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
));
// English plural pairs (x_one / x_other) may be a single x_other elsewhere:
// Japanese, Chinese and Indonesian have one plural form.
const base = (key) => key.replace(/_(one|other)$/, '');
const placeholders = (s) => [...String(s).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1]).sort();
const tags = (s) => [...String(s).matchAll(/<(\/?)(\d+)\s*\/?>/g)].map(m => m[1] + m[2]).sort();

const en = Object.fromEntries(flatten(await load('en.js')));

for (const file of files.filter(f => f !== 'en.js')) {
  const locale = Object.fromEntries(flatten(await load(file)));

  test(`${file}: has every key English has, and no others`, () => {
    const want = new Set(Object.keys(en).map(base));
    const have = new Set(Object.keys(locale).map(base));
    assert.deepEqual([...want].filter(k => !have.has(k)), [], 'missing keys');
    assert.deepEqual([...have].filter(k => !want.has(k)), [], 'unknown keys');
  });

  test(`${file}: every string keeps English's placeholders and tags`, () => {
    for (const [key, value] of Object.entries(locale)) {
      const source = en[key] ?? en[`${base(key)}_other`] ?? en[base(key)];
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim().length > 0, `${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(source), `${key}: placeholders`);
      assert.deepEqual(tags(value), tags(source), `${key}: tags`);
    }
  });

  test(`${file}: a plural key keeps an _other form`, () => {
    for (const key of Object.keys(en).filter(k => k.endsWith('_other'))) {
      assert.ok(key in locale, `${key} missing`);
    }
  });
}

test('there is an English locale to compare against', () => {
  assert.ok(Object.keys(en).length > 100);
});
