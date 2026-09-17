# UGC Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone can suggest a new restaurant or report incorrect info on
an existing one, without logging in; each submission lands as an `open`
row in a Supabase `leads` table that the public key can only insert into,
and a repository script lists and resolves them — no submission ever
reaches `restaurants.js` except through the existing Phase 3 verification,
by hand.

**Architecture:** The static app `POST`s one row to Supabase's REST
endpoint with the public key (no SDK). Row-level security plus a column
grant limit that key to inserting fresh `open` rows. All validation and
request logic lives in one pure module, `src/data/leads.js`, shared by the
form (browser) and the review script (Node) and covered by `node:test`.
`/submit` renders as a sheet inside `AppShell`, like `/place/:id`, and is
prerendered to a real file so direct loads are not 404s.

**Tech Stack:** React 19, react-router 8, react-i18next (all existing);
Supabase (managed Postgres + PostgREST), reached with plain `fetch`;
Node 24's built-in `node:test`, `fetch` and `--env-file`. **No new npm
dependency.**

**Spec:** `docs/superpowers/specs/2026-09-17-ugc-intake-design.md`

## Global Constraints

- Every commit must pass the five existing gates: `npm run check-data`
  ("No violations."), `npm run lint` (baseline **1** warning — the
  documented `kakaoMapUrl` `origin` param; this work must not add one),
  `npm run build`, `grep -rc retrievedBy dist/` (0 everywhere),
  `node scripts/evidence-hash.mjs --check` (0 pending, 0 drifted).
- This plan adds gates every later commit must also pass: `npm test`
  (all pass), `grep -rliE "service_role|sb_secret_" dist/ | wc -l` → `0`,
  and the secret-value scan in Task 6 Step 1 → `0`.
- **No data changes.** `src/data/restaurants.js`, `data/evidence/`, the
  Confidence Model, Evidence Layer and Lifecycle are untouched. No code
  path may write from `leads` into the data.
- **No new npm dependency** — not `@supabase/supabase-js`, not a test
  runner.
- The service role / secret key never appears in `src/`, in any `VITE_`
  variable, or in the repository. It lives only in `.env.local`
  (gitignored by the existing `*.local` rule).
- Every new user-facing string goes through `t()` in
  `src/i18n/locales/en.js`. No hardcoded English in new UI.
- Styles go in `src/index.css` using existing tokens (`--fill`, `--line`,
  `--surface`, `--ink`, `--ink-title`, `--ink-body`, `--muted`,
  `--muted-strong`, `--green-strong`, `--danger`, `--radius`). **No new
  hex values** (HANDOFF §11 rule 19).
- Quarantined restaurants are never a correction target (§2.14): an
  unknown or quarantined `?place=` falls back to new-restaurant mode.
- Browser verification before claiming UI works (§11 rule 16).
- **Commit discipline:** one feature, **one commit**, at the end
  (Task 6), after the user approves it. Tasks 1–5 end with local
  verification, not commits. Push = Vercel deploy; the push is not done
  until that commit's GitHub deployment status reads `success`
  (§11 rule 23).
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/data/leads.js` | create | Pure lead logic: topics, limits, `resolvePlace`, `buildLead`, `supabaseConfig`, `authHeaders`, `submitLead`. Browser + Node. |
| `scripts/tests/leads.test.mjs` | create | `node:test` coverage of `src/data/leads.js` |
| `scripts/lib/leads-format.mjs` | create | Pure: `formatLead`, `parseResolveArgs` for the review script |
| `scripts/tests/leads-format.test.mjs` | create | `node:test` coverage of the formatter / argument parser |
| `scripts/leads.mjs` | create | CLI: `verify-rls`, `list`, `resolve` against live Supabase |
| `supabase/leads.sql` | create | Table, constraints, grants, RLS policy — pasted once into the SQL editor |
| `.env.example` | create | Variable names, no values |
| `src/components/SubmitSheet.jsx` | create | The `/submit` form sheet |
| `src/App.jsx` | modify | `/submit` route; render `SubmitSheet` |
| `src/components/TabPanel.jsx` | modify | Profile row "Suggest a restaurant" |
| `src/components/RestaurantDetail.jsx` | modify | "Report incorrect info" link |
| `src/i18n/locales/en.js` | modify | `submit.*` strings + `profile.suggestRestaurant` |
| `src/index.css` | modify | `.submit-*` rules, `.detail-report` |
| `scripts/prerender-places.mjs` | modify | Also write `dist/submit/index.html` |
| `package.json` | modify | `"test"` script |
| `HANDOFF.md`, `docs/GROWTH-PLAN.md` | modify | Task 6 |

**Order:** Task 2 Step 3 needs the user (Supabase project). Tasks 1, 3
(Steps 1–5), 4 and 5 don't need a live project and may run first if the
user isn't ready yet; every live step waits for Task 2.

---

### Task 1: The lead module, test-first

**Files:**
- Modify: `package.json` (scripts)
- Create: `scripts/tests/leads.test.mjs`
- Create: `src/data/leads.js`

**Interfaces:**
- Consumes: `isQuarantined(restaurant)` from `src/data/verification.js`
  (`restaurant?.lifecycle?.status === LIFECYCLE.QUARANTINE`);
  `restaurants` from `src/data/restaurants.js`.
- Produces (exact names, used by Tasks 2–5):
  - `LEAD_TOPICS: string[]` = `['vegan','halal','hours','closed','address','other']`
  - `LEAD_LIMITS` = `{ name: 120, location_hint: 200, message: 2000, source_url: 500, contact_email: 200 }`
  - `resolvePlace(placeId: string|null, restaurants: object[]): object|null`
  - `buildLead(form, { place?, lang? })`, where
    `form = { name, locationHint, topic, message, sourceUrl, contactEmail, website }`, returns
    `{ ok: true, row }` or `{ ok: false, spam: boolean, errors: { [column]: { code, max? } } }`.
    `row = { kind, place_id, name, location_hint, topic, message, source_url, contact_email, lang }`.
    Error keys are **database column names**; `code` ∈
    `required | invalidTopic | tooLong | invalidUrl | invalidEmail`.
  - `supabaseConfig(env): { url, anonKey } | null` (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  - `authHeaders(key: string): { apikey, Authorization? }`
  - `submitLead(row, { url, anonKey }, fetchImpl = fetch): Promise<{ ok: true } | { ok: false, status: number }>`

- [ ] **Step 1: Add the test script to `package.json`**

In `"scripts"`, after the `"check-data"` line, add:

```json
    "test": "node --test \"scripts/tests/*.test.mjs\"",
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/tests/leads.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the tests; confirm they fail for the right reason**

