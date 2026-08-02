# Multilingual Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `react-i18next`/`i18next` infrastructure to K-Food Map with
English as the only real language, extracting strings for four core
screens (TabBar, Prologue, safety/trust labels, Journal badges) plus a
Profile language picker — per
`docs/superpowers/specs/2026-08-03-multilingual-infra-design.md`. Zero
translated content ships; this is infrastructure only.

**Architecture:** `src/i18n/index.js` calls `i18next.init({ resources:
{ en: { translation: {...} } } })` synchronously at import time, with
`initReactI18next` registered so React components can call
`useTranslation()`. Because `src/data/verification.js` calls `i18next.t()`
directly (it's not a React component) and is also imported by
`scripts/check-data.mjs` (a plain Node script, not just the React app),
`verification.js` imports `../i18n` itself to guarantee initialization
regardless of entry point — verified this matters: calling `i18next.t()`
before `.init()` returns `undefined`, not the key or a fallback string.

**Tech Stack:** `react-i18next@^17.0.11`, `i18next@^26.3.6` (confirmed
compatible with this project's `react@^19.2.7` via `react-i18next`'s own
`peerDependencies`).

## Global Constraints

- Every commit must pass: `npm run check-data` ("No violations."),
  `npm run lint` (baseline: 1 warning, the documented `kakaoMapUrl`
  `origin` param — unrelated), `npm run build`, `grep -rc retrievedBy
  dist/` (must print `0` everywhere), `node scripts/evidence-hash.mjs
  --check` (`0 pending, 0 drifted`).
- No data or Confidence-Model/Evidence-Layer changes — `verification.js`'s
  *logic* (which fields carry what confidence) must not change, only how
  its output strings are produced.
- **Extraction scope is exactly**: `TabBar.jsx`, `Prologue.jsx`,
  `verification.js`'s `trustBadge()`/`VEGAN_LABEL`/`HALAL_LABEL`,
  `JournalPanel.jsx`'s badge names/sample label/empty-state steps, and
  `TabPanel.jsx`'s Profile "Language" row. **Do not** touch `FilterBar.jsx`,
  `BottomSheetList.jsx`, `RestaurantDetail.jsx`, `MapComponent.jsx`,
  `Icons.jsx`, or any other part of `JournalPanel.jsx`/`TabPanel.jsx`
  beyond what's listed — that's explicitly deferred scope per the spec.
- **Never touch `story`, `vibe`, `esg_point`, restaurant names, or zone
  names** — permanently out of scope, editorial/data content.
- `f.evidence` strings inside `trustBadge()` (research-authored English
  text quoting a source) are data, not UI chrome — pass them through
  as-is via interpolation, never wrap them in `t()`.
- **Commit discipline:** single commit at the end (Task 5), matching the
  pattern used for every other plan this session. Tasks 1–4 end with
  local verification, not commits.
- **Browser verification (§11 rule 16) has a specific failure mode to
  check for:** a typo'd or missing i18next key renders as the raw key
  string (e.g. `tabBar.map`) instead of crashing or showing nothing.
  Verification must read the actual rendered text on screen, not just
  confirm the page loads without errors.

---

### Task 1: i18n infrastructure + TabBar extraction

**Files:**
- Create: `src/i18n/index.js`
- Create: `src/i18n/locales/en.js`
- Modify: `src/main.jsx`
- Modify: `src/components/TabBar.jsx`

**Interfaces:**
- Produces: `src/i18n/locales/en.js` default-exports a nested object;
  `src/i18n/index.js` has no exports (its only job is the `i18next.init()`
  side effect) and must be imported (for that side effect) by anything
  that calls `i18next.t()` before React has mounted — specifically
  `src/main.jsx` and, starting in Task 3, `src/data/verification.js`.
- Consumes: nothing from other tasks — this is the foundation task.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-i18next@^17.0.11 i18next@^26.3.6
```

Confirm `package.json`'s `dependencies` (not `devDependencies` — these
ship in the browser bundle, unlike `vite-plugin-pwa`) now includes both.

- [ ] **Step 2: Create the locale file**

Create `src/i18n/locales/en.js`:

```js
// English strings for the four "core screens" extracted so far (see
// docs/superpowers/specs/2026-08-03-multilingual-infra-design.md for the
// full extraction-scope rationale). This is the one file a future
// session extends when a second language ships -- add a sibling file
// (e.g. ko.js) with the same key shape and register it in ../index.js.
export default {
  tabBar: {
    map: 'Map',
    discover: 'Discover',
    journal: 'Journal',
    profile: 'Profile',
  },
};
```

- [ ] **Step 3: Create the i18n init module**

Create `src/i18n/index.js`:

```js
// Side-effect-only module: initializes the i18next singleton so any
// caller of i18next.t() gets real strings, whether it's a React
// component (via useTranslation()) or a plain Node script like
// scripts/check-data.mjs (via src/data/verification.js importing this
// file directly -- see that file's own comment).
//
// resources are bundled into the JS, not fetched -- no separate network
// request, no interaction with the service worker's precache manifest.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes -- avoid double-escaping
  },
});
```

- [ ] **Step 4: Wire it into `main.jsx`**

Read the current `src/main.jsx` first. Add the import (side-effect only,
no named import) before `App.jsx`'s import:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './i18n'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

(Only the new `import './i18n'` line is added; everything else in the
file stays exactly as-is.)

- [ ] **Step 5: Extract `TabBar.jsx`'s four labels**

Read the current `src/components/TabBar.jsx` first. Change:

```jsx
import React from 'react';
```
to:
```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
```

Change:
```jsx
const tabs = [
  { id: 'map', label: 'Map' },
  { id: 'discover', label: 'Discover' },
  { id: 'journal', label: 'Journal' },
  { id: 'profile', label: 'Profile' },
];

