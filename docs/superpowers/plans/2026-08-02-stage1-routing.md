# Stage 1 Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give K-Food Map real, shareable URLs — `/` and `/place/:id` — with
build-time static HTML so non-JS link-preview crawlers see the correct
restaurant name/description/image, per
`docs/superpowers/specs/2026-08-02-routing-design.md`.

**Architecture:** `react-router` (v8) in plain declarative mode. The URL
becomes the source of truth for which restaurant's detail is open —
`selectedRestaurant` is derived from `useParams()`, not stored in
`useState`. A build-time Node script (no headless browser) copies
`dist/index.html` once per active restaurant with swapped `<title>`/`og:*`
tags.

**Tech Stack:** React 19, react-router 8.x, Vite 7 (existing), Node ESM
scripts (existing pattern: `scripts/check-data.mjs`).

## Global Constraints

- Every one of these applies from HANDOFF.md §11 / §2.1 and must hold at the
  end of this work, not just per-task:
  - `npm run check-data` must print "No violations."
  - `npm run lint` must not introduce new warnings (baseline: 1, the
    documented `kakaoMapUrl` `origin` param — unrelated to this work).
  - `npm run build` must succeed.
  - `grep -c retrievedBy dist/assets/*.js` must print `0`.
  - `node scripts/evidence-hash.mjs --check` must print `0 pending, 0 drifted`.
  - Quarantined restaurants (`akiya`, `makan`) get no `/place/:id` route and
    no prerendered page — reuse `isQuarantined`/`activeRestaurants`, do not
    write a second exclusion check.
  - No data or Confidence-Model/Evidence-Layer changes of any kind.
