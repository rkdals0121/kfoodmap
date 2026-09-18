# Submit Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When someone suggests a new restaurant, typing its name offers up
to five Kakao place suggestions; picking one attaches Kakao's place id,
address and coordinates to the lead, so the reviewer starts from a
candidate instead of a search — while a submitter who ignores the
suggestions submits exactly as today.

**Architecture:** One Vercel serverless function (`api/place-search.js`,
this repository's first server code) holds the Kakao REST key and proxies
keyword search; its pure parts live in `api/_lib/kakao.mjs` and are unit
tested. A dev-only Vite plugin mounts the same handler so the feature is
testable without `vercel dev`. The submit form's name field becomes an
ARIA combobox. Four optional columns on `leads` carry the picked place.

**Tech Stack:** Vercel Node function (no framework, no dependency), Vite 8
`configureServer` plugin, React 19 + react-i18next (existing), Supabase
REST (existing), `node:test` (existing).

**Spec:** `docs/superpowers/specs/2026-09-18-submit-autofill-design.md`

## Global Constraints

- **No new npm dependency.** No Kakao SDK, no HTTP client, no combobox library.
- **`KAKAO_REST_API_KEY` is server-only.** Never `VITE_`-prefixed, never
  imported from `src/`, never in the repository (§11 rule 24 extends to it).
- Gates every commit must pass: `npm run check-data` ("No violations."),
  `npm run lint` (baseline **1** warning, `src/utils.js`), `npm test`,
  `npm run build`, `grep -rc retrievedBy dist/` → 0,
  `grep -rliE "service_role|sb_secret_|KakaoAK" dist/ | wc -l` → 0,
  `node scripts/evidence-hash.mjs --check` → 0 pending / 0 drifted.
- **A lead is never a fact.** Nothing in this feature may write to
  `src/data/restaurants.js` or let a Kakao value bypass §2.11 verification.
- Autofill is optional at every point: an unconfigured build, a Kakao
  error, an empty result set and a submitter who never picks must all end
  in a working form.
- Every new user-facing string goes through `t()` in `src/i18n/locales/en.js`.
- Styles in `src/index.css`, existing tokens only, **no new hex values**.
- `src/data/privacy.js` states what a submission contains — if this
  feature adds fields to a lead, that file changes in the same commit
  (§11 rule 25).
- Browser verification before claiming UI works (§11 rule 16).
- **One feature, one commit,** at the end, after the user approves; push
  is a deploy and is not done until the commit's deployment reads
  `success` (§11 rule 23). Commit trailer:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Never read, print or commit `.env.local`.** It holds live keys.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `api/_lib/kakao.mjs` | create | Pure: `validateQuery`, `kakaoSearchUrl`, `mapKakaoDocuments` |
| `scripts/tests/kakao.test.mjs` | create | `node:test` coverage of the above |
| `api/place-search.js` | create | The Vercel handler: env, fetch, status codes, cache headers, best-effort rate limit |
| `vite.config.js` | modify | Dev-only plugin mounting the handler at `/api/place-search` |
| `supabase/leads-autofill.sql` | create | Four columns + extended anon column grant |
| `src/data/leads.js` | modify | `buildLead` accepts an optional `selection` |
| `scripts/tests/leads.test.mjs` | modify | Selection cases |
| `src/components/SubmitSheet.jsx` | modify | The combobox, its states, the picked-place note |
| `src/hooks/usePlaceSuggestions.js` | create | Debounce + abort + fetch, isolated from the form |
| `src/i18n/locales/en.js` | modify | Combobox strings |
| `src/index.css` | modify | `.submit-combobox*` rules |
| `scripts/lib/leads-format.mjs` | modify | The `kakao:` line |
| `scripts/tests/leads-format.test.mjs` | modify | Its test |
| `src/data/privacy.js` | modify | "what a report contains" gains the picked place |
| `HANDOFF.md`, `docs/GROWTH-PLAN.md` | modify | Task 6 |

**Order note:** Task 2's live checks need `KAKAO_REST_API_KEY` in
`.env.local` and Task 3's need the SQL run in Supabase — both are the
user's. Offline steps of every task may run first; live steps run in a
single live phase before Task 6.

---

### Task 1: The pure Kakao layer, test-first

**Files:**
- Create: `scripts/tests/kakao.test.mjs`
- Create: `api/_lib/kakao.mjs`

**Interfaces:**
- Produces:
  - `MIN_QUERY = 2`, `MAX_QUERY = 50`, `RESULT_LIMIT = 5`
  - `validateQuery(raw): { ok: true, query } | { ok: false, code }` — code ∈ `tooShort | tooLong`
  - `kakaoSearchUrl(query): string`
  - `mapKakaoDocuments(payload): Array<{ id, name, address, lat, lng, category }>`

- [ ] **Step 1: Write the failing tests**

Create `scripts/tests/kakao.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuery, kakaoSearchUrl, mapKakaoDocuments, MIN_QUERY, MAX_QUERY, RESULT_LIMIT } from '../../api/_lib/kakao.mjs';

test('validateQuery trims, and enforces the documented bounds', () => {
  assert.deepEqual(validateQuery('  공화춘  '), { ok: true, query: '공화춘' });
  assert.deepEqual(validateQuery('가'), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery('   '), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery(undefined), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery('x'.repeat(MAX_QUERY)), { ok: true, query: 'x'.repeat(MAX_QUERY) });
  assert.deepEqual(validateQuery('x'.repeat(MAX_QUERY + 1)), { ok: false, code: 'tooLong' });
  assert.equal(MIN_QUERY, 2);
});

test('kakaoSearchUrl asks Kakao for exactly the documented request', () => {
  const url = new URL(kakaoSearchUrl('공화춘'));
  assert.equal(url.origin + url.pathname, 'https://dapi.kakao.com/v2/local/search/keyword.json');
  assert.equal(url.searchParams.get('query'), '공화춘');
  assert.equal(url.searchParams.get('size'), String(RESULT_LIMIT));
});

const payload = {
  documents: [
    {
      id: '12345', place_name: '공화춘', address_name: '인천 중구 선린동 38-1',
      road_address_name: '인천 중구 차이나타운로 43', x: '126.6173', y: '37.4746',
      category_name: '음식점 > 중식', phone: '032-765-0571', place_url: 'http://place.map.kakao.com/12345',
    },
    {
      id: '67890', place_name: '이름만 지번', address_name: '서울 용산구 이태원동 1',
      road_address_name: '', x: '127.0', y: '37.5', category_name: '음식점',
    },
  ],
};

test('mapKakaoDocuments keeps only the fields we use, road address first', () => {
  const rows = mapKakaoDocuments(payload);
  assert.deepEqual(rows[0], {
    id: '12345', name: '공화춘', address: '인천 중구 차이나타운로 43',
    lat: 37.4746, lng: 126.6173, category: '음식점 > 중식',
  });
  assert.equal(rows[1].address, '서울 용산구 이태원동 1', 'falls back to the lot address');
  assert.equal(rows.some(r => 'phone' in r || 'place_url' in r), false, 'phone and place_url are not collected');
});

test('mapKakaoDocuments never throws on a malformed payload', () => {
  for (const bad of [null, undefined, {}, { documents: null }, { documents: [{}] }, { documents: [{ id: 'x', x: 'abc', y: 'def' }] }]) {
    assert.ok(Array.isArray(mapKakaoDocuments(bad)));
  }
  assert.deepEqual(mapKakaoDocuments({ documents: [{ id: 'x', place_name: 'n', x: 'abc', y: 'def' }] }), []);
});

test('mapKakaoDocuments caps the list even if Kakao returns more', () => {
  const many = { documents: Array.from({ length: 15 }, (_, i) => ({ id: String(i), place_name: `n${i}`, address_name: 'a', x: '127', y: '37', category_name: 'c' })) };
  assert.equal(mapKakaoDocuments(many).length, RESULT_LIMIT);
});
```

- [ ] **Step 2: Run and confirm the failure**

Run: `npm test`
Expected: `Cannot find module '…/api/_lib/kakao.mjs'`; the 26 existing tests still pass.

- [ ] **Step 3: Implement `api/_lib/kakao.mjs`**

```js
// Pure helpers for api/place-search.js — no I/O, so they can be tested
// without a server. Kakao's request shape (host, path, header, size 1-15)
// is from its current Local API docs, checked 2026-09-18.

export const MIN_QUERY = 2;
export const MAX_QUERY = 50;
export const RESULT_LIMIT = 5;

export function validateQuery(raw) {
  const query = typeof raw === 'string' ? raw.trim() : '';
  if (query.length < MIN_QUERY) return { ok: false, code: 'tooShort' };
  if (query.length > MAX_QUERY) return { ok: false, code: 'tooLong' };
  return { ok: true, query };
}

export function kakaoSearchUrl(query) {
  const params = new URLSearchParams({ query, size: String(RESULT_LIMIT) });
  return `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
}

