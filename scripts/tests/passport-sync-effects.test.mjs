// The effect layer of usePassportSync, driven through a real React renderer.
//
// The pure pieces (reconcilePassport, mergePassport, passportDelta,
// passportBelongsTo) are covered in passport-sync.test.mjs and
// passport.test.mjs. Every Critical found in this file so far has been in
// the effect layer instead — the generation gate, the push gate, the
// account-change branch — and none of it is reachable from a pure function.
// So this file mounts the hook for real: React state, React effects, real
// timers, a jsdom localStorage, and a fetch stub standing in for PostgREST.
//
// Nothing here reimplements the hook. Every assertion is about what the
// device ended up holding (React state, localStorage) or what crossed the
// wire (the recorded fetch calls).
import test, { before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// --- browser globals, before anything React touches them -------------------

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://kfoodmap.test/',
});
const define = (name, value) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define('window', dom.window);
define('document', dom.window.document);
define('navigator', dom.window.navigator);
define('localStorage', dom.window.localStorage);
define('IS_REACT_ACT_ENVIRONMENT', true);

const href = relative => new URL(relative, import.meta.url).href;
const LEADS = href('../../src/data/leads.js');
const AUTH = href('../../src/data/auth.js');

// The hook reads its config from `import.meta.env`, which Vite fills in and
// Node does not — under `node --test` it is undefined, so supabaseConfig
// returns null and the hook goes permanently offline. Mocking that one
// export is what makes the module reachable at all; the rest of leads.js is
// passed straight through so nothing else changes shape.
const CONFIG = { url: 'https://example.supabase.co', anonKey: 'eyJtest' };

// Set by each test before it mounts; the mocked createAuthClient hands this
// back so the test can drive onAuthStateChange the way GoTrue would.
let nextClient = null;
// How many times the next createAuthClient calls should fail before one
// succeeds. Stands in for the dynamic import of the auth chunk failing: an
// offline cold start (the chunk is deliberately not precached), a captive
// portal answering with its own HTML so the import fails on MIME, or a stale
// hashed asset after a deploy.
let clientLoadFailures = 0;

let usePassportSync;
let React;
let createRoot;
let act;
let PASSPORT_KEY;
let PASSPORT_OWNER_KEY;
let loadLocalPassport;
let saveLocalPassport;

before(async () => {
  const leads = await import(LEADS);
  mock.module(LEADS, {
    namedExports: { ...leads, supabaseConfig: () => CONFIG },
  });
  mock.module(AUTH, {
    namedExports: {
      AUTH_STORAGE_KEY: 'kfm-auth',
      // Async, because the real one is: it dynamic-imports
      // `@supabase/auth-js` so the library never lands in the first-paint
      // bundle. The seam is unchanged — the hook still gets a GoTrue-shaped
      // client from this module and nothing else — but it now arrives a
      // microtask later, which is exactly the timing these sequences must
      // keep surviving.
      createAuthClient: async () => {
        if (clientLoadFailures > 0) {
          clientLoadFailures -= 1;
          throw new Error('failed to fetch dynamically imported module');
        }
        return nextClient;
      },
      // The real one answers "is the client owed on this load?" from
      // localStorage and the URL. Answered true here so every sequence below
      // still runs against a mounted, subscribed client, the way it did when
      // the client was built unconditionally.
      authClientNeededNow: () => true,
      storedSessionExists: () => false,
      authReturnInUrl: () => false,
      // No refusal in the URL: these sequences are about what happens after
      // a session exists, not about how one was started.
      authRefusedInUrl: () => false,
      // Answered without a request: the sign-in row is not what this file
      // is about, and a real call would be one more thing to stub.
      googleEnabled: async () => false,
    },
  });

  React = await import('react');
  act = React.act;
  ({ createRoot } = await import('react-dom/client'));
  usePassportSync = (await import(href('../../src/hooks/usePassportSync.js'))).default;
  ({ PASSPORT_KEY, PASSPORT_OWNER_KEY, loadLocalPassport, saveLocalPassport } =
    await import(href('../../src/data/passport.js')));
});

// --- the fake GoTrue client ------------------------------------------------

