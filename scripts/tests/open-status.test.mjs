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
  assert.equal(getOpenStatus(hours(w), at(12, 0)).detail, 'opens tomorrow 5:00 PM');
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

test('after the last slot, it says when it next opens', () => {
  const h = hours(every([{ from: '11:00', to: '21:00' }]));
  assert.equal(getOpenStatus(h, at(22, 0)).detail, 'opens tomorrow 11:00 AM');
});

test('closing days are skipped to the next opening day', () => {
  const w = every([{ from: '11:30', to: '21:00' }]);
  w.wed = []; // 2026-09-29 is a Tuesday
  w.thu = [];
  assert.equal(getOpenStatus(hours(w), at(22, 0)).detail, 'opens Fri 11:30 AM');
});

test('an unrecorded day stops the look-ahead rather than being skipped', () => {
  const w = every([{ from: '11:00', to: '21:00' }]);
  delete w.wed;
  assert.equal(getOpenStatus(hours(w), at(22, 0)).detail, 'closed for today');
  w.tue = [];
  assert.equal(getOpenStatus(hours(w), at(12, 0)).detail, 'closed today');
});

test('"open now" is asked of the clock in Korea, whatever the device time zone', () => {
  const hours = { value: { weekly: { fri: [{ from: '11:00', to: '15:00' }], sat: [] } }, confidence: 'supported', source: 'x' };
  // 2026-10-02 04:00 UTC is Friday 13:00 in Korea: open.
  assert.equal(getOpenStatus(hours, new Date('2026-10-02T04:00:00Z')).open, true);
  // 2026-10-02 12:00 UTC is Friday 21:00 in Korea: closed, though it is
  // lunchtime in London.
  assert.equal(getOpenStatus(hours, new Date('2026-10-02T12:00:00Z')).open, false);
  // 2026-10-02 16:00 UTC is already Saturday 01:00 in Korea.
  assert.equal(getOpenStatus(hours, new Date('2026-10-02T16:00:00Z')).detail, 'closed today');
});

test('open but past last order is marked not orderable', () => {
  const h = { value: { weekly: { fri: [{ from: '11:00', to: '22:00', lastOrder: '21:00' }] } }, confidence: 'supported', source: 'x' };
  // Friday 21:30 in Korea.
  const late = getOpenStatus(h, new Date('2026-10-02T12:30:00Z'));
  assert.equal(late.open, true);
  assert.equal(late.orderable, false);
  // Friday 20:00 in Korea: open and orderable (the field is simply absent).
  const early = getOpenStatus(h, new Date('2026-10-02T11:00:00Z'));
  assert.equal(early.open, true);
  assert.notEqual(early.orderable, false);
});

test('language detection maps the browser list to a language we have', async () => {
  const { detectLanguage } = await import('../../src/i18n/index.js');
  assert.equal(detectLanguage(['ja-JP', 'en-US']), 'ja');
  assert.equal(detectLanguage(['zh-TW', 'en']), 'zh-Hans');
  assert.equal(detectLanguage(['id']), 'id');
  assert.equal(detectLanguage(['ms-MY', 'en']), 'en');
  assert.equal(detectLanguage(['fr-FR', 'ja']), 'ja');
  assert.equal(detectLanguage(['ko-KR']), 'en');
  assert.equal(detectLanguage(undefined), 'en');
});
