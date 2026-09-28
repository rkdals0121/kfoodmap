import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntry, mergePassport, savedOnly, passportBelongsTo } from '../../src/data/passport.js';

const entry = (id, savedAt, visitedAt, updatedAt) => ({ id, savedAt, visitedAt, updatedAt });

test('a delete on one device is not resurrected by the other', () => {
  const local = [entry('a', null, null, 200)];   // unsaved here at t=200
  const remote = [entry('a', 100, null, 100)];   // still saved on the server
  const merged = mergePassport(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].savedAt, null, 'the later delete must win');
  assert.deepEqual(savedOnly(merged), []);
});

test('a place present on one side only survives', () => {
  const merged = mergePassport([entry('a', 1, null, 1)], [entry('b', 2, null, 2)]);
  assert.deepEqual(merged.map(e => e.id).sort(), ['a', 'b']);
});

test('a tie favours the saved side', () => {
  const merged = mergePassport([entry('a', null, null, 500)], [entry('a', 400, null, 500)]);
  assert.equal(merged[0].savedAt, 400, 'an equal timestamp must not destroy a record');
});

test('the visit invariant holds on every merged result', () => {
  const merged = mergePassport([], [entry('a', null, 900, 900)]);
  assert.equal(merged[0].visitedAt, null);
});

test('a real server timestamp beats a legacy record of unknown age', () => {
  const merged = mergePassport([entry('a', 0, null, 0)], [entry('a', null, null, 50)]);
  assert.equal(merged[0].savedAt, null);
});

test('legacy shapes normalise', () => {
  assert.deepEqual(normalizeEntry('a'), { id: 'a', savedAt: 0, visitedAt: null, updatedAt: 0 });
  assert.deepEqual(normalizeEntry({ id: 'b', savedAt: 7 }), { id: 'b', savedAt: 7, visitedAt: null, updatedAt: 7 });
  assert.equal(normalizeEntry({ savedAt: 1 }), null, 'an entry with no id is not an entry');
  assert.equal(normalizeEntry(null), null);
});

test('a tombstone never carries a visit', () => {
  assert.deepEqual(
    normalizeEntry({ id: 'c', savedAt: null, visitedAt: 5, updatedAt: 9 }),
    { id: 'c', savedAt: null, visitedAt: null, updatedAt: 9 },
  );
});

import { toRow, fromRow, pullPassport, pushPassport, deleteAllPassport } from '../../src/data/passport.js';

const CONFIG = { url: 'https://example.supabase.co', anonKey: 'eyJtest' };

test('a row round-trips through the wire shape', () => {
  const e = { id: 'a', savedAt: 1000, visitedAt: 2000, updatedAt: 3000 };
  const row = toRow('u1', e);
  assert.equal(row.user_id, 'u1');
  assert.equal(row.place_id, 'a');
  assert.equal(row.saved_at, new Date(1000).toISOString());
  assert.deepEqual(fromRow(row), e);
});

test('a tombstone crosses the wire as null, not as a missing row', () => {
  const row = toRow('u1', { id: 'a', savedAt: null, visitedAt: null, updatedAt: 5 });
  assert.equal(row.saved_at, null);
  assert.equal(fromRow(row).savedAt, null);
});

test('pull sends the user token, not the anon key, as Bearer', async () => {
  let seen;
  const fake = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => [
      { place_id: 'a', saved_at: new Date(10).toISOString(), visited_at: null, updated_at: new Date(10).toISOString() },
    ] };
  };
  const result = await pullPassport(CONFIG, 'user-jwt', fake);
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, [{ id: 'a', savedAt: 10, visitedAt: null, updatedAt: 10 }]);
  assert.equal(seen.init.headers.Authorization, 'Bearer user-jwt');
  assert.equal(seen.init.headers.apikey, CONFIG.anonKey);
  assert.ok(seen.url.startsWith('https://example.supabase.co/rest/v1/passports'));
});

test('a network failure is reported, never swallowed into an empty passport', async () => {
  const fake = async () => { throw new Error('offline'); };
  assert.deepEqual(await pullPassport(CONFIG, 'jwt', fake), { ok: false, entries: [] });
});

test('push upserts rather than duplicating', async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return { ok: true, status: 201 }; };
  await pushPassport([{ id: 'a', savedAt: 1, visitedAt: null, updatedAt: 1 }], CONFIG, 'jwt', 'u1', fake);
  assert.match(seen.init.headers.Prefer, /merge-duplicates/);
  assert.equal(JSON.parse(seen.init.body)[0].user_id, 'u1');
  assert.equal(seen.init.headers.Authorization, 'Bearer jwt');
  assert.equal(seen.init.headers.apikey, CONFIG.anonKey);
});

test('push of nothing makes no request', async () => {
  let called = false;
  const fake = async () => { called = true; return { ok: true, status: 201 }; };
  const result = await pushPassport([], CONFIG, 'jwt', 'u1', fake);
  assert.equal(called, false);
  assert.equal(result.ok, true);
});

test('delete-all scopes itself to the signed-in user', async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return { ok: true, status: 204 }; };
  await deleteAllPassport(CONFIG, 'jwt', 'u1', fake);
  assert.equal(seen.init.method, 'DELETE');
  assert.match(seen.url, /user_id=eq\.u1/);
  assert.equal(seen.init.headers.Authorization, 'Bearer jwt');
  assert.equal(seen.init.headers.apikey, CONFIG.anonKey);
});

