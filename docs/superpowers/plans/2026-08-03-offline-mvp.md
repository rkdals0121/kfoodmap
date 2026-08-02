# Offline MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After one online visit, K-Food Map works from a fully offline
cold start — app shell, all 20 restaurants' data, and deep links to
`/place/:id` (including ones never opened this session) — with an honest
"offline" banner over the map, per
`docs/superpowers/specs/2026-08-03-offline-mvp-design.md`.

**Architecture:** `vite-plugin-pwa` (Workbox `generateSW` strategy)
precaches the built static payload — restaurant data is already inside the
JS bundle, so precaching the bundle *is* precaching the data.
**Update, found during Task 1 implementation:** `npm run build` runs `vite
build` (which finalizes the service-worker precache manifest near the end
of that step) *before* the separate `node scripts/prerender-places.mjs`
step creates the 18 `dist/place/<id>/index.html` crawler pages — so in
practice those pages are never in the precache manifest, regardless of
`globPatterns`. This is fine and requires no build-pipeline change:
`navigateFallback: '/index.html'` was already configured as the mechanism
for exactly this case (any navigation request that isn't an exact cache
hit), and it's sufficient on its own — every offline `/place/:id`
navigation goes through it, verified in Task 4. See the design spec's
"Second correction" note for the full account.

**Tech Stack:** `vite-plugin-pwa@^1.3.0` (confirmed compatible with this
project's `vite@^8.1.1` via its own `peerDependencies`), Workbox
(transitive, via `workbox-build`), Playwright for verification (already
used elsewhere this session, not a new project dependency).

## Global Constraints

- Every commit must pass: `npm run check-data` ("No violations."),
  `npm run lint` (baseline: 1 warning, the documented `kakaoMapUrl`
  `origin` param — unrelated to this work), `npm run build`,
  `grep -rc retrievedBy dist/` (must print `0` everywhere), and
  `node scripts/evidence-hash.mjs --check` (`0 pending, 0 drifted`).
- No data or Confidence-Model/Evidence-Layer changes.
- Map tiles (Leaflet/CARTO) are explicitly **out of scope** — do not add
  any tile-caching logic.
- No "update available" prompt UI — `registerType: 'autoUpdate'` only.
- **Verification for this feature requires `vite build && vite preview`,
  not `npm run dev`** — service workers don't register realistically in
  Vite's dev server. Every task that touches service-worker behavior must
  be checked against a built-and-previewed app, not the dev server.
- **Commit discipline:** the user has not been asked about single-vs-split
  commits for this plan. Default to the same pattern used for the routing
  plan earlier this session — **a single commit at the end** (Task 4),
  since this is one cohesive feature. Tasks 1–3 end with local
  verification, not commits.
- **Browser verification (§11 rule 16):** retry the Chrome extension tool
  before Task 4's commit step; if still unavailable, verify via headless
  Playwright (as used throughout this session) and/or ask the user to
  check directly, per the pattern already established this session.

---

### Task 1: Install and configure vite-plugin-pwa

**Files:**
- Modify: `package.json` (new devDependency)
- Modify: `vite.config.js`

**Interfaces:**
- Produces: a built `dist/` that includes a generated service worker
  (`dist/sw.js`), a web manifest (`dist/manifest.webmanifest`), and an
  auto-injected `<link rel="manifest">` + service-worker registration
  script in `dist/index.html` (the plugin's `transformIndexHtml` hook
  handles both injections — confirmed in its source, no manual `main.jsx`
  or `index.html` change needed for basic registration).

- [ ] **Step 1: Install the dependency**

```bash
npm install -D vite-plugin-pwa@^1.3.0
```

Confirm `package.json`'s `devDependencies` now includes
`"vite-plugin-pwa": "^1.3.0"` (or whatever exact version npm resolved).

- [ ] **Step 2: Configure the plugin**

Edit `vite.config.js` to:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'K-Food Map',
        short_name: 'K-Food Map',
        description: 'A curated map of sustainable Korean dining in Seoul & Incheon.',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
})
```

Note: `apple-touch-icon.png` doesn't exist yet — that's Task 2. Listing it
in `includeAssets` now is fine; the build will just warn or 404 on that
specific asset reference until Task 2 adds the file. If `npm run build` in
Step 3 below errors (rather than warns) because the file is missing,
remove `'apple-touch-icon.png'` from `includeAssets` in this task and add
it back in Task 2 instead — don't leave the build broken.

- [ ] **Step 3: Verify the build produces PWA output**

```bash
npm run build
ls dist/sw.js dist/manifest.webmanifest
grep -c 'rel="manifest"' dist/index.html
```

Expected: both files exist; the grep prints `1` (the manifest link was
injected into the built `index.html`).

- [ ] **Step 4: Confirm `navigateFallback` is present in the built service
  worker (the mechanism `/place/:id` offline support actually depends on)**

```bash
grep -o 'url:"[^"]*place[^"]*"' dist/sw.js | head -5
grep -o 'url:"[^"]*"' dist/sw.js | wc -l
grep -c 'NavigationRoute' dist/sw.js
```

**Expected — and this is the corrected expectation, not the original
draft's:** the first command prints nothing (none of the 18
`dist/place/<id>/index.html` pages are in the precache manifest, because
`prerender-places.mjs` runs after `vite build` already finalized it — see
this plan's Architecture section). The second command's count reflects
only the JS/CSS/main-shell assets, not 18+. The third command checks for
the `NavigationRoute` class name Workbox actually emits in the minified
output (the literal string `navigateFallback` never appears there) and
prints `1` or more — confirming `navigateFallback` made it into the
generated service worker, which is what actually makes offline
`/place/:id` navigation work
(verified end-to-end in Task 4, not here). If the third command prints
`0`, that's a real problem — `workbox: { navigateFallback: '/index.html'
}` from Step 2 didn't take effect and must be investigated before
continuing.

- [ ] **Step 5: Run the full gate suite**

```bash
npm run check-data
npm run lint
npm run build
grep -rc retrievedBy dist/
node scripts/evidence-hash.mjs --check
```

Expected: all pass per the Global Constraints section above. Do NOT
commit — see Global Constraints.

---

### Task 2: Apple touch icon

**Files:**
- Create: `scripts/rasterize-apple-touch-icon.mjs` (one-off script, not
  wired into `npm run build` — run once, the output is checked into git)
- Create: `public/apple-touch-icon.png` (generated by the script above)
- Modify: `index.html`

**Interfaces:**
- Consumes: `public/favicon.svg` (existing file, 48×46 viewBox, transparent
  background, purple/blue abstract mark).
- Produces: `public/apple-touch-icon.png`, a 180×180 PNG with the mark
  centered and aspect-ratio preserved (not stretched to fill the square),
  transparent background.

Why a script and not a manual step: reproducible or throw-away either
way, but writing it as a script means the exact rasterization approach is
recorded, not just "I made a PNG somehow" — and it can be re-run if
`favicon.svg` ever changes.

- [ ] **Step 1: Write the rasterization script**

Create `scripts/rasterize-apple-touch-icon.mjs`:

```js
// One-off: rasterizes public/favicon.svg into a 180x180 PNG for
// index.html's apple-touch-icon link (iOS's "Add to Home Screen" does
// not reliably read Web App Manifest icons the way Android/Chrome does).
// Not part of npm run build -- run manually, commit the output.
//
// Run: node scripts/rasterize-apple-touch-icon.mjs

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
const outPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
const SIZE = 180;

