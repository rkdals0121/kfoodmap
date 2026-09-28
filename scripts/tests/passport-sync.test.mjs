import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePassport, passportSignature, passportDelta, signInReturnTo } from '../../src/hooks/usePassportSync.js';

const config = { url: 'https://example.supabase.co', anonKey: 'eyJtest' };
const session = { access_token: 'user-token', user: { id: 'user-1' } };

const row = (id, savedAt, visitedAt = null, updatedAt = savedAt ?? 0) => ({
  place_id: id,
  saved_at: savedAt === null ? null : new Date(savedAt).toISOString(),
  visited_at: visitedAt === null ? null : new Date(visitedAt).toISOString(),
  updated_at: new Date(updatedAt).toISOString(),
});

// A fetch stub that answers the two passport endpoints and records what it
// was asked to do, so "did anything get written back?" is a fact about
// requests rather than about intent.
function stubFetch(remoteRows, { onPull } = {}) {
  const calls = [];
  const impl = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body });
    if ((options.method ?? 'GET') === 'GET') {
      if (onPull) await onPull();
      return { ok: true, status: 200, json: async () => remoteRows };
    }
    return { ok: true, status: 201, json: async () => [] };
  };
  return { impl, calls };
}

const pushes = calls => calls.filter(c => c.method === 'POST');

test('a reconcile whose generation moved mid-pull writes nothing — the delete stays deleted', async () => {
  // The Critical case: a pull is in flight when the user confirms "delete my
  // saved places". The delete succeeds and clears the device; then this pull
  // resolves holding the rows that were just deleted.
  let generation = 7;
  const writes = [];
  const { impl, calls } = stubFetch([row('kampungku', 1000), row('sanchon', 2000)], {
    onPull: async () => { generation += 1; }, // the delete lands mid-flight
  });

  const result = await reconcilePassport({
    config,
    session,
    setEntries: updater => writes.push(updater),
    isCurrent: (captured => () => generation === captured)(generation),
    fetchImpl: impl,
  });

  assert.equal(result.reason, 'stale');
  assert.equal(writes.length, 0, 'the deleted rows were written back into state');
  assert.equal(pushes(calls).length, 0, 'the deleted rows were pushed back to the server');
});

test('a reconcile that is still current commits the merge and pushes nothing itself', async () => {
  const writes = [];
  const remote = [];
  const { impl, calls } = stubFetch([row('kampungku', 1000)]);

  const result = await reconcilePassport({
    config,
    session,
    setEntries: updater => writes.push(updater),
    isCurrent: () => true,
    onRemote: rows => remote.push(rows),
    fetchImpl: impl,
  });

  assert.equal(result.reason, 'merged');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]([]).map(e => e.id), ['kampungku']);
  // Reconcile cannot know the merged list — React runs the updater later —
  // so it never pushes a snapshot. It reports what the server holds instead.
  assert.equal(pushes(calls).length, 0);
  assert.deepEqual(remote[0].map(e => e.id), ['kampungku']);
  assert.notEqual(remote[0][0].savedAt, null, 'a pulled save must not arrive as a tombstone');
});

test('a failed pull leaves local untouched and reports rather than emptying the passport', async () => {
  const writes = [];
  const calls = [];
  const impl = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET' });
    return { ok: false, status: 500, json: async () => [] };
  };

  const result = await reconcilePassport({
    config,
    session,
    setEntries: updater => writes.push(updater),
    isCurrent: () => true,
    fetchImpl: impl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'pull-failed');
  assert.equal(writes.length, 0);
  assert.equal(pushes(calls).length, 0);
});

test('the merge is a functional updater, so a tap queued in the same frame survives', async () => {
  // The lost-update case: the heart is tapped while the pull is in flight, so
  // by the time the merge runs React's queue already holds that entry. A
  // plain setEntries(merged) computed from a stale snapshot would erase it.
  const writes = [];
  const { impl } = stubFetch([row('kampungku', 1000)]);

  await reconcilePassport({
    config,
    session,
    setEntries: updater => writes.push(updater),
    isCurrent: () => true,
    fetchImpl: impl,
  });

  assert.equal(typeof writes[0], 'function', 'setEntries was called with a value, not an updater');
  const tappedDuringPull = [{ id: 'sanchon', savedAt: 5000, visitedAt: null, updatedAt: 5000 }];
  const next = writes[0](tappedDuringPull);
  assert.deepEqual(next.map(e => e.id).sort(), ['kampungku', 'sanchon']);
});

test('reconcile refuses to run without a session, so the passport table is never touched anonymously', async () => {
  const calls = [];
  const impl = async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => [] }; };

  for (const absent of [null, undefined]) {
    const result = await reconcilePassport({
      config, session: absent, setEntries: () => {}, isCurrent: () => true, fetchImpl: impl,
    });
    assert.equal(result.reason, 'no-session');
  }
  const noConfig = await reconcilePassport({
    config: null, session, setEntries: () => {}, isCurrent: () => true, fetchImpl: impl,
  });
  assert.equal(noConfig.reason, 'no-session');
  assert.equal(calls.length, 0);
});

