# Passport Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person's saved and visited places follow them across devices
after an optional Google sign-in, without losing a record and without
resurrecting a deleted one.

**Architecture:** `localStorage` stays the local source of truth; a
`public.passports` table holds one row per (user, place) with a tombstone
column; one pure `mergePassport()` reconciles the two at sign-in, at app
start and on reconnect. Auth is Supabase's Google OAuth via
`@supabase/auth-js`; data still moves over plain `fetch` to PostgREST, as
`src/data/leads.js` already does.

**Tech Stack:** React 19, Vite 8, `@supabase/auth-js` (new dependency,
auth only — no postgrest/realtime/storage), Supabase Postgres + RLS,
`node:test`.

**Spec:** `docs/superpowers/specs/2026-09-19-passport-sync-design.md`

## Global Constraints

- **Never commit or push to `master`.** Work on branch `passport-sync`;
  per-task commits are fine **on that branch**. The squash-merge to master
  happens only after the operator approves, and **push triggers a
  production deploy**.
- **Never read, print or stage `.env.local`.** It holds live keys. Never
  paste a key into a report, a test fixture, or a commit.
- `SUPABASE_SERVICE_ROLE_KEY` is script-only: never `VITE_`-prefixed,
  never imported from `src/`, never committed (§11 rule 24). Anything
  `VITE_` ships to every visitor.
- **Signed out, the passport path makes zero network calls.** The app must
  behave exactly as it does today for anyone who never signs in.
- **The invariant holds everywhere:** `visitedAt != null` implies
  `savedAt != null`. Assert it on every merge result.
- `src/data/privacy.js` changes in the **same commit** as anything that
  changes what the app stores or sends (§11 rule 25).
- Gates, all of which must pass before the final report:
  `npm run check-data` → "No violations."; `npm run lint` → baseline **1**
  warning (`src/utils.js:157`) and no new ones; `npm test`;
  `npm run build`; `grep -rc retrievedBy dist/` → 0;
  `grep -rliE "service_role|sb_secret_|KakaoAK" dist/ | wc -l` → 0;
  `node scripts/evidence-hash.mjs --check` → 0/0.
- Browser verification before claiming any UI works (§11 rule 16).
- Never invent data. A sync that fails reports that it failed; it never
  shows a stale record as if it were synced.

---

### Task 1: The table, its RLS, and a script that tries to break it

**Files:**
- Create: `supabase/passports.sql`
- Create: `scripts/passport.mjs`

**Interfaces:**
- Consumes: `parseSupabaseUrl`, `authHeaders` from `src/data/leads.js`.
- Produces: table `public.passports (user_id uuid, place_id text, saved_at timestamptz, visited_at timestamptz, updated_at timestamptz)`; CLI commands `verify-rls`, `delete-user <email>`.

- [ ] **Step 1: Write the SQL.**

```sql
-- K-Food Map cross-device passport. Paste into the Supabase SQL editor
-- once; re-running is safe. See
-- docs/superpowers/specs/2026-09-19-passport-sync-design.md.
--
-- One row per (person, place). saved_at is null for a place the person
-- unsaved: the row is a tombstone, and it exists so that a delete made on
-- one device is not resurrected by another device that still remembers the
-- place as saved.

create table if not exists public.passports (
  user_id    uuid not null references auth.users on delete cascade,
  place_id   text not null check (char_length(place_id) between 1 and 64),
  saved_at   timestamptz,
  visited_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id),
  constraint visit_implies_save check (visited_at is null or saved_at is not null)
);

alter table public.passports enable row level security;

revoke all on public.passports from anon, authenticated;
grant select, insert, update, delete on public.passports to authenticated;
grant select, insert, update, delete on public.passports to service_role;

-- A signed-in person reads and writes their own rows and no one else's.
-- The `with check` clauses are what stop a row being written under, or
-- moved to, another user_id.
drop policy if exists passports_own_select on public.passports;
create policy passports_own_select on public.passports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists passports_own_insert on public.passports;
create policy passports_own_insert on public.passports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists passports_own_update on public.passports;
create policy passports_own_update on public.passports
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists passports_own_delete on public.passports;
create policy passports_own_delete on public.passports
  for delete to authenticated using (auth.uid() = user_id);
```