function fakeAuthClient() {
  let listener = null;
  return {
    onAuthStateChange(fn) {
      listener = fn;
      return { data: { subscription: { unsubscribe() { listener = null; } } } };
    },
    // What GoTrue emits: INITIAL_SESSION on subscribe, SIGNED_IN on a new
    // session, SIGNED_OUT / TOKEN_REFRESH_FAILED with a null one.
    emit(event, session) { if (listener) listener(event, session); },
    signInWithOAuth: async function () { this.oauthCalls += 1; return {}; },
    oauthCalls: 0,
    signOut: async () => ({ error: null }),
  };
}

const sessionFor = (id, token = `${id}-token`) => ({ access_token: token, user: { id } });

// --- the fetch stub: PostgREST, reduced to the three calls this hook makes --

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function installNet() {
  const calls = [];
  const state = {
    rows: [],
    pullOk: true,
    pushOk: true,
    deleteOk: true,
    // Set to a deferred to freeze the NEXT pull / delete in flight; consumed
    // by the call it holds, so later calls are not affected.
    holdPull: null,
    holdDelete: null,
  };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    calls.push({ method, url: String(url), body: options.body });
    if (method === 'GET') {
      // Captured at call time. A pull still in flight when the rows are
      // deleted must resolve holding the rows it actually read — that
      // snapshot IS the stale-reconcile bug.
      const snapshot = state.rows;
      const hold = state.holdPull;
      state.holdPull = null;
      if (hold) await hold.promise;
      if (!state.pullOk) return { ok: false, status: 500, json: async () => [] };
      return { ok: true, status: 200, json: async () => snapshot };
    }
    if (method === 'DELETE') {
      const hold = state.holdDelete;
      state.holdDelete = null;
      if (hold) await hold.promise;
      return { ok: state.deleteOk, status: state.deleteOk ? 204 : 500 };
    }
    return { ok: state.pushOk, status: state.pushOk ? 201 : 500 };
  };
  return { calls, state };
}

const posts = calls => calls.filter(c => c.method === 'POST');
const pulls = calls => calls.filter(c => c.method === 'GET');
const deletes = calls => calls.filter(c => c.method === 'DELETE');
const postedRows = calls => posts(calls).flatMap(c => JSON.parse(c.body));
const postedIds = calls => postedRows(calls).map(r => r.place_id);

// --- the host component: App.jsx's passport wiring, and nothing else -------

// The hook's own debounce is 1000 ms and is not configurable, so the waits
// are real. Kept just above it so a push that is going to happen has
// happened by the time the assertion reads the call log.
const PUSH_WAIT_MS = 1400;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const entry = (id, at) => ({ id, savedAt: at, visitedAt: null, updatedAt: at });
const row = (id, at) => ({
  place_id: id,
  saved_at: new Date(at).toISOString(),
  visited_at: null,
  updated_at: new Date(at).toISOString(),
});

const seedDevice = (entries, owner) => {
  localStorage.setItem(PASSPORT_KEY, JSON.stringify(entries));
  if (owner) localStorage.setItem(PASSPORT_OWNER_KEY, owner);
};
const deviceEntries = () => JSON.parse(localStorage.getItem(PASSPORT_KEY) ?? 'null');
const deviceOwner = () => localStorage.getItem(PASSPORT_OWNER_KEY);

let mounted = [];

async function mountHook({ isOnline = true } = {}) {
  const { useState, useEffect, createElement } = React;
  const api = { current: null };

  function Harness() {
    const [entries, setEntries] = useState(loadLocalPassport);
    // App.jsx passes useOnlineStatus() here, which flips on the browser's
    // online/offline events. Held in state so a test can flip it the way a
    // reconnect does.
    const [online, setOnline] = useState(isOnline);
    // App.jsx line 104: local first, always. Present here because three of
    // these sequences are about what the DEVICE ends up holding.
    useEffect(() => { saveLocalPassport(entries); }, [entries]);
    const sync = usePassportSync({ entries, setEntries, isOnline: online });
    api.current = { ...sync, entries, setEntries, setOnline };
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
  // The client now arrives through a promise, so the subscribe effect runs on
  // the render after the one that mounted. Flushed here so every test below
  // can still emit auth events on the line after mounting.
  await flush();
  const handle = {
    api,
    unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); },
  };
  mounted.push(handle);
  return handle;
}