// Only the fields the lead needs. Kakao also returns phone and place_url;
// those are not ours to collect on a submitter's behalf, so they stop here.
// A document without a usable id, name or coordinate pair is dropped rather
// than passed on half-formed — the form treats an empty list as "no
// suggestions", which is already a supported state.
export function mapKakaoDocuments(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  return documents
    .map(doc => {
      const lat = Number.parseFloat(doc?.y);
      const lng = Number.parseFloat(doc?.x);
      return {
        id: typeof doc?.id === 'string' ? doc.id : '',
        name: typeof doc?.place_name === 'string' ? doc.place_name : '',
        address: doc?.road_address_name || doc?.address_name || '',
        lat, lng,
        category: typeof doc?.category_name === 'string' ? doc.category_name : '',
      };
    })
    .filter(row => row.id && row.name && Number.isFinite(row.lat) && Number.isFinite(row.lng))
    .slice(0, RESULT_LIMIT);
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test` → all pass (26 + 5).
Run: `npm run lint` → exactly 1 warning.

---

### Task 2: The serverless function and its dev shim

**Files:**
- Create: `api/place-search.js`
- Modify: `vite.config.js`

**Interfaces:**
- Consumes: `api/_lib/kakao.mjs` (Task 1).
- Produces: `GET /api/place-search?q=…` → `200 { results }` |
  `400 { code: 'tooShort' | 'tooLong' }` | `429 { code: 'rateLimited' }` |
  `502 { code: 'upstream' }` | `503 { code: 'unconfigured' }`, and the same
  route under `vite dev`.

- [ ] **Step 1: Write the handler**

Create `api/place-search.js`:

```js
// The repository's first server code, and it exists for exactly one
// reason: KAKAO_REST_API_KEY must not ship to the browser. It reads one
// query parameter, asks Kakao, and returns the few fields the submit form
// needs. No database access, no other secret, no other route.
import { validateQuery, kakaoSearchUrl, mapKakaoDocuments } from './_lib/kakao.mjs';

// Best effort only: serverless instances are not shared, so this bounds a
// single warm instance, nothing more. The real limits are the CDN cache
// below and the query-length cap. If abuse ever appears, the answer is a
// bot challenge, not a bigger counter.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip)?.filter(t => now - t < WINDOW_MS) ?? [];
  bucket.push(now);
  hits.set(ip, bucket);
  if (hits.size > 500) hits.clear(); // bounded memory; a warm instance is short-lived
  return bucket.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return res.status(503).json({ code: 'unconfigured' });

  const url = new URL(req.url, 'http://localhost');
  const check = validateQuery(url.searchParams.get('q'));
  if (!check.ok) return res.status(400).json({ code: check.code });

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ code: 'rateLimited' });

  try {
    const upstream = await fetch(kakaoSearchUrl(check.query), {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!upstream.ok) {
      // Kakao's body can carry the key back in an error echo; log the
      // status only, and never pass its body to the browser.
      console.error(`kakao place search failed: HTTP ${upstream.status}`);
      return res.status(502).json({ code: 'upstream' });
    }
    const results = mapKakaoDocuments(await upstream.json());
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ results });
  } catch (error) {
    console.error(`kakao place search error: ${error?.name}`);
    return res.status(502).json({ code: 'upstream' });
  }
}
```

- [ ] **Step 2: Mount it in the dev server**

`vite dev` does not serve `api/`, and `vercel dev` cannot log in on this
machine (§7 #29). Add to `vite.config.js`, above `defineConfig`:

```js
// Dev only: Vite does not serve api/, so mount the same handler at the
// same path. apply: 'serve' keeps it out of every build.
function apiDevServer() {
  return {
    name: 'kfm-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/place-search', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/place-search.js');
        const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        await handler(
          { url: req.url, headers: req.headers },
          { status: (code) => ({ json: (body) => send(code, body) }), setHeader: () => {} },
        );
      });
    },
  };
}
```

and add `apiDevServer(),` as the first entry of the `plugins` array.

- [ ] **Step 3: Offline checks**

```bash
node --check api/place-search.js
npm run build
grep -rc "place-search" dist/assets/*.js | grep -v ':0$' | wc -l   # client must not bundle the handler: expect 0 matches in the handler's own name
ls dist/api 2>/dev/null; echo "no api/ in dist (expected)"
npm test
npm run lint
```

Expected: no syntax error; build succeeds; `dist/` contains no `api/`
directory (Vercel builds functions from the repository, not from `dist/`).

- [ ] **Step 4: Live check (live phase — needs the user's key)**

With `KAKAO_REST_API_KEY` set in `.env.local`, start the dev server the
controller uses and call the route (never printing the key):

```bash
curl -s "http://localhost:5173/api/place-search?q=%EA%B3%B5%ED%99%94%EC%B6%98" | head -c 400; echo
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/api/place-search?q=a"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/api/place-search?q=$(printf 'x%.0s' {1..60})"
```

Expected: JSON with up to 5 plausible results for 공화춘; `400` for the
one-character query; `400` for the 60-character query. Then, with the key
temporarily unset in the environment of a second dev-server run, `503`.

---

### Task 3: The four columns and `buildLead`'s selection

**Files:**
- Create: `supabase/leads-autofill.sql`
- Modify: `src/data/leads.js`
- Modify: `scripts/tests/leads.test.mjs`

**Interfaces:**
- Produces: `buildLead(form, { place, lang, selection })`; a row that now
  carries `kakao_place_id`, `kakao_address`, `kakao_lat`, `kakao_lng`
  (all `null` when no selection).

- [ ] **Step 1: Write the SQL**

Create `supabase/leads-autofill.sql`:

```sql
-- Adds the place a submitter picked from Kakao search to a lead.
-- Additive and safe to re-run. Paste into the Supabase SQL editor once.
-- See docs/superpowers/specs/2026-09-18-submit-autofill-design.md.
--
-- Still a lead, not a fact: this is what the submitter chose, not what we
-- assert. Verification (§2.11) cross-checks it by hand before any of it
-- reaches restaurants.js.

alter table public.leads add column if not exists kakao_place_id text;
alter table public.leads add column if not exists kakao_address  text;
alter table public.leads add column if not exists kakao_lat      double precision;
alter table public.leads add column if not exists kakao_lng      double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_kakao_bounds') then
    alter table public.leads add constraint leads_kakao_bounds check (
      (kakao_place_id is null or char_length(kakao_place_id) <= 40)
      and (kakao_address is null or char_length(kakao_address) <= 200)
      and (kakao_lat is null or (kakao_lat between -90 and 90))
      and (kakao_lng is null or (kakao_lng between -180 and 180))
    );
  end if;
end $$;

-- Extend, don't replace: the anon key may now also insert these four, and
-- still nothing else (status and the resolution fields stay out of reach).
grant insert (kind, place_id, name, location_hint, topic, message, source_url, contact_email, lang,
              kakao_place_id, kakao_address, kakao_lat, kakao_lng)
  on public.leads to anon;
```

- [ ] **Step 2: Write the failing tests**

Append to `scripts/tests/leads.test.mjs`:

```js
const selection = { id: '12345', name: '공화춘', address: '인천 중구 차이나타운로 43', lat: 37.4746, lng: 126.6173, category: '음식점 > 중식' };

test('a lead without a selection carries null kakao fields', () => {
  const { row } = buildLead(form);
  assert.equal(row.kakao_place_id, null);
  assert.equal(row.kakao_address, null);
  assert.equal(row.kakao_lat, null);
  assert.equal(row.kakao_lng, null);
});

test('a selection is copied onto the row, and fills the location hint', () => {
  const { row } = buildLead({ ...form, locationHint: '' }, { selection });
  assert.equal(row.kakao_place_id, '12345');
  assert.equal(row.kakao_address, '인천 중구 차이나타운로 43');
  assert.equal(row.kakao_lat, 37.4746);
  assert.equal(row.kakao_lng, 126.6173);
  assert.equal(row.location_hint, '인천 중구 차이나타운로 43');
});

test('a location hint the user typed wins over the selection address', () => {
  const { row } = buildLead({ ...form, locationHint: 'behind the station' }, { selection });
  assert.equal(row.location_hint, 'behind the station');
});

test('a correction never carries a selection — the place is already ours', () => {
  const { row } = buildLead(form, { place: active, selection });
  assert.equal(row.kakao_place_id, null);
  assert.equal(row.kakao_lat, null);
});

test('an out-of-range or malformed selection is dropped, not sent', () => {
  for (const bad of [
    { ...selection, lat: 999 }, { ...selection, lng: -181 },
    { ...selection, lat: 'x' }, { ...selection, id: '' },
    { ...selection, id: 'x'.repeat(41) }, { ...selection, address: 'x'.repeat(201) },
  ]) {
    const { row } = buildLead(form, { selection: bad });
    assert.equal(row.kakao_place_id, null, JSON.stringify(bad).slice(0, 60));
    assert.equal(row.kakao_lat, null);
  }
});
```

- [ ] **Step 3: Run, confirm failure, implement**

Run `npm test` — the new cases fail (`kakao_place_id` undefined).

In `src/data/leads.js`, add the bounds beside `LEAD_LIMITS`:

```js
export const SELECTION_LIMITS = { kakao_place_id: 40, kakao_address: 200 };
```

add a normalizer above `buildLead`:

```js
// A picked suggestion is data from Kakao by way of the browser, so it is
// checked the same way a typed field is: anything malformed or out of
// range is dropped entirely rather than sent half-valid. Dropping it costs
// the reviewer a lookup; sending a bad coordinate costs them trust in the
// whole column.
function normalizeSelection(selection) {
  const empty = { kakao_place_id: null, kakao_address: null, kakao_lat: null, kakao_lng: null };
  if (!selection) return empty;
  const id = clean(selection.id);
  const address = clean(selection.address);
  const lat = Number(selection.lat);
  const lng = Number(selection.lng);
  const ok = id && id.length <= SELECTION_LIMITS.kakao_place_id
    && (!address || address.length <= SELECTION_LIMITS.kakao_address)
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  return ok ? { kakao_place_id: id, kakao_address: address, kakao_lat: lat, kakao_lng: lng } : empty;
}
```

and in `buildLead`, change the signature to
`buildLead(form, { place = null, lang = 'en', selection = null } = {})`,
compute `const picked = place ? normalizeSelection(null) : normalizeSelection(selection);`
before building `row`, set
`location_hint: place ? null : (clean(form.locationHint) ?? picked.kakao_address)`,
and spread `...picked` into `row`.

Run `npm test` → all pass. Run `npm run lint` → 1 warning.

- [ ] **Step 4: Live (live phase)**

Ask the user to paste `supabase/leads-autofill.sql` into the Supabase SQL
editor and run it. Then:

```bash
node --env-file=.env.local scripts/leads.mjs verify-rls
```

Expected: `All 9 rules hold.` — the extended grant must not have widened
anything else.

---

### Task 4: The combobox on the submit form

**Files:**
- Create: `src/hooks/usePlaceSuggestions.js`
- Modify: `src/components/SubmitSheet.jsx`
- Modify: `src/i18n/locales/en.js`
- Modify: `src/index.css`
- Modify: `src/data/privacy.js`

**Interfaces:**
- Consumes: `/api/place-search` (Task 2), `buildLead`'s `selection` (Task 3).
- Produces: `usePlaceSuggestions(query, enabled)` →
  `{ results, loading }`; the combobox UI.

- [ ] **Step 1: The hook**

Create `src/hooks/usePlaceSuggestions.js`:

```js
import { useState, useEffect } from 'react';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

// Suggestions are a convenience: every failure path here ends in an empty
// list, never an error the submitter has to deal with. The request is
// debounced and the previous one aborted, so typing fast costs one call.
export function usePlaceSuggestions(query, enabled) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (!enabled || text.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/place-search?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const body = response.ok ? await response.json() : null;
        setResults(Array.isArray(body?.results) ? body.results : []);
      } catch {
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, enabled]);

  return { results, loading };
}
```

- [ ] **Step 2: Strings**

In `src/i18n/locales/en.js`, inside `submit`, add:

```js
    suggestionsLabel: 'Matching places',
    suggestionsHint: 'Start typing and pick your restaurant if you see it — or just type the name.',
    picked: 'Address from Kakao Map: {{address}}. We check it ourselves before anything appears on the map.',
    clearPick: 'Clear',
```

- [ ] **Step 3: The combobox**

In `SubmitSheet.jsx`: import `usePlaceSuggestions`, add
`const [selection, setSelection] = useState(null);`,
`const [listOpen, setListOpen] = useState(false);`,
`const [activeIndex, setActiveIndex] = useState(-1);`, and
`const { results } = usePlaceSuggestions(form.name, !place && !selection);`.

Replace the name `Field` (new-restaurant mode only) with a combobox: the
input gets `role="combobox"`, `aria-expanded={listOpen && results.length > 0}`,
`aria-controls="submit-name-list"`, `aria-autocomplete="list"`,
`aria-activedescendant={activeIndex >= 0 ? \`submit-name-option-${activeIndex}\` : undefined}`;
typing calls `setSelection(null); setListOpen(true); setActiveIndex(-1);`
alongside the existing `set('name')`; `onKeyDown` handles ArrowDown/ArrowUp
(move `activeIndex`, clamped), Enter (choose `results[activeIndex]` when
one is active, and `event.preventDefault()` so the form does not submit),
and Escape (when the list is open: `event.stopPropagation()` — the sheet's
own Escape listener is in the capture phase, so the listbox must stop it —
then close the list).

Under the input, when `listOpen && results.length > 0`:

```jsx
<ul className="submit-suggestions" role="listbox" id="submit-name-list" aria-label={t('submit.suggestionsLabel')}>
  {results.map((result, index) => (
    <li key={result.id}
        id={`submit-name-option-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        className={`submit-suggestion${index === activeIndex ? ' is-active' : ''}`}
        onMouseDown={(event) => { event.preventDefault(); choose(result); }}>
      <span className="submit-suggestion__name">{result.name}</span>
      <span className="submit-suggestion__meta">{result.address}{result.category ? ` · ${result.category}` : ''}</span>
    </li>
  ))}
</ul>
```

with

```jsx
  const choose = (result) => {
    setSelection(result);
    setForm(prev => ({ ...prev, name: result.name, locationHint: prev.locationHint || result.address }));
    setListOpen(false);
    setActiveIndex(-1);
  };
```

When `selection` is set, render under the field:

```jsx
<p className="submit-picked">
  {t('submit.picked', { address: selection.address })}
  <button type="button" className="submit-picked__clear" onClick={() => setSelection(null)}>{t('submit.clearPick')}</button>
</p>
```

Pass the selection through on submit: `buildLead(form, { place, lang: i18n.language, selection })`.
Add `hint={t('submit.suggestionsHint')}` to the name `Field`.

- [ ] **Step 4: Styles — append to `src/index.css`**

```css
/* ── Place suggestions (submit form) ─────────────────────────────────── */
.submit-suggestions {
  list-style: none;
  margin-top: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}
