# Stage 1 routing design — shareable restaurant URLs + crawler-visible meta

**Date:** 2026-08-02 · **Decides:** GROWTH-PLAN.md decision C (amend HANDOFF
§2.1's "no router" constraint) · **Base commit:** `2b1e6ac`

## Why

GROWTH-PLAN Stage 1 requires shareable per-restaurant URLs and SEO before any
of the door-widening work (share, search, language) makes sense. Today every
restaurant lives behind client-only React state (`selectedRestaurant` in
`App.jsx`), so there is no URL a user or a link-preview crawler can land on
for a specific place.

## Scope

**In scope:** a real, bookmarkable/shareable URL per restaurant
(`/place/:id`) and for the home/map view (`/`), with build-time static HTML
so that non-JS link-preview crawlers (KakaoTalk, Facebook, Twitter) see the
correct restaurant name/description/image, not a generic homepage card.

**Out of scope (explicitly deferred):** real URLs for the `discover` /
`journal` / `profile` tabs (decided against — journal/profile are
personalized app state, not shareable content; discover is a fixed set of 4
curated cards, not worth its own route yet); URL-encoding filters or search
query; any SSR/framework migration; any change to the Confidence
Model/Evidence Layer/data.

## Architecture

Add React Router (v7, React-19-compatible) in plain declarative mode — no
loaders/actions/framework mode, just `BrowserRouter`/`Routes`/`Route`. The
current React Router v7 docs should be checked at implementation time to
confirm whether the `react-router` or `react-router-dom` package is the
correct import for a plain Vite SPA (the project merged the two around v7;
don't assume from memory — verify against installed version's docs).
`BrowserRouter` wraps `<App />` in `main.jsx`; `App.jsx` gets two `Route`s:
`/` and
`/place/:id`. Both render the same `App` shell (map + sidebar + tabs); the
shell does not fork.

**`selectedRestaurant` stops being `useState` and becomes derived from the
URL.** `useParams().id` looks the restaurant up via
`restaurants.find(r => r.id === id)`. This removes a piece of duplicated
state rather than adding one:

- `openDetail(r)` / `openStory(r)` call `navigate(`/place/${r.id}`)` instead
  of `setSelectedRestaurant(r)`.
- `onClose` calls `navigate('/')` instead of `setSelectedRestaurant(null)`.
- Back/forward become native browser behavior — no custom history handling.

`activeTab`, `selectedFilters`, `searchQuery`, `mapCenter`, and all the
sidebar/sheet UI state stay exactly as they are: plain `useState`, untouched.
`focusStory` (scroll-to-story-anchor) is passed via `navigate(url, { state:
{ focusStory: true } })` — router state, not a URL segment, since it's a
transient in-app affordance, not something worth sharing a link to.

## URL scheme & prerendering

- `/` — home (map view, current default experience, byte-identical to today
  behaviorally).
- `/place/:id` — restaurant detail, `:id` is the existing `id` field from
  `restaurants.js` (e.g. `/place/gonghwachun`).
- **Quarantined places are excluded.** `akiya` and `makan` (2 of 20) are not
  prerendered and have no public route: quarantine already means "excluded
  from every discovery surface" (`App.jsx`'s `activeRestaurants` filter,
  §2.14), and an indexable public URL is a discovery surface. Navigating to
  `/place/akiya` — client-side or via a stale/guessed link — redirects home.

**Prerendering, no headless browser:** after `vite build`, a new script
`scripts/prerender-places.mjs` reads `restaurants.js`, and for each of the 18
active restaurants writes `dist/place/<id>/index.html`: a copy of the built
`dist/index.html` with only `<title>`, `og:title`, `og:description`,
`og:image`, `og:url`, and `<link rel="canonical">` swapped to that
restaurant's data. `og:image` uses the restaurant's existing `image` field
as-is (today an illustration placeholder SVG, per the image contract in
HANDOFF §2.2) — no photo is invented for the preview card. Every `<script>`
tag is untouched, so a human opening the link still gets the full
interactive SPA, which then hydrates and can navigate further client-side.

`package.json`'s `build` script becomes `vite build && node
scripts/prerender-places.mjs`, so the prerendered set can never drift from
`restaurants.js` — adding or quarantining a restaurant regenerates it
automatically on the next build.

**No `vercel.json` rewrite is needed.** Because every valid `/place/:id` is a
real static file at build time, Vercel serves it directly. An id that isn't
in the prerendered set (typo, quarantined, removed) is a genuine 404 at the
CDN level — consistent with "unknown beats guessing": we don't pretend a
non-existent place has a page.

## Error handling

- **Unknown id reaches the client router** (e.g. a stale link to a since-
  removed id, or direct client-side navigation to a bad path that somehow
  bypassed the static 404): `restaurants.find` returns `undefined` →
  redirect to `/`. Nothing is rendered that asserts an unverified place
  exists.
- **Quarantined id**: same redirect-to-home path as unknown id — reuses the
  existing `isQuarantined` guard that `openDetail`/`openStory` already
  apply, so there is exactly one place that decides "is this place visible,"
  not two.

## Verification plan

No automated test suite exists in this repo (HANDOFF §7 #15), so — per §11
rule 16 — this is checked by:

1. Gates: `check-data`, `lint`, `build`, `retrievedBy` leak check,
   `evidence-hash --check` (unaffected by this change, but re-run per the
   one-feature-one-commit discipline).
2. `npm run build` produces `dist/place/<id>/index.html` for all 18 active
   restaurants and none of the 2 quarantined ones.
3. `curl`/`cat` on a generated file confirms `og:title`/`og:description` /
   `og:image` carry the real restaurant's data — this is the actual
   crawler-visibility proof, checkable without a browser or JS execution.
4. Browser check (manual, since Chrome extension automation was unavailable
   this session — re-attempt if available, otherwise ask the user to
   confirm directly): clicking a restaurant updates the URL and back/forward
   work; refreshing `/place/:id` loads straight into that detail view;
   `/place/<quarantined-or-bad-id>` redirects home; the four tabs
   (map/discover/journal/profile) still work exactly as before.

## Risks / things intentionally not solved here

- `og:image` will be a generic per-category illustration, not a real photo,
  for every restaurant — this is a limit of the current data (§2.2's image
  contract, "all null today"), not something this change should paper over
  by inventing imagery.
- `kakaoMapUrl`'s unused `origin` parameter (HANDOFF §7 #14) is unrelated to
  this work and stays as its own deferred item.