- **Commit discipline for this plan:** the user chose a **single commit**
  for this whole feature (routing is one cohesive unit; see the design
  spec's "why one commit" note). So, unlike the default plan-per-task
  commit pattern, **Tasks 1–3 end with a local verification step, not a
  commit** — the actual `git commit` happens once, at the end of Task 4,
  after all gates pass and the UI has been checked in a browser.
- **Browser verification (§11 rule 16):** the Chrome extension was
  unavailable earlier this session. Before Task 4's commit step, retry it;
  if still unavailable, ask the user to check directly (same pattern used
  for the Stage 0 housekeeping commit) rather than skipping verification.

---

### Task 1: Add react-router and wrap the app

**Files:**
- Modify: `package.json`
- Modify: `src/main.jsx`

**Interfaces:**
- Produces: `<BrowserRouter>` wraps `<App />`, so any component rendered
  under `App` can call `useParams`/`useNavigate`/`useLocation` from
  `react-router` (used by Task 2).

- [ ] **Step 1: Add the dependency**

```bash
npm install react-router@^8.3.0
```

Confirm afterward that `package.json`'s `dependencies` block now includes
`"react-router": "^8.3.0"` and that `npm run build` still succeeds (sanity
check before touching any app code — isolates "dependency installs cleanly"
from "the app uses it correctly").

- [ ] **Step 2: Wrap `App` in `BrowserRouter`**

Edit `src/main.jsx` to:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify it still boots**

Run: `npm run dev`, open `http://localhost:5173/` in a browser (or curl it
for a 200 — a full render check needs a browser, deferred to Task 4).
Expected: page loads exactly as before — `BrowserRouter` with no `Routes`
inside `App` yet is a no-op wrapper, so nothing should look different.

*(No commit here — see Global Constraints. Continue to Task 2.)*

---

### Task 2: Route-driven restaurant detail

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `react-router`'s `Routes`, `Route`, `useParams`, `useNavigate`,
  `useLocation` (installed in Task 1).
- Consumes: `activeRestaurants` (existing top-level const in `App.jsx`,
  already filters `isQuarantined` — reused here so quarantine-exclusion for
  routes needs no new check).
- Produces: `openDetail(r)` / `openStory(r)` now navigate instead of
  setting state; `RestaurantDetail`'s `onClose` now navigates to `/`. No
  other component's props change shape.

Today, `App.jsx` (`src/App.jsx:60`) is one function that holds
`selectedRestaurant` in `useState` and returns the whole shell directly.
This task splits it into a thin `App` (route table) and the existing body,
renamed `AppShell`, which now derives `selectedRestaurant` and `focusStory`
from the URL instead of local state.

- [ ] **Step 1: Add the router imports**

At the top of `src/App.jsx`, add:

```jsx
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router';
```

- [ ] **Step 2: Rename `App` to `AppShell` and add the param/nav/location hooks**

Change:

```jsx
export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
```

to:

```jsx
function AppShell() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
```

- [ ] **Step 3: Replace `selectedRestaurant` and `focusStory` state with derived values**

Find and delete these two lines (currently `src/App.jsx:63` and `:67`):

```jsx
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
```
```jsx
  const [focusStory, setFocusStory] = useState(false);
```

In their place (same position, right after `selectedFilters`), add:

```jsx
  // The URL is the source of truth for which restaurant is open — no
  // separate state to keep in sync. activeRestaurants already excludes
  // quarantined places, so an id that's quarantined or simply doesn't
  // exist both resolve to null here, and the effect below sends it home.
  const selectedRestaurant = useMemo(
    () => (id ? activeRestaurants.find(r => r.id === id) ?? null : null),
    [id],
  );
  const focusStory = Boolean(location.state?.focusStory);

  useEffect(() => {
    if (id && !selectedRestaurant) navigate('/', { replace: true });
  }, [id, selectedRestaurant, navigate]);
```

- [ ] **Step 4: Update `openDetail` / `openStory` to navigate**

Find (currently `src/App.jsx:99-100`):

```jsx
  const openDetail = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(false); };
  const openStory = (r) => { if (isQuarantined(r)) return; setSelectedRestaurant(r); setFocusStory(true); };
```

Replace with:

```jsx
  const openDetail = (r) => { if (isQuarantined(r)) return; navigate(`/place/${r.id}`); };
  const openStory = (r) => { if (isQuarantined(r)) return; navigate(`/place/${r.id}`, { state: { focusStory: true } }); };
```

- [ ] **Step 5: Update `RestaurantDetail`'s `onClose`**

Find (currently `src/App.jsx:258`):

```jsx
        onClose={() => setSelectedRestaurant(null)}
```

Replace with:

```jsx
        onClose={() => navigate('/')}
```

- [ ] **Step 6: Wrap the shell in the route table**

At the very bottom of the file, change:

```jsx
export default function App() {
```
(the top of what's now `AppShell` — already renamed in Step 2) — keep that
as `function AppShell() { ... }` ending with its existing closing brace, and
add this new default export **after** the `AppShell` function's closing
brace:

```jsx
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/place/:id" element={<AppShell />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Verify with the dev server**

Run: `npm run dev`. In a browser: click a restaurant on the map — confirm
the URL bar shows `/place/<id>`; click the browser back button — confirm it
closes the detail and the URL returns to `/`; reload the page while a detail
is open — confirm the same restaurant's detail shows immediately (not a
blank map first); manually navigate to `/place/not-a-real-id` — confirm it
redirects to `/` without a console error. Also click through Journal →
click a saved/visited stamp → confirm it still opens detail correctly (this
exercises `openDetail` from a second call site).

Run `npm run lint` — expect no new warnings versus the 1-warning baseline
(there should be no unused-import warnings from this edit; `useState` is
still used for other state in the same file).

*(No commit here — continue to Task 3.)*

---

### Task 3: Build-time prerendering for crawler-visible meta

**Files:**
- Create: `scripts/prerender-places.mjs`
- Modify: `package.json` (the `build` script)
- Modify: `index.html` (baseline `og:*` tags for the home route)

**Interfaces:**
- Consumes: `restaurants` from `src/data/restaurants.js`, `isQuarantined`
  from `src/data/verification.js` — same imports `scripts/check-data.mjs`
  already uses from Node, so this is a proven pattern in this repo.
- Consumes: `dist/index.html`, produced by the preceding `vite build` step
  in the same `npm run build` invocation.
- Produces: `dist/place/<id>/index.html` for every active restaurant (18 of
  20 today) — nothing later in this plan depends on the exact file
  contents beyond "exists and contains that restaurant's name in
  `og:title`" (checked in Step 3 below).

- [ ] **Step 1: Add baseline `og:*` tags to the home page**

`index.html` today has a plain `<meta name="description">` but no Open
Graph tags at all, so sharing the bare homepage link also renders a
blank/generic preview card. Add these alongside the existing `<meta>` tags
(inside `<head>`, e.g. right after the existing `description` meta):

```html
    <meta property="og:type" content="website" />
    <meta property="og:title" content="K-Food Map · Sustainable Korean Dining" />
    <meta property="og:description" content="A curated map of sustainable Korean dining in Seoul & Incheon — vegan, halal, mild and zero-waste friendly." />
    <meta property="og:image" content="https://kfoodmap.vercel.app/favicon.svg" />
    <meta property="og:url" content="https://kfoodmap.vercel.app/" />
    <link rel="canonical" href="https://kfoodmap.vercel.app/" />
```

- [ ] **Step 2: Write the prerender script**

Create `scripts/prerender-places.mjs`:

```js
// Build-time prerendering for crawler-visible per-restaurant meta.
//
// No headless browser: this just copies the already-built dist/index.html
// once per active restaurant with <title>/og:*/canonical swapped to that
// restaurant's data. Every <script> tag is untouched, so a human opening
// the link gets the full interactive SPA — only non-JS link-preview
// crawlers (KakaoTalk, Facebook, Twitter) see a difference, which is the
// point: today they all see the same generic homepage card.
//
// Run as part of `npm run build` (see package.json), never standalone —
// it reads dist/index.html, which only exists after `vite build`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { restaurants } from '../src/data/restaurants.js';
import { isQuarantined } from '../src/data/verification.js';

const SITE_URL = 'https://kfoodmap.vercel.app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Each entry finds one existing tag in the built index.html template and
// replaces its content/href with this restaurant's value. Driven by a table
// rather than one .replace() call per tag, so adding a tag later (e.g.
// twitter:card) is a one-line addition, not a new repeated block.
function replacements(place) {
  const name = escapeHtml(place.name.split('(')[0].trim());
  const description = escapeHtml(place.vibe);
  const url = `${SITE_URL}/place/${place.id}`;
  const image = place.image ? `${SITE_URL}${place.image}` : `${SITE_URL}/favicon.svg`;

  return [
    [/<title>.*<\/title>/, `<title>${name} · K-Food Map</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${name} · K-Food Map" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${image}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
  ];
}

function pageFor(place) {
  return replacements(place).reduce((html, [pattern, value]) => html.replace(pattern, value), template);
}

const active = restaurants.filter(r => !isQuarantined(r));

for (const place of active) {
  const dir = path.join(distDir, 'place', place.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), pageFor(place), 'utf8');
}

console.log(`Prerendered ${active.length} place page(s) into dist/place/ (of ${restaurants.length} total).`);
```

- [ ] **Step 3: Wire it into the build**

In `package.json`, change:

```json
    "build": "vite build",
```

to:

```json
    "build": "vite build && node scripts/prerender-places.mjs",
```

- [ ] **Step 4: Verify**

Run: `npm run build`. Expected console output ends with `Prerendered 18
place page(s) into dist/place/ (of 20 total).`

Then check the generated files directly (no browser needed — this is the
actual crawler-visibility proof):

```bash
ls dist/place | wc -l          # expect 18
grep 'og:title' dist/place/gonghwachun/index.html
```

Expected: the `og:title` line contains "Gonghwachun" (or whatever
`gonghwachun`'s `name` field resolves to after `.split('(')[0].trim()`),
not the generic "K-Food Map" title. Also confirm neither `akiya` nor
`makan` has a directory under `dist/place/`.

*(No commit here — continue to Task 4.)*

---

### Task 4: Doc sync, full gate run, browser check, single commit

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/GROWTH-PLAN.md`

**Interfaces:** none — this task only verifies and documents what Tasks
1–3 built; it introduces no new code.

- [ ] **Step 1: Update HANDOFF.md**

- §2.1: the "No backend, no router, no state library" line needs to say
  routing was introduced, with a one-line pointer to this plan/spec and the
  landing commit hash (fill the hash in after Step 5's commit — see the
  note in Step 5).
- §7: mark GROWTH-PLAN decision C resolved (mirroring how decisions A/B
  were recorded in the Stage 0 housekeeping commit).
- §12 "Next Recommended Task": mark the routing decision item done, and
  update "Immediately next" to point at Stage 2.

- [ ] **Step 2: Update `docs/GROWTH-PLAN.md`**

- §4 Stage 1: mark it ✅ complete, matching the style used for Stage 0.
- §5 decisions table: mark **C** resolved (✅), same style as A/B.

- [ ] **Step 3: Run all five gates**

```bash
npm run check-data
npm run lint
npm run build
grep -c retrievedBy dist/assets/*.js
node scripts/evidence-hash.mjs --check
```

Expected: "No violations."; 1 warning (baseline, unchanged); build
succeeds and prerenders 18 pages; `0`; `0 pending, 0 drifted`.

- [ ] **Step 4: Browser verification**

Retry the Chrome extension tool. If it connects: repeat the checks from
Task 2 Step 7 (URL updates on click, back button, refresh-on-detail,
bad-id redirect) directly. If it's still unavailable, run `npm run dev`
and ask the user to check those same four things themselves before
proceeding — do not commit UI-affecting code without one or the other.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.jsx src/App.jsx \
  scripts/prerender-places.mjs index.html HANDOFF.md docs/GROWTH-PLAN.md
git commit -m "Stage 1: route-based restaurant URLs + prerendered og:meta

- react-router wraps the app; selectedRestaurant/focusStory are now
  derived from the URL (/ and /place/:id) instead of useState, so
  back/forward and reload work natively and there's one fewer piece of
  duplicated state.
- Quarantined restaurants get no route and no prerendered page: reused
  the existing isQuarantined/activeRestaurants filter rather than adding
  a second check.
- scripts/prerender-places.mjs copies dist/index.html once per active
  restaurant with <title>/og:*/canonical swapped to that restaurant's
  data, no headless browser. Wired into npm run build. No vercel.json
  rewrite needed since every valid id is a real file at build time.
- HANDOFF.md and docs/GROWTH-PLAN.md updated in the same commit
  (decision C resolved).

Gates: check-data, lint, build, retrievedBy leak check, evidence-hash
--check all pass. Verified in browser: URL updates on open/close,
back/forward, reload-on-detail, bad-id redirect.
"
```

(Adjust the exact `git add` file list if Task 1's `npm install` produced no
`package-lock.json` diff, or if any file path above doesn't match what
actually changed — check `git status` first, same as the Stage 0
housekeeping commit did.)

Then, separately, **ask the user before `git push`** — push triggers a
Vercel production deploy, same as every prior commit this session.

---

## Self-review notes

- **Spec coverage:** architecture (Task 2), URL scheme + prerendering
  (Task 3), error handling for unknown/quarantined ids (Task 2 Step 3's
  effect), verification plan (Task 4 Steps 3–4) — all five spec sections
  have a task. The spec's "out of scope" list (tab routes, filter/search
  URL-sync) has deliberately no task.
- **Type/name consistency:** `openDetail`/`openStory` signatures unchanged
  (still take a restaurant object `r`); `RestaurantDetail`'s props
  (`restaurant`, `onClose`, `focusStory`, etc.) are unchanged — only what
  supplies them changed. `activeRestaurants` name matches its existing
  definition at the top of `App.jsx`; no new module-level export needed
  since `AppShell` and `App` live in the same file.
- **One placeholder resolved during drafting, not left in:** the design
  spec flagged "confirm `react-router` vs `react-router-dom` at
  implementation time." Resolved here by checking the registry directly
  (`npm view react-router-dom version` → `7.18.2`, peer `react >=18`;
  `npm view react-router version` → `8.3.0`, peer `react >=19.2.7` — an
  exact match to this repo's installed React version) and confirming
  `react-router`'s conditional exports include a root entry point usable
  for a plain Vite SPA. Task 1 pins `react-router@^8.3.0` accordingly.