.submit-suggestion {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
}
.submit-suggestion:last-child {
  border-bottom: none;
}
.submit-suggestion.is-active,
.submit-suggestion:hover {
  background: var(--fill);
}
.submit-suggestion__name {
  font-weight: 600;
  color: var(--ink);
}
.submit-suggestion__meta {
  font-size: 13px;
  color: var(--muted);
}
.submit-picked {
  font-size: 13px;
  color: var(--ink-body);
  line-height: 1.5;
}
.submit-picked__clear {
  margin-left: 8px;
  min-height: 44px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--green-strong);
  cursor: pointer;
}
```

Then `git diff -U0 src/index.css | grep -E '^\+' | grep -Eic '#[0-9a-f]{3,8}\b'` → `0`.

- [ ] **Step 5: The policy follows the data (§11 rule 25)**

In `src/data/privacy.js`, in the "When you send a report" / "제보를 보낼 때
받는 정보" sections, state that if the submitter picks a suggestion, the
report also carries the place's address and coordinates **as Kakao Map has
them**, and that Kakao receives the typed text in order to answer the
search. Keep English and Korean parallel — `scripts/tests/privacy.test.mjs`
asserts the section counts match.

- [ ] **Step 6: Offline checks**

`npm test`, `npm run lint` (1 warning), `npm run build`, and the secret
scans from Global Constraints.

---

### Task 5: The reviewer sees the pick

**Files:**
- Modify: `scripts/lib/leads-format.mjs`
- Modify: `scripts/tests/leads-format.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('a lead with a picked place shows it, labelled as the submitter\'s pick', () => {
  const text = formatLead({ ...base, kakao_place_id: '12345', kakao_address: '인천 중구 차이나타운로 43', kakao_lat: 37.4746, kakao_lng: 126.6173 }, byId);
  assert.match(text, /kakao: .*인천 중구 차이나타운로 43/);
  assert.match(text, /37\.4746, 126\.6173/);
  assert.match(text, /submitter's pick, unverified/);
});

test('a lead without a picked place shows no kakao line', () => {
  assert.doesNotMatch(formatLead(base, byId), /kakao:/);
});
```

- [ ] **Step 2: Implement**

In `formatLead`, after the `source:` line:

```js
  if (lead.kakao_place_id) {
    const coords = [lead.kakao_lat, lead.kakao_lng].map(n => (Number.isFinite(n) ? n : '?')).join(', ');
    lines.push(`   kakao:   ${sanitize(lead.kakao_address ?? '')} (${coords}) — submitter's pick, unverified`);
  }
```

(Use the file's existing `sanitize`/indent helpers — submitted strings, same rule.)

- [ ] **Step 3: Run** — `npm test` all pass; `npm run lint` 1 warning.

---

### Task 6: Live phase, gates, documentation, one commit

- [ ] **Step 1: Live checks** — Task 2 Step 4 (the route against Kakao),
  Task 3 Step 4 (`verify-rls` after the migration), then a real submission
  from the dev server with a picked place; `scripts/leads.mjs list` shows
  the `kakao:` line; resolve the QA lead with a note.

- [ ] **Step 2: Browser QA (§11 rule 16)** — suggestions appear while
  typing a Korean restaurant name; ArrowDown/ArrowUp/Enter select;
  clicking selects; the picked note appears with a working Clear; typing
  again clears the selection; Escape closes the list and **not** the
  sheet, and a second Escape closes the sheet; submitting without picking
  still works; correction mode shows no suggestions; 375 px width; no
  console errors.

- [ ] **Step 3: All gates** — the seven from Global Constraints, plus the
  literal-key scan:

```bash
node --env-file=.env.local -e "const fs=require('fs'),p=require('path');const k=process.env.KAKAO_REST_API_KEY;let n=0;(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else if(fs.readFileSync(f).includes(k))n++}})('dist');console.log('kakao key occurrences in dist:',n)"
```

Expected `0`.

- [ ] **Step 4: Documentation** — `HANDOFF.md`: §2.1 gains an "Autofill"
  paragraph (the function, why server code exists now and how narrowly,
  the dev shim and why, the four columns, the combobox, and the rule that
  Kakao's answer is the submitter's pick, never our fact); §11 rule 24
  extended to `KAKAO_REST_API_KEY`; the quick-start block gains the new
  gate; §7 #30's autofill bullet marked done with the date; header date
  and base commit re-measured. `docs/GROWTH-PLAN.md`: Stage 4 autofill ✅
  with one line, gate list updated, test count re-measured.

- [ ] **Step 5: Report and ask for approval — do not commit yet.**
  Report gate output, live results, the browser evidence, `git status`,
  `git diff --stat`, and the proposed message. Wait for an explicit yes.

- [ ] **Step 6: Commit and push after approval**, then confirm the
  deployment reads `success` and check `/submit` on the deployed site:
  suggestions must work there too (Vercel needs `KAKAO_REST_API_KEY` in
  its environment — **ask the user to add it before this step**, as a
  Config-type variable, and note that unlike the two `VITE_` ones this one
  must never be exposed to the browser).