const svg = readFileSync(svgPath, 'utf8');

const html = `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .frame {
    width: ${SIZE}px; height: ${SIZE}px;
    display: flex; align-items: center; justify-content: center;
  }
  .frame svg { max-width: 100%; max-height: 100%; }
</style></head><body><div class="frame">${svg}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(html);
await page.locator('.frame').screenshot({ path: outPath, omitBackground: true });
await browser.close();

console.log(`Wrote ${outPath} (${SIZE}x${SIZE}, transparent background)`);
```

- [ ] **Step 2: Run it**

```bash
node scripts/rasterize-apple-touch-icon.mjs
```

Expected output: `Wrote .../public/apple-touch-icon.png (180x180, transparent background)`

- [ ] **Step 3: Verify the output**

```bash
node -e "const fs=require('fs'); const b=fs.readFileSync('public/apple-touch-icon.png'); console.log('size bytes:', b.length); console.log('PNG signature ok:', b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47);"
```

Expected: a byte count in the low tens of KB (a simple flat-color mark on
transparent background compresses well), and `PNG signature ok: true`.
Also open the file with the Read tool (it renders images) and visually
confirm the mark is centered, not stretched or cropped.

- [ ] **Step 4: Add the `apple-touch-icon` link and finalize `includeAssets`**

