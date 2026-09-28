import { GoTrueClient } from '@supabase/auth-js';
import { authHeaders } from './leads.js';
import { AUTH_STORAGE_KEY } from './auth.js';

// The only module in the app that imports `@supabase/auth-js`, and it exists
// solely so that import is reachable by exactly one dynamic `import()` — in
// `createAuthClient`. Vite then emits this file and the library as their own
// chunk (`assets/auth-client-<hash>.js`), which the entry chunk does not
// import, so the ~105 kB raw / ~27 kB gzip of auth-js is never on the path to
// first paint. Named rather than inlined into auth.js for that reason: the
// chunk carries this file's name, which makes it identifiable in the build
// output and in `workbox.globIgnores` (vite.config.js).
export function buildAuthClient(config) {
  return new GoTrueClient({
    url: `${config.url}/auth/v1`,
    headers: authHeaders(config.anonKey),
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  });
}
