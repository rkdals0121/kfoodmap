# Offline MVP design — GROWTH-PLAN Stage 2, item 4

**Date:** 2026-08-03 · **Decides:** how the last remaining Stage 2 item ships
· **Base commit:** `4f882c1`

## Why

GROWTH-PLAN Stage 2 item 4: "정적 데이터의 오프라인 이용 (기획 동결됨. 지도
타일은 범위 밖)" — offline use of the static data; map tiles explicitly out
of scope. HANDOFF §10 item 6 adds one caution: "caching unstable content
offline is worse than not caching, so it waits for content to settle rather
than leading" — this is why it's last in Stage 2, after the data-shape work
(routing, prerendering) had already settled.

## Scope

**"Offline" means:** after at least one online visit (required to receive
the app's code at all), the app works from a fully offline cold start —
closed tab, airplane mode, reopened — not just resilience to a mid-session
connectivity drop. This is the realistic target user: a foreign visitor who
may not have a Korean SIM/data plan.

**In scope:** service-worker precaching of the app shell and all bundled
static data (all 20 restaurants' data is already inside the JS bundle, not
fetched separately) and illustration assets; offline-capable deep links to
`/place/:id` including ones never visited in the current session; a small
"you're offline" banner over the map region; PWA installability
(manifest.json + icons).

**Out of scope:** Leaflet map tiles (network resource, left uncached, per
the frozen plan); a "new version available" update-prompt UI (autoUpdate is
the simpler, safer default per the "unstable content" caution); anything
about the `dist/place/**` crawler-prerendered pages beyond confirming they
don't conflict with this feature (they don't — see Architecture).

## Architecture

Add `vite-plugin-pwa` (Workbox-based; `1.3.0` supports Vite `^8.0.0`,
matching this project's `vite ^8.1.1` — confirmed via `npm view
vite-plugin-pwa peerDependencies`, not assumed) as a dev dependency,
registered in `vite.config.js`. At build time it generates a service worker
that precaches the built JS/CSS/image assets (the whole static payload —
restaurant data is bundled in the JS, not a separate fetch, so precaching
the bundle *is* precaching the data) and a `manifest.json`.

**`registerType: 'autoUpdate'`** — the service worker updates in the
background and takes effect on the next navigation, no user-facing "update
available" prompt. Matches the "waits for content to settle" caution: this
is the conservative default, not a leading-edge freshness guarantee.

**The 18 `dist/place/<id>/index.html` prerendered pages (crawler og:meta,
already shipped) are excluded from the precache list** and handled instead
by Workbox's `navigateFallback: '/index.html'`. This is the standard
pattern for offline deep-linking in a client-routed SPA: any browser
navigation request (address bar entry, reload, opening a bookmarked/shared
link — not a client-side route change, which never leaves the loaded page)
that the service worker intercepts and can't serve from the exact-URL cache
falls back to the cached `index.html` shell. Because `react-router` and all
20 restaurants' data are already inside that shell's JS bundle, the app
boots, reads the URL, and renders the correct restaurant — no second
network round-trip, and no dependency on that specific `/place/<id>` path
ever having been visited before in this session.

**No conflict with the crawler-prerendering feature:** link-preview
crawlers (KakaoTalk, Facebook, Twitter) never install a service worker —
each crawler fetch is a fresh, stateless request that always hits the real
prerendered HTML with correct `og:*` tags. The service worker only affects
*returning human visitors* who already installed it on a prior visit, and
for a human browsing the live app, `og:*` meta tags are inert (crawler-only
metadata) — so intercepting their navigation and serving the generic shell
instead of the prerendered variant costs nothing. The two features serve
disjoint audiences and don't need to agree with each other.

**Map tiles stay uncached.** Leaflet's tile requests to the CARTO tile
server are left as plain network requests with no service-worker
involvement — offline, they simply fail and Leaflet shows blank tile space,
which is why the offline banner exists (see below). Markers/pins are SVG
elements positioned from each restaurant's already-bundled coordinates, so
they render correctly regardless of tile load success.

## Offline banner

A small `useOnlineStatus()` hook (browser-standard `navigator.onLine` +
`window` `online`/`offline` event listeners, no new dependency) drives a
one-line banner over the map region when offline: "Offline — map imagery
will return when you're back online." Disappears automatically when the
`online` event fires. Restaurant list, filters, search, and detail pages
are all unaffected (data doesn't need network), so nothing else needs an
offline-specific state.

## Manifest & icons

Reuses the existing `favicon.svg` as the manifest icon (`sizes: "any"`,
`type: "image/svg+xml"`) for Android/Chrome, which read SVG manifest icons
correctly. iOS Safari's "Add to Home Screen" does not reliably honor Web
App Manifest icons, so `index.html` additionally gets an `apple-touch-icon`
link pointing at a 180×180 PNG rasterized from `favicon.svg` once, checked
into `public/` as a static file — not generated at build time, avoiding a
new rasterization dependency for a one-time asset. This is the same
class of format gap as the `og:image` SVG issue found and fixed earlier
this session (§7 #22), handled proactively here instead of shipping a
broken icon and finding out later.

## Verification plan

Per §11 rule 16 (browser verification for UI changes) plus the specific
concern raised and resolved during design review — does a deep link to a
never-visited-this-session `/place/:id` work fully offline:

1. Gates: `check-data`, `lint`, `build`, `retrievedBy` leak check,
   `evidence-hash --check` (unaffected by this change, re-run per the
   one-feature-one-commit discipline).
2. **`vite build && vite preview`, not `npm run dev`** — service workers
   don't register realistically in Vite's dev server; a production-like
   static server is required for this feature to be testable at all.
3. Playwright, headless Chromium: visit online, wait for the service
   worker to reach `activated` state, confirm `navigator.serviceWorker
   .controller` is set. Then `context.setOffline(true)`, hard-reload `/`,
   confirm the shell and restaurant list still render. Then — the scenario
   from design review — `page.goto()` directly to a `/place/:id` that was
   never opened this session, while still offline, and confirm the correct
   restaurant's detail renders with zero console errors.
4. Confirm the offline banner appears over the map region while offline
   and disappears after `context.setOffline(false)` + a reload.
5. Confirm `manifest.json` is served and references the icon; confirm the
   `apple-touch-icon` link tag is present in built `index.html`.

## Risks / things intentionally not solved here

- First-ever visit (before the service worker has installed) still
  requires connectivity — unavoidable for any web app; not a regression
  from any stated goal.
- No "update available" UI (autoUpdate is silent); a user who never
  revisits after a data correction ships could see stale data indefinitely
  until their next natural visit. Accepted per the "unstable content"
  caution — this project doesn't ship data corrections frequently or
  urgently enough to justify the added complexity of a prompt UI.
- Exact `vite-plugin-pwa` config option names (`navigateFallback`,
  `navigateFallbackDenylist`, `includeAssets`, etc.) should be confirmed
  against the installed version's own type definitions/docs at
  implementation time, not assumed from memory — the plan should verify,
  not guess, the same discipline used for `react-router`'s import path
  earlier this session.