// Every wait goes through act so React flushes effects, and the state
// updates they queue, before an assertion reads anything.
const flush = async (ms = 0) => { await act(async () => { await sleep(ms); }); };
const signal = async (client, event, session) => {
  await act(async () => { client.emit(event, session); });
  await flush();
};
const tap = async (api, id, at) => {
  await act(async () => {
    api.current.setEntries(prev => [...prev.filter(e => e.id !== id), entry(id, at)]);
  });
  await flush();
};

let net;
beforeEach(() => {
  localStorage.clear();
  nextClient = fakeAuthClient();
  clientLoadFailures = 0;
  net = installNet();
});
afterEach(async () => {
  for (const handle of mounted) await handle.unmount();
  mounted = [];
});

// --- 1. a stale reconcile after a delete ----------------------------------

test('a pull that resolves after "delete my saved places" puts nothing back — not in state, not on the device, not on the server', async () => {
  seedDevice([entry('kampungku', 1000)], null);
  const client = nextClient;
  const { api } = await mountHook();

  // The pull that is about to go stale. It reads the pre-delete rows and
  // then hangs.
  net.state.rows = [row('kampungku', 1000), row('sanchon', 2000)];
  const inFlight = deferred();
  net.state.holdPull = inFlight;
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  assert.equal(pulls(net.calls).length, 1, 'the reconcile pull did not start');

  // The user confirms the delete while that pull is still out. The server
  // is empty from here on; the reconcile that reopens the gate sees that.
  net.state.rows = [];
  await act(async () => { await api.current.deleteRecords(); });
  await flush();
  assert.equal(deletes(net.calls).length, 1, 'the DELETE did not go out');

  // Now the pre-delete pull comes back, holding two places the user was
  // told could not come back.
  await act(async () => { inFlight.resolve(); await sleep(0); });
  await flush(PUSH_WAIT_MS);

  assert.deepEqual(api.current.entries, [], 'the deleted rows were merged back into state');
  assert.deepEqual(deviceEntries(), [], 'the deleted rows were written back to localStorage');
  assert.deepEqual(postedIds(net.calls), [], 'the deleted rows were pushed back to the server');
  // The owner key is back, and legitimately so: clearDevice bumped syncEpoch,
  // that reconcile pulled the now-empty server and recorded whose empty
  // passport this is. Asserted rather than ignored so a future change that
  // stops reopening the gate here is visible from this test too.
  assert.equal(deviceOwner(), 'user-a');
  assert.equal(pulls(net.calls).length, 2, 'the delete did not reopen the gate with a reconcile');
});

// --- 2. an account change closes the push gate ----------------------------

test("B's session replaces A's: with B's pull failing, nothing is pushed under B's id", async () => {
  // A signs in and reconciles, so the push gate is open and `pushedRef`
  // holds A's remote.
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('kampungku', 1000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);
  assert.deepEqual(api.current.entries.map(e => e.id), ['kampungku']);
  assert.equal(deviceOwner(), 'user-a', "A's reconcile did not record the owner");

  const callsBefore = net.calls.length;

  // B's session replaces A's, and B's pull fails — a 500, or a captive
  // portal answering with its own login page. This is exactly the moment
  // the device has no fresh remote to compare against.
  net.state.pullOk = false;
  await signal(client, 'SIGNED_IN', sessionFor('user-b'));
  await flush(PUSH_WAIT_MS);

  // The device was A's, so it is cleared rather than donated to B.
  assert.deepEqual(api.current.entries, [], "A's places survived the account change");
  assert.deepEqual(deviceEntries(), []);
  assert.equal(deviceOwner(), null);

  // B taps a heart. The gate is shut — B's remote has never been read — so
  // this waits for a reconcile rather than upserting blind.
  await tap(api, 'gonghwachun', 9000);
  await flush(PUSH_WAIT_MS);

  const after = net.calls.slice(callsBefore);
  assert.deepEqual(postedIds(after), [],
    'the device pushed under a user id whose remote it had never read');
  assert.equal(postedRows(net.calls).some(r => r.user_id === 'user-b'), false,
    "rows were upserted under B's user id with no reconcile behind them");
  assert.equal(postedIds(net.calls).includes('kampungku'), false,
    "A's places were uploaded into B's account");
});

// --- 3. the gate reopens after a successful delete ------------------------

