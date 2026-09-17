import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { formatLead, parseResolveArgs } from '../lib/leads-format.mjs';

const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));
const place = restaurants.find(r => r.dietary?.halal?.value);
const base = {
  id: '11111111-2222-3333-4444-555555555555', created_at: '2026-09-17T05:00:00.000Z',
  kind: 'new', place_id: null, name: 'Test Kitchen', location_hint: 'near Itaewon station',
  topic: 'vegan', message: 'Whole menu is vegan', source_url: null, contact_email: null,
};

test('a new lead shows name, where and claim, and says when source/contact are missing', () => {
  const text = formatLead(base, byId);
  assert.match(text, /11111111-2222-3333-4444-555555555555 · new · vegan · 2026-09-17/);
  assert.match(text, /name: +Test Kitchen/);
  assert.match(text, /where: +near Itaewon station/);
  assert.match(text, /claim: +Whole menu is vegan/);
  assert.match(text, /source: +none given/);
  assert.match(text, /contact: +none/);
});

test('a correction shows the place and our current value for the topic, with its confidence', () => {
  const text = formatLead({ ...base, kind: 'correction', place_id: place.id, name: place.name, location_hint: null, topic: 'halal' }, byId);
  assert.match(text, new RegExp(`place: +${place.id} — `));
  assert.match(text, new RegExp(`current: +${place.dietary.halal.value} \\[${place.dietary.halal.confidence}\\]`));
  assert.doesNotMatch(text, /where:/);
});

test('a correction naming an unknown place is flagged, not printed as if valid', () => {
  const text = formatLead({ ...base, kind: 'correction', place_id: 'gone-place', topic: 'hours' }, byId);
  assert.match(text, /⚠ unknown place_id "gone-place"/);
  assert.doesNotMatch(text, /current:/);
});

test('topic "other" prints no current value', () => {
  const text = formatLead({ ...base, kind: 'correction', place_id: place.id, topic: 'other' }, byId);
  assert.doesNotMatch(text, /current:/);
});

test('an ANSI/CR escape in a message is stripped, never printed raw to the terminal', () => {
  const text = formatLead({ ...base, message: 'hide this\x1b[2K\rgone' }, byId);
  assert.equal(text.includes('\x1b'), false);
  assert.equal(text.includes('\r'), false);
});

test('a forged header embedded in a message cannot pass as a real lead header', () => {
  const forged = '\n── 99999999-0000-0000-0000-000000000000 · new · vegan · 2026-01-01';
  const text = formatLead({ ...base, message: `hello${forged}` }, byId);
  const headerLines = text.split('\n').filter(line => line.startsWith('──'));
  assert.deepEqual(headerLines, [`── ${base.id} · new · vegan · 2026-09-17`]);
});

test('resolve requires an id, a resolution status, and a non-empty note', () => {
  assert.deepEqual(parseResolveArgs(['abc', 'rejected', '--note', 'Permanently closed per Naver Place']),
    { ok: true, id: 'abc', status: 'rejected', note: 'Permanently closed per Naver Place' });
  assert.equal(parseResolveArgs(['abc', 'rejected']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'rejected', '--note', '   ']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'published', '--note', 'x']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'open', '--note', 'x']).ok, false);
  assert.equal(parseResolveArgs([]).ok, false);
});
