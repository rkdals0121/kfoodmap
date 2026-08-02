# Multilingual infrastructure design — GROWTH-PLAN Stage 3

**Date:** 2026-08-03 · **Decides:** how Stage 3 ("Multilingual MVP") ships
· **Base commit:** `86936c8`

## Why

GROWTH-PLAN Stage 3: "Multilingual MVP — UI + 안전 라벨만 (동결된 범위).
영어 우선. 편집 콘텐츠(story 등) 번역은 범위 밖. 안전 라벨 번역은 검증
가능 인력 확보가 전제." HANDOFF §10 lists Multilingual first in the
original Phase 6 order because it "touches every screen ... to avoid
rework once more screens exist."

**Confirmed with the user before designing:** there is no verified
translation personnel available yet (someone who speaks a target
language well enough to translate dietary/safety labels responsibly).
Per this project's own rule against inventing or guessing anything
safety-adjacent, that means **this round ships zero translated content.**
It is infrastructure only — string extraction and a language-switching
mechanism — with English as the only real language, structured so a
future session can drop in a second language's strings without any
further architecture work.

## Scope

**In scope this round:**
- `react-i18next` + `i18next` added, initialized with English resources
  bundled directly into the JS (no separate HTTP fetch for translation
  files — same reasoning as restaurant data already being bundled, not
  fetched).
- String extraction for four "core screens," in order of what a user
  meets first:
  1. `TabBar.jsx` — the four nav labels (Map / Discover / Journal / Profile).
  2. `Prologue.jsx` — all 4 onboarding steps' copy, including the trust
     line added earlier this session.
  3. **Safety/trust labels** — `src/data/verification.js`'s
     `VEGAN_LABEL`/`HALAL_LABEL` dictionaries (`Fully vegan`, `Vegan
     options`, `Halal certified`, `Halal-friendly`, `Pork-free`) and
     `trustBadge()`'s full return set (`Unknown`/`Official`/
     `Community-checked`/`Confirmed`/`Reported`/`Inferred`, each with a
     short label *and* a longer `detail` sentence — all of it, not just
     the short labels, since the detail sentences are exactly the
     "confirmed vs. reported vs. our own reading" honesty distinctions
     this product exists to make legible). Also `JournalPanel.jsx`'s two
     badge names (`First Taste`, `Plant Based`) and the `SAMPLE`/journal
     empty-state 3-step copy added earlier this session, since they're
     UI chrome, not editorial content.
  4. `TabPanel.jsx`'s Profile "Language" row — converted from a static
     display value to an actual (if currently trivial) language picker.

**Deliberately deferred to a later, incremental round** (not because
they're low-value, but to keep this round's diff reviewable): `FilterBar`
search placeholder and chip labels, `BottomSheetList` card copy,
`RestaurantDetail`'s non-editorial labels (section headings, button text,
caveat copy), the rest of `JournalPanel`, the Food Journeys section.
These stay hardcoded English for now.

**Permanently out of scope, per the frozen plan:** `story`, `vibe`,
`esg_point`, and any other editorial prose field on a restaurant; the
"safety label translation needs verified personnel" precondition applies
doubly hard to editorial content, which was never in scope regardless.
Restaurant names and zone names are data, not UI, and are never
translated.

## Architecture

`src/i18n/index.js` initializes `i18next` with `react-i18next`'s
`initReactI18next` plugin, resources supplied inline:

```js
resources: {
  en: { translation: { /* imported from ./locales/en.js */ } },
},
lng: 'en', // no language detection needed yet -- only one language exists
fallbackLng: 'en',
```

`src/i18n/locales/en.js` is a plain nested object of English strings,
organized by the screen/module they belong to (`tabBar`, `prologue`,
`dietary`, `trust`, `journal`), imported by `src/i18n/index.js`. This
file is the thing a future session replaces/extends when a second
language actually ships — it's the one artifact whose shape this design
needs to get right, since everything else just consumes it.

**Inside React components** (`TabBar.jsx`, `Prologue.jsx`,
`JournalPanel.jsx`, `TabPanel.jsx`): `const { t } = useTranslation();`,
then `t('tabBar.map')` etc. replacing the hardcoded string.

