import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined } from '../../src/data/verification.js';
import {
  LEAD_LIMITS, LEAD_TOPICS, resolvePlace, buildLead, supabaseConfig, authHeaders, submitLead,
} from '../../src/data/leads.js';

const active = restaurants.find(r => !isQuarantined(r));
const quarantined = restaurants.find(r => isQuarantined(r));
const form = {
  name: 'Test Kitchen', locationHint: 'near Itaewon station', topic: 'vegan',
  message: 'The whole menu is vegan', sourceUrl: '', contactEmail: '', website: '',
};

test('a new-restaurant lead builds a row, empty optionals become null', () => {
  const result = buildLead(form);
  assert.equal(result.ok, true);
  assert.deepEqual(result.row, {
    kind: 'new', place_id: null, name: 'Test Kitchen', location_hint: 'near Itaewon station',
    topic: 'vegan', message: 'The whole menu is vegan', source_url: null, contact_email: null, lang: 'en',
  });
});

test('whitespace is trimmed', () => {
  const result = buildLead({ ...form, name: '  Test Kitchen  ', message: '\n ok \n' });
  assert.equal(result.row.name, 'Test Kitchen');
  assert.equal(result.row.message, 'ok');
});

test('a correction takes its name from the place and carries no location hint', () => {
  const result = buildLead({ ...form, name: 'ignored', locationHint: 'ignored' }, { place: active, lang: 'en' });
  assert.equal(result.ok, true);
  assert.equal(result.row.kind, 'correction');
  assert.equal(result.row.place_id, active.id);
  assert.equal(result.row.name, active.name);
  assert.equal(result.row.location_hint, null);
});

test('a filled honeypot is spam and produces no row', () => {
  const result = buildLead({ ...form, website: 'http://spam.example' });
  assert.equal(result.ok, false);
  assert.equal(result.spam, true);
  assert.equal(result.row, undefined);
});

test('name and message are required', () => {
  const result = buildLead({ ...form, name: '   ', message: '' });
  assert.equal(result.ok, false);
  assert.equal(result.spam, false);
  assert.deepEqual(result.errors.name, { code: 'required' });
  assert.deepEqual(result.errors.message, { code: 'required' });
});

test('topic must be one of the known topics', () => {
  for (const topic of LEAD_TOPICS) assert.equal(buildLead({ ...form, topic }).ok, true);
  assert.deepEqual(buildLead({ ...form, topic: 'rating' }).errors.topic, { code: 'invalidTopic' });
  assert.deepEqual(buildLead({ ...form, topic: '' }).errors.topic, { code: 'invalidTopic' });
});

test('length limits match the database, inclusive', () => {
  assert.equal(buildLead({ ...form, message: 'x'.repeat(2000) }).ok, true);
  assert.deepEqual(buildLead({ ...form, message: 'x'.repeat(2001) }).errors.message, { code: 'tooLong', max: 2000 });
  assert.deepEqual(buildLead({ ...form, name: 'x'.repeat(121) }).errors.name, { code: 'tooLong', max: 120 });
});

test('source URL must be http(s); email must look like an email', () => {
  assert.equal(buildLead({ ...form, sourceUrl: 'https://example.com/menu' }).ok, true);
  assert.deepEqual(buildLead({ ...form, sourceUrl: 'example.com' }).errors.source_url, { code: 'invalidUrl' });
  assert.deepEqual(buildLead({ ...form, sourceUrl: 'javascript:alert(1)' }).errors.source_url, { code: 'invalidUrl' });
  assert.equal(buildLead({ ...form, contactEmail: 'a@b.co' }).ok, true);
  assert.deepEqual(buildLead({ ...form, contactEmail: 'not-an-email' }).errors.contact_email, { code: 'invalidEmail' });
});

test('every restaurant name fits the name limit, so a correction can always be sent', () => {
  for (const r of restaurants) assert.ok(r.name.length <= LEAD_LIMITS.name, r.id);
});

test('resolvePlace: an active id resolves; quarantined, unknown and empty do not', () => {
  assert.equal(resolvePlace(active.id, restaurants), active);
  assert.equal(resolvePlace(quarantined.id, restaurants), null);
  assert.equal(resolvePlace('no-such-place', restaurants), null);
  assert.equal(resolvePlace(null, restaurants), null);
  assert.equal(resolvePlace('', restaurants), null);
});

test('supabaseConfig needs both variables and strips a trailing slash', () => {
  assert.equal(supabaseConfig({}), null);
  assert.equal(supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }), null);
  assert.equal(supabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.deepEqual(
    supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: 'k' }),
    { url: 'https://x.supabase.co', anonKey: 'k' },
  );
});

test('supabaseConfig normalizes a pasted Supabase "API URL" (with /rest/v1 path) to its origin', () => {
  assert.deepEqual(
    supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/rest/v1/', VITE_SUPABASE_ANON_KEY: 'k' }),
    { url: 'https://x.supabase.co', anonKey: 'k' },
  );
  assert.deepEqual(
    supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/rest/v1', VITE_SUPABASE_ANON_KEY: 'k' }),
    { url: 'https://x.supabase.co', anonKey: 'k' },
  );
  assert.deepEqual(
    supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    { url: 'https://x.supabase.co', anonKey: 'k' },
  );
});

test('supabaseConfig rejects a value that is not a parseable http(s) URL', () => {
  assert.equal(supabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.equal(supabaseConfig({ VITE_SUPABASE_URL: 'ftp://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }), null);
});

test('authHeaders: legacy JWT keys also go in Authorization, new keys only in apikey', () => {
  assert.deepEqual(authHeaders('eyJhbGciOi.x.y'), { apikey: 'eyJhbGciOi.x.y', Authorization: 'Bearer eyJhbGciOi.x.y' });
  assert.deepEqual(authHeaders('sb_publishable_abc'), { apikey: 'sb_publishable_abc' });
});

test('submitLead posts the row and reports the outcome', async () => {
  const calls = [];
  const fake = (status) => async (url, init) => { calls.push({ url, init }); return { status }; };
  const config = { url: 'https://x.supabase.co', anonKey: 'sb_publishable_abc' };
  const { row } = buildLead(form);

  assert.deepEqual(await submitLead(row, config, fake(201)), { ok: true });
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/leads');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_abc');
  assert.equal(calls[0].init.headers.Prefer, 'return=minimal');
  assert.deepEqual(JSON.parse(calls[0].init.body), row);

  assert.deepEqual(await submitLead(row, config, fake(401)), { ok: false, status: 401 });
  assert.deepEqual(
    await submitLead(row, config, async () => { throw new TypeError('network'); }),
    { ok: false, status: 0 },
  );
});