- [ ] **Step 2: Write `scripts/passport.mjs`.**

Follow `scripts/leads.mjs` in shape: read `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the
environment (the caller passes `--env-file=.env.local`; **the script never
reads that file itself and never prints a key**), reuse `parseSupabaseUrl`
and `authHeaders` from `src/data/leads.js`, and use `process.exitCode = 1`
rather than `process.exit()` after network I/O — `process.exit()` after a
fetch crashes Node on Windows with a libuv assertion in `src/win/async.c`.

`verify-rls` needs two real signed-in identities. Make them with the admin
API rather than requiring a human to click through Google:

```js
// Create a throwaway confirmed user and return { id, accessToken }.
async function makeTestUser(base, serviceKey, anonKey, email, password) {
  const created = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders(serviceKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`admin create failed: ${created.status}`);
  const { id } = await created.json();
  const signedIn = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { ...authHeaders(anonKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!signedIn.ok) throw new Error(`password sign-in failed: ${signedIn.status}`);
  const { access_token: accessToken } = await signedIn.json();
  return { id, accessToken };
}
```

Both users are deleted in a `finally` block
(`DELETE ${base}/auth/v1/admin/users/${id}` with the service key), so even
a failed run leaves nothing behind. Use two random-suffixed addresses at
`@kfoodmap-rls-test.invalid` — `.invalid` is reserved by RFC 2606 and can
never be a real mailbox.

The rules, each printed PASS/FAIL, exit code 1 if any fails:

1. A inserting A's own row **succeeds** (201).
2. A reading `/rest/v1/passports` **sees** A's row.
3. A reading it does **not** see B's row (seed one as B first).
4. A inserting a row with `user_id = B` is **denied** (401/403).
5. A updating B's row affects **0 rows**, and B's row is unchanged when
   re-read as B.
6. A deleting B's row affects **0 rows**; B's row still exists.
7. A moving its own row to `user_id = B` is **denied**.
8. The anon key with no user JWT reads **zero** rows.
9. The anon key with no user JWT **cannot insert** (401/403).
10. `visited_at` set with `saved_at` null is **rejected by the table
    constraint**, proving the invariant is enforced in the database and
    not only in JavaScript.

`delete-user <email>` looks the user up through the admin API and deletes
it, which cascades the passport rows. It refuses without an explicit
email argument.

- [ ] **Step 3: Prove the check can fail.**

A verification that cannot fail proves nothing. Temporarily run the same
rules with the **service key** in place of A's user token and confirm the
suite reports failures (service_role bypasses RLS). Record in your report
how many rules flipped. Revert the temporary change — it must not appear
in the committed script.

- [ ] **Step 4: Operator step — report it, never fake it.**

The SQL has to be run by the operator in the Supabase SQL editor. State in
your report that live verification is blocked until that happens, and give
the exact command:
`node --env-file=.env.local scripts/passport.mjs verify-rls`.
Do **not** claim RLS is proven until that run is green.

- [ ] **Step 5: Commit on the branch.**

```bash
git add supabase/passports.sql scripts/passport.mjs
git commit -m "passport: table, row-level security, and an adversarial check"
```

---

### Task 2: `mergePassport` — the whole correctness story, with no network

**Files:**
- Create: `src/data/passport.js`
- Create: `scripts/tests/passport.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PASSPORT_KEY` — `'kfm-bookmarks'` (today's key; the new shape is a superset, so an existing device keeps its passport)
  - `normalizeEntry(raw) -> { id, savedAt, visitedAt, updatedAt } | null`
  - `loadLocalPassport() -> entry[]`
  - `saveLocalPassport(entries) -> void`
  - `clearLocalPassport() -> void`
  - `mergePassport(local, remote) -> entry[]`
  - `savedOnly(entries) -> entry[]` (tombstones removed — what the UI renders)
- Entry shape, stated once and relied on by every later task: `savedAt` is
  a millisecond number **or `null`, meaning tombstone**; `visitedAt` is a
  millisecond number or `null`; `updatedAt` is a millisecond number where
  `0` means "time unknown" (a legacy record).

- [ ] **Step 1: Write the failing tests.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntry, mergePassport, savedOnly } from '../../src/data/passport.js';

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
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `node --test scripts/tests/passport.test.mjs`
Expected: FAIL — `Cannot find module '../../src/data/passport.js'`.

- [ ] **Step 3: Implement the module.**

```js
// The passport: which places a person saved, and which they have been to.
//
// savedAt === null is a TOMBSTONE, not "missing". It is the only reason a
// delete made on one device survives contact with another device that
// still remembers the place as saved. Drop tombstones and deletions come
// back — the failure this shape exists to prevent.
//
// updatedAt === 0 means "we do not know when this happened" — the shape
// written before sync existed. It loses every merge against a real
// timestamp, which is the honest outcome rather than a coin flip.
export const PASSPORT_KEY = 'kfm-bookmarks';

export function normalizeEntry(raw) {
  if (typeof raw === 'string') return { id: raw, savedAt: 0, visitedAt: null, updatedAt: 0 };
  if (!raw || typeof raw.id !== 'string') return null;
  const savedAt = raw.savedAt === null ? null : (raw.savedAt ?? 0);
  const visitedAt = savedAt === null ? null : (raw.visitedAt ?? null);
  const updatedAt = raw.updatedAt ?? (savedAt ?? 0);
  return { id: raw.id, savedAt, visitedAt, updatedAt };
}

export function loadLocalPassport() {
  try {
    const stored = JSON.parse(localStorage.getItem(PASSPORT_KEY));
    return Array.isArray(stored) ? stored.map(normalizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLocalPassport(entries) {
  localStorage.setItem(PASSPORT_KEY, JSON.stringify(entries));
}

export function clearLocalPassport() {
  localStorage.removeItem(PASSPORT_KEY);
}

export function savedOnly(entries) {
  return entries.filter(e => e.savedAt !== null);
}

// Per place, the later write wins. On a tie the saved side wins: an equal
// timestamp is not evidence that the person meant to delete.
export function mergePassport(local, remote) {
  const byId = new Map();
  for (const raw of [...local, ...remote]) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    const held = byId.get(entry.id);
    if (!held) { byId.set(entry.id, entry); continue; }
    if (entry.updatedAt > held.updatedAt) { byId.set(entry.id, entry); continue; }
    if (entry.updatedAt === held.updatedAt && held.savedAt === null && entry.savedAt !== null) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Run the tests.**

Run: `node --test scripts/tests/passport.test.mjs`
Expected: PASS, 7/7.

- [ ] **Step 5: Prove the tests bite.** Delete the tie-break branch from
`mergePassport`, confirm the tie test fails, then restore it. Quote the
observed failure message in your report.

- [ ] **Step 6: Commit.**

```bash
git add src/data/passport.js scripts/tests/passport.test.mjs
git commit -m "passport: merge rule with tombstones, tested"
```

---

### Task 3: Transport — pull, push, delete, all injectable

**Files:**
- Modify: `src/data/passport.js`
- Modify: `scripts/tests/passport.test.mjs`

**Interfaces:**
- Consumes: `normalizeEntry` from Task 2; `authHeaders` from `src/data/leads.js`.
- Produces:
  - `toRow(userId, entry) -> { user_id, place_id, saved_at, visited_at, updated_at }` (ISO strings or null)
  - `fromRow(row) -> entry`
  - `pullPassport({ url, anonKey }, accessToken, fetchImpl = fetch) -> { ok, entries }`
  - `pushPassport(entries, { url, anonKey }, accessToken, userId, fetchImpl = fetch) -> { ok, status }`
  - `deleteAllPassport({ url, anonKey }, accessToken, userId, fetchImpl = fetch) -> { ok, status }`

- [ ] **Step 1: Write the failing tests** (append to the same file).

```js
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
});
```

- [ ] **Step 2: Run; expect failures** for the five new imports.

Run: `node --test scripts/tests/passport.test.mjs`

- [ ] **Step 3: Implement.**

```js
import { authHeaders } from './leads.js';

const iso = ms => (ms === null || ms === undefined ? null : new Date(ms).toISOString());
const ms = value => (value ? Date.parse(value) : null);

export function toRow(userId, entry) {
  return {
    user_id: userId,
    place_id: entry.id,
    saved_at: iso(entry.savedAt),
    visited_at: iso(entry.visitedAt),
    updated_at: iso(entry.updatedAt ?? 0),
  };
}

export function fromRow(row) {
  return normalizeEntry({
    id: row.place_id,
    savedAt: ms(row.saved_at),
    visitedAt: ms(row.visited_at),
    updatedAt: ms(row.updated_at) ?? 0,
  });
}

// The anon key stays in `apikey` (PostgREST needs it to route); the user's
// JWT is the Bearer token, and it is what RLS reads. Sending the anon key
// as Bearer would make every request anonymous and silently return nothing.
function userHeaders(anonKey, accessToken) {
  return { ...authHeaders(anonKey), Authorization: `Bearer ${accessToken}` };
}

export async function pullPassport({ url, anonKey }, accessToken, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(
      `${url}/rest/v1/passports?select=place_id,saved_at,visited_at,updated_at`,
      { headers: userHeaders(anonKey, accessToken) },
    );
    if (!response.ok) return { ok: false, entries: [] };
    const rows = await response.json();
    return { ok: true, entries: rows.map(fromRow).filter(Boolean) };
  } catch {
    return { ok: false, entries: [] };
  }
}

export async function pushPassport(entries, { url, anonKey }, accessToken, userId, fetchImpl = fetch) {
  if (entries.length === 0) return { ok: true, status: 0 };
  try {
    const response = await fetchImpl(`${url}/rest/v1/passports`, {
      method: 'POST',
      headers: {
        ...userHeaders(anonKey, accessToken),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(entries.map(e => toRow(userId, e))),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function deleteAllPassport({ url, anonKey }, accessToken, userId, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/rest/v1/passports?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: userHeaders(anonKey, accessToken),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
```

- [ ] **Step 4: Run the whole suite.**

Run: `npm test`
Expected: PASS, with no regressions in the other five test files.

- [ ] **Step 5: Commit.**

```bash
git add src/data/passport.js scripts/tests/passport.test.mjs
git commit -m "passport: pull, push and delete over PostgREST"
```

---

### Task 4: The session — sign in, sign out, and know whether Google is even configured

**Files:**
- Create: `src/data/auth.js`
- Create: `scripts/tests/auth.test.mjs`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `authHeaders` from `src/data/leads.js`.
- Produces:
  - `createAuthClient(config) -> GoTrueClient | null`
  - `googleEnabled(config, fetchImpl = fetch) -> Promise<boolean>`
  - `AUTH_STORAGE_KEY = 'kfm-auth'`

- [ ] **Step 1: Install the dependency.**

Run: `npm install @supabase/auth-js`
Record the installed version. Do **not** install `@supabase/supabase-js` —
it drags in postgrest, realtime and storage clients this app does not use.

- [ ] **Step 2: Write the failing tests.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { googleEnabled, createAuthClient } from '../../src/data/auth.js';

const CONFIG = { url: 'https://example.supabase.co', anonKey: 'eyJtest' };

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

test('no config means no client at all', () => {
  assert.equal(createAuthClient(null), null);
});
```

- [ ] **Step 3: Run; expect the module-not-found failure.**

Run: `node --test scripts/tests/auth.test.mjs`

- [ ] **Step 4: Implement.**

```js
import { GoTrueClient } from '@supabase/auth-js';
import { authHeaders } from './leads.js';

export const AUTH_STORAGE_KEY = 'kfm-auth';

// Null when Supabase is not configured (forks, env-less previews). Every
// caller handles null by hiding sign-in rather than by throwing — an
// unconfigured deploy shows the app exactly as it is today.
export function createAuthClient(config) {
  if (!config) return null;
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

// The client holds no Google client id — Supabase performs the OAuth
// exchange — so readiness is asked for, not assumed. Anything other than a
// clear yes is "not configured": a sign-in button that cannot work is
// worse than no button.
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
```

- [ ] **Step 5: Run the suite.** `npm test` → all green.

- [ ] **Step 6: Verify against the live project (no key printing).**

```bash
node --env-file=.env.local --input-type=module -e "
import { supabaseConfig } from './src/data/leads.js';
import { googleEnabled } from './src/data/auth.js';
console.log('google ready:', await googleEnabled(supabaseConfig(process.env)));
"
```

Expected **today**: `false` — the operator has not configured Google yet.
That `false` is the correct answer, and the UI must respect it.

- [ ] **Step 7: Commit.**

```bash
git add package.json package-lock.json src/data/auth.js scripts/tests/auth.test.mjs
git commit -m "passport: auth client and Google readiness detection"
```

---

### Task 5: Wiring — App state, the sync hook, and the Profile rows

**Files:**
- Create: `src/hooks/usePassportSync.js`
- Modify: `src/App.jsx` (lines 32-49 `BOOKMARKS_KEY`/`loadBookmarks`, line 82 state, lines 119-126 persistence and derived ids, lines 141-158 handlers)
- Modify: `src/components/TabPanel.jsx` (the `settings` array in `ProfileTab`, lines 143-151)
- Modify: `src/i18n/locales/en.js` (the `profile` namespace)

**Interfaces:**
- Consumes: Tasks 2–4; `useOnlineStatus` from `src/hooks/useOnlineStatus.js`; `supabaseConfig` from `src/data/leads.js`.
- Produces: `usePassportSync({ entries, setEntries, isOnline })` returning
  `{ session, googleReady, signIn, signOut, deleteRecords, lastSyncFailed }`.

- [ ] **Step 1: Move `App.jsx`'s passport state onto entries.**

Delete `BOOKMARKS_KEY`, `loadBookmarks` and the persistence effect; use the
Task 2 module instead. State becomes the full entry list **including
tombstones**, while what child components receive stays exactly what they
receive today:

```js
const [entries, setEntries] = useState(loadLocalPassport);
useEffect(() => { saveLocalPassport(entries); }, [entries]);

const bookmarks = useMemo(() => savedOnly(entries), [entries]);
const bookmarkedIds = useMemo(() => bookmarks.map(b => b.id), [bookmarks]);
const visitedIds = useMemo(
  () => bookmarks.filter(b => b.visitedAt !== null).map(b => b.id),
  [bookmarks],
);
```

Unsaving now writes a tombstone instead of dropping the row — this is the
change that lets a delete survive sync:

```js
const handleToggleBookmark = (placeId) => {
  const now = Date.now();
  setEntries(prev => {
    const held = prev.find(e => e.id === placeId);
    if (!held || held.savedAt === null) {
      const fresh = { id: placeId, savedAt: now, visitedAt: null, updatedAt: now };
      return held ? prev.map(e => (e.id === placeId ? fresh : e)) : [...prev, fresh];
    }
    // Unsave: keep the row as a tombstone. The visit goes with the save,
    // exactly as it did when the entry was dropped outright.
    return prev.map(e => (e.id === placeId ? { ...e, savedAt: null, visitedAt: null, updatedAt: now } : e));
  });
};

const handleToggleVisited = (placeId) => {
  const now = Date.now();
  setEntries(prev => prev.map(e =>
    e.id === placeId && e.savedAt !== null
      ? { ...e, visitedAt: e.visitedAt === null ? now : null, updatedAt: now }
      : e,
  ));
};
```

`JournalPanel`, `BottomSheetList` and `RestaurantDetail` keep their current
props and must not change.

- [ ] **Step 2: Write the hook.**

```js
// Sync is strictly additive to the local passport: localStorage is written
// first and is never rolled back by a failed request. Signed out, this hook
// makes no network call at all — the passport endpoints are only touched
// with a user token, and `googleEnabled` is the only anonymous request,
// made once to decide whether a sign-in row can exist.
export default function usePassportSync({ entries, setEntries, isOnline }) { /* ... */ }
```

Behaviour, in order:

1. On mount, build `createAuthClient(supabaseConfig(import.meta.env))` once
   (`useRef`), call `googleEnabled` once, and subscribe with
   `client.onAuthStateChange`.
2. When a session appears (sign-in, restored session, or token refresh),
   **reconcile**: `pullPassport` → `mergePassport(local, remote)` → write
   the merged list to state **and** `pushPassport(merged)`, so both sides
   end identical. If the pull fails, leave local untouched and set
   `lastSyncFailed`.
3. While signed in, push on change, debounced ~1s, skipped entirely when
   `isOnline` is false. On reconnect, run the full reconcile again rather
   than replaying a queue — the merge already resolves whatever happened
   offline, which is why there is no queue to get wrong.
4. `signIn` calls
   `client.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
5. `signOut` calls `client.signOut()`, then `clearLocalPassport()` and
   `setEntries([])` — this device is left clean and the account keeps the
   records (the operator's decision, 2026-09-19).
6. `deleteRecords` calls `deleteAllPassport`, then clears the device the
   same way. It must not run without a session.

- [ ] **Step 3: Profile rows in `TabPanel.jsx`.**

Pass the hook's values down as props from `App.jsx`; keep `TabPanel` free
of Supabase imports. In the `settings` array:

- `googleReady === false` → render **nothing** about accounts. No teaser,
  no disabled button.
- Signed out, ready → `{ label: t('profile.signIn'), value: t('profile.signInGoogle'), icon: '🔑', action: signIn }`
- Signed in → `{ label: t('profile.account'), value: session.user.email, icon: '🔑' }`,
  `{ label: t('profile.signOut'), value: t('profile.signOutHint'), icon: '🚪', action: signOut }`,
  `{ label: t('profile.deleteRecords'), value: '', icon: '🗑️', action: confirmThenDelete }`
- `lastSyncFailed` → `{ label: t('profile.syncFailed'), value: '', icon: '⚠️' }`.
  Say it plainly; never show a stale list as if it were synced.

`confirmThenDelete` uses `window.confirm(t('profile.deleteRecordsConfirm'))`.

- [ ] **Step 4: Add every key to `src/i18n/locales/en.js`** under `profile`:

```js
    signIn: 'Account',
    signInGoogle: 'Sign in with Google',
    account: 'Signed in as',
    signOut: 'Sign out',
    signOutHint: 'Clears this device',
    deleteRecords: 'Delete my saved places',
    deleteRecordsConfirm: 'This deletes your saved and visited places from your account and from this device. This cannot be undone.',
    syncFailed: "Couldn't sync — your records are safe on this device",
```

`scripts/tests/labels.test.mjs` asserts every `t('…')` resolves, so a
missing key fails the suite rather than printing a key name to a visitor.

- [ ] **Step 5: Run `npm test`, `npm run lint`, `npm run build`.**

- [ ] **Step 6: Browser verification (§11 rule 16), signed out.**

Start the dev server with the preview tools, then:
- Save and unsave a place; the Journal and the heart icons behave exactly
  as before.
- `localStorage['kfm-bookmarks']` holds a tombstone after an unsave —
  confirm the UI does not show it anywhere.
- **The network panel shows no request to `*.supabase.co` from the
  passport path.** Paste the filtered request list into your report.
- No console errors, and no account row on Profile (Google is not
  configured yet, so `googleReady` is false).

- [ ] **Step 7: Commit.**

```bash
git add src/App.jsx src/hooks/usePassportSync.js src/components/TabPanel.jsx src/i18n/locales/en.js
git commit -m "passport: sync the passport while signed in"
```

---

### Task 6: The policy, the operator's setup, the gates, one commit

**Files:**
- Modify: `src/data/privacy.js`
- Modify: `scripts/tests/privacy.test.mjs` (only if it asserts a sentence being rewritten)
- Modify: `HANDOFF.md`, `GROWTH-PLAN.md`

- [ ] **Step 1: Rewrite the two statements that stop being true.**

`privacy.js`'s English "In short" section today says
`'Your saved and visited places stay on your own device.'` and
`'We only receive personal information if you choose to send a report and include your email address.'`
Both are false for a signed-in user. Rewrite **both languages** as parallel
statements of the same facts — this file is not a translation pipeline —
covering:

- signing in is optional, and without it nothing leaves the device
- signing in with Google gives us the email address and account id that
  Supabase Auth stores
- the account then holds which places you saved or marked visited, and
  when — no names, no coordinates, no photos, no location
- signing out erases the passport from that device
- how to delete everything: the in-app action for the records, and
  `PRIVACY_CONTACT` for the account itself

Bump `PRIVACY_EFFECTIVE_DATE` to `'2026-09-19'`.

- [ ] **Step 2: Run every gate** and paste the real output:

```bash
npm run check-data && npm run lint && npm test && npm run build
grep -rc retrievedBy dist/ ; grep -rliE "service_role|sb_secret_|KakaoAK" dist/ | wc -l
node scripts/evidence-hash.mjs --check
```

Also report the bundle delta introduced by `@supabase/auth-js`, measured
by comparing this build's `dist/assets/*.js` total against a build from
`master`.

- [ ] **Step 3: Write the operator's Google setup instructions** into your
report — numbered, with exact page and field names:

1. Google Cloud Console → APIs & Services → Credentials → Create
   credentials → OAuth client ID → Web application.
2. Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback` (derive
   `<project-ref>` from `VITE_SUPABASE_URL` — the host is not a secret;
   **the key is, and is never printed**).
3. Supabase dashboard → Authentication → Providers → Google → paste Client
   ID and Client Secret → Enable → Save.
4. Supabase dashboard → Authentication → URL Configuration → Site URL
   `https://kfoodmap.vercel.app`, and add `http://localhost:5173` under
   Redirect URLs for local testing.

Then re-run the Task 4 readiness check; it must print `true`.

- [ ] **Step 3b: Prove sync end-to-end against the live table, without
waiting for Google.**

The spec's two-window browser check cannot run until the operator finishes
OAuth setup, and a plan that stops there would ship an unproven sync path.
Close the gap with the same throwaway-user trick Task 1 uses — a script
run (not a committed test, since it needs the service key) that:

1. creates a confirmed test user and signs in for a real JWT,
2. pushes two entries, one saved and one tombstone,
3. pulls them back and asserts `mergePassport` against a divergent local
   list produces the expected winner for each place,
4. deletes everything and removes the user.

Report the actual output. Then state plainly that the **two-window
browser check remains outstanding** until Google is configured, and that
it is the first thing to do afterwards.

- [ ] **Step 4: Docs.** HANDOFF §2.1 gains a paragraph on passport sync
(the tombstone rule and why it exists, the merge's three call sites, the
signed-out guarantee); §11 gains a rule that any new user-scoped table
ships only with an adversarial `verify-rls`; §7 records what is blocked on
operator setup. GROWTH-PLAN Stage 4 marks cross-device sync done.
Re-measure the test count.

- [ ] **Step 5: Report and STOP.** Do not squash, do not push. Present gate
output, the bundle delta, the browser evidence, what remains blocked on
operator setup, and the proposed commit message.

- [ ] **Step 6: After the operator approves** — squash-merge `passport-sync`
into `master` with the trailer
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, push, confirm the
GitHub deployment status reads `success` (§11 rule 23), then check the live
site: signed out, the app is unchanged and makes no Supabase passport
request.