Run: `npm test`
Expected: FAIL — `Cannot find module '…/src/data/leads.js'`.

- [ ] **Step 4: Implement `src/data/leads.js`**

```js
// A lead is a user submission waiting for a person to verify it — never a
// fact. Nothing in this module (or anywhere) writes a lead into
// restaurants.js; accepted leads go through the Phase 3 verification by
// hand. Shared by the /submit form and scripts/leads.mjs.
import { isQuarantined } from './verification.js';

export const LEAD_TOPICS = ['vegan', 'halal', 'hours', 'closed', 'address', 'other'];

// Mirrors the CHECK constraints in supabase/leads.sql. The database is the
// real limit; these exist so the form can say which field is wrong.
export const LEAD_LIMITS = {
  name: 120,
  location_hint: 200,
  message: 2000,
  source_url: 500,
  contact_email: 200,
};

const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

// Quarantined places are excluded from every discovery surface (§2.14); a
// correction form for one would be another such surface.
export function resolvePlace(placeId, restaurants) {
  if (!placeId) return null;
  const place = restaurants.find(r => r.id === placeId);
  return place && !isQuarantined(place) ? place : null;
}

export function buildLead(form, { place = null, lang = 'en' } = {}) {
  if (clean(form.website)) return { ok: false, spam: true, errors: {} };

  const row = {
    kind: place ? 'correction' : 'new',
    place_id: place ? place.id : null,
    name: place ? place.name : clean(form.name),
    location_hint: place ? null : clean(form.locationHint),
    topic: form.topic,
    message: clean(form.message),
    source_url: clean(form.sourceUrl),
    contact_email: clean(form.contactEmail),
    lang,
  };

  const errors = {};
  if (!row.name) errors.name = { code: 'required' };
  if (!LEAD_TOPICS.includes(row.topic)) errors.topic = { code: 'invalidTopic' };
  if (!row.message) errors.message = { code: 'required' };
  if (row.source_url && !URL_PATTERN.test(row.source_url)) errors.source_url = { code: 'invalidUrl' };
  if (row.contact_email && !EMAIL_PATTERN.test(row.contact_email)) errors.contact_email = { code: 'invalidEmail' };
  for (const [column, max] of Object.entries(LEAD_LIMITS)) {
    if (!errors[column] && row[column] && row[column].length > max) errors[column] = { code: 'tooLong', max };
  }

  return Object.keys(errors).length > 0 ? { ok: false, spam: false, errors } : { ok: true, row };
}

// Absent in forks and env-less previews; the form says so instead of
// failing on send.
export function supabaseConfig(env) {
  const url = env?.VITE_SUPABASE_URL?.trim();
  const anonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

// Supabase's legacy keys are JWTs and are also sent as a Bearer token. The
// newer sb_publishable_/sb_secret_ keys are not JWTs and are rejected in
// Authorization, so they go in apikey only.
export function authHeaders(key) {
  return key.startsWith('eyJ')
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}

export async function submitLead(row, { url, anonKey }, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...authHeaders(anonKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    return response.status === 201 ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
```

- [ ] **Step 5: Run the tests; confirm they pass**

Run: `npm test`
Expected: 13 tests pass, 0 fail.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: exactly 1 warning (the existing `kakaoMapUrl` one).

---

### Task 2: Schema, RLS, and a live proof of the RLS

**Blocked on the user** at Step 3.

**Files:**
- Create: `supabase/leads.sql`
- Create: `.env.example`
- Create: `scripts/leads.mjs` (`verify-rls` only; Task 3 adds the rest)

**Interfaces:**
- Consumes: `authHeaders`, `buildLead` from `src/data/leads.js`.
- Produces: a live `public.leads` table; a local `.env.local` holding
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`; `scripts/leads.mjs` with module-level
  helpers `env(name): string` and
  `rest(path, key, init?): Promise<Response>` and a `commands` object that
  Task 3 extends.

- [ ] **Step 1: Write `supabase/leads.sql`**

```sql
-- K-Food Map submission queue. Paste into the Supabase SQL editor once;
-- re-running is safe. See docs/superpowers/specs/2026-09-17-ugc-intake-design.md.
--
-- A lead is not a fact: nothing reads this table into the app's data.

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('new', 'correction')),
  place_id        text check (place_id is null or char_length(place_id) <= 64),
  name            text not null check (char_length(name) between 1 and 120),
  location_hint   text check (location_hint is null or char_length(location_hint) <= 200),
  topic           text not null check (topic in ('vegan', 'halal', 'hours', 'closed', 'address', 'other')),
  message         text not null check (char_length(message) between 1 and 2000),
  source_url      text check (source_url is null or char_length(source_url) <= 500),
  contact_email   text check (contact_email is null or char_length(contact_email) <= 200),
  lang            text not null default 'en' check (char_length(lang) <= 16),
  status          text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'deferred')),
  resolution_note text,
  resolved_at     timestamptz,
  constraint correction_names_a_place check (kind <> 'correction' or place_id is not null)
);

alter table public.leads enable row level security;