In `index.html`, find:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

Add immediately after it:

```html
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

If Task 1 Step 2 had to remove `'apple-touch-icon.png'` from
`includeAssets` because the file didn't exist yet, add it back now in
`vite.config.js`'s `VitePWA({ includeAssets: [...] })` array.

- [ ] **Step 5: Verify**

```bash
npm run build
grep -c 'apple-touch-icon' dist/index.html
ls dist/apple-touch-icon.png
```

Expected: grep prints `1`; the file exists in `dist/`.

*(No commit here — continue to Task 3.)*

---

### Task 3: Offline banner

**Files:**
- Create: `src/hooks/useOnlineStatus.js`
- Modify: `src/App.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `useOnlineStatus(): boolean` — a hook returning the current
  online/offline state, live-updating via the browser's `online`/`offline`
  window events. No parameters, no dependencies on any other module from
  this plan.
- Consumes (in `App.jsx`): nothing new from Tasks 1–2 — this task is
  independent of the service-worker configuration; it works the same way
  whether or not a service worker is installed, since it's driven purely
  by `navigator.onLine`.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useOnlineStatus.js`:

```js
import { useState, useEffect } from 'react';

// Tracks browser connectivity via the standard online/offline window
// events. Used to show an honest "you're offline" note where the app
// depends on network (the map's tiles) -- everything else (restaurant
// data, routing) works offline regardless, since it's all bundled.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 2: Wire it into `App.jsx` and render the banner over the map**

Read the current `src/App.jsx` first to confirm exact line numbers (this
plan was written against the state after the Stage 1/Stage 2 work earlier
this session; lines may have shifted slightly).

Add the import near the top, alongside the other hook-like imports:

```jsx
import { useOnlineStatus } from './hooks/useOnlineStatus';
```

Inside `AppShell`, add the hook call near the other top-level hooks (e.g.
right after the `useParams`/`useNavigate`/`useLocation` block):

```jsx
  const isOnline = useOnlineStatus();
```

Find the map region's JSX:

```jsx
      <div className="map-region">
        <MapComponent
          restaurants={filteredRestaurants}
          onMarkerClick={openDetail}
          selectedId={selectedRestaurant?.id}
          onCenterChange={setMapCenter}
        />
      </div>
```

Add the banner as a sibling inside `.map-region`, rendered conditionally:

```jsx
      <div className="map-region">
        {!isOnline && (
          <div className="offline-banner" role="status">
            Offline — map imagery will return when you're back online.
          </div>
        )}
        <MapComponent
          restaurants={filteredRestaurants}
          onMarkerClick={openDetail}
          selectedId={selectedRestaurant?.id}
          onCenterChange={setMapCenter}
        />
      </div>
```

- [ ] **Step 3: Style the banner**

In `src/index.css`, find `.map-region` (search for `^\.map-region {`) and
add this new rule immediately after that block:

```css
.offline-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 450;
  background: var(--ink-title);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 999px;
  box-shadow: var(--shadow-2);
  white-space: nowrap;
  pointer-events: none;
}
```

