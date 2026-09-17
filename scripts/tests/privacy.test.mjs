import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privacyPolicy, LEAD_EMAIL_RETENTION_DAYS } from '../../src/data/privacy.js';
import { emailPurgeCutoff } from '../lib/leads-retention.mjs';

test('both languages carry the same sections, with the same list lengths', () => {
  const { en, ko } = privacyPolicy;
  assert.equal(en.sections.length, ko.sections.length);
  en.sections.forEach((section, i) => {
    assert.equal(Boolean(section.text), Boolean(ko.sections[i].text), `section ${i} text`);
    assert.equal(section.items?.length, ko.sections[i].items?.length, `section ${i} items`);
  });
});

test('the retention period stated in the text is the one the purge uses', () => {
  assert.equal(LEAD_EMAIL_RETENTION_DAYS, 365);
  const retention = (policy) => policy.sections.map(s => s.text ?? '').join(' ');
  assert.match(retention(privacyPolicy.en), /one year after you send the report/);
  assert.match(retention(privacyPolicy.ko), /보낸 날로부터 1년 후/);
});

test('emailPurgeCutoff is exactly the retention period before now', () => {
  const now = new Date('2027-03-01T12:00:00.000Z');
  assert.equal(emailPurgeCutoff(now, 365), '2026-03-01T12:00:00.000Z');
  assert.equal(emailPurgeCutoff(now, 1), '2027-02-28T12:00:00.000Z');
});

test('emailPurgeCutoff refuses a non-positive period, so a typo cannot purge everything', () => {
  assert.throws(() => emailPurgeCutoff(new Date(), 0));
  assert.throws(() => emailPurgeCutoff(new Date(), -5));
  assert.throws(() => emailPurgeCutoff(new Date(), Number.NaN));
});