-- The public (anon) key may insert the submission columns and nothing
-- else: no select (other people's emails), no update, no delete, and no
-- way to set status or resolution fields even on its own new row.
revoke all on public.leads from anon, authenticated;
grant insert (kind, place_id, name, location_hint, topic, message, source_url, contact_email, lang)
  on public.leads to anon;

drop policy if exists leads_anon_insert on public.leads;
create policy leads_anon_insert on public.leads
  for insert to anon
  with check (status = 'open' and resolution_note is null and resolved_at is null);
```

The column grant is stricter than the spec's policy alone (defence in
depth: the policy still holds if a future grant widens the columns).

- [ ] **Step 2: Write `.env.example`**

```bash
# Copy to .env.local (gitignored) and fill in from the Supabase project's
# API settings. Never commit real values.

# Public — shipped in the browser bundle. RLS limits it to inserting leads.
# Either the legacy "anon" key or the newer "publishable" key works.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Secret — the local review script only. Never prefix with VITE_: Vite
# would ship it to every visitor. Legacy "service_role" or newer "secret".
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: User setup — pause and ask; never guess or print values**

Ask the user to:
1. Create a **new** Supabase project on their **personal** account (not
   the Eatple team), name `kfoodmap`, region Northeast Asia (Seoul).
2. SQL editor → paste all of `supabase/leads.sql` → Run → "Success".
3. Copy `.env.example` to `.env.local` inside the `k-food-map` folder and
   fill the three values **in the file** (not in chat).
4. Vercel dashboard (personal account) → `kfoodmap` → Settings →
   Environment Variables: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` for Production and Preview. **Never the
   service key.**

Then confirm without printing values:

```bash
node --env-file=.env.local -e "for (const k of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) console.log(k, process.env[k] ? 'set' : 'MISSING')"
git check-ignore .env.local
```

Expected: three `set`; `git check-ignore` prints `.env.local`.

- [ ] **Step 4: Write `scripts/leads.mjs` with `verify-rls`**

```js
// Review queue for user submissions (docs/superpowers/specs/2026-09-17-ugc-intake-design.md).
//
//   node --env-file=.env.local scripts/leads.mjs verify-rls
//
// Leads are leads, not facts: nothing here writes to restaurants.js.
import { authHeaders, buildLead } from '../src/data/leads.js';

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set. Run with --env-file=.env.local (see .env.example).`);
    process.exit(2);
  }
  return value;
}

function rest(path, key, init = {}) {
  const base = env('VITE_SUPABASE_URL').replace(/\/+$/, '');
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(key), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

// Proves the public key can do exactly one thing, against the live table —
// the same standard as the evidence rules: each proven to hold by trying
// to break it, not assumed. Leaves no rows behind.
async function verifyRls() {
  const anon = env('VITE_SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const marker = `rls-self-test ${new Date().toISOString()}`;
  const { row } = buildLead({ name: 'RLS self-test', topic: 'other', message: marker });
  const results = [];
  const check = (rule, pass, detail) => results.push({ rule, pass, detail });
  const byMessage = (message) => `leads?message=eq.${encodeURIComponent(message)}`;
  const rowsAsService = async (message) => (await rest(`${byMessage(message)}&select=id,status`, service)).json();

  try {
    const insert = await rest('leads', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    check('anon can insert a well-formed lead', insert.status === 201, `HTTP ${insert.status}`);

    const read = await rest('leads?select=*', anon);
    const readBody = read.ok ? await read.json() : null;
    check('anon cannot read leads', !read.ok || (Array.isArray(readBody) && readBody.length === 0),
      `HTTP ${read.status}${readBody ? `, ${readBody.length} row(s)` : ''}`);

    const forgedMessage = `${marker} forged`;
    const forged = await rest('leads', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...row, message: forgedMessage, status: 'accepted' }),
    });
    check('anon cannot insert a pre-resolved lead', forged.status >= 400, `HTTP ${forged.status}`);

    const update = await rest(byMessage(marker), anon, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted' }),
    });
    const afterUpdate = await rowsAsService(marker);
    check('anon cannot change a status', afterUpdate.length === 1 && afterUpdate[0].status === 'open',
      `HTTP ${update.status}, status now ${afterUpdate[0]?.status}`);

    const del = await rest(byMessage(marker), anon, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    const afterDelete = await rowsAsService(marker);
    check('anon cannot delete', afterDelete.length === 1, `HTTP ${del.status}, ${afterDelete.length} row(s) remain`);

    const forgedRows = await rowsAsService(forgedMessage);
    check('no forged row exists', forgedRows.length === 0, `${forgedRows.length} forged row(s)`);
  } finally {
    await rest(`leads?message=like.${encodeURIComponent(`${marker}*`)}`, service, { method: 'DELETE' });
  }

  for (const { rule, pass, detail } of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${rule}  (${detail})`);
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n${failed} rule(s) failed.` : `\nAll ${results.length} rules hold.`);
  process.exit(failed ? 1 : 0);
}

const commands = { 'verify-rls': verifyRls };

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.error(`Usage: node --env-file=.env.local scripts/leads.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
await commands[command](args);
```

- [ ] **Step 5: Prove the RLS**

Run: `node --env-file=.env.local scripts/leads.mjs verify-rls`
Expected: six `PASS` lines, `All 6 rules hold.`, exit 0.

If `anon can insert` fails with 401, check which key type is in
`VITE_SUPABASE_ANON_KEY` before touching code; with 403 / `42501`,
re-run `supabase/leads.sql` (grant or policy missing). **Never weaken the
SQL to make a rule pass** — the same spirit as §11 rule 13.

- [ ] **Step 6: Prove the check can fail (mutation test)**

In the SQL editor run `grant select on public.leads to anon;`, re-run
`verify-rls`, confirm `FAIL  anon cannot read leads` and exit 1. Then run
`revoke select on public.leads from anon;` and confirm
`All 6 rules hold.` again.

---

### Task 3: The review script — `list` and `resolve`

**Files:**
- Create: `scripts/tests/leads-format.test.mjs`
- Create: `scripts/lib/leads-format.mjs`
- Modify: `scripts/leads.mjs`

**Interfaces:**
- Consumes: `env`, `rest`, `commands` in `scripts/leads.mjs` (Task 2);
  `restaurants` from `src/data/restaurants.js`.
- Produces: `formatLead(lead, byId): string`;
  `parseResolveArgs(argv: string[])` →
  `{ ok: true, id, status, note } | { ok: false, errors: string[] }`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/tests/leads-format.test.mjs`:

