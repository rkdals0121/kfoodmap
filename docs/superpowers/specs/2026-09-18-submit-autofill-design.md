# Submit autofill design — GROWTH-PLAN Stage 4, second feature

**Date:** 2026-09-18 · **Decides:** how a submitted restaurant gets an
address without the submitter typing one, and how this project's first
server function is shaped · **Base commit:** `b92e00f`

## Why

The UGC intake spec (2026-09-17) deferred autofill deliberately: "address
and coordinates are settled at verification time … autofill at submit time
is convenience, not trust, and it would require server code holding API
keys." That deferral named its own revisit trigger — this is it, and the
approach it named (B, a serverless function gatekeeper) is what ships here.

What autofill buys is not trust, it is **specificity**. Today a submitter
types "near Itaewon station" and a reviewer starts from a name and a
neighbourhood. With autofill the lead carries a Kakao place id, the address
Kakao has, and coordinates — so the reviewer starts from a candidate to
confirm or reject rather than a search to run. The eatpass study found the
same: their form's autofill is the reason their submissions are actionable.

The trust model is unchanged and must stay unchanged: **a lead is never a
fact.** Kakao's answer is what the submitter picked, not what we assert.
Nothing from it reaches `restaurants.js` except through the §2.11
verification, which still cross-checks Naver *and* Kakao by hand.

## Decisions taken (user, 2026-09-18)

1. **Kakao, not Naver.** Naver closed new Search API registrations on
   2026-07-31 (search moved to NAVER API HUB on Naver Cloud Platform);
   Kakao needs only a Kakao account and gives a free quota to the first
   activated app. Naver may be added later as a second opinion — the
   reviewer-side cross-check, not the submitter-side one.
2. **Autofill is optional.** A submitter who ignores the suggestions and
   types freely must be able to submit exactly as today.

## Scope

