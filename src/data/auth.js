import { authHeaders } from './leads.js';

export const AUTH_STORAGE_KEY = 'kfm-auth';

// Null when Supabase is not configured (forks, env-less previews). Every
// caller handles null by hiding sign-in rather than by throwing — an
// unconfigured deploy shows the app exactly as it is today.
//
// Async, and deliberately so: `@supabase/auth-js` is ~105 kB raw / ~27 kB
// gzip, and this app is a map for visitors walking around Seoul on mobile
// data. Almost none of them sign in, so the library is imported here —
// behind a dynamic import Vite emits as its own chunk — and never on first
// paint. `authClientNeededNow` below is what decides when that cost is
// actually owed.
export async function createAuthClient(config) {
  if (!config) return null;
  const { buildAuthClient } = await import('./auth-client.js');
  return buildAuthClient(config);
}

// --- when the library is actually owed -------------------------------------
//
// Three cases, and only three:
//
//   1. a stored session — a returning signed-in visitor, who must be restored
//      exactly as they are today;
//   2. the visitor presses Sign in — handled at the call site, not here;
//   3. the browser is coming back from Google, where the client must exist on
//      THIS load or the `?code=` exchange never happens and the sign-in is
//      silently dropped.
//
// Case 3 is the one that cannot be guessed at, so the conditions below mirror
// `GoTrueClient._initialize`, which is the code that would otherwise do the
// detecting (node_modules/@supabase/auth-js/dist/module/GoTrueClient.js):
// it parses the URL with `parseParametersFromURL` — hash first, then the
// query, query winning — and then asks two questions:
//
//   _isImplicitGrantCallback: access_token || error || error_description ||
//     error_code. This is also the shape an ABORTED consent comes back as
//     (`?error=access_denied&error_description=…`), which is why the error
//     parameters are in the list and not only the success ones.
//   _isPKCECallback: a `code` parameter AND a stored verifier — either the
//     per-flow slot `kfm-auth-flow-<id>-code-verifier` (when `sb_flow_id` is
//     on the URL) or the fixed `kfm-auth-code-verifier`. `storePKCEVerifier`
//     writes both on every flow start, so "some key under the auth storage
//     key ending in -code-verifier" is a superset of what auth-js will
//     accept. A superset is the safe direction: it can only construct a
//     client auth-js then declines to use, never miss a real return.
function paramsFromUrl(location) {
  const params = {};
  let url;
  try {
    url = new URL(location.href);
  } catch {
    return params;
  }
  if (url.hash && url.hash[0] === '#') {
    try {
      new URLSearchParams(url.hash.substring(1)).forEach((value, key) => { params[key] = value; });
    } catch {
      // A hash that is not a query string carries no auth parameters.
    }
  }
  // Search parameters take precedence over hash ones, same as auth-js.
  url.searchParams.forEach((value, key) => { params[key] = value; });
  return params;
}

// Storage access throws in some privacy modes. A throw here must read as
// "nothing stored", never as an exception on first paint.
//
// Note what is NOT written here: `storage = localStorage` as a default
// parameter. A default is evaluated on entry, before the body's `try`, and
// reading `window.localStorage` is itself the access that throws — Chrome
// with all cookies blocked, a sandboxed iframe without `allow-same-origin`,
// old Safari private mode. Written that way the throw escapes
// `authClientNeededNow()` in the hook's mount effect and takes the whole
// render down: a blank app, not a blank Profile. So the access lives inside
// the try, the way src/data/passport.js already does it, and the parameter
// defaults to undefined.
function hasPendingCodeVerifier(storage) {
  try {
    const store = storage ?? localStorage;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(AUTH_STORAGE_KEY) && key.endsWith('-code-verifier')) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function storedSessionExists(storage) {
  try {
    return (storage ?? localStorage).getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function authReturnInUrl(location, storage) {
  let params;
  try {
    params = paramsFromUrl(location ?? window.location);
  } catch {
    return false;
  }
  if (params.access_token || params.error || params.error_description || params.error_code) {
    return true;
  }
  return Boolean(params.code) && hasPendingCodeVerifier(storage);
}

// The single question the hook asks on mount: must the client exist on this
// load, before anyone touches the Sign in row?
export function authClientNeededNow(location, storage) {
  return storedSessionExists(storage) || authReturnInUrl(location, storage);
}

// The client holds no Google client id — Supabase performs the OAuth
// exchange — so readiness is asked for, not assumed. Anything other than a
// clear yes is "not configured": a sign-in button that cannot work is
// worse than no button.
//
// A plain `fetch` on purpose: this runs on every load, including for the
// visitors who will never sign in, so it must not be what drags the auth
// library in.
export async function googleEnabled(config, fetchImpl = fetch) {
  if (!config) return false;
  try {
    const response = await fetchImpl(`${config.url}/auth/v1/settings`, {
      headers: authHeaders(config.anonKey),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return Boolean(settings?.external?.google);
  } catch {
    return false;
  }
}