```js
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

test('resolve requires an id, a resolution status, and a non-empty note', () => {
  assert.deepEqual(parseResolveArgs(['abc', 'rejected', '--note', 'Permanently closed per Naver Place']),
    { ok: true, id: 'abc', status: 'rejected', note: 'Permanently closed per Naver Place' });
  assert.equal(parseResolveArgs(['abc', 'rejected']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'rejected', '--note', '   ']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'published', '--note', 'x']).ok, false);
  assert.equal(parseResolveArgs(['abc', 'open', '--note', 'x']).ok, false);
  assert.equal(parseResolveArgs([]).ok, false);
});
```

- [ ] **Step 2: Run; confirm failure**

Run: `npm test`
Expected: the new file fails with `Cannot find module '…/scripts/lib/leads-format.mjs'`; Task 1's 13 tests still pass.

- [ ] **Step 3: Implement `scripts/lib/leads-format.mjs`**

```js
// Formatting for scripts/leads.mjs: a lead printed the way Phase 3
// verification works — the claim next to what we currently record.

const CURRENT = {
  vegan: place => place.dietary?.vegan,
  halal: place => place.dietary?.halal,
  hours: place => place.hours,
  address: place => place.address,
  closed: place => place.lifecycle ?? 'active (no lifecycle record)',
};

function describe(fact) {
  if (fact == null) return 'no record';
  if (typeof fact !== 'object' || !('confidence' in fact)) {
    return typeof fact === 'string' ? fact : JSON.stringify(fact);
  }
  const value = fact.value == null ? '(no value)'
    : typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value);
  return `${value} [${fact.confidence}]${fact.source ? ` — ${fact.source}` : ''}`;
}

export function formatLead(lead, byId) {
  const lines = [`── ${lead.id} · ${lead.kind} · ${lead.topic} · ${lead.created_at.slice(0, 10)}`];

  if (lead.kind === 'correction') {
    const place = byId[lead.place_id];
    if (place) {
      lines.push(`   place:   ${place.id} — ${place.name}`);
      if (CURRENT[lead.topic]) lines.push(`   current: ${describe(CURRENT[lead.topic](place))}`);
    } else {
      lines.push(`   place:   ⚠ unknown place_id "${lead.place_id}" — not in restaurants.js`);
    }
  } else {
    lines.push(`   name:    ${lead.name}`);
    lines.push(`   where:   ${lead.location_hint ?? 'not given'}`);
  }

  lines.push(`   claim:   ${lead.message}`);
  lines.push(`   source:  ${lead.source_url ?? 'none given'}`);
  lines.push(`   contact: ${lead.contact_email ?? 'none'}`);
  return lines.join('\n');
}

const RESOLUTIONS = ['accepted', 'rejected', 'deferred'];

export function parseResolveArgs(argv) {
  const [id, status, ...rest] = argv;
  const noteAt = rest.indexOf('--note');
  const note = noteAt === -1 ? null : (rest[noteAt + 1] ?? '').trim() || null;

  const errors = [];
  if (!id) errors.push('missing lead id');
  if (!RESOLUTIONS.includes(status)) errors.push(`status must be one of: ${RESOLUTIONS.join(', ')}`);
  if (!note) errors.push('--note "<why>" is required — a resolution without a reason is not recorded');

  return errors.length > 0 ? { ok: false, errors } : { ok: true, id, status, note };
}
```

- [ ] **Step 4: Run; confirm pass**

Run: `npm test`
Expected: 18 tests pass (13 + 5), 0 fail.

- [ ] **Step 5: Add `list` and `resolve` to `scripts/leads.mjs`**

Replace the header comment's usage lines with:

```js
//   node --env-file=.env.local scripts/leads.mjs list
//   node --env-file=.env.local scripts/leads.mjs resolve <id> <accepted|rejected|deferred> --note "<why>"
//   node --env-file=.env.local scripts/leads.mjs verify-rls
//
// "accepted" means worth running the Phase 3 verification on — not
// published. Leads are leads, not facts: nothing here writes to restaurants.js.
```

Add below the existing import:

```js
import { restaurants } from '../src/data/restaurants.js';
import { formatLead, parseResolveArgs } from './lib/leads-format.mjs';
```

Add directly above `const commands`:

```js
async function list() {
  const response = await rest('leads?status=eq.open&order=created_at.asc&select=*', env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!response.ok) {
    console.error(`Could not read leads: HTTP ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  const leads = await response.json();
  const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));
  for (const lead of leads) console.log(`${formatLead(lead, byId)}\n`);
  console.log(`${leads.length} open lead(s).`);
}

