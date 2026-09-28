import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_STORAGE_KEY,
  authClientNeededNow,
  authRefusedInUrl,
  authReturnInUrl,
  createAuthClient,
  googleEnabled,
  storedSessionExists,
} from '../../src/data/auth.js';

const CONFIG = { url: 'https://example.supabase.co', anonKey: 'eyJtest' };

// A localStorage-shaped stand-in: getItem/length/key are the whole surface
// the readiness checks touch.
function fakeStorage(entries = {}) {
  const keys = Object.keys(entries);
  return {
    get length() { return keys.length; },
    key: i => keys[i] ?? null,
    getItem: k => (k in entries ? entries[k] : null),
  };
}
const at = href => ({ href });

test('google is enabled only when the server says so', async () => {
  const withGoogle = async () => ({ ok: true, json: async () => ({ external: { email: true, google: true } }) });
  const withoutGoogle = async () => ({ ok: true, json: async () => ({ external: { email: true } }) });
  assert.equal(await googleEnabled(CONFIG, withGoogle), true);
  assert.equal(await googleEnabled(CONFIG, withoutGoogle), false);
});

test('an unreachable settings endpoint means "not ready", not "ready"', async () => {
  const boom = async () => { throw new Error('offline'); };
  assert.equal(await googleEnabled(CONFIG, boom), false);
});

test('no config means no client at all — and no library import to find that out', async () => {
  assert.equal(await createAuthClient(null), null);
});

// --- when the library is owed ---------------------------------------------
//
// The list below is not invented: it mirrors GoTrueClient._initialize, which
// is the code that does the detecting once the client exists. Miss a shape
// here and a real sign-in return is silently dropped, because no client is
// built on the load that carries the code.

const PENDING = { 'kfm-auth-code-verifier': 'abc123' };
const SLOT = { 'kfm-auth-flow-0123456789abcdef-code-verifier': 'abc123' };

test('a stored session alone is enough — a returning visitor is restored', () => {
  assert.equal(storedSessionExists(fakeStorage({ [AUTH_STORAGE_KEY]: '{}' })), true);
  assert.equal(storedSessionExists(fakeStorage({})), false);
  assert.equal(
    authClientNeededNow(at('https://kfoodmap.test/'), fakeStorage({ [AUTH_STORAGE_KEY]: '{}' })),
    true,
  );
});

test('a PKCE return is a ?code= with a verifier this device actually stored', () => {
  const url = at('https://kfoodmap.test/place/gonghwachun?code=xyz');
  assert.equal(authReturnInUrl(url, fakeStorage(PENDING)), true);
  assert.equal(authReturnInUrl(url, fakeStorage(SLOT)), true,
    'a per-flow verifier slot is a pending flow too');
  assert.equal(
    authReturnInUrl(at('https://kfoodmap.test/?code=xyz&sb_flow_id=0123456789abcdef'), fakeStorage(SLOT)),
    true,
  );
  // No verifier: this device did not start a flow, so a ?code= belongs to
  // something else entirely and must not drag the library in.
  assert.equal(authReturnInUrl(url, fakeStorage({})), false);
});

test('an aborted consent is a return too — it comes back as ?error=, not ?code=', () => {
  assert.equal(
    authReturnInUrl(at('https://kfoodmap.test/?error=access_denied&error_description=denied'), fakeStorage(PENDING)),
    true,
  );
  assert.equal(
    authReturnInUrl(at('https://kfoodmap.test/?error_code=400'), fakeStorage({})),
    true,
    'an error return needs no verifier — auth-js does not ask for one either',
  );
});

test('an implicit-grant return arrives in the hash, where auth-js also looks', () => {
  assert.equal(
    authReturnInUrl(at('https://kfoodmap.test/#access_token=tok&token_type=bearer'), fakeStorage({})),
    true,
  );
  assert.equal(
    authReturnInUrl(at('https://kfoodmap.test/#error=server_error'), fakeStorage({})),
    true,
  );
});

test('an ordinary page load is not a return, so nothing is loaded', () => {
  assert.equal(authClientNeededNow(at('https://kfoodmap.test/'), fakeStorage({})), false);
  assert.equal(
    authClientNeededNow(at('https://kfoodmap.test/place/gonghwachun#gallery'), fakeStorage({})),
    false,
  );
  // A pending verifier with no code on the URL is a flow that was started and
  // abandoned, not a return.
  assert.equal(authClientNeededNow(at('https://kfoodmap.test/'), fakeStorage(PENDING)), false);
});

test('a storage object that throws reads as "nothing stored"', () => {
  const hostile = {
    get length() { throw new Error('denied'); },
    key() { throw new Error('denied'); },
    getItem() { throw new Error('denied'); },
  };
  assert.equal(storedSessionExists(hostile), false);
  assert.equal(authClientNeededNow(at('https://kfoodmap.test/?code=xyz'), hostile), false);
});

// The half the test above cannot reach. Chrome with all cookies blocked, a
// sandboxed iframe without `allow-same-origin` and old Safari private mode do
// not hand back a storage object that throws on use — reading the
// `localStorage` PROPERTY is itself what throws. Passing a hostile object
// never exercises that, and a `storage = localStorage` default parameter
// would be evaluated before the function body's try, so the throw would
// escape `authClientNeededNow()` in the hook's mount effect and take the
// whole render down: a blank app, not a blank Profile.
test('storage whose very accessor throws does not take the render down', () => {
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const realWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    // Both defines are INSIDE the try. If the second one ever throws — a
    // future Node making either global non-configurable — the finally still
    // runs and a throwing `localStorage` does not leak into the rest of this
    // file. The restore below is idempotent, so entering the try before
    // either define has happened costs nothing.
    Object.defineProperty(globalThis, 'localStorage', {
      get() { throw new Error('access denied'); },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { get location() { throw new Error('access denied'); } },
      configurable: true,
      writable: true,
    });
    // Called with no arguments, exactly as the hook's mount effect calls it.
    assert.equal(storedSessionExists(), false);
    assert.equal(authReturnInUrl(), false);
    assert.equal(authClientNeededNow(), false);
    // And with a real return URL, where the verifier lookup is reached.
    assert.equal(authReturnInUrl(at('https://kfoodmap.test/?code=xyz')), false);
    assert.equal(authReturnInUrl(at('https://kfoodmap.test/?error=access_denied')), true,
      'an error return needs no storage at all, so it must still be detected');
  } finally {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
    else delete globalThis.localStorage;
    if (realWindow) Object.defineProperty(globalThis, 'window', realWindow);
    else delete globalThis.window;
  }
});

test('a refusal at the consent screen is detected from the URL it returns on', () => {
  // What Google actually sends back when the person closes the consent
  // screen. auth-js returns early on this shape without restoring a
  // session, so nothing else in the app would ever notice it.
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/?error=access_denied')), true);
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/?error_code=400&error_description=bad')), true);
  // The hash form, which is what an implicit-grant error uses.
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/#error=access_denied')), true);
});

test('an ordinary URL, and a successful return, are not refusals', () => {
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/')), false);
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/place/maji')), false);
  // A code in hand is the success leg — the opposite of a refusal.
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/?code=xyz')), false);
  // A restaurant whose own query string happens to carry the word.
  assert.equal(authRefusedInUrl(at('https://kfoodmap.test/submit?place=error-cafe')), false);
});

test('an unreadable location reads as "no refusal", never as an exception', () => {
  assert.equal(authRefusedInUrl({ get href() { throw new Error('access denied'); } }), false);
});
