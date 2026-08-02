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

**Correction after checking `vite-plugin-pwa`'s and `workbox-build`'s actual
type definitions (not assumed from memory — downloaded and read both
packages' `.d.ts` files):** the 18 `dist/place/<id>/index.html` prerendered
pages do **not** need to be excluded from precaching. Workbox's default
`globPatterns` (`["**/*.{js,wasm,css,html}"]`, confirmed in
`workbox-build`'s `GenerateSWOptions` type) already matches every `.html`
file under `dist/`, recursively — so all 18 prerendered pages get precached
automatically alongside the main shell, at negligible size cost (each is a
near-copy of `index.html` with different `<head>` tags, a few KB). This is
strictly simpler than the originally-drafted design (which planned to
exclude them via `navigateFallbackDenylist` and lean entirely on fallback):
a direct navigation to an already-precached `/place/<id>` gets an *exact*
cache hit — no fallback logic even runs.

`navigateFallback` (a real `workbox-build` option, confirmed in its
`GenerateSWOptions` type — set under the plugin's `workbox: {...}` key, not
at the top level) stays configured as a safety net for paths that
*aren't* in the precache manifest at all: a restaurant added after the
service worker last updated, a typo'd id, anything not foreseeable at
build time. For those, Workbox falls back to the cached `index.html`
shell, and since `react-router` and all 20 restaurants' data are already
inside that shell's JS bundle, the app boots, reads the URL, and renders
whatever it can (a known restaurant, or the existing bad-id redirect to
home) — no second network round-trip either way.

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
- **Resolved during design, not deferred:** `vite-plugin-pwa@1.3.0`'s and
  `workbox-build@7.4.1`'s actual `.d.ts` files were downloaded (`npm pack`)
  and read directly rather than assumed from memory — same discipline used
  for `react-router`'s import path earlier this session. Confirmed:
  `VitePWA(options): Plugin[]` is the named export; `registerType`,
  `manifest`, `includeAssets` are top-level `VitePWAOptions`; `workbox:
  Partial<GenerateSWOptions>` (from the `workbox-build` package) is where
  `navigateFallback`/`navigateFallbackAllowlist`/`navigateFallbackDenylist`/
  `globPatterns` actually live — a `DevOptions.navigateFallback` field also
  exists but is unrelated (development-only, different strategy). The
  original draft's plan to exclude prerendered pages via
  `navigateFallbackDenylist` turned out to be unnecessary complexity once
  the default `globPatterns` behavior was confirmed — see Architecture.