**Read `leaflet/dist/leaflet.css` before trusting this value** (it's
imported in `src/main.jsx`) — Leaflet's own panes have their own z-index
scale local to `.leaflet-container` (historically: tile pane 200, overlay
pane 400, shadow pane 500, marker pane 600, tooltip pane 650, popup pane
700), and whether those compete directly against a sibling like
`.offline-banner` depends on whether `.leaflet-container` establishes its
own stacking context (a `position` value plus a `transform`/`z-index`
would do it; plain `position: relative` alone would not). `z-index: 450`
here is a starting guess that clears the tile and overlay panes, chosen
because markers/popups (600/700) are unlikely to visually overlap the
banner's top-center position in practice — but this is exactly the kind
of cross-stacking-context reasoning that turned out wrong once already
this session (the mobile detail-sheet bug, HANDOFF §7 #20). **Step 4
below is not optional-if-it-looks-fine — take an actual screenshot with
the map showing tiles (online) vs. offline (banner + blank tiles) and
visually confirm the banner sits on top, not behind.** If it's hidden,
that's a real finding: report it, don't silently bump the number and move
on without understanding why.

- [ ] **Step 4: Verify with the dev server (this task has no service-worker
  dependency, so `npm run dev` is fine here)**

```bash
npm run dev
```

In a browser: open devtools, Network tab, toggle "Offline" — confirm the
banner appears **visually on top of** the map (not just present in the
DOM — take a screenshot and look at it) within ~1 second (the `offline`
event fires immediately), and the rest of the app (list, search, filters,
restaurant clicks) still works. Toggle back online — confirm the banner
disappears. If headless browser tooling is available, do this via a
screenshot-based check rather than only a DOM query (a DOM query would
not have caught the double-numbering bug found earlier this session
either — visual checks catch what structural queries miss).

Run `npm run lint` — expect no new warnings versus the 1-warning baseline.

*(No commit here — continue to Task 4.)*

---

### Task 4: Full offline verification, docs sync, single commit

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/GROWTH-PLAN.md`

**Interfaces:** none — this task verifies and documents Tasks 1–3, no new
code.

- [ ] **Step 1: Build and preview (not dev server)**

```bash
npm run build
npm run preview -- --port 4174
```

Leave this running in the background for the steps below.

- [ ] **Step 2: Write and run the offline-scenario verification script**

This is the scenario raised and resolved during design review: does a
`/place/:id` never opened this session still work when opened cold,
offline. Create a throwaway script (scratch location, not committed —
e.g. the session's scratchpad directory) with this content:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// 1. Online visit -- let the service worker install and activate.
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 });
console.log('service worker controller present:', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));

// 2. Go offline.
const context = page.context();
await context.setOffline(true);

// 3. Deep-link to a restaurant never opened this session, while offline.
await page.goto('http://localhost:4174/place/sanchon', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
const heading = await page.locator('h1, h2').first().textContent().catch(() => null);
console.log('URL after offline deep-link:', page.url());
console.log('Rendered heading:', heading);

// 4. Confirm the offline banner is present.
const bannerText = await page.locator('.offline-banner').textContent().catch(() => null);
console.log('Offline banner text:', bannerText);

// 5. Back online -- banner should clear (no reload needed, the online
//    event fires and the hook re-renders).
await context.setOffline(false);
await page.waitForTimeout(500);
const bannerGone = (await page.locator('.offline-banner').count()) === 0;
console.log('Banner cleared after going back online:', bannerGone);

await browser.close();
console.log('--- console errors ---');
console.log(consoleErrors.join('\n') || '(none)');
```

Run it (from a directory with `playwright` installed — reuse the pattern
from earlier this session: a scratchpad `npm init -y && npm install
playwright@1.62.1` if not already set up there).

Expected: `service worker controller present: true`; URL after the
offline deep-link is `http://localhost:4174/place/sanchon`; the rendered
heading is Sanchon's name (confirm it's not blank or an error state);
banner text mentions "Offline"; banner cleared after going back online is
`true`; console errors is `(none)`.

If the service worker controller check times out or `sanchon`'s detail
doesn't render, this is a real failure of the feature — do not proceed to
commit. Debug via `page.evaluate(() => navigator.serviceWorker
.getRegistrations())` and the `dist/sw.js` precache manifest from Task 1
Step 4 before assuming the fix is elsewhere.

- [ ] **Step 3: Retry the Chrome extension for a real-browser check**

If `mcp__claude-in-chrome__*` tools are available this time, repeat the
same scenario (online visit, offline toggle via devtools, deep link,
banner) in an actual browser rather than only headless Chromium. If still
unavailable, ask the user to verify directly (same pattern used
throughout this session) before proceeding to commit.

- [ ] **Step 4: Update HANDOFF.md**

- §2.1: add a short paragraph describing the offline architecture
  (mirroring the style of the existing "Routing" paragraph added earlier
  this session) — `vite-plugin-pwa` precaches the app shell + bundled
  data; the 18 crawler-prerendered `/place/<id>` pages are NOT precached
  (build-ordering: `prerender-places.mjs` runs after `vite build`
  finalizes the manifest) so offline `/place/:id` navigation goes through
  `navigateFallback` to the shell instead; map tiles uncached; offline
  banner.
- §3 Directory Structure: add `src/hooks/useOnlineStatus.js` and
  `scripts/rasterize-apple-touch-icon.mjs` to the tree, and
  `public/apple-touch-icon.png` if the `public/` listing enumerates files.
- §7: mark GROWTH-PLAN Stage 2 item 4 resolved, referencing this plan and
  spec.
- §12 "Next Recommended Task": mark Offline MVP done — this closes out
  Stage 2 entirely — and note Stage 3 (Multilingual) is next per
  GROWTH-PLAN, not yet started.
