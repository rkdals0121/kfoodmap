# Passport sync across devices — design

**Date:** 2026-09-19 · **Decides:** how a saved/visited record follows a
person from one device to another, and what that costs in collected data
· **Base commit:** `513149a`

## Why

The passport (saved places and visit stamps) lives in
`localStorage['kfm-bookmarks']` on exactly one browser. A traveller who
plans on a laptop and eats with a phone has two passports, and clearing
site data destroys both. GROWTH-PLAN Stage 4 named cross-device sync as
its last large item.

This is the first feature that puts a *person's* record on a server. The
project's standing bias is to collect nothing; everything below is built
to keep that bias intact where it can, and to state plainly where it
cannot.

## Decisions taken with the operator (2026-09-19)

1. **Sign-in is Google OAuth.** Supabase Auth's email provider is the
   only one enabled today (measured: `/auth/v1/settings` reports
   `external.email: true`, no external providers). Google therefore
   needs operator setup in Google Cloud + Supabase before live sign-in
   works; code and tests do not wait for it.
2. **First sign-in merges, it does not overwrite.** A record the person
   made by hand never disappears silently.
3. **Signing out clears this device** and leaves the account untouched.
   The app is used on hostel and borrowed phones; not leaving a visit
   history behind is the safer default.
4. **Sign-in stays optional forever.** Logged out, the app behaves
   exactly as it does today.

## Architecture

### One row per place, not one blob per person

```sql
create table public.passports (
  user_id    uuid        not null references auth.users on delete cascade,
  place_id   text        not null,
  saved_at   timestamptz,          -- null = not saved (tombstone)
  visited_at timestamptz,
  updated_at timestamptz not null, -- the merge decides on this
  primary key (user_id, place_id)
);
```

A single JSON blob per person loses writes: save A on the phone, save B
on the laptop, and whichever syncs second overwrites the other's whole
document. Per-place rows make that case a non-event.

`saved_at is null` is a **tombstone**, and it is the reason the table
cannot be a set of saved places. Union merge without tombstones
resurrects deletions: unsave a place on the phone, and the laptop's copy
re-adds it on the next sync. The row survives the delete so the delete
can win.

### The merge is one pure function, used in three places

`mergePassport(local, remote) -> entries` in `src/data/passport.js`:

- group by `place_id`; take the side with the greater `updated_at`
- **tie goes to the saved side** — a tie must not destroy a record
- carry `visited_at` from the winning side only (a visit belongs to the
  save it was recorded against)
- re-assert the invariant `visitedAt != null implies savedAt != null`
  on the result, dropping a visit that would otherwise float free
- legacy local entries have no `updated_at`; they migrate as
  `savedAt ?? 0`, i.e. "time unknown", so a real server timestamp always
  wins over a record whose age we cannot establish

The same function runs at first sign-in, at app start while signed in,
and on reconnect. There is no first-login special case to get wrong.

### localStorage stays the local source of truth

Writes go to `localStorage` first and the server upsert follows and may
fail. A failed upsert never blocks the UI and never rolls back the local
write — this is a PWA used where the network is not guaranteed. On
reconnect (`useOnlineStatus`, already present) the client pushes entries
whose `updated_at` is newer than the last confirmed sync, then merges
again.

Signed out, no network call is made at all.

### Access control

RLS on `passports` with `auth.uid() = user_id` on select, insert, update
and delete; the anon role gets nothing without a user JWT. Proven the
way `leads` was proven — `scripts/passport.mjs verify-rls` runs
adversarial attempts (read another user's rows, insert under another
user_id, update a row's user_id to steal it, delete another user's row)
and fails loudly if any succeeds.

### Sign-out and deletion

- **Sign out:** end the session, remove `kfm-bookmarks`, reset passport
  state in memory. Account rows are untouched.
- **"Delete my records":** a Profile action that deletes this user's
  `passports` rows (RLS permits it) and clears the device.
- **Account deletion** (the Google email held by Supabase Auth) needs
  the service key, so it is an operator action:
  `scripts/passport.mjs delete-user <email>`. The privacy page states
  this and gives `PRIVACY_CONTACT`.

## Privacy policy changes (§11 rule 25, same commit)

Two current statements stop being true for signed-in users and must be
rewritten rather than left standing:

- "Your saved and visited places stay on your own device."
- the "In short" claim that no personal information is received unless a
  report is sent

The policy gains: what Supabase Auth stores when you sign in with Google
(email address, account id), what `passports` stores (place ids and
timestamps — no names, no coordinates, no photos), that signing in is
optional and the app is fully usable without it, that signing out clears
the device, and how to have the account deleted.
`PRIVACY_EFFECTIVE_DATE` is bumped.

## Dependency

`@supabase/auth-js` only — GoTrueClient handles the OAuth PKCE exchange,
session storage and token refresh. Hand-rolling refresh is the kind of
code that fails silently a week later. The data path keeps using plain
`fetch` against PostgREST, as `src/data/leads.js` already does, so
postgrest-js, realtime-js and storage-js stay out of the bundle. The
actual bundle delta is measured with `npm run build` during
implementation and reported; it is not asserted here.

## Verification

- `node:test` on `mergePassport`: deletion does not resurrect; tie
  favours the saved side; the visit invariant holds on every merged
  result; legacy entries migrate; a place present on one side only
  survives.
- `scripts/passport.mjs verify-rls`: every adversarial rule denied, and
  the script must fail when pointed at an over-privileged key (the same
  self-check `leads.mjs verify-rls` uses — a test that cannot fail
  proves nothing).
- Browser, two windows: save in A, reload B, it appears; unsave in A,
  reload B, it is gone and stays gone; go offline in A, save, come back
  online, B sees it.
- Signed out, the network panel shows no request to Supabase from the
  passport path.
- All existing gates, unchanged.

## Risks

- **Google OAuth setup is operator work.** Until it is done, sign-in
  fails on the live site. Mitigation: the client does not hold a Google
  client id (Supabase performs the OAuth exchange), so readiness is
  detected rather than assumed — the sign-in entry point renders only
  when Supabase is configured **and** `/auth/v1/settings` reports
  `external.google: true`, which is exactly what the operator's setup
  flips. A half-configured deploy shows today's app, not a broken
  button.
- **Clock skew.** `updated_at` comes from the device for local writes.
  A badly-set device clock can win a merge it should lose. Accepted: the
  blast radius is one person's own bookmark, and the alternative
  (server-assigned times only) breaks offline writes, which matters
  more.
- **Scope.** This adds auth to an app that has none. Everything outside
  the passport — submissions, filters, data — stays anonymous and
  unchanged.