**Inside `verification.js`, which is not a React component** (`fact()`,
`trustBadge()`, `VEGAN_LABEL`, `HALAL_LABEL` are called during render but
live in a plain data/logic module): import the `i18next` singleton
directly — `import i18next from 'i18next'; i18next.t('trust.confirmed')`
— rather than threading a `t` function through every call site as a
parameter. This is `i18next`'s standard supported pattern for non-React
code, and confirmed against the actual installed package (not assumed):
`i18next@26.3.6`'s own `index.d.ts` declares `const i18next: i18n;
export default i18next;` — the default export genuinely is a singleton
instance carrying `.t()`/`.changeLanguage()`/`.init()`, matching this
design exactly. It works correctly with re-rendering: when the active language
changes, any component that itself calls `useTranslation()` re-renders,
and if that re-render calls `trustBadge()` again, the fresh
`i18next.t()` call inside it returns the new language's string — no
extra wiring needed, because `trustBadge()` is invoked fresh on every
render, never memoized against language.

`src/main.jsx` imports `./i18n` once (for its initialization side
effect) before rendering `<App />`.

**No interaction with routing, prerendering, or the offline/PWA work
from earlier this session:** no URL segment carries language (a
`/en/place/:id` scheme is explicitly not being built this round — see
below), so `react-router`'s routes are untouched. `scripts/
prerender-places.mjs` reads `restaurants.js` directly for its `og:*`
meta and has nothing to do with UI chrome strings, so it needs no
changes. Because translation resources are bundled into the JS (not
fetched as separate files), `vite-plugin-pwa`'s precache manifest and
`globPatterns` need no changes either — there's no new asset type being
shipped, just more strings inside the same JS bundle.

## Language switcher (Profile tab)

The existing static Profile row (`{ label: 'Language', value: 'English',
icon: '🌐' }` in `TabPanel.jsx`) becomes interactive but, per the user's
decision, **presents as a single-option picker** — clicking it opens a
short list containing only "English," reflecting the actual current
state honestly rather than implying a choice that doesn't exist yet.
When a second language's strings are added to `src/i18n/locales/`, that
list grows automatically from whatever locales are registered — no
component change needed, only a new locale file plus one line
registering it in `src/i18n/index.js`.

Selecting a language calls `i18next.changeLanguage(code)` and persists
the choice to `localStorage` under `kfm-language`, read back on next load
the same way `kfm-prologue`/`kfm-bookmarks` already are.

## Error handling

None of substance — this is additive, no new failure modes. A missing
translation key falls back to `i18next`'s own behavior (renders the key
itself in dev, which is a visible, honest failure mode rather than a
blank string — acceptable for an infra-only round with one language,
where every key that's ever called necessarily exists).

## Verification plan

Per §11 rule 16 (browser verification for UI changes):

1. Gates: `check-data`, `lint`, `build`, `retrievedBy` leak check,
   `evidence-hash --check`.
2. Browser check (headless Chromium, given the Chrome extension tool's
   unreliability this session): every string in the four core screens
   still renders its correct (English) text after the `t()` swap — a
   silent typo'd key would otherwise render as a raw key string like
   `tabBar.map` instead of `Map`, which is exactly the failure mode to
   catch visually, not just by "the app didn't crash."
3. Confirm the Profile Language row opens a picker with exactly one
   entry ("English"), that selecting it is a no-op (already selected),
   and that the choice persists in `localStorage` under `kfm-language`.
4. Confirm `npm run build` output size/precache manifest are not
   meaningfully affected (no new chunks fetched over the network at
   runtime) — a quick sanity check, not a hard gate.

## Risks / things intentionally not solved here

- `verification.js` reaching for the `i18next` singleton directly (not
  via a passed-in `t`) is a deliberate coupling between a data/logic
  module and the i18n library, chosen because threading `t` as a
  parameter through `fact()`/`trustBadge()`/`dietaryBadges()` and every
  call site would be a much larger diff for the same result. Revisit if
  `verification.js` ever needs to run in a context without `i18next`
  initialized (none exists today — it's only ever imported by React
  components or Node scripts that don't call `trustBadge()`).
- The single-option language picker is a slightly unusual UI (a menu
  with nothing to actually choose) — accepted deliberately per the
  user's decision, as more honest than hiding the row entirely or than
  implying choices that don't exist.
- No RTL (right-to-left) CSS support is being added this round, even
  though a future Arabic translation (plausible given the halal-traveler
  audience) would need it. Out of scope: RTL is a layout concern for
  whichever future round actually ships a RTL language, not something to
  build blind today.