test('a save made after a successful delete still reaches the server', async () => {
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('kampungku', 1000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);

  net.state.rows = [];
  await act(async () => { await api.current.deleteRecords(); });
  await flush();
  assert.equal(deletes(net.calls).length, 1);

  const callsBefore = net.calls.length;
  await tap(api, 'gonghwachun', 9000);
  await flush(PUSH_WAIT_MS);

  const after = net.calls.slice(callsBefore);
  assert.deepEqual(postedIds(after), ['gonghwachun'],
    'syncing stopped silently for the rest of the session after the delete');
  assert.equal(postedRows(after)[0].user_id, 'user-a');
});

// --- 4. no push around an in-flight DELETE --------------------------------

test('a heart tapped while the DELETE is in flight is not POSTed back around it', async () => {
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('kampungku', 1000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);
  const callsBefore = net.calls.length;

  // The DELETE goes out and hangs — a request slower than the 1000 ms push
  // debounce, which is the whole window this guard is about.
  const inFlight = deferred();
  net.state.holdDelete = inFlight;
  net.state.rows = [];
  let deleting;
  await act(async () => { deleting = api.current.deleteRecords(); await sleep(0); });
  assert.equal(deletes(net.calls).length, 1, 'the DELETE did not start');

  // The user taps a heart while it is out.
  await tap(api, 'gonghwachun', 9000);
  await flush(PUSH_WAIT_MS);
  assert.deepEqual(postedIds(net.calls.slice(callsBefore)), [],
    'rows were POSTed back around the DELETE that was meant to remove them');

  await act(async () => { inFlight.resolve(); await deleting; });
  await flush();
  assert.deepEqual(api.current.entries, [], 'the delete did not clear the device');
  assert.deepEqual(deviceEntries(), []);
});

// The mirror of the sequence above, and the one that actually proves the
// generation check INSIDE the push timer callback (usePassportSync.js, the
// `generationRef.current !== generation` line in the debounced push).
//
// Test 4 taps after the DELETE has started, so the push gate is already shut
// — `pushedRef` was nulled before the effect re-ran — and no timer is ever
// scheduled. That guard is never reached, which is why removing it leaves
// test 4 passing. Here the order is reversed: the tap schedules a timer while
// the gate is open, and only THEN does the delete land. `invalidate()` closes
// the gate against new scheduling and bumps the generation, but it cannot
// clear a timer that already exists — the push effect's deps (entries,
// session, config, isOnline) have not changed, so React runs no cleanup. The
// timer survives with the old generation and comes due mid-DELETE.
//
// Without the check, `passportDelta(entries, null)` finds nothing recorded as
// delivered and returns EVERY entry, POSTing the whole passport back around
// the DELETE that was meant to remove it.
test('a heart tapped BEFORE the delete does not ride a timer around it', async () => {
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('kampungku', 1000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);
  const callsBefore = net.calls.length;

  // The tap comes first, and is deliberately NOT waited out: a push timer is
  // now scheduled, carrying this generation, due in 1000 ms.
  await tap(api, 'gonghwachun', 9000);
  assert.deepEqual(postedIds(net.calls.slice(callsBefore)), [],
    'the push debounce elapsed before the delete — this sequence needs it pending');

  // Inside that window the user confirms the delete, and the DELETE hangs.
  const inFlight = deferred();
  net.state.holdDelete = inFlight;
  net.state.rows = [];
  let deleting;
  await act(async () => { deleting = api.current.deleteRecords(); await sleep(0); });
  assert.equal(deletes(net.calls).length, 1, 'the DELETE did not start');

  // The timer comes due while the DELETE is still out.
  await flush(PUSH_WAIT_MS);
  assert.deepEqual(postedIds(net.calls.slice(callsBefore)), [],
    'a push scheduled before the delete fired around it and re-uploaded the passport');

  await act(async () => { inFlight.resolve(); await deleting; });
  await flush(PUSH_WAIT_MS);
  assert.deepEqual(api.current.entries, [], 'the delete did not clear the device');
  assert.deepEqual(deviceEntries(), []);
  assert.equal(postedIds(net.calls).includes('kampungku'), false,
    'the deleted rows were pushed back to the server');
});

// --- 5. a session that ends on its own ------------------------------------