async function resolve(args) {
  const parsed = parseResolveArgs(args);
  if (!parsed.ok) {
    for (const error of parsed.errors) console.error(error);
    process.exit(2);
  }
  const response = await rest(
    `leads?id=eq.${encodeURIComponent(parsed.id)}&status=eq.open`,
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: parsed.status, resolution_note: parsed.note, resolved_at: new Date().toISOString() }),
    },
  );
  const rows = response.ok ? await response.json() : [];
  if (rows.length !== 1) {
    console.error(`No open lead ${parsed.id} (HTTP ${response.status}). Already resolved, or a typo?`);
    process.exit(1);
  }
  console.log(`${parsed.id} → ${parsed.status}: ${parsed.note}`);
}
```

Replace `const commands = { 'verify-rls': verifyRls };` with:

```js
const commands = { list, resolve, 'verify-rls': verifyRls };
```

Run `npm run lint` → still exactly 1 warning.

- [ ] **Step 6: Exercise against the live table (needs Task 2)**

```bash
node --env-file=.env.local scripts/leads.mjs list
node --env-file=.env.local scripts/leads.mjs resolve 00000000-0000-0000-0000-000000000000 rejected
node --env-file=.env.local scripts/leads.mjs resolve 00000000-0000-0000-0000-000000000000 rejected --note "test"
```

Expected: `list` prints `0 open lead(s).` (the self-test cleaned up); the
first `resolve` exits 2 with the `--note` error and sends nothing; the
second exits 1 with `No open lead …`. The happy path runs in Task 6 on
real QA submissions.

---

### Task 4: The `/submit` sheet

**Files:**
- Modify: `src/i18n/locales/en.js`
- Create: `src/components/SubmitSheet.jsx`
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Modify: `scripts/prerender-places.mjs`

**Interfaces:**
- Consumes: `LEAD_TOPICS`, `LEAD_LIMITS`, `resolvePlace`, `buildLead`,
  `supabaseConfig`, `submitLead` (Task 1); `useOnlineStatus()` from
  `src/hooks/useOnlineStatus.js`; `XIcon` from `src/components/Icons.jsx`;
  existing CSS classes `.detail-backdrop`, `.detail-sheet`,
  `.detail-close`, `.detail-scroll`, `.detail-content`, `.btn-primary`.
- Produces: `<SubmitSheet place={object|null} onClose={() => void} />`;
  route `/submit` (optional `?place=<id>`); i18n keys `submit.*` and
  `profile.suggestRestaurant`.

- [ ] **Step 1: Strings in `src/i18n/locales/en.js`**

Inside `profile`, after `languageEnglish`, add:

```js
    suggestRestaurant: 'Suggest a restaurant',
```

After the `profile` block, add a new top-level block:

```js
  submit: {
    titleNew: 'Suggest a restaurant',
    titleCorrection: 'Report incorrect info',
    introNew: 'Know a place that belongs on the map? Tell us what you know — we research every suggestion ourselves before anything is added.',
    introCorrection: 'Something wrong about {{name}}? Tell us what you saw.',
    nameLabel: 'Restaurant name',
    locationLabel: 'Where is it?',
    locationHint: 'A neighbourhood or the nearest station is enough.',
    topicLabel: 'What is it about?',
    topicPlaceholder: 'Choose one',
    topics: {
      vegan: 'Vegan options',
      halal: 'Halal',
      hours: 'Opening hours',
      closed: 'Closed or moved',
      address: 'Address or location',
      other: 'Something else',
    },
    messageLabel: 'What did you see?',
    sourceLabel: 'Link (optional)',
    sourceHint: "The restaurant's website, social page, or a listing.",
    emailLabel: 'Email (optional)',
    emailHint: 'Only used if we need to ask you a follow-up question. Never shown publicly.',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Thanks — we verify every submission before anything appears on the map.',
    close: 'Close',
    failed: "Couldn't send. Your text is still here — please try again.",
    offline: "You're offline. Your text is kept here — send it when you're back online.",
    disabled: "Submissions aren't enabled in this build.",
    reportLink: 'Report incorrect info',
    errors: {
      required: 'Required',
      invalidTopic: 'Choose a topic',
      tooLong: 'Too long — {{max}} characters at most',
      invalidUrl: 'Use a link starting with http:// or https://',
      invalidEmail: 'Enter a valid email address',
    },
  },
```

Update the file's top comment's first line to say it holds the core
screens **plus the submission form**.

- [ ] **Step 2: Create `src/components/SubmitSheet.jsx`**

```jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from './Icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { LEAD_TOPICS, LEAD_LIMITS, buildLead, supabaseConfig, submitLead } from '../data/leads';

const config = supabaseConfig(import.meta.env);

const EMPTY = { name: '', locationHint: '', topic: '', message: '', sourceUrl: '', contactEmail: '', website: '' };

function Field({ id, label, hint, error, children }) {
  const { t } = useTranslation();
  return (
    <div className="submit-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="submit-field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="submit-field__error" id={`${id}-error`} role="alert">
          {t(`submit.errors.${error.code}`, { max: error.max })}
        </p>
      )}
    </div>
  );
}