export default function TabBar({ activeTab, onSelect, isCollapsed }) {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`tab-item${activeTab === t.id ? ' active' : ''}`}
          aria-current={activeTab === t.id ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
          title={isCollapsed ? t.label : undefined}
        >
          {icons[t.id]}
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
```
to:
```jsx
const tabIds = ['map', 'discover', 'journal', 'profile'];

export default function TabBar({ activeTab, onSelect, isCollapsed }) {
  const { t } = useTranslation();

  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabIds.map(id => (
        <button
          key={id}
          className={`tab-item${activeTab === id ? ' active' : ''}`}
          aria-current={activeTab === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
          title={isCollapsed ? t(`tabBar.${id}`) : undefined}
        >
          {icons[id]}
          <span className="tab-label">{t(`tabBar.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
```

(Note: the local variable named `t` in the original `tabs.map(t => ...)`
is renamed to `id` to avoid shadowing the `t` translation function from
`useTranslation()` — this is exactly the kind of naming collision this
step must not introduce silently.)

- [ ] **Step 6: Verify**

```bash
npm run build
npm run lint
```

Expected: build succeeds; lint shows no new warnings vs. the 1-warning
baseline.

Then start `npm run dev` and confirm in a browser (or headless
Chromium, per this session's established pattern) that all four tab
labels ("Map", "Discover", "Journal", "Profile") render their correct
text — not `tabBar.map` or similar raw keys, which is exactly the
failure mode a typo would produce and NOT crash on.

*(No commit here — continue to Task 2.)*

---

### Task 2: Prologue extraction

**Files:**
- Modify: `src/i18n/locales/en.js`
- Modify: `src/components/Prologue.jsx`

**Interfaces:**
- Consumes: `useTranslation` from `react-i18next` (Task 1 already
  installed the dependency).
- Produces: adds a `prologue` key group to `en.js`'s default export —
  later tasks add their own top-level groups (`trust`, `dietary`,
  `journal`, `profile`), never touching `prologue`'s keys.

- [ ] **Step 1: Add the `prologue` group to `en.js`**

In `src/i18n/locales/en.js`, add a new top-level key after `tabBar`:

```js
export default {
  tabBar: {
    map: 'Map',
    discover: 'Discover',
    journal: 'Journal',
    profile: 'Profile',
  },
  prologue: {
    welcomeTitle: 'Welcome to Korea.',
    welcomeSubtitle: 'Discover food that matches your taste.',
    trustLine: '{{count}} restaurants, researched one at a time — every claim sourced, or marked honestly unknown.',
    continue: 'Continue',
    storiesTitle: 'Explore Korean food stories.',
    storiesSubtitle: 'Every restaurant has a cultural story.',
    next: 'Next',
    locationTitle: 'Allow location',
    locationSubtitle: 'To find the best places near you.',
    allowLocation: 'Allow While Using App',
    skipForNow: 'Skip for now',
    findingTitle: 'Finding restaurants near you...',
  },
};
```

- [ ] **Step 2: Wire `Prologue.jsx`**

Read the current `src/components/Prologue.jsx` first. Change the import
block:

```jsx
import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon } from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import './Prologue.css';
```
to:
```jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon } from './Icons';
import { restaurants } from '../data/restaurants';
import { isQuarantined } from '../data/verification';
import './Prologue.css';
```

Add the hook call right after the component's existing state
declarations:

```jsx
export default function Prologue({ onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
```

Replace each step's JSX. Step 1:
```jsx
        {step === 1 && (
          <div className="prologue-step">
            <h1 className="prologue-title">Welcome to Korea.</h1>
            <p className="prologue-subtitle">Discover food that matches your taste.</p>
            <p className="prologue-trust">
              <ShieldCheckIcon size={16} />
              {activeCount} restaurants, researched one at a time — every
              claim sourced, or marked honestly unknown.
            </p>
            <button className="prologue-btn" onClick={nextStep}>Continue</button>
          </div>
        )}
```
becomes:
```jsx
        {step === 1 && (
          <div className="prologue-step">
            <h1 className="prologue-title">{t('prologue.welcomeTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.welcomeSubtitle')}</p>
            <p className="prologue-trust">
              <ShieldCheckIcon size={16} />
              {t('prologue.trustLine', { count: activeCount })}
            </p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.continue')}</button>
          </div>
        )}
```

Step 2:
```jsx
        {step === 2 && (
          <div className="prologue-step">
            <h1 className="prologue-title">Explore Korean food stories.</h1>
            <p className="prologue-subtitle">Every restaurant has a cultural story.</p>
            <button className="prologue-btn" onClick={nextStep}>Next</button>
          </div>
        )}
```
becomes:
```jsx
        {step === 2 && (
          <div className="prologue-step">
            <h1 className="prologue-title">{t('prologue.storiesTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.storiesSubtitle')}</p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.next')}</button>
          </div>
        )}
```

Step 3:
```jsx
            <h1 className="prologue-title">Allow location</h1>
            <p className="prologue-subtitle">To find the best places near you.</p>
            <button className="prologue-btn" onClick={nextStep}>Allow While Using App</button>
            <button className="prologue-btn prologue-btn--ghost" onClick={nextStep}>Skip for now</button>
```
becomes:
```jsx
            <h1 className="prologue-title">{t('prologue.locationTitle')}</h1>
            <p className="prologue-subtitle">{t('prologue.locationSubtitle')}</p>
            <button className="prologue-btn" onClick={nextStep}>{t('prologue.allowLocation')}</button>
            <button className="prologue-btn prologue-btn--ghost" onClick={nextStep}>{t('prologue.skipForNow')}</button>
```

Step 4:
```jsx
            <h1 className="prologue-title">Finding restaurants near you...</h1>
```
becomes:
```jsx
            <h1 className="prologue-title">{t('prologue.findingTitle')}</h1>
```

- [ ] **Step 3: Verify**

```bash
npm run build
npm run lint
```

Expected: build succeeds; lint clean vs. baseline.

Browser check (headless or real): step through all 4 Prologue screens
(click Continue → Next → Allow/Skip, wait ~2s for step 4's auto-advance)
and confirm every string renders correctly, especially
`{{count}} restaurants...` — confirm the actual number (18) is
interpolated correctly, not literally `{{count}}` or blank.

*(No commit here — continue to Task 3.)*

---

### Task 3: `verification.js` extraction — safety/trust labels

**Files:**
- Modify: `src/i18n/locales/en.js`
- Modify: `src/data/verification.js`

**Interfaces:**
- Consumes: `i18next` default export directly (not the React hook — this
  file is not a component). Also consumes `../i18n` for its
  initialization side effect.
- Produces: `trustBadge()`, `VEGAN_LABEL`, `HALAL_LABEL` keep their exact
  existing signatures and call sites (`RestaurantDetail.jsx`,
  `BottomSheetList.jsx`, `scripts/check-data.mjs`, etc. — none of which
  this task touches) — only what's *inside* them changes.

- [ ] **Step 1: Add the `trust` and `dietary` groups to `en.js`**

In `src/i18n/locales/en.js`, add two new top-level keys after `prologue`:

```js
  trust: {
    unknown: 'Unknown',
    unknownDetail: 'Not established.',
    official: 'Official',
    officialDetail: 'Confirmed against an official registry.',
    communityChecked: 'Community-checked',
    communityCheckedDetail: 'Reported by travellers and checked by us.',
    confirmed: 'Confirmed',
    confirmedDetail: 'Confirmed with the restaurant.',
    reported: 'Reported',
    reportedDetail: 'Stated by a source, not yet confirmed. {{evidence}}',
    inferred: 'Inferred',
    inferredDetail: 'Our reading, not a stated fact. {{evidence}}',
  },
  dietary: {
    veganFull: 'Fully vegan',
    veganOptions: 'Vegan options',
    halalCertified: 'Halal certified',
    halalFriendly: 'Halal-friendly',
    porkFree: 'Pork-free',
  },
```

- [ ] **Step 2: Wire `verification.js`**

Read the current `src/data/verification.js` first. Add two imports at
the very top of the file, before the existing comment block (so they run
first):

```js
import i18next from 'i18next';
import '../i18n';

// Data-integrity primitives.
```

(The `import '../i18n'` is what guarantees `i18next.init()` has run
before any `i18next.t()` call below — required because this file is also
imported by `scripts/check-data.mjs`, a plain Node script that never
imports `src/main.jsx`.)

Replace `trustBadge()`:
```js
export function trustBadge(f) {
  if (!isKnown(f)) return { label: 'Unknown', tone: 'none', detail: f?.evidence ?? 'Not established.' };

  if (f.confidence === CONFIDENCE.CONFIRMED) {
    if (f.source === SOURCE.OFFICIAL) return { label: 'Official', tone: 'strong', detail: 'Confirmed against an official registry.' };
    if (f.source === SOURCE.COMMUNITY) return { label: 'Community-checked', tone: 'medium', detail: 'Reported by travellers and checked by us.' };
    return { label: 'Confirmed', tone: 'strong', detail: 'Confirmed with the restaurant.' };
  }
  if (f.confidence === CONFIDENCE.SUPPORTED) {
    return { label: 'Reported', tone: 'medium', detail: `Stated by a source, not yet confirmed. ${f.evidence ?? ''}`.trim() };
  }
  return { label: 'Inferred', tone: 'weak', detail: `Our reading, not a stated fact. ${f.evidence ?? ''}`.trim() };
}
```
with:
```js
export function trustBadge(f) {
  if (!isKnown(f)) return { label: i18next.t('trust.unknown'), tone: 'none', detail: f?.evidence ?? i18next.t('trust.unknownDetail') };

  if (f.confidence === CONFIDENCE.CONFIRMED) {
    if (f.source === SOURCE.OFFICIAL) return { label: i18next.t('trust.official'), tone: 'strong', detail: i18next.t('trust.officialDetail') };
    if (f.source === SOURCE.COMMUNITY) return { label: i18next.t('trust.communityChecked'), tone: 'medium', detail: i18next.t('trust.communityCheckedDetail') };
    return { label: i18next.t('trust.confirmed'), tone: 'strong', detail: i18next.t('trust.confirmedDetail') };
  }
  if (f.confidence === CONFIDENCE.SUPPORTED) {
    return { label: i18next.t('trust.reported'), tone: 'medium', detail: i18next.t('trust.reportedDetail', { evidence: f.evidence ?? '' }).trim() };
  }
  return { label: i18next.t('trust.inferred'), tone: 'weak', detail: i18next.t('trust.inferredDetail', { evidence: f.evidence ?? '' }).trim() };
}
```

**Note the two data-vs-UI distinctions preserved exactly:** `f.evidence`
(research-authored English text) is never passed through `t()` itself —
it's interpolated as a *value* into an already-translated template
(`trust.reportedDetail`/`trust.inferredDetail`), so it stays in its
original language regardless of which UI language is active, per the
Global Constraints. And the `f?.evidence ?? i18next.t('trust.unknownDetail')`
fallback keeps the exact original precedence (real evidence text wins
over the generic "Not established." line).

Replace `VEGAN_LABEL`/`HALAL_LABEL`:
```js
/** Human labels for dietary levels. Absent levels intentionally render nothing. */
export const VEGAN_LABEL = {
  [VEGAN.FULL]: 'Fully vegan',
  [VEGAN.OPTIONS]: 'Vegan options',
};
export const HALAL_LABEL = {
  [HALAL.CERTIFIED]: 'Halal certified',
  [HALAL.FRIENDLY]: 'Halal-friendly',
  [HALAL.PORK_FREE]: 'Pork-free',
};
```
with:
```js
/**
 * Human labels for dietary levels. Absent levels intentionally render
 * nothing. Functions, not plain objects, because the value must be
 * read through i18next.t() at call time (not import time) so a language
 * change picks it up on the next render -- dietaryBadges() below, and
 * every call site, already calls these fresh on every invocation, so
 * this is a drop-in replacement for what was a plain object lookup.
 */
export const VEGAN_LABEL = {
  get [VEGAN.FULL]() { return i18next.t('dietary.veganFull'); },
  get [VEGAN.OPTIONS]() { return i18next.t('dietary.veganOptions'); },
};
export const HALAL_LABEL = {
  get [HALAL.CERTIFIED]() { return i18next.t('dietary.halalCertified'); },
  get [HALAL.FRIENDLY]() { return i18next.t('dietary.halalFriendly'); },
  get [HALAL.PORK_FREE]() { return i18next.t('dietary.porkFree'); },
};
```

**Why getters, not a plain object built once:** `VEGAN_LABEL`/`HALAL_LABEL`
are module-level `const`s evaluated once, at import time, by the original
code — but they're *read* many times (`VEGAN_LABEL[v.value]` in
`dietaryBadges()`, called fresh per restaurant per render). If they were
plain string values computed once at import time, they'd freeze in
whatever language was active when the module first loaded, and never
update after a language change. A getter re-evaluates `i18next.t()` on
every property access, which is exactly as fresh as the existing
`dietaryBadges()` call pattern already assumes. (Since only one language
exists this round, this distinction has no visible effect yet — it's
correctness for the feature this infrastructure exists to enable.)

- [ ] **Step 3: Verify `check-data.mjs` still runs correctly with this
  Node-script code path**

```bash
npm run check-data
```

Expected: "No violations." — same as before this task. This is the
concrete check that `import '../i18n'` successfully initializes i18next
in a plain Node process (not just inside Vite/the browser); if this
command hangs, errors, or prints "undefined" anywhere in its output,
something is wrong with the init-ordering assumption and must be fixed
before continuing — do not proceed past a failing `check-data` here.

- [ ] **Step 4: Verify the rest of the gate suite and lint**

```bash
npm run lint
npm run build
grep -rc retrievedBy dist/
node scripts/evidence-hash.mjs --check
```

Expected: lint clean vs. baseline; build succeeds; retrievedBy grep `0`
everywhere; evidence-hash `0 pending, 0 drifted`.

- [ ] **Step 5: Browser check**

Open a restaurant's detail page (e.g. `/place/gonghwachun`) and confirm
dietary/trust badges still render correct English text (e.g. "Fully
vegan", "Reported", the "Stated by a source, not yet confirmed. ..."
detail text with the real evidence quote still appended, not `{{evidence}}`
literally or a raw key).

*(No commit here — continue to Task 4.)*

---

### Task 4: `JournalPanel.jsx` badges + `TabPanel.jsx` Profile language picker

**Files:**
- Modify: `src/i18n/locales/en.js`
- Modify: `src/components/JournalPanel.jsx`
- Modify: `src/components/TabPanel.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useTranslation` from `react-i18next`; `localStorage` pattern
  matching the existing `kfm-bookmarks`/`kfm-prologue` keys (new key:
  `kfm-language`).
- Produces: nothing new consumed by later tasks (Task 5 is
  verification/docs only).

- [ ] **Step 1: Add the `journal` and `profile` groups to `en.js`**

```js
  journal: {
    firstTaste: 'First Taste',
    plantBased: 'Plant Based',
    sample: 'Sample',
    whatItllLookLike: "What it'll look like",
    step1: 'Find a restaurant you like',
    step2: 'Tap the heart to save it',
    step3: 'Mark it visited after your trip',
  },
  profile: {
    language: 'Language',
    languageEnglish: 'English',
  },
```

- [ ] **Step 2: Wire `JournalPanel.jsx`**

Read the current `src/components/JournalPanel.jsx` first. Change the
import block:
```jsx
import React, { useMemo } from 'react';
import { restaurants } from '../data/restaurants';
import { isQuarantined, isKnown, VEGAN } from '../data/verification';
```
to:
```jsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { restaurants } from '../data/restaurants';
import { isQuarantined, isKnown, VEGAN } from '../data/verification';
```

Add the hook call as the first line inside the component:
```jsx
export default function JournalPanel({ bookmarks, onRestaurantClick }) {
  const { t } = useTranslation();
  const byId = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r])), []);
```

Change the badges array:
```jsx
  const badges = [
    { key: 'first-taste', icon: '🇰🇷', name: 'First Taste', earned: visitedList.length > 0 },
    {
      key: 'plant-based',
      icon: '🌱',
      name: 'Plant Based',
      earned: visitedList.some(({ place }) => isKnown(place.dietary?.vegan) && place.dietary.vegan.value === VEGAN.FULL),
    },
  ];
```
to:
```jsx
  const badges = [
    { key: 'first-taste', icon: '🇰🇷', name: t('journal.firstTaste'), earned: visitedList.length > 0 },
    {
      key: 'plant-based',
      icon: '🌱',
      name: t('journal.plantBased'),
      earned: visitedList.some(({ place }) => isKnown(place.dietary?.vegan) && place.dietary.vegan.value === VEGAN.FULL),
    },
  ];
```

In the empty-state JSX, change:
```jsx
              <p className="journal-sample-label">What it'll look like</p>
```
to:
```jsx
              <p className="journal-sample-label">{t('journal.whatItllLookLike')}</p>
```

Change:
```jsx
                    <span className="stamp-sample-tag">Sample</span>
```
to:
```jsx
                    <span className="stamp-sample-tag">{t('journal.sample')}</span>
```

Change the 3-step guide:
```jsx
          <div className="journal-empty__steps">
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">1</span>
              Find a restaurant you like
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">2</span>
              Tap the heart to save it
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">3</span>
              Mark it visited after your trip
            </div>
          </div>
```
to:
```jsx
          <div className="journal-empty__steps">
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">1</span>
              {t('journal.step1')}
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">2</span>
              {t('journal.step2')}
            </div>
            <div className="journal-empty__step">
              <span className="journal-empty__step-num">3</span>
              {t('journal.step3')}
            </div>
          </div>
```

- [ ] **Step 3: Wire `TabPanel.jsx`'s Profile language row**

Read the current `src/components/TabPanel.jsx` first. Change the import
block:
```jsx
import React from 'react';
import { useNavigate } from 'react-router';
import { SparkleIcon, UserIcon, ChevronRightIcon, CompassIcon } from './Icons';
```
to:
```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SparkleIcon, UserIcon, ChevronRightIcon, CompassIcon } from './Icons';
```

Replace the `ProfileTab` function:
```jsx
function ProfileTab({ onNavigate }) {
  const settings = [
    { label: 'Language', value: 'English', icon: '🌐' },
    { label: 'Food Preferences', value: 'Not set', icon: '🍲' },
    { label: 'Dietary Preferences', value: 'Not set', icon: '🌱' },
    { label: 'Saved Places', value: 'View Journal', icon: '❤️', action: () => onNavigate('journal') },
    { label: 'About K-Food Map', value: 'v1.0', icon: 'ℹ️' },
    { label: 'Privacy Policy', value: '', icon: '🔒' },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>Settings</h2>
        <p>Manage your preferences and app settings.</p>
      </div>

      <div className="settings-list">
        {settings.map((item, idx) => (
          <div key={idx} className="settings-item" onClick={item.action}>
            <span className="settings-icon">{item.icon}</span>
            <div className="settings-text">
              <span className="settings-label">{item.label}</span>
            </div>
            {item.value && <span className="settings-value">{item.value}</span>}
            <ChevronRightIcon size={18} />
          </div>
        ))}
      </div>
    </section>
  );
}
```
with:
```jsx
// Only English exists today -- LANGUAGES grows when a second locale file
// is added under src/i18n/locales/ and registered in src/i18n/index.js.
// The picker is built to scale to that list without a component change.
const LANGUAGES = [{ code: 'en', labelKey: 'profile.languageEnglish' }];
const LANGUAGE_STORAGE_KEY = 'kfm-language';

function LanguagePicker({ onClose }) {
  const { t, i18n } = useTranslation();

  const selectLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    onClose();
  };

  return (
    <div className="language-picker-overlay" onClick={onClose}>
      <div className="language-picker" onClick={(e) => e.stopPropagation()}>
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            className={`language-picker__option${i18n.language === lang.code ? ' active' : ''}`}
            onClick={() => selectLanguage(lang.code)}
          >
            {t(lang.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileTab({ onNavigate }) {
  const { t } = useTranslation();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const settings = [
    { label: t('profile.language'), value: t('profile.languageEnglish'), icon: '🌐', action: () => setLanguagePickerOpen(true) },
    { label: 'Food Preferences', value: 'Not set', icon: '🍲' },
    { label: 'Dietary Preferences', value: 'Not set', icon: '🌱' },
    { label: 'Saved Places', value: 'View Journal', icon: '❤️', action: () => onNavigate('journal') },
    { label: 'About K-Food Map', value: 'v1.0', icon: 'ℹ️' },
    { label: 'Privacy Policy', value: '', icon: '🔒' },
  ];

  return (
    <section className="tab-panel profile-panel">
      <div className="tab-panel-header">
        <span className="panel-icon" aria-hidden="true"><UserIcon size={24} /></span>
        <h2>Settings</h2>
        <p>Manage your preferences and app settings.</p>
      </div>

      <div className="settings-list">
        {settings.map((item, idx) => (
          <div key={idx} className="settings-item" onClick={item.action}>
            <span className="settings-icon">{item.icon}</span>
            <div className="settings-text">
              <span className="settings-label">{item.label}</span>
            </div>
            {item.value && <span className="settings-value">{item.value}</span>}
            <ChevronRightIcon size={18} />
          </div>
        ))}
      </div>

      {languagePickerOpen && <LanguagePicker onClose={() => setLanguagePickerOpen(false)} />}
    </section>
  );
}
```

Note: only "Food Preferences" and "Dietary Preferences" rows' `label`
values stay as plain hardcoded strings — those two settings rows are
outside this task's extraction scope (they're not one of the four core
screens' *listed* strings; only the "Language" row itself was called out
in the spec). Do not extract them in this task.

- [ ] **Step 4: Style the language picker**

In `src/index.css`, add this new rule block anywhere after the
`.settings-list`/`.settings-item` rules (search for `.settings-icon` to
find that area):

```css
.language-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(16, 24, 40, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.language-picker {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.language-picker__option {
  padding: 14px 16px;
  border: none;
  background: none;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.language-picker__option.active {
  background: var(--green-tint);
  color: var(--green-strong);
}
```

(`z-index: 500` is deliberate: above every mobile chrome element seen so
far this session — `.sidebar-region` 100, `.tab-bar` 200, `.offline-banner`
450 — and below the detail sheet's 210/211... **wait, 500 > 211, so this
overlay would incorrectly paint over an open restaurant detail if both
were somehow shown at once.** They can't be shown at once in practice
(the language picker only opens from the Profile tab, which is mutually
exclusive with viewing a restaurant detail in this app's navigation
model — opening a detail always happens from the Map/Discover/Journal
tabs, never Profile), but confirm this assumption holds during Step 5's
browser check rather than trusting this parenthetical. If it doesn't
hold, lower `z-index: 500` to something between 211 and 9999 only if
genuinely needed above the gallery lightbox, otherwise between 211 and
that mobile stack.)

- [ ] **Step 5: Verify**

```bash
npm run build
npm run lint
```

Expected: build succeeds; lint clean vs. baseline.

Browser check: open Profile tab, confirm the Language row shows
"Language" / "English"; click it, confirm a picker opens from the bottom
with exactly one option ("English"), marked active; click it, confirm
the picker closes (selecting the already-active language is a harmless
no-op per the spec); confirm `localStorage.getItem('kfm-language')` is
`'en'` afterward. Also visit Journal with an empty passport and confirm
the sample stamps show "Sample" tags and the 3-step guide renders
correctly (same content as before this task, just now routed through
`t()`).

*(No commit here — continue to Task 5.)*

---

### Task 5: Full verification, docs sync, single commit

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/GROWTH-PLAN.md`

**Interfaces:** none — this task verifies and documents Tasks 1–4, no
new code.

- [ ] **Step 1: Run the full gate suite**

```bash
npm run check-data
npm run lint
npm run build
grep -rc retrievedBy dist/
node scripts/evidence-hash.mjs --check
```

Expected: all pass per Global Constraints.

- [ ] **Step 2: Full-app browser sweep for raw-key leaks**

This is the check the spec specifically calls for: a typo'd i18next key
doesn't crash, it silently renders the raw key string. Visit, in one
pass (headless Chromium or real browser): Prologue (all 4 steps), Map
tab (tab labels), a restaurant detail page (trust/dietary badges),
Journal (empty state, or with a bookmark added to see "First Taste"/
"Plant Based" badge names), Discover tab (nothing changed here, sanity
check only), Profile tab (Language row + picker). Read every string
extracted in Tasks 1–4 and confirm none of them show a raw dotted key
(anything matching a pattern like `word.word` in the rendered UI is a
red flag — English prose with a literal period doesn't look like that).

- [ ] **Step 3: Confirm `check-data` output is unaffected**

```bash
npm run check-data 2>&1 | head -5
```

Expected: identical shape to before this plan (e.g. "Checked 20 places."
... "No violations.") — confirms `verification.js`'s i18next wiring
didn't change any data-validation behavior, only string production.

- [ ] **Step 4: Retry the Chrome extension, or ask the user**

If `mcp__claude-in-chrome__*` tools are available this time, do Step 2's
sweep in a real browser instead of/in addition to headless Chromium. If
still unavailable, ask the user to spot-check the Profile language
picker and one restaurant's trust badges directly, per the pattern used
throughout this session, before committing.

- [ ] **Step 5: Update HANDOFF.md**

- §2.1: add a short paragraph (after the existing "Offline" paragraph)
  describing the i18n architecture — `react-i18next`/`i18next`, resources
  bundled not fetched, `verification.js`'s direct `i18next` singleton
  usage via getters for `VEGAN_LABEL`/`HALAL_LABEL` and why (re-evaluated
  per access, not frozen at import time), the `import '../i18n'` guarantee
  for the `check-data.mjs` Node-script code path, zero translated content
  shipped this round.
- §3 Directory Structure: add `src/i18n/index.js` and
  `src/i18n/locales/en.js` to the tree.
- §7: mark GROWTH-PLAN Stage 3 resolved (the infrastructure slice of it —
  note explicitly that Stage 3 is not *fully* done, since translated
  content for a second language is still gated on verified personnel per
  the frozen plan; only the infra shipped).
- §12 "Next Recommended Task": mark this Multilingual infrastructure
  slice done; note remaining extraction scope (FilterBar,
  BottomSheetList, RestaurantDetail, etc.) as future incremental work,
  and that translated content for any second language needs the
  personnel precondition met first.

- [ ] **Step 6: Update `docs/GROWTH-PLAN.md`**

- §4 Stage 3: mark the infrastructure portion done, matching the style
  used for Stage 1/Stage 2 items — explicitly note it's infra-only
  (no translated content), and that full string-extraction coverage and
  a second language both remain open, gated as described above.

- [ ] **Step 7: Run the full gate suite one more time**

```bash
npm run check-data
npm run lint
npm run build
grep -rc retrievedBy dist/
node scripts/evidence-hash.mjs --check
```

Expected: all pass, matching Global Constraints.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/i18n/ src/main.jsx \
  src/components/TabBar.jsx src/components/Prologue.jsx \
  src/data/verification.js src/components/JournalPanel.jsx \
  src/components/TabPanel.jsx src/index.css HANDOFF.md docs/GROWTH-PLAN.md
git commit -m "Stage 3: Multilingual infrastructure, English-only for now

GROWTH-PLAN Stage 3 -- infrastructure slice only. No translated content
ships: there is no verified translation personnel yet, and per this
project's rule against inventing or guessing anything safety-adjacent,
that means zero translated strings rather than a guess. Confirmed with
the user before designing.

- react-i18next + i18next, resources bundled into the JS (no separate
  fetch, no interaction with the routing/prerendering/PWA-precache work
  from earlier this session).
- Extracted four core screens: TabBar nav labels, all of Prologue,
  every safety/trust label in verification.js (trustBadge()'s six
  outcomes plus VEGAN_LABEL/HALAL_LABEL), and JournalPanel's badge
  names/sample tag/empty-state steps. Deliberately not FilterBar,
  BottomSheetList, RestaurantDetail, or the rest of JournalPanel/
  TabPanel -- narrower scope on purpose, to keep this diff reviewable;
  those are future incremental extraction rounds.
- verification.js is not a React component but calls i18next.t()
  directly and is also imported by scripts/check-data.mjs (a plain Node
  script) -- it imports ../i18n itself to guarantee initialization
  regardless of entry point. Verified: i18next.t() returns undefined,
  not the key, before .init() runs, so this isn't optional.
  VEGAN_LABEL/HALAL_LABEL became getters (re-evaluated per access, not
  frozen at import time) so a future language change is picked up on
  the next render, matching how dietaryBadges() already calls them
  fresh on every invocation.
- Profile's "Language" row is now interactive, opening a picker with
  exactly one option ("English") rather than implying choices that
  don't exist -- grows automatically when a second locale file is
  registered, no component change needed.
- f.evidence (research-authored source-quote text) is passed through
  trustBadge()'s translated templates via interpolation, never itself
  wrapped in t() -- it's data, not UI chrome, same as story/vibe/
  esg_point, which stay permanently out of scope.

HANDOFF.md and docs/GROWTH-PLAN.md updated in this commit.

Gates: check-data, lint, build, retrievedBy leak check, evidence-hash
--check all pass. Browser-verified across all five affected screens
(Prologue, TabBar, a restaurant detail's trust/dietary badges, Journal,
Profile's language picker) that every extracted string renders its
correct English text rather than a raw i18next key -- the specific
failure mode this kind of change can produce silently."
```

(Adjust the `git add` file list if `git status` shows anything different
— check first, same as every prior commit this session.)

Then, separately, **ask the user before `git push`** — push triggers a
Vercel production deploy.

---

## Self-review notes

- **Spec coverage:** i18n init + TabBar (Task 1), Prologue (Task 2),
  safety/trust labels (Task 3), Journal badges + Profile picker (Task 4),
  verification + docs (Task 5) — every spec section has a task. The
  spec's explicit deferred-scope list (FilterBar, BottomSheetList,
  RestaurantDetail, rest of JournalPanel/TabPanel, FoodJourneys) has
  deliberately no task, and Task 4 Step 3 explicitly calls out the two
  Profile rows staying untouched.
- **Type/name consistency:** every `t('...')` key used in a component
  matches a key actually added to `en.js` in the same or an earlier
  task — cross-checked: `tabBar.*` (Task 1), `prologue.*` (Task 2),
  `trust.*`/`dietary.*` (Task 3), `journal.*`/`profile.*` (Task 4). No
  task references a key group before the task that defines it.
- **Verified, not assumed, before this plan was written:**
  `react-i18next`/`i18next` version compatibility (via `npm view`
  peerDependencies), `i18next`'s default export being a real singleton
  instance (via its own `.d.ts`), `initReactI18next`/`useTranslation`
  being real exports of `react-i18next` (via its own `.d.ts`), and —
  found during this plan's own drafting, not left as a guess — that
  `i18next.t()` returns `undefined` before `.init()` runs (tested
  directly), which is why `verification.js` importing `../i18n` for its
  side effect is load-bearing, not defensive boilerplate.
- **One thing intentionally NOT resolved in this plan, flagged for the
  implementer to check rather than trust:** Task 4 Step 4's z-index
  parenthetical talks itself into a possible contradiction (500 vs. the
  detail sheet's 211) and explicitly defers the real answer to browser
  verification rather than asserting one — on the theory, established
  twice already this session, that reasoning about cross-component
  z-index stacking from first principles has been wrong before and
  a screenshot is what actually settles it.