test('the push signature is content identity, not array identity', () => {
  const a = [{ id: 'b', savedAt: 2, visitedAt: null, updatedAt: 2 }, { id: 'a', savedAt: 1, visitedAt: null, updatedAt: 1 }];
  const b = [{ id: 'a', savedAt: 1, visitedAt: null, updatedAt: 1 }, { id: 'b', savedAt: 2, visitedAt: null, updatedAt: 2 }];
  assert.equal(passportSignature(a), passportSignature(b), 'order must not change the signature');
  // Reference identity would have said "already pushed" for a list that is
  // in fact different, and "not yet pushed" for one that is the same — the
  // signature is what makes the push gate trustworthy.
  assert.notEqual(passportSignature(a), passportSignature([...a, { id: 'c', savedAt: 3, visitedAt: null, updatedAt: 3 }]));
  assert.equal(passportSignature(a), passportSignature(a.map(e => ({ ...e }))), 'a fresh copy must share its signature');

  const tombstoned = [{ id: 'a', savedAt: null, visitedAt: null, updatedAt: 3 }, { id: 'b', savedAt: 2, visitedAt: null, updatedAt: 2 }];
  assert.notEqual(passportSignature(b), passportSignature(tombstoned), 'an unsave must not look like an already-pushed list');
});

// --- The diffed push: the client half of the stale-write fix ---
//
// PostgREST's upsert is unconditional last-writer-wins on the whole row; it
// never consults updated_at. So what the client chooses to send IS the merge
// rule, as far as the server is concerned, and sending the whole list makes
// every heart tap a re-assertion of every other place in it.

test('a push sends only the entries that changed since the last delivered list', () => {
  const delivered = [
    { id: 'kampungku', savedAt: 1000, visitedAt: null, updatedAt: 1000 },
    { id: 'sanchon', savedAt: 2000, visitedAt: null, updatedAt: 2000 },
  ];
  const signature = passportSignature(delivered);
  const entries = [
    delivered[0],
    delivered[1],
    { id: 'gonghwachun', savedAt: 3000, visitedAt: null, updatedAt: 3000 },
  ];
  assert.deepEqual(passportDelta(entries, signature).map(e => e.id), ['gonghwachun']);
  assert.deepEqual(passportDelta(delivered, signature), [], 'an unchanged list has nothing to send');
});

test('the stale write cannot happen: one heart tap does not re-assert a place another device changed', () => {
  // The Critical, driven end to end through the two functions the push
  // effect uses. The laptop reconciled this morning and has held the tab
  // open since; the phone unsaved 'sanchon' this afternoon. Nothing on the
  // laptop re-reconciles mid-session, so its idea of the server is still
  // this morning's.
  const thisMorning = [
    { id: 'kampungku', savedAt: 1000, visitedAt: null, updatedAt: 1000 },
    { id: 'sanchon', savedAt: 1000, visitedAt: null, updatedAt: 1000 },
  ];
  const delivered = passportSignature(thisMorning);

  // The laptop's user taps the heart on a different place.
  const afterTap = [...thisMorning, { id: 'gonghwachun', savedAt: 9000, visitedAt: null, updatedAt: 9000 }];

  const sent = passportDelta(afterTap, delivered);
  assert.deepEqual(sent.map(e => e.id), ['gonghwachun']);
  assert.equal(sent.some(e => e.id === 'sanchon'), false,
    "the laptop re-asserted this morning's save over the phone's afternoon tombstone");
  // And what it does send is a fresh local write, so it can never be the
  // stale writer the database trigger has to catch.
  assert.ok(sent.every(e => e.updatedAt >= 9000));
});

test('an unsave is in the diff — the narrowing must not drop the write that matters most', () => {
  const delivered = passportSignature([{ id: 'sanchon', savedAt: 1000, visitedAt: null, updatedAt: 1000 }]);
  const unsaved = [{ id: 'sanchon', savedAt: null, visitedAt: null, updatedAt: 4000 }];
  assert.deepEqual(passportDelta(unsaved, delivered), unsaved);
});

test('a visit recorded against an otherwise unchanged save is in the diff', () => {
  const delivered = passportSignature([{ id: 'sanchon', savedAt: 1000, visitedAt: null, updatedAt: 1000 }]);
  const visited = [{ id: 'sanchon', savedAt: 1000, visitedAt: 5000, updatedAt: 5000 }];
  assert.deepEqual(passportDelta(visited, delivered).map(e => e.id), ['sanchon']);
});

test('an unknown delivered signature sends everything, which is what today already does', () => {
  const entries = [{ id: 'a', savedAt: 1, visitedAt: null, updatedAt: 1 }];
  for (const signature of [null, undefined, '', 'not json', '{"not":"an array"}']) {
    assert.deepEqual(passportDelta(entries, signature), entries, `signature ${JSON.stringify(signature)}`);
  }
});

test('the sign-in return URL keeps the page, and leaves auth-js room for its own params', () => {
  assert.equal(
    signInReturnTo({ origin: 'https://kfoodmap.app', pathname: '/place/gonghwachun' }),
    'https://kfoodmap.app/place/gonghwachun',
  );
  // A query or hash already on the URL is dropped on purpose: auth-js
  // appends `?code=…` / `#error=…` to whatever it is given.
  const returned = signInReturnTo({ origin: 'https://kfoodmap.app', pathname: '/', search: '?tab=journal', hash: '#x' });
  assert.equal(returned, 'https://kfoodmap.app/');
  assert.ok(!returned.includes('?') && !returned.includes('#'));
});