**In scope:** one serverless function proxying Kakao keyword place search;
a suggestion list on the submit form's name field; four new optional
columns on `leads`; the reviewer's view of them; the secret handling and
its gate; a dev-server shim so the function is testable without `vercel
dev` (the Vercel CLI cannot log in on this machine — §7 #29).

**Out of scope, recorded:** Naver as a second source; reverse geocoding;
map-pin picking; using Kakao's answer for anything outside the lead row;
any automatic promotion of a lead into `restaurants.js`; caching Kakao
results in our database; autofill for the *correction* mode (the
restaurant is already ours there).

## Architecture

### The function — `api/place-search.js`

Vercel's Node runtime, the repository's **first server code**. §2.1's
"no server code in this repository" half of the backend amendment is
narrowed here: one function, whose only job is to hold a key.

- `GET /api/place-search?q=<text>`
- A non-`GET` method → `405 { code: 'method' }`, checked first, before the
  key check or any other work, so a wrong method can never burn quota —
  including against an unconfigured build, which for every other method
  would otherwise answer `503`.
- Validates: `q` trimmed, 2–50 characters, else `400` with a code. No
  other parameter is read.
- Calls `https://dapi.kakao.com/v2/local/search/keyword.json?query=<q>&size=5`
  with `Authorization: KakaoAK ${KAKAO_REST_API_KEY}`. Confirmed against
  Kakao's current docs (method, host, header format, `size` 1–15).
- Maps each document to exactly the fields we use — `id`, `name`,
  `address` (`road_address_name || address_name`), `lat` (`y`), `lng`
  (`x`), `category` (`category_name`) — and returns
  `{ results: [...] }`. Nothing else from Kakao's payload is passed on:
  `phone` and `place_url` are not ours to collect on a submitter's behalf.
- `KAKAO_REST_API_KEY` absent → `503 { code: 'unconfigured' }`. Kakao
  error → `502 { code: 'upstream' }`, with Kakao's status logged, never
  its body echoed.
- `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` — Vercel's
  CDN then answers repeat queries for the *same URL* without touching
  Kakao. This protects normal traffic (the same person retyping a name, or
  two people searching the same restaurant) but is not a quota guarantee:
  Vercel keys the edge cache on the full request URL and the handler reads
  only `q`, so `?q=X&n=1`, `?q=X&n=2`, … are each a cache miss that still
  reaches Kakao with the identical query. The cache key is Vercel's, not
  ours, so this is named as a known gap rather than closed by normalizing
  or rejecting unknown query parameters.
- Best-effort per-instance rate limit (a small in-memory bucket keyed by
  `x-vercel-forwarded-for` / `x-real-ip`, falling back to `x-forwarded-for`
  only when neither is present — the first two are set by Vercel's own
  edge and can't be forged by the client, unlike `x-forwarded-for`, whose
  first element is whatever the client sent). Recorded as best-effort
  because serverless instances are not shared: the CDN cache and the
  length cap are the real limits. If abuse ever shows up, the answer is a
  bot challenge, not a bigger in-memory counter.

The pure parts — query validation and Kakao→our-shape mapping — live in
`api/_lib/kakao.mjs` so they are unit-testable without a server; the
handler is the thin I/O wrapper around them.

### Local development

`vite dev` does not serve `api/`, and `vercel dev` is unavailable here
(the CLI crashes logging in from a machine whose hostname contains
Hangul). `vite.config.js` gains a **dev-only plugin** that mounts the same
handler at the same path via `configureServer`, reading the key from the
environment. It is `apply: 'serve'`, so it cannot affect a production
build — and it keeps browser QA of this feature possible at all.

### Client — the name field becomes a combobox

Only in new-restaurant mode. Typing ≥2 characters starts a 300 ms
debounced fetch (the previous request is aborted); up to 5 suggestions
render in a listbox under the field, each showing name, address and
category. Picking one fills the name and the location hint and records the
selection; typing again after picking clears the selection, because the
text no longer describes what was picked. Escape closes the list and not
the sheet while the list is open — not by having the listbox stop the
event (a child's `stopPropagation` can never preempt a listener the sheet
already has on `window` in the capture phase, which always runs first);
instead the sheet's own Escape handler is list-aware, reading a ref
mirroring whether the listbox is actually rendered
(`listOpen && results.length > 0`, the same condition it renders under) to
decide which one to close. Arrow keys and
Enter move and choose; the pattern follows WAI-ARIA's combobox roles
(`aria-expanded`, `aria-activedescendant`, `role="listbox"/"option"`).

Any error, or an unconfigured build, is **silent**: no suggestions, the
field behaves exactly as it does today. The form must never block on
Kakao, because the form's job is to accept what a person saw.

A one-line note under a chosen suggestion states what it is: the address
comes from Kakao, and we verify it ourselves before anything appears on
the map.

### Data — four optional columns

`supabase/leads-autofill.sql` (additive, safe to re-run, same style as
`leads.sql`):

| column | type | notes |
|---|---|---|
| `kakao_place_id` | `text`, ≤ 40 | the id the submitter picked |
| `kakao_address` | `text`, ≤ 200 | address as Kakao returned it |
| `kakao_lat` | `double precision` | −90 … 90 |
| `kakao_lng` | `double precision` | −180 … 180 |

All nullable; every existing lead stays valid. The anon column grant is
extended to exactly these four. The RLS policy is untouched, and
`verify-rls` must still pass all 9 rules afterwards — including the forged
-insert checks, which is why the grant list is extended rather than
replaced.

`buildLead` gains an optional `selection`: present → the four fields are
copied from it and the location hint is Kakao's address; absent → all four
are `null`, exactly today's row. A selection is only accepted in
new-restaurant mode.

### Reviewer's view

`formatLead` prints a `kakao:` line for a lead that carries one — name,
address, coordinates — labelled as **the submitter's pick, unverified**.
It never merges with the `current:` line, which is our own record. The
sanitizer applies to it like every other submitted string.

## Verification plan

1. `api/_lib/kakao.mjs` unit tests: query too short/long/blank → the
   documented error; a recorded Kakao payload → our six fields, with
   `road_address_name` preferred and a fallback to `address_name`; a
   malformed payload → empty results, never a throw.
2. `buildLead` tests: with and without a selection; a selection in
   correction mode is ignored; out-of-range coordinates rejected.
3. Live, against Kakao with the real key: a Korean restaurant name
   returns plausible rows; a nonsense string returns zero; a missing key
   returns `503`.
4. Live, against Supabase: submit with a selection, `list` shows the
   `kakao:` line, `verify-rls` still reports all 9 rules.
5. Browser: suggestions appear, keyboard navigation works, picking fills
   the field, typing again clears the selection, Escape closes the list
   but not the sheet, submitting without picking still works, and the
   correction mode is unchanged. Mobile width included.
6. Gates: the five existing, plus `npm test`, plus the secret scans —
   `grep -rliE "service_role|sb_secret_|KakaoAK" dist/` = 0 and the
   literal key value absent from `dist/`.

## Risks / things deliberately not solved

- **Kakao's data is not our data.** A submitter can pick the wrong branch
  of a chain, or a stale listing. That is what the reviewer is for; the
  `kakao:` line is labelled so it can never be mistaken for a confirmed
  address.
- **Free quota.** One account, one activated app. The CDN cache plus the
  2-character minimum keeps normal use far under it; if the quota is ever
  exhausted, autofill degrades to silence and the form still works.
- **First server code.** It adds a deploy-time surface this project did
  not have. It stays one file, with no database access and no secrets
  beyond the Kakao key.