- Header: update **Base commit** to this commit's parent and the "this
  edit lands together with" note, following the exact pattern used in
  every prior commit this session (read the current header for the
  established format).

- [ ] **Step 5: Update `docs/GROWTH-PLAN.md`**

- §4 Stage 2 item 4: mark ✅ complete, matching the style of items 1, 2,
  3, 5 (already marked complete earlier this session).
- Note in the Stage 2 heading or a closing line that all 5 Stage 2 items
  are now done, and Stage 3 is next.

- [ ] **Step 6: Run the full gate suite one more time**

```bash
npm run check-data
npm run lint
npm run build
grep -rc retrievedBy dist/
node scripts/evidence-hash.mjs --check
```

Expected: all pass, matching Global Constraints.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html \
  public/apple-touch-icon.png scripts/rasterize-apple-touch-icon.mjs \
  src/hooks/useOnlineStatus.js src/App.jsx src/index.css \
  HANDOFF.md docs/GROWTH-PLAN.md
git commit -m "Stage 2: Offline MVP -- installable, works from a cold offline start

- vite-plugin-pwa precaches the built static payload (app shell + all
  20 restaurants' data, already bundled in the JS -- no separate fetch
  to cache). The 18 crawler-prerendered /place/<id> pages are NOT in the
  precache manifest (prerender-places.mjs runs after vite build already
  finalized it -- a build-ordering fact found during implementation, not
  a design choice), so every offline /place/:id navigation goes through
  navigateFallback instead: the cached shell loads, and react-router with
  its bundled data renders the right restaurant, no second network round
  trip either way. Verified end-to-end, not assumed.
- apple-touch-icon.png (180x180, rasterized once from favicon.svg via
  scripts/rasterize-apple-touch-icon.mjs) for iOS home-screen install,
  since iOS doesn't reliably read Web App Manifest icons the way
  Android/Chrome does -- same class of format gap as the og:image SVG
  issue found earlier this session, handled proactively here.
- useOnlineStatus() hook + a small banner over the map when offline
  (map tiles need network and stay uncached, per the frozen plan --
  restaurant data, search, filters, and routing all work offline
  regardless).
- Map tiles explicitly not cached, per GROWTH-PLAN's frozen scope.
- No update-prompt UI (registerType: autoUpdate only), per HANDOFF's
  caution against leading on unstable content.

This closes out GROWTH-PLAN Stage 2 (all 5 items now shipped). HANDOFF.md
and docs/GROWTH-PLAN.md updated in this commit.

Gates: check-data, lint, build, retrievedBy leak check (0 across all of
dist/), evidence-hash --check all pass. Verified via vite build && vite
preview + headless Chromium: service worker activates on first online
visit; a /place/:id never opened this session renders correctly when
opened cold while fully offline; offline banner appears/clears correctly;
zero console errors."
```

(Adjust the `git add` file list if `git status` shows anything different
from what's listed — check first, same as every prior commit this
session.)

Then, separately, **ask the user before `git push`** — push triggers a
Vercel production deploy, same as every prior commit this session.

---

## Self-review notes

- **Spec coverage:** precaching + data (Task 1), manifest/icons (Task 2),
  offline banner (Task 3), the specific never-visited-deep-link scenario +
  docs sync (Task 4) — every spec section has a task.
- **Type/name consistency:** `useOnlineStatus()` returns a plain
  `boolean`, used directly as `isOnline` in `App.jsx` — no mismatch
  between what Task 3 produces and how it's consumed (same task, but
  checked since a later task doesn't also need to know this shape).
- **No placeholder verification steps:** every verification step in this
  plan has the actual command and actual expected output, not "test that
  it works" — including the one the design review specifically demanded
  (Task 4 Step 2's script).
- **Corrected twice, not left as a guess either time:** first, before
  writing this plan, by downloading and reading the actual installed
  package's type definitions (`globPatterns` behavior). Second, during
  Task 1's actual implementation, when the build-ordering gap between
  `vite build`'s precache finalization and `prerender-places.mjs`'s later
  run was found by inspecting the real built `dist/sw.js`, not assumed
  from the type-level reasoning alone. Both corrections are recorded in
  the spec (`docs/superpowers/specs/2026-08-03-offline-mvp-design.md`)
  and reflected in Task 1 Step 4's expectations above. The actual
  requirement — offline `/place/:id` support — was never at risk either
  time; only the internal mechanism understanding changed.