// --- Whose passport is on this device? ---
//
// One predicate answers this for both the in-session account switch and the
// reload, because two answers drifting apart is what let one account's rows
// be pushed into another's.

test('an anonymous passport merges into the account that signs in', () => {
  // The operator's union-merge decision: places saved before signing in are
  // the signer's own and must follow them into the account.
  assert.equal(passportBelongsTo(null, 'user-b'), true);
});

test('a passport already owned by this account merges', () => {
  assert.equal(passportBelongsTo('user-b', 'user-b'), true);
});

test('a passport owned by a different account does NOT merge', () => {
  // The hostel machine: A closed the tab without signing out, or A's refresh
  // token expired. B must not inherit A's saved places.
  assert.equal(passportBelongsTo('user-a', 'user-b'), false);
});

test('a missing owner key with entries present is treated as anonymous and merges', () => {
  // Every device that upgrades to this version. Treating "unknown" as
  // "destroy" would wipe the passport of everyone who already had one.
  // `null` is what the production path produces: localStorage.getItem
  // returns null for an absent key, and loadPassportOwner's catch returns
  // null too. `undefined` is asserted only because the predicate is exported
  // and a caller could reach it with an unset variable.
  assert.equal(passportBelongsTo(null, 'user-b'), true);
  assert.equal(passportBelongsTo(undefined, 'user-b'), true);
});

test('the predicate does not answer for a signed-out device', () => {
  // Nothing is ever cleared without a user id to compare against; both
  // absent means there is no account to take the passport over.
  assert.equal(passportBelongsTo(null, null), true);
  assert.equal(passportBelongsTo('user-a', null), false);
});

// --- Malformed timestamps: NaN is not null, and `??` does not catch it ---
//
// `Date.parse('not a date')` is NaN. Before the Number.isFinite guard, that
// NaN flowed two ways and broke in two different places: into state and then
// through `JSON.stringify`, which writes NaN as `null` — silently converting
// a saved place into a tombstone on the next load — and into
// `new Date(NaN).toISOString()`, which throws RangeError on the way out.
test('a malformed saved_at reads back as unknown, never as a tombstone-by-accident', () => {
  const entry = fromRow({ place_id: 'a', saved_at: 'not a date', visited_at: null, updated_at: 'also not a date' });
  assert.equal(Number.isNaN(entry.savedAt), false, 'NaN reached the entry');
  assert.equal(Number.isNaN(entry.updatedAt), false, 'NaN reached the entry');
  // savedAt null here is honest — the value was unreadable — but it must be a
  // real null that survives a round trip through localStorage, not a NaN that
  // only becomes null once JSON.stringify has quietly rewritten it.
  assert.deepEqual(JSON.parse(JSON.stringify(entry)), entry, 'the entry does not survive JSON.stringify unchanged');
});

test('toRow does not throw on an unparseable timestamp — RangeError is not a sync failure mode', () => {
  assert.doesNotThrow(() => toRow('u1', { id: 'a', savedAt: Number.NaN, visitedAt: null, updatedAt: Number.NaN }));
  const row = toRow('u1', { id: 'a', savedAt: Number.NaN, visitedAt: null, updatedAt: Number.NaN });
  assert.equal(row.saved_at, null);
  // updated_at is `not null` in supabase/passports.sql — unlike saved_at, it
  // must never cross the wire as null, or the whole push batch fails with a
  // 400. An unreadable updatedAt falls back to the epoch, which already
  // means "time unknown" for this column.
  assert.equal(row.updated_at, new Date(0).toISOString());
});

test('toRow never emits a null updated_at — the column is not-null and one bad row fails the whole push batch', () => {
  // Fails against the pre-fix code, which does `iso(entry.updatedAt ?? 0)`:
  // `??` only catches a missing field, not a NaN that already made it past
  // `entry.updatedAt`, so the row's updated_at came back null there.
  const row = toRow('u1', { id: 'a', savedAt: 10, visitedAt: null, updatedAt: Number.NaN });
  assert.notEqual(row.updated_at, null, 'updated_at must never be null: the column is not-null');
  assert.equal(row.updated_at, new Date(0).toISOString());
});

test('a string date does not turn a saved place into a tombstone', () => {
  // Fails against the pre-fix `finite`, which only tries `Number(value)`:
  // `Number('2026-01-01')` is NaN, so a hand-edited or migration-written
  // ISO string in savedAt was read as null — a tombstone — and pushed to
  // every device as an unsave of a place the person still has saved.
  const row = toRow('u1', { id: 'a', savedAt: '2026-01-01T00:00:00.000Z', visitedAt: null, updatedAt: 5 });
  assert.notEqual(row.saved_at, null, 'a parseable date string must not become a tombstone');
  assert.equal(row.saved_at, new Date('2026-01-01T00:00:00.000Z').toISOString());
});

test('an actual garbage string still becomes null, not a thrown RangeError', () => {
  const row = toRow('u1', { id: 'a', savedAt: 'not a date at all', visitedAt: null, updatedAt: 5 });
  assert.equal(row.saved_at, null);
});

test('a real zero timestamp is still epoch, not "unknown" — the legacy shape must survive the guard', () => {
  // updatedAt 0 means "we do not know when", and it has to cross the wire as
  // a real timestamp that loses every merge, not vanish into null.
  const row = toRow('u1', { id: 'a', savedAt: 0, visitedAt: null, updatedAt: 0 });
  assert.equal(row.saved_at, new Date(0).toISOString());
  assert.equal(row.updated_at, new Date(0).toISOString());
  assert.equal(fromRow(row).savedAt, 0);
});
