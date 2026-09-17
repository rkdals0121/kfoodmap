# UGC intake design — GROWTH-PLAN Stage 4, first feature

**Date:** 2026-09-17 · **Decides:** how user submissions enter the
verification pipeline, and what the project's first backend is
· **Base commit:** `8bb0730`

## Why

GROWTH-PLAN Stage 4 opened on 2026-09-17 when the user took decision **D**:
amend §2.1's "no backend" to a *minimal managed backend*, restaurant data
staying static in the bundle. Of the three backend-gated features (UGC
intake, Cross-Device Sync, AI Food Guide), UGC intake goes first because it
needs no authentication, so it exercises the smallest possible slice of
the new backend, and because the eatpass.kr study (GROWTH-PLAN §3) found
the submit form to be that product's most effective growth device.

The trust model does not change. HANDOFF §2.11 already reasoned that
"unmoderated crowd halal claims would be worse than no data." A submission
here is a **lead**, never a fact: nothing a user submits reaches
`restaurants.js` except by a person running the Phase 3 verification
workflow and editing the data by hand.

## Decisions taken during brainstorming (user, 2026-09-17)

1. **Both kinds:** suggest a new restaurant, and report a correction to an
   existing one.
2. **No login.** Anyone can submit; contact email is optional.
3. **No Naver/Kakao autofill in the MVP.** Address and coordinates are
   settled at verification time, where the project already uses those
   APIs; autofill at submit time is convenience, not trust, and it would
   require server code holding API keys. Deferred to the next step.
4. **Review happens in the repository:** a Node script reads the queue and
   records resolutions; the Supabase dashboard is the fallback view. No
   in-app admin screen.
5. **Approach A** below over a Vercel function gate (B) or GitHub Issues
   as a queue (C).

## Scope

**In scope:** one Supabase table with row-level security; a `/submit`
route with one form in two modes; two entry points (Profile tab, detail
page); a review script; the table's SQL (schema + policy) committed under
`supabase/`; the environment/secret handling and one new gate;
prerendering `/submit` so a direct load is not a 404.

**Out of scope, recorded not forgotten:** autofill (next step, and the
point at which a server function — approach B — becomes justified);
authentication (Cross-Device Sync's job); an in-app admin screen;
server-side rate limiting or a bot challenge such as Turnstile (add when
spam is observed, not before — see Risks); photo attachments; notifying a
submitter of the outcome; any automatic path from a lead into the data.

## Approaches considered

- **A. The static app writes one row to Supabase directly** over its REST
  endpoint with the public anon key; RLS restricts that key to `INSERT`.
  Zero server code, zero new client dependency. **Chosen.**
- **B. A Vercel serverless function as gatekeeper** — validation and rate
  limiting, then insert with the service key. More control, but it puts
  server code in the repository and serverless rate limiting needs a KV
  store to be real. Right for the autofill step; premature now.
- **C. GitHub Issues as the queue** via a serverless function — closest to
  "the repository is the only truth," but needs a function and a token,
  and Sync will need a database anyway, so it would be built twice.

## Architecture

### Data: the `leads` table

| column | type | notes |
|---|---|---|
| `id` | `uuid`, default `gen_random_uuid()` | |
| `created_at` | `timestamptz`, default `now()` | |
| `kind` | `text`, CHECK in (`new`, `correction`) | |
| `place_id` | `text`, nullable | our restaurant id for corrections. **Not validated by the database** — the review script checks it against `restaurants.js`, keeping the id set in the repository |
| `name` | `text`, CHECK length ≤ 120 | new: what the user typed; correction: filled by the app from the restaurant record |
| `location_hint` | `text`, nullable, ≤ 200 | "near Itaewon station" — deliberately not an address or coordinates |
| `topic` | `text`, CHECK in (`vegan`, `halal`, `hours`, `closed`, `address`, `other`) | what the submission is about |
| `message` | `text`, CHECK length ≤ 2000 | what the user saw, in their own words |
| `source_url` | `text`, nullable, ≤ 500 | operator site, SNS, a listing |
| `contact_email` | `text`, nullable, ≤ 200 | optional |
| `lang` | `text` | the UI language at submit time (`en` today) |
| `status` | `text`, CHECK in (`open`, `accepted`, `rejected`, `deferred`), default `open` | changed only by the review script |
| `resolution_note` | `text`, nullable | required by the script on every resolution — the Phase 3 rule that a deferral carries its rationale |
| `resolved_at` | `timestamptz`, nullable | |

**Row-level security.** RLS enabled. One policy for the `anon` role:
`INSERT` with `WITH CHECK (status = 'open' AND resolution_note IS NULL AND
resolved_at IS NULL)`. No `SELECT`, `UPDATE`, or `DELETE` policy for
`anon` — so the public key, which anyone can read out of the bundle,
cannot read other people's submissions (including emails) or alter a
status. The service role key bypasses RLS and lives only in the
reviewer's local `.env.local`.

The CHECK constraints are the server-side validation. The app validates
the same limits before sending, for the error message, not for safety.

### Client

**Route.** `/submit` renders the form inside `AppShell`, the same way
`/place/:id` does. `?place=<id>` selects correction mode; an unknown or
quarantined id falls back to new mode (quarantined places are excluded
from every discovery surface, §2.14 — a correction form would be one).

**Entry points.** Profile tab: a "Suggest a restaurant" settings row →
`/submit`. Detail page: a "Report incorrect info" link at the end of the
practical section → `/submit?place=<id>`.

**Fields.** New mode: name, location hint. Both modes: topic (select),
message, source URL (optional), email (optional). Correction mode shows
the restaurant's name as a heading, not an input. One hidden honeypot
input; if it has a value the app does not send at all.

**Submission.** A single `fetch` `POST` to
`${VITE_SUPABASE_URL}/rest/v1/leads` with `apikey` and `Authorization:
Bearer` headers carrying the anon key, `Prefer: return=minimal`. No
`@supabase/supabase-js` — one insert does not justify a dependency, and
the bundle stays where it is.

**Configuration.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, set
in Vercel's project environment and in a gitignored `.env.local` locally
(`*.local` is already in `.gitignore`). A committed `.env.example` lists
the names with no values. The anon key is a public key by Supabase's
design; the RLS policy above is what makes that safe.

**States.** Success: "Thanks — we verify every submission before anything
appears on the map." (the promise, stated where it is made). Failure: the
form stays filled, with a retry message. Offline (`useOnlineStatus`): the
submit button is disabled with a one-line explanation. **Unconfigured
build** (either variable absent, e.g. a fork or a preview without env):
the route renders "Submissions aren't enabled in this build" instead of
a form that would fail on send — never a silent failure.

**Strings.** Every new user-facing string goes through `t()` from the
start (`src/i18n/locales/en.json`); this feature adds no hardcoded
English, so it does not grow the §7 #27 extraction backlog.

**Prerender.** `scripts/prerender-places.mjs` additionally writes
`dist/submit/index.html` — a copy of the built shell with generic meta —
so a direct load or reload of `/submit` is a real file, consistent with
how `/place/:id` works. Still no rewrite rule in `vercel.json`.

### Review script: `scripts/leads.mjs`

Run as `node --env-file=.env.local scripts/leads.mjs <command>`; Node 24's
built-in `fetch` and `--env-file` mean no new dependency. Reads
`VITE_SUPABASE_URL` (the same variable the app uses — one URL, one file)
and `SUPABASE_SERVICE_ROLE_KEY` from the environment.

- `list` — fetches `status = open`, oldest first, and prints each lead in
  the Phase 3 verification layout. For a correction it prints the
  restaurant's *current* value for the topic beside the claim (e.g. the
  `dietary.halal` record for a `halal` topic) and warns when `place_id`
  matches no restaurant in `restaurants.js`.