// The sheet for /submit. A correction (place given) never asks for a name
// or location — those are ours already. What's sent is a lead for a person
// to verify, never data, and the success copy says so where the promise is made.
export default function SubmitSheet({ place, onClose }) {
  const { t, i18n } = useTranslation();
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed

  const title = place ? t('submit.titleCorrection') : t('submit.titleNew');
  const set = (key) => (event) => setForm(prev => ({ ...prev, [key]: event.target.value }));
  const describedBy = (id, hasHint) =>
    [hasHint && `${id}-hint`, errors[id] && `${id}-error`].filter(Boolean).join(' ') || undefined;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = buildLead(form, { place, lang: i18n.language });
    // A filled honeypot gets the same success screen and sends nothing —
    // a bot learns nothing from the response.
    if (result.spam) { setStatus('sent'); return; }
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setStatus('sending');
    const sent = await submitLead(result.row, config);
    setStatus(sent.ok ? 'sent' : 'failed');
  };

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button className="detail-close" aria-label={t('submit.close')} onClick={onClose}>
          <XIcon size={18} />
        </button>
        <div className="detail-scroll">
          <div className="detail-content submit-content">
            <h2 className="submit-title">{title}</h2>

            {!config && <p className="submit-note">{t('submit.disabled')}</p>}

            {config && status === 'sent' && (
              <>
                <p className="submit-status" role="status">{t('submit.sent')}</p>
                <button className="btn-primary submit-close" onClick={onClose}>{t('submit.close')}</button>
              </>
            )}

            {config && status !== 'sent' && (
              <form className="submit-form" onSubmit={handleSubmit} noValidate>
                <p className="submit-note">
                  {place ? t('submit.introCorrection', { name: place.name }) : t('submit.introNew')}
                </p>

                {!place && (
                  <>
                    <Field id="name" label={t('submit.nameLabel')} error={errors.name}>
                      <input id="name" value={form.name} onChange={set('name')} maxLength={LEAD_LIMITS.name}
                        aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('name', false)} />
                    </Field>
                    <Field id="location_hint" label={t('submit.locationLabel')} hint={t('submit.locationHint')} error={errors.location_hint}>
                      <input id="location_hint" value={form.locationHint} onChange={set('locationHint')} maxLength={LEAD_LIMITS.location_hint}
                        aria-invalid={Boolean(errors.location_hint)} aria-describedby={describedBy('location_hint', true)} />
                    </Field>
                  </>
                )}

                <Field id="topic" label={t('submit.topicLabel')} error={errors.topic}>
                  <select id="topic" value={form.topic} onChange={set('topic')}
                    aria-invalid={Boolean(errors.topic)} aria-describedby={describedBy('topic', false)}>
                    <option value="" disabled>{t('submit.topicPlaceholder')}</option>
                    {LEAD_TOPICS.map(topic => <option key={topic} value={topic}>{t(`submit.topics.${topic}`)}</option>)}
                  </select>
                </Field>

                <Field id="message" label={t('submit.messageLabel')} error={errors.message}>
                  <textarea id="message" rows={5} value={form.message} onChange={set('message')} maxLength={LEAD_LIMITS.message}
                    aria-invalid={Boolean(errors.message)} aria-describedby={describedBy('message', false)} />
                </Field>

                <Field id="source_url" label={t('submit.sourceLabel')} hint={t('submit.sourceHint')} error={errors.source_url}>
                  <input id="source_url" type="url" inputMode="url" value={form.sourceUrl} onChange={set('sourceUrl')} maxLength={LEAD_LIMITS.source_url}
                    aria-invalid={Boolean(errors.source_url)} aria-describedby={describedBy('source_url', true)} />
                </Field>

                <Field id="contact_email" label={t('submit.emailLabel')} hint={t('submit.emailHint')} error={errors.contact_email}>
                  <input id="contact_email" type="email" autoComplete="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={LEAD_LIMITS.contact_email}
                    aria-invalid={Boolean(errors.contact_email)} aria-describedby={describedBy('contact_email', true)} />
                </Field>

                <div className="submit-honeypot" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </div>

                {!isOnline && <p className="submit-status submit-status--error" role="status">{t('submit.offline')}</p>}
                {isOnline && status === 'failed' && <p className="submit-status submit-status--error" role="alert">{t('submit.failed')}</p>}

                <button className="btn-primary" type="submit" disabled={!isOnline || status === 'sending'}>
                  {status === 'sending' ? t('submit.sending') : t('submit.send')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

(The honeypot's label is deliberately not translated — no human sees it.)

- [ ] **Step 3: Wire the route in `src/App.jsx`**

Add to the imports:

```jsx
import SubmitSheet from './components/SubmitSheet';
import { resolvePlace } from './data/leads';
```

Inside `AppShell`, directly after the line
`const focusStory = Boolean(location.state?.focusStory);`, add:

```jsx
  const isSubmit = location.pathname === '/submit';
  const submitPlace = useMemo(
    () => (isSubmit ? resolvePlace(new URLSearchParams(location.search).get('place'), activeRestaurants) : null),
    [isSubmit, location.search],
  );
```

Directly after the closing `/>` of `<RestaurantDetail … />`, add:

```jsx
      {isSubmit && (
        <SubmitSheet
          key={location.search}
          place={submitPlace}
          onClose={() => navigate(submitPlace ? `/place/${submitPlace.id}` : '/')}
        />
      )}
```

In `App`, after `<Route path="/place/:id" element={<AppShell />} />`, add:

```jsx
      <Route path="/submit" element={<AppShell />} />
```

(A visitor who hasn't completed Prologue sees it first — the same
accepted behaviour as a shared `/place/:id`, HANDOFF §7 #23.)

- [ ] **Step 4: Styles — append to `src/index.css`**

```css
/* ── Submission sheet (/submit) ───────────────────────────────────────── */
.submit-content {
  padding-top: 56px; /* clears .detail-close; this sheet has no hero image */
}
.submit-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink-title);
  margin-bottom: 8px;
}
.submit-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 32px;
}
.submit-note {
  color: var(--ink-body);
  line-height: 1.5;
}
.submit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.submit-field label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.submit-field input,
.submit-field select,
.submit-field textarea {
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  font: inherit;
  font-size: 16px; /* <16px makes iOS Safari zoom in on focus */
  color: var(--ink);
  background: var(--fill);
  border: 1px solid transparent;
  border-radius: var(--radius);
  transition: border-color 0.15s ease;
}
.submit-field textarea {
  resize: vertical;
}
.submit-field input:focus,
.submit-field select:focus,
.submit-field textarea:focus {
  outline: none;
  border-color: var(--green-strong);
}
.submit-field [aria-invalid="true"] {
  border-color: var(--danger);
}
.submit-field__hint {
  font-size: 13px;
  color: var(--muted);
}
.submit-field__error,
.submit-status--error {
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
}
.submit-status {
  color: var(--ink-body);
  line-height: 1.5;
  margin-bottom: 16px;
}
.submit-honeypot {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.submit-form .btn-primary,
.submit-close {
  flex: none;
  width: 100%;
}
.submit-form .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Confirm no new hex:

```bash
git diff -U0 src/index.css | grep -E '^\+' | grep -Eic '#[0-9a-f]{3,8}\b'
```

Expected: `0`.

- [ ] **Step 5: Prerender `/submit` in `scripts/prerender-places.mjs`**

Directly after the `for (const place of active) { … }` loop, add:

```js
// /submit is a route too, so a direct load or reload must be a real file,
// the same as /place/:id. Generic meta; noindex because a form has nothing
// for a search engine, and deliberately absent from the sitemap.
{
  const url = `${SITE_URL}/submit`;
  const title = 'Suggest a restaurant · K-Food Map';
  const page = [
    [/<title>.*<\/title>/, `<title>${title}</title>`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    [/<\/head>/, `  <meta name="robots" content="noindex" />\n  </head>`],
  ].reduce((html, [pattern, value]) => html.replace(pattern, () => value), template);
  mkdirSync(path.join(distDir, 'submit'), { recursive: true });
  writeFileSync(path.join(distDir, 'submit', 'index.html'), page, 'utf8');
}
```

Change the last `console.log` to:

```js
console.log(`Wrote submit/index.html, sitemap.xml (${active.length + 1} URLs) and robots.txt.`);
```

- [ ] **Step 6: Build and check the output**

```bash
npm run build
grep -o '<title>[^<]*</title>' dist/submit/index.html
grep -c 'name="robots" content="noindex"' dist/submit/index.html
grep -c '/submit' dist/sitemap.xml
```

Expected: `<title>Suggest a restaurant · K-Food Map</title>`, `1`, `0`.

- [ ] **Step 7: Browser check (dev server)**

Start the `k-food-map` dev server (`.claude/launch.json`). If `.env.local`
does not exist yet, steps 2–5 show the "not enabled" message instead —
then repeat them after Task 2.

1. `http://localhost:5173/submit` on a clean profile: Prologue first; after it, the sheet opens over the map.
2. Send with everything empty → "Required" under name and message, "Choose a topic" under topic; `read_network_requests` shows no request to `/rest/v1/leads`.
3. `/submit?place=eid` → "Report incorrect info", intro names the restaurant, no name/location fields; close → `/place/eid`.
4. `/submit?place=makan` (quarantined) and `/submit?place=nope` → new-restaurant mode.
5. `window.dispatchEvent(new Event('offline'))` → offline line, Send disabled; `new Event('online')` restores it.
6. `read_console_messages` with `onlyErrors` → none.

Real submissions happen in Task 6 (they create rows).

---

### Task 5: Entry points

**Files:**
- Modify: `src/components/TabPanel.jsx`
- Modify: `src/components/RestaurantDetail.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: route `/submit`; i18n keys `profile.suggestRestaurant`,
  `submit.reportLink` (Task 4).
- Produces: nothing later tasks call.

- [ ] **Step 1: Profile row**

In `ProfileTab` (`src/components/TabPanel.jsx`), add
`const navigate = useNavigate();` below the `useState` line
(`useNavigate` is already imported at the top of the file), and in the
`settings` array insert, directly before the `About K-Food Map` entry:

```jsx
    { label: t('profile.suggestRestaurant'), value: '', icon: '📍', action: () => navigate('/submit') },
```

- [ ] **Step 2: Detail-page link**

In `src/components/RestaurantDetail.jsx`, add to the imports:

```jsx
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
```

Inside the component, before `const [copied, setCopied] = useState(false);`, add:

```jsx
  const { t } = useTranslation();
```

Directly after the closing `</div>` of `<div className="detail-directions">`
(inside the "Location & Directions" section, before `</section>`), add:

```jsx
              <Link className="detail-report" to={`/submit?place=${restaurant.id}`}>
                {t('submit.reportLink')}
              </Link>
```

- [ ] **Step 3: Style — append to `src/index.css`**

```css
.detail-report {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.detail-report:hover {
  color: var(--ink);
}
```

- [ ] **Step 4: Browser check**

1. Profile tab → "Suggest a restaurant" → `/submit`, new mode.
2. Open any restaurant → "Report incorrect info" under the map buttons → `/submit?place=<that id>`, correction mode; closing returns to that restaurant.
3. `resize_window` preset `mobile`: the link's bounding box is ≥ 44 px tall and not covered by the tab bar or sheet edge; then preset `desktop`.
4. The rest of the detail page is unchanged; lint still 1 warning; no new hex (`git diff -U0 src/index.css | grep -E '^\+' | grep -Eic '#[0-9a-f]{3,8}\b'` → `0`).

---

### Task 6: Gates, live QA, documentation, one commit

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/GROWTH-PLAN.md`

- [ ] **Step 1: All gates**

```bash
npm run check-data
npm run lint
npm test
npm run build
grep -rc retrievedBy dist/ | grep -v ':0$' | wc -l
grep -rliE "service_role|sb_secret_" dist/ | wc -l
node scripts/evidence-hash.mjs --check
node --env-file=.env.local -e "const fs=require('fs'),p=require('path');const k=process.env.SUPABASE_SERVICE_ROLE_KEY;let n=0;(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else if(fs.readFileSync(f).includes(k)){n++;console.log('LEAK',f)}}})('dist');console.log('secret key occurrences in dist:',n)"
```

Expected: `No violations.`; 1 lint warning; all tests pass; build OK;
`0`; `0`; `0 pending, 0 drifted`; `secret key occurrences in dist: 0`.

- [ ] **Step 2: RLS proof, again**

Run: `node --env-file=.env.local scripts/leads.mjs verify-rls`
Expected: `All 6 rules hold.`

- [ ] **Step 3: Live submissions through the real form (dev server)**

1. New mode: name "QA Test Kitchen", location "QA", topic Vegan, message "QA — delete", link `https://example.com` → success copy. `read_network_requests` shows one `POST …/rest/v1/leads` → `201`.
2. Correction mode on `eid`: topic Halal, message "QA — delete" → success, one `201`.
3. Honeypot: fill every field **and** set `#website` via `form_input`, Send → success copy **and no** `POST` to `/rest/v1/leads`.
4. Unconfigured build: `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build`, then `npx vite preview` → `/submit` shows "Submissions aren't enabled in this build." and no form. Stop the preview; `npm run build` again.

- [ ] **Step 4: Review script happy path**

Run: `node --env-file=.env.local scripts/leads.mjs list`
Expected: exactly the two QA leads; the `eid` one shows
`current: friendly [supported] — Government tourism site`.

```bash
node --env-file=.env.local scripts/leads.mjs resolve <new-lead-id> rejected --note "QA row from UGC intake verification"
node --env-file=.env.local scripts/leads.mjs resolve <eid-lead-id> rejected --note "QA row from UGC intake verification"
node --env-file=.env.local scripts/leads.mjs list
```

Expected: two `→ rejected` lines, then `0 open lead(s).` QA rows stay as
`rejected` records rather than being deleted — resolved leads are history.

- [ ] **Step 5: Update `HANDOFF.md`**

1. Header: `Last updated` 2026-09-17 (or the actual date), base commit =
   current HEAD, one sentence saying this edit lands with the UGC intake
   commit.
2. §2.1 "Why no backend": keep the paragraph; append: "**Amended
   2026-09-17 (GROWTH-PLAN decision D):** one managed Supabase table,
   `leads`, that the app can only insert into (column grant + RLS in
   `supabase/leads.sql`, proven live by `scripts/leads.mjs verify-rls`).
   Restaurant data is still verified at authoring time and shipped static;
   there is still no server code in this repository."
3. §2.1: a new **"UGC intake (2026-09-17, Stage 4)"** paragraph — the
   `/submit` route and its two entry points; `src/data/leads.js` as the
   one shared module; `SubmitSheet`; `dist/submit/index.html` (noindex,
   not in the sitemap); which env variable lives where (Vercel: the two
   `VITE_` ones; `.env.local` only: the service key); and the rule, in
   bold: **a lead is never a fact — nothing reads `leads` into the data.**
   Link the spec and this plan.
4. §7 #15 ("No automated tests"): append that `npm test` now exists
   (`node:test`, `scripts/tests/`) and covers only the lead module and
   the review formatter; data rules are still `check-data`'s job.
5. §7: new item **#30** — deferred from UGC intake, each with reason and
   revisit trigger: Naver/Kakao autofill (the next Stage 4 step);
   server-side rate limiting / bot challenge (revisit when `list` shows
   junk); notifying submitters; photo attachments.
6. §8 "Not started": replace "Any backend, auth, or user-generated
   content" with "Authentication and Cross-Device Sync (a backend now
   exists for UGC intake — §2.1)".
7. §11: add rule 24 — the service key never in `src/`, in a `VITE_`
   variable, or in the repository; `VITE_` means "shipped to every
   visitor".
8. §12 item 5: UGC intake done (hash filled in after commit is not
   possible in the same commit — say "this commit"), next is autofill or
   Cross-Device Sync, user's choice. Quick start block: add `npm test`,
   the `service_role|sb_secret_` grep, and the three `scripts/leads.mjs`
   commands.

- [ ] **Step 6: Update `docs/GROWTH-PLAN.md`**

- Stage 4: mark **UGC 제보** ✅ with the date and one line: 로그인 없음 ·
  새 식당 / 정보 수정 두 모드 · Supabase `leads`(공개 키는 INSERT만) ·
  `scripts/leads.mjs`로 검수 · 자동채움은 다음 단계.
- §2 gate list: add `npm test` and
  `grep -rliE "service_role|sb_secret_" dist/ | wc -l  # 0 필수`.

- [ ] **Step 7: Report and ask for commit approval — do not commit yet**

Report: gate output, `verify-rls` output, the network evidence from
Step 3, `git status --porcelain` and `git diff --stat`, and the proposed
message below. Wait for an explicit yes.

- [ ] **Step 8: Commit and push (after approval only)**

```bash
git add src/data/leads.js src/components/SubmitSheet.jsx src/App.jsx \
  src/components/TabPanel.jsx src/components/RestaurantDetail.jsx \
  src/i18n/locales/en.js src/index.css scripts/prerender-places.mjs \
  scripts/leads.mjs scripts/lib/leads-format.mjs scripts/tests/ \
  supabase/leads.sql .env.example package.json HANDOFF.md docs/GROWTH-PLAN.md
git status --porcelain
```

Confirm `.env.local` is **not** listed as staged (it should not appear at
all). Then:

```bash
git commit -F - <<'EOF'
Stage 4: UGC intake — suggest a restaurant or report incorrect info

Anyone can submit, no login. Each submission is an `open` row in a
Supabase `leads` table the public key can only insert into (column grant
+ RLS in supabase/leads.sql, proven live by `scripts/leads.mjs
verify-rls`). A lead is never a fact: nothing reads the table into the
data; `scripts/leads.mjs list/resolve` feeds the Phase 3 verification,
which still edits restaurants.js by hand.

/submit renders as a sheet in new-restaurant or correction mode, is
prerendered so a direct load is a real file, and says submissions aren't
enabled when a build has no Supabase config. First use of `npm test`
(node:test, no dependency). No data changed.

Spec: docs/superpowers/specs/2026-09-17-ugc-intake-design.md
Plan: docs/superpowers/plans/2026-09-17-ugc-intake.md

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
git push origin master
```

- [ ] **Step 9: Deployment and the live site**

1. Poll `https://api.github.com/repos/rkdals0121/kfoodmap/deployments`
   for the new SHA, then its `/statuses`, until final. Expected:
   `success`. If `failure`, read the Vercel log (dashboard screenshot —
   the CLI can't log in on this machine, HANDOFF §7 #29) before changing
   anything.
2. On `https://kfoodmap.vercel.app`: direct loads of `/submit` and
   `/submit?place=eid` return 200 and render the **form** — the "not
   enabled" message here means the Vercel env variables are missing.
3. One live submission from the deployed site; `list` shows it;
   `resolve <id> rejected --note "QA row from the production deploy check"`.