test('an expired or revoked session clears this device and says so', async () => {
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('kampungku', 1000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);
  assert.deepEqual(api.current.entries.map(e => e.id), ['kampungku']);
  assert.equal(api.current.sessionEnded, false);

  // GoTrue emits a null session: the refresh token expired, was revoked, or
  // another tab signed out. From here they are the same event.
  await signal(client, 'TOKEN_REFRESH_FAILED', null);
  await flush();

  assert.deepEqual(api.current.entries, [], 'the places outlived the session that owned them');
  assert.deepEqual(deviceEntries(), [], 'the places are still on the device');
  assert.equal(deviceOwner(), null, 'the device still claims an owner with no session');
  assert.equal(api.current.sessionEnded, true,
    'the Journal emptied itself with no explanation');
  assert.equal(localStorage.getItem('kfm-session-ended'), '1',
    'the explanation would not survive a reload');
});

test('a device that never had a session is left alone', async () => {
  // null -> null. Nothing ended here, so nothing is cleared: this is the
  // anonymous passport, and it has to survive until its owner signs in.
  seedDevice([entry('kampungku', 1000)], null);
  const client = nextClient;
  const { api } = await mountHook();
  await signal(client, 'INITIAL_SESSION', null);
  await flush(PUSH_WAIT_MS);

  assert.deepEqual(api.current.entries.map(e => e.id), ['kampungku'],
    'a passport that never had a session was wiped');
  assert.deepEqual(deviceEntries().map(e => e.id), ['kampungku']);
  assert.equal(api.current.sessionEnded, false,
    'a device that never signed in was told its session ended');
  // Passport requests only. `googleEnabled` is mocked out in this file, so
  // the one anonymous request the hook really does make — the readiness probe
  // — never reaches this stub and is not what is being asserted here.
  assert.equal(pulls(net.calls).length, 0, 'a signed-out device pulled the passport');
  assert.deepEqual(postedIds(net.calls), []);
});

// --- 6. a chunk load that fails is not permanent --------------------------

// `@supabase/auth-js` is loaded on demand, so building the client is now a
// network operation that can fail. It must fail the way this app fails
// everywhere else — quietly, and temporarily. A failure cached for the life
// of the page would mean a signed-in visitor who opened the app offline stays
// signed out and unsynced even after the connection comes back, which is
// exactly the hotel-wifi device this whole file is written for.
test('a failed auth-chunk load is retried on reconnect, not cached forever', async () => {
  const client = nextClient;
  clientLoadFailures = 1;
  const { api } = await mountHook({ isOnline: false });

  // The first attempt failed, so there is no client and no subscription: an
  // auth event emitted now reaches nobody.
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush();
  assert.equal(api.current.session, null, 'a client was built despite the load failing');

  // The connection comes back. The mount effect is keyed on isOnline, and the
  // failed attempt was cleared from the ref, so this re-asks rather than
  // handing back the dead promise.
  net.state.rows = [row('kampungku', 1000)];
  await act(async () => { api.current.setOnline(true); });
  await flush();

  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);

  assert.equal(api.current.session?.user?.id, 'user-a',
    'sync stayed dead for the session after one failed chunk load');
  assert.deepEqual(api.current.entries.map(e => e.id), ['kampungku'],
    'the retry produced no working client, so the account never reconciled');
  assert.equal(deviceOwner(), 'user-a');
});

test('a Sign in press after a failed load tries again rather than doing nothing', async () => {
  // The captive-portal and stale-deploy arms: there is no reconnect to wait
  // for, because navigator.onLine never said anything was wrong. The next
  // press is the only thing that can recover, so it has to actually retry.
  const client = nextClient;
  clientLoadFailures = 1;
  const { api } = await mountHook();
  await flush();

  await act(async () => { await api.current.signIn(); });
  await flush();
  assert.equal(client.oauthCalls, 1,
    'the press was handed the cached failure and the button did nothing');
});

test('an anonymous passport merges into the first account that signs in', async () => {
  seedDevice([entry('kampungku', 1000)], null);
  const client = nextClient;
  const { api } = await mountHook();
  net.state.rows = [row('sanchon', 2000)];
  await signal(client, 'SIGNED_IN', sessionFor('user-a'));
  await flush(PUSH_WAIT_MS);

  assert.deepEqual(api.current.entries.map(e => e.id).sort(), ['kampungku', 'sanchon'],
    'the places saved before signing in did not carry into the account');
  assert.equal(deviceOwner(), 'user-a');
  assert.deepEqual(postedIds(net.calls), ['kampungku'],
    'the pre-sign-in save was never uploaded');
});