- `resolve <id> <accepted|rejected|deferred> --note "<why>"` — sets
  status, note, `resolved_at`. Refuses to run without `--note`: a
  resolution without a reason is the thing Phase 3 forbids.

`accepted` means "worth running verification on," not "published." The
verification itself is the existing §2.11 process, by hand.

### Secrets and gates

- `src/` never imports or names the service role key. New gate, same
  shape as the `retrievedBy` leak check: `grep -rc SERVICE_ROLE dist/`
  must be 0. Added to the HANDOFF quick-start list and §11.
- `.env.local` is gitignored; `.env.example` is committed.
- HANDOFF §2.1's "no backend" paragraph is amended, not deleted: what
  still holds (data verified and shipped static; no server code in the
  repository) and what changed (one managed table the app writes to).

## Verification plan

1. **Prove the RLS the way evidence rules are proven** — each check fired
   for real against the live table with the anon key: `SELECT` → refused
   or empty; `UPDATE` on an existing row → refused; `INSERT` with
   `status = 'accepted'` → refused; a well-formed `INSERT` → 201.
2. **Browser QA (§11 rule 16):** submit in new mode and in correction
   mode, confirm both rows in the Supabase table with the expected
   `kind`/`place_id`; honeypot filled → nothing sent (network tab); offline
   → button disabled; unconfigured build → the disabled message, no form;
   375 px and 1280 px widths.
3. Direct load and reload of `/submit` and `/submit?place=eid` on the
   deployed site → 200, form renders.
4. `scripts/leads.mjs list` shows the QA rows; `resolve` one with a note,
   confirm the row changed, confirm `resolve` without `--note` refuses.
5. The five gates plus the new `SERVICE_ROLE` gate; the deployment for
   the commit reads `success` (§11 rule 23).

## Setup the user must do (not code)

A **new** Supabase project for K-Food Map, on the personal account — not
a table inside the Eatple project, so the account/team boundary that was
untangled on 2026-08-02 and again today is not re-crossed. From it: the
project URL, the anon key, the service role key, into `.env.local`; URL
and anon key also into the Vercel project's environment variables. The
table and policy are created by a SQL file committed in this feature
(`supabase/leads.sql`) and pasted into the SQL editor once, so the schema
is in the repository too.

## Risks / things intentionally not solved here

- **Spam.** No server-side rate limit. The honeypot stops naive bots;
  anything that posts to the REST endpoint directly can add junk rows.
  The damage is bounded to reviewer time, because nothing is published
  without a person — the same reason the project can accept unverified
  leads at all. If junk appears, the fix is a bot challenge in front of
  the insert, or approach B; both are additive.
- **The anon key is visible.** By design. What it can do is exactly the
  `INSERT` policy; the RLS proof in the verification plan is what makes
  this claim checkable rather than assumed.
- **Email is personal data.** Optional, never readable through the public
  key, and only used to ask a follow-up question. The form says so next
  to the field.
- **`place_id` can be stale** if a restaurant is ever renamed or removed;
  the script's warning handles it, the database does not try to.
