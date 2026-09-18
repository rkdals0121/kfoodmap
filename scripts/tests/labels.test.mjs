import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import '../../src/i18n/index.js';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined, matchesDietary } from '../../src/data/verification.js';
import { CHIP_GROUPS, sourceLabel, methodLabel, SOURCE_LABEL_KEYS, METHOD_LABEL_KEYS } from '../../src/i18n/labels.js';
import { DIETARY_CHIPS, TRAIT_GROUPS } from '../../src/filters.js';

const active = restaurants.filter(r => !isQuarantined(r));

test('every chip id is answerable by the data — a renamed id fails here, not silently at runtime', () => {
  for (const group of CHIP_GROUPS) {
    for (const chip of group.chips) {
      if (DIETARY_CHIPS.includes(chip.id)) {
        assert.ok(active.some(r => matchesDietary(r, chip.id)), `no active restaurant matches dietary chip ${chip.id}`);
      } else if (Object.hasOwn(TRAIT_GROUPS, chip.id)) {
        const members = TRAIT_GROUPS[chip.id];
        assert.ok(active.some(r => r.traits.some(t => members.includes(t))), `no active restaurant is on the ${chip.id} axis`);
      } else {
        assert.ok(active.some(r => r.traits.includes(chip.id)), `no active restaurant carries trait ${chip.id}`);
      }
    }
  }
});

test('every DIETARY_CHIPS entry and TRAIT_GROUPS key has a chip in CHIP_GROUPS — a chip removed from App.jsx would otherwise go undetected here', () => {
  const chipIds = new Set(CHIP_GROUPS.flatMap(g => g.chips.map(c => c.id)));
  for (const id of DIETARY_CHIPS) {
    assert.ok(chipIds.has(id), `DIETARY_CHIPS entry ${id} has no chip in CHIP_GROUPS`);
  }
  for (const id of Object.keys(TRAIT_GROUPS)) {
    assert.ok(chipIds.has(id), `TRAIT_GROUPS key ${id} has no chip in CHIP_GROUPS`);
  }
});

test('every chip labelKey resolves to a real string', () => {
  for (const group of CHIP_GROUPS) {
    assert.notEqual(i18next.t(group.labelKey), group.labelKey, `missing key ${group.labelKey}`);
    for (const chip of group.chips) {
      assert.notEqual(i18next.t(chip.labelKey), chip.labelKey, `missing key ${chip.labelKey}`);
    }
  }
});

test('every source and method value in the data has a label entry', () => {
  const sources = new Set(), methods = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.source === 'string') sources.add(node.source);
    if (typeof node.method === 'string') methods.add(node.method);
    for (const value of Object.values(node)) walk(value);
  };
  restaurants.forEach(walk);
  for (const value of sources) assert.ok(SOURCE_LABEL_KEYS[value], `source without a label: ${value}`);
  for (const value of methods) assert.ok(METHOD_LABEL_KEYS[value], `method without a label: ${value}`);
});

test('an unmapped source or method degrades to the stored text, never to a key name', () => {
  assert.equal(sourceLabel('A source nobody mapped yet'), 'A source nobody mapped yet');
  assert.equal(methodLabel('A method nobody mapped yet'), 'A method nobody mapped yet');
  assert.equal(sourceLabel(undefined), '');
  assert.equal(methodLabel(null), '');
});

// --- Static t('key.path') resolution scan --------------------------------
//
// Walks src/**/*.{js,jsx} and collects every literal t('key.path') call site
// (regex on the file text, not a real parse — dynamic keys built from
// template literals or concatenation are invisible to this scan and skipped
// on purpose). Each key found must resolve to a real string, not its own
// name, catching a typo'd or deleted key before it ships as a blank label.
const rootDir = fileURLToPath(new URL('../../src', import.meta.url));

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function staticTKeys() {
  const keyPattern = /\bt\(\s*'([\w.]+)'/g;
  const keys = new Map(); // key -> Set of files
  for (const file of collectSourceFiles(rootDir)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(keyPattern)) {
      const key = match[1];
      if (!keys.has(key)) keys.set(key, new Set());
      keys.get(key).add(path.relative(rootDir, file));
    }
  }
  return keys;
}

test('every statically-referenced t(\'key.path\') resolves to a real string', () => {
  const keys = staticTKeys();
  assert.ok(keys.size > 0, 'the scan found no t(\'...\') call sites — the regex or the scan path is broken');
  for (const [key, files] of keys) {
    assert.notEqual(i18next.t(key), key, `key ${key} does not resolve (referenced in ${[...files].join(', ')})`);
  }
});
