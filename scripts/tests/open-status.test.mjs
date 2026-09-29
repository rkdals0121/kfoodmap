import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpenStatus } from '../../src/utils.js';

const hours = (weekly) => ({ value: { raw: 'test', weekly }, confidence: 'supported' });
const every = (slots) => Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => [d, slots]));
// 2026-09-29 is a Tuesday.
const at = (hh, mm, day = 29) => new Date(2026, 8, day, hh, mm);

test('a same-day slot is open inside and closed outside', () => {
  const h = hours(every([{ from: '11:00', to: '21:00' }]));
  assert.equal(getOpenStatus(h, at(12, 0)).open, true);
  assert.equal(getOpenStatus(h, at(22, 0)).open, false);
  assert.equal(getOpenStatus(h, at(9, 0)).detail, 'opens 11:00 AM');
});

test('a slot that runs past midnight is open in the evening', () => {
  const h = hours(every([{ from: '10:00', to: '01:00' }]));
  const s = getOpenStatus(h, at(23, 30));
  assert.equal(s.open, true);
  assert.equal(s.detail, 'until 1:00 AM');
});

test("just after midnight, yesterday's late slot is still open", () => {
  const h = hours(every([{ from: '10:00', to: '02:00' }]));
  assert.equal(getOpenStatus(h, at(0, 30)).open, true);
  assert.equal(getOpenStatus(h, at(2, 30)).open, false);
});

test("yesterday's late slot counts even if today is a closing day", () => {
  const w = every([{ from: '17:00', to: '02:00' }]);
  w.tue = [];
  assert.equal(getOpenStatus(hours(w), at(1, 0)).open, true);
  assert.equal(getOpenStatus(hours(w), at(12, 0)).detail, 'closed today');
});

test('last order after midnight is read against the late slot', () => {
  const h = hours(every([{ from: '18:00', to: '02:00', lastOrder: '01:00' }]));
  assert.equal(getOpenStatus(h, at(23, 0)).detail, 'until 2:00 AM · last order 1:00 AM');
  assert.match(getOpenStatus(h, at(1, 30)).detail, /last order passed/);
});

test('free-text hours across midnight', () => {
  const h = { value: { raw: '6:00 PM – 2:00 AM' }, confidence: 'supported' };
  assert.equal(getOpenStatus(h, at(23, 0)).open, true);
  assert.equal(getOpenStatus(h, at(1, 0)).open, true);
  assert.equal(getOpenStatus(h, at(15, 0)).open, false);
});
