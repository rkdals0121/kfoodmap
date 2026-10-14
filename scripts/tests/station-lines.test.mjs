import test from 'node:test';
import assert from 'node:assert/strict';
import { localLine } from '../../src/data/station-ko.js';
import { restaurants } from '../../src/data/restaurants.js';

test('a numbered line in the reader\'s language, with its city', () => {
  assert.equal(localLine('Line 4', 'ja'), '4号線');
  assert.equal(localLine('Line 4', 'zh-Hans'), '4号线');
  assert.equal(localLine('Line 4', 'zh-Hant'), '4號線');
  assert.equal(localLine('Line 4', 'id'), 'Jalur 4');
  assert.equal(localLine('Seoul Subway Line 1', 'ja'), '1号線');
  assert.equal(localLine('Busan Line 1', 'ja'), '釜山1号線');
  assert.equal(localLine('Daejeon Metro Line 1', 'zh-Hans'), '大田1号线');
  assert.equal(localLine('Busan Line 1', 'id'), 'Jalur 1 Busan');
});

test('two lines: a bare second line is the first one\'s city, a bare first is Seoul\'s', () => {
  assert.equal(localLine('Daegu Line 1 / Line 2', 'ja'), '大邱1号線・大邱2号線');
  assert.equal(localLine('Daegu Line 1 / Line 2', 'id'), 'Jalur 1 Daegu / Jalur 2 Daegu');
  assert.equal(localLine('Line 1 / Incheon Line 1', 'zh-Hans'), '1号线、仁川1号线');
  assert.equal(localLine('Line 2 / Line 4', 'zh-Hant'), '2號線、4號線');
});

test('a named line, or a part that is not a numbered line, keeps the record\'s English', () => {
  for (const line of ['Shinbundang', 'Suin-Bundang Line', 'AREX (Airport Railroad)', 'Line 4 / Ui LRT',
    'Line 2 (Sinjeong branch) / Line 5', 'Korail / Daegu Line 1', 'Line 10', '', null, undefined]) {
    assert.equal(localLine(line, 'ja'), null, String(line));
  }
  assert.equal(localLine('Line 4', 'en'), null);
  assert.equal(localLine('Line 4', 'ko'), null);
});

test('every line on record is either wholly converted or left as written', () => {
  const lines = new Set(restaurants.map((r) => r.transit?.value?.line).filter((l) => typeof l === 'string'));
  for (const line of lines) {
    for (const language of ['ja', 'zh-Hans', 'zh-Hant', 'id']) {
      const shown = localLine(line, language);
      if (shown === null) continue;
      const leftover = shown.replace(/Jalur|Busan|Daegu|Incheon|Gwangju|Daejeon/g, '');
      assert.doesNotMatch(leftover, /[A-Za-z]/, `${line} → ${shown}`);
      assert.equal(shown.split(/・|、| \/ /).length, line.split(' / ').length, `${line} → ${shown}`);
    }
  }
});
