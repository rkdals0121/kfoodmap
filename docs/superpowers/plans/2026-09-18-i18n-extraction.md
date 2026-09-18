# i18n Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every remaining user-facing string in the UI goes through
`t()`, and the two string groups that double as data identifiers (filter
chips, `source`/`method`) get a display layer so translating them can
never silently break filtering — with English still the only language.

**Architecture:** `{ id, labelKey }` for chips (matching keeps using
`id`, so no data migration); a display map for `source`/`method` that
falls back to the stored string; plain key extraction everywhere else;
three tests that make a mistyped id or a missing key fail the suite
instead of the screen.

**Tech Stack:** react-i18next + i18next (existing), `node:test` (existing).
**No new dependency. No data file changes.**

**Spec:** `docs/superpowers/specs/2026-09-18-i18n-extraction-design.md`

## Global Constraints

- **No translated content.** English stays the only locale; `LANGUAGES`
  in `TabPanel.jsx` keeps its single entry. This plan changes structure,
  not copy: a string that moves into a key keeps its exact wording.
- **No data file changes** — `src/data/restaurants.js`, `culture.js`,
  `journeys.js`, `data/evidence/` are untouched. Editorial content
  (`story`, `vibe`, `esg_point`, dining tips, journey titles) is **not**
  extracted.
- `src/data/verification.js` stays free of UI-only concerns: it is
  imported by Node scripts. The `source`/`method` display map lives under
  `src/i18n/`.
- Filtering behaviour must be identical: `selectedFilters` continues to
  hold ids (`'Vegan'`, `'Zero-waste'`, …) and `App.jsx`'s matching logic
  is not rewritten.
- Gates every commit must pass: `npm run check-data` ("No violations."),
  `npm run lint` (baseline **1** warning, `src/utils.js:157`), `npm test`,
  `npm run build`, `grep -rc retrievedBy dist/` → 0,
  `grep -rliE "service_role|sb_secret_|KakaoAK" dist/ | wc -l` → 0,
  `node scripts/evidence-hash.mjs --check` → 0/0.
- Browser verification before claiming UI works (§11 rule 16), including
  **filter-count parity** for every chip.
- One feature, one commit at the end, after the user approves; push is a
  deploy and is not done until the deployment reads `success` (§11 rule 23).
  Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never read, print or stage `.env.local`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/i18n/labels.js` | create | `CHIP_GROUPS` (id + labelKey), `sourceLabel()`, `methodLabel()` with raw-value fallback |
| `scripts/tests/labels.test.mjs` | create | the three invariants |
| `src/components/FilterBar.jsx` | modify | render `t(labelKey)`, emit `id` |
| `src/components/RestaurantDetail.jsx` | modify | ~19 strings + the dead email |
| `src/components/JournalPanel.jsx` | modify | ~9 strings |
| `src/components/BottomSheetList.jsx` | modify | ~3 strings |
| `src/components/TabPanel.jsx` | modify | Discover/Profile strings |
| `src/components/TabBar.jsx`, `src/components/MapComponent.jsx`, `src/App.jsx` | modify | one aria/banner string each |
| `src/i18n/locales/en.js` | modify | every new key |
| `HANDOFF.md`, `docs/GROWTH-PLAN.md` | modify | Task 5 |

---

### Task 1: The label layer and its tests

**Files:**
- Create: `scripts/tests/labels.test.mjs`
- Create: `src/i18n/labels.js`
- Modify: `src/i18n/locales/en.js`

**Interfaces produced:**
- `CHIP_GROUPS: [{ labelKey, chips: [{ id, labelKey }] }]` — ids exactly as
  today: `Vegan`, `Halal` | `Sustainability`, `Zero-waste`, `Local Sourcing`
  | `Mild Taste`, `Fermented`; group labelKeys `filters.groupDietary`,
  `filters.groupSustainability`, `filters.groupDining`.
- `sourceLabel(value: string): string`, `methodLabel(value: string): string`
  — translated when known, the stored value verbatim when not.

- [ ] **Step 1: Write the failing tests**

Create `scripts/tests/labels.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import '../../src/i18n/index.js';
import { restaurants } from '../../src/data/restaurants.js';
import { isQuarantined, matchesDietary } from '../../src/data/verification.js';
import { CHIP_GROUPS, sourceLabel, methodLabel, SOURCE_LABEL_KEYS, METHOD_LABEL_KEYS } from '../../src/i18n/labels.js';

const active = restaurants.filter(r => !isQuarantined(r));
const DIETARY = ['Vegan', 'Halal'];
const GROUPS = ['Sustainability'];

test('every chip id is answerable by the data — a renamed id fails here, not silently at runtime', () => {
  for (const group of CHIP_GROUPS) {
    for (const chip of group.chips) {
      if (DIETARY.includes(chip.id)) {
        assert.ok(active.some(r => matchesDietary(r, chip.id)), `no active restaurant matches dietary chip ${chip.id}`);
      } else if (GROUPS.includes(chip.id)) {
        assert.ok(active.some(r => r.traits.some(t => ['Zero-waste', 'Local Sourcing'].includes(t))), `no active restaurant is on the ${chip.id} axis`);
      } else {
        assert.ok(active.some(r => r.traits.includes(chip.id)), `no active restaurant carries trait ${chip.id}`);
      }
    }
  }
});

test('every chip labelKey resolves to a real string', () => {
  for (const group of CHIP_GROUPS) {
    assert.notEqual(i18next.t(group.labelKey), group.labelKey, `missing key ${group.labelKey}`);
    for (const chip of group.chips) {
      assert.notEqual(i18next.t(chip.labelKey), chip.labelKey, `missing key ${chip.labelKey}`);
    }
  }
});

test('every source and method value in the data has a label entry', () => {
  const sources = new Set(), methods = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.source === 'string') sources.add(node.source);
    if (typeof node.method === 'string') methods.add(node.method);
    for (const value of Object.values(node)) walk(value);
  };
  restaurants.forEach(walk);
  for (const value of sources) assert.ok(SOURCE_LABEL_KEYS[value], `source without a label: ${value}`);
  for (const value of methods) assert.ok(METHOD_LABEL_KEYS[value], `method without a label: ${value}`);
});

test('an unmapped source or method degrades to the stored text, never to a key name', () => {
  assert.equal(sourceLabel('A source nobody mapped yet'), 'A source nobody mapped yet');
  assert.equal(methodLabel('A method nobody mapped yet'), 'A method nobody mapped yet');
  assert.equal(sourceLabel(undefined), '');
  assert.equal(methodLabel(null), '');
});
```

- [ ] **Step 2: Run, confirm the failure**

Run: `npm test` → `Cannot find module '…/src/i18n/labels.js'`; the 42 existing tests still pass.

- [ ] **Step 3: Implement `src/i18n/labels.js`**

The eight source values and seven method values currently in the data —
copy them **exactly**, including the curly apostrophe in "Read from the
operator’s own website":

```js
// Display labels for strings that are also data identifiers.
//
// Filter chips are compared against r.traits (App.jsx), and source/method
// are stored on every fact in restaurants.js. Translating those values in
// place would silently match nothing, so the id stays and only the label
// moves. Lives here rather than in verification.js, which Node scripts
// import and which must stay free of UI concerns.
import i18next from 'i18next';

export const CHIP_GROUPS = [
  {
    labelKey: 'filters.groupDietary',
    chips: [
      { id: 'Vegan', labelKey: 'filters.vegan' },
      { id: 'Halal', labelKey: 'filters.halal' },
    ],
  },
  {
    labelKey: 'filters.groupSustainability',
    chips: [
      { id: 'Sustainability', labelKey: 'filters.sustainability' },
      { id: 'Zero-waste', labelKey: 'filters.zeroWaste' },
      { id: 'Local Sourcing', labelKey: 'filters.localSourcing' },
    ],
  },
  {
    labelKey: 'filters.groupDining',
    chips: [
      { id: 'Mild Taste', labelKey: 'filters.mildTaste' },
      { id: 'Fermented', labelKey: 'filters.fermented' },
    ],
  },
];

// Keyed by the value as stored in restaurants.js. A value with no entry
// falls back to itself (see sourceLabel), so data added before its label
// shows the English it already showed rather than a blank or a key name.
export const SOURCE_LABEL_KEYS = {
  'Naver Place / Kakao Map': 'provenance.sourceMaps',
  'Restaurant directory listing': 'provenance.sourceDirectory',
  'Project research': 'provenance.sourceResearch',
  'The restaurant': 'provenance.sourceOperator',
  'Government tourism site': 'provenance.sourceGovernment',
  'Neighbourhood centre placeholder': 'provenance.sourcePlaceholder',
  'Venue name or branding': 'provenance.sourceBranding',
  'Traveller reports': 'provenance.sourceTravellers',
};

export const METHOD_LABEL_KEYS = {
  'Naver Place and Kakao Map agree': 'provenance.methodMapCrosscheck',
  'Map service lookup': 'provenance.methodMapLookup',
  'Map service routing API': 'provenance.methodRouting',
  'Read from the operator’s own website': 'provenance.methodOperatorSite',
  'Read from a government listing': 'provenance.methodGovListing',
  'Independent sources agree': 'provenance.methodIndependent',
  'Read from a directory listing': 'provenance.methodDirectory',
};

const labelFor = (map) => (value) => {
  if (typeof value !== 'string' || value === '') return '';
  const key = map[value];
  return key ? i18next.t(key) : value;
};

export const sourceLabel = labelFor(SOURCE_LABEL_KEYS);
export const methodLabel = labelFor(METHOD_LABEL_KEYS);
```

- [ ] **Step 4: Add the keys to `src/i18n/locales/en.js`**

Two new top-level blocks, wording copied exactly from what the screen
shows today:

```js
  filters: {
    groupDietary: 'Dietary filters',
    groupSustainability: 'Sustainability filters',
    groupDining: 'Dining filters',
    vegan: 'Vegan',
    halal: 'Halal',
    sustainability: 'Sustainability',
    zeroWaste: 'Zero-waste',
    localSourcing: 'Local Sourcing',
    mildTaste: 'Mild Taste',
    fermented: 'Fermented',
    searchPlaceholder: 'Search restaurants or neighborhoods',
  },
  provenance: {
    sourceMaps: 'Naver Place / Kakao Map',
    sourceDirectory: 'Restaurant directory listing',
    sourceResearch: 'Project research',
    sourceOperator: 'The restaurant',
    sourceGovernment: 'Government tourism site',
    sourcePlaceholder: 'Neighbourhood centre placeholder',
    sourceBranding: 'Venue name or branding',
    sourceTravellers: 'Traveller reports',
    methodMapCrosscheck: 'Naver Place and Kakao Map agree',
    methodMapLookup: 'Map service lookup',
    methodRouting: 'Map service routing API',
    methodOperatorSite: 'Read from the operator’s own website',
    methodGovListing: 'Read from a government listing',
    methodIndependent: 'Independent sources agree',
    methodDirectory: 'Read from a directory listing',
  },
```

- [ ] **Step 5: Green, then lint** — `npm test` (42 + 4 pass), `npm run lint` (1 warning).

---

### Task 2: FilterBar uses the label layer

**Files:** `src/components/FilterBar.jsx`

- [ ] **Step 1: Rewrite the chip rendering**

Import `useTranslation` and `CHIP_GROUPS` from `../i18n/labels`; delete the
local `CHIP_GROUPS`. The group wrapper's `aria-label` becomes
`t(group.labelKey)` and its `key` becomes `group.labelKey`; each button's
`key` is `chip.id`, its text `t(chip.labelKey)`, and its handler
`onToggleFilter(chip.id)`. `isActive` stays `selectedFilters.includes(chip.id)`.
The search input's `placeholder` and `aria-label` become
`t('filters.searchPlaceholder')`.

- [ ] **Step 2: Verify the ids did not change**

```bash
node --input-type=module -e "
import { CHIP_GROUPS } from './src/i18n/labels.js';
console.log(JSON.stringify(CHIP_GROUPS.flatMap(g => g.chips.map(c => c.id))));
"
```

Expected exactly: `["Vegan","Halal","Sustainability","Zero-waste","Local Sourcing","Mild Taste","Fermented"]` — the same strings `App.jsx` matches on.

- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build`.

---

### Task 3: RestaurantDetail — the largest screen, and one dead address

**Files:** `src/components/RestaurantDetail.jsx`, `src/i18n/locales/en.js`

**Interfaces consumed:** `sourceLabel`, `methodLabel` from `../i18n/labels`.

- [ ] **Step 1: Extract every hardcoded string** under a `detail.*`
namespace, keeping wording identical. At minimum (line numbers from the
current file): `aria-label="Close"` (160), `aria-label="Dietary and dining
facts"` (180), `"Signature Menu"` (198), the unverified-dishes note (208),
`"Opening hours unknown — check before you go"` (224), `"Website"` (253),
`"Instagram"` (256), `"Why it's special"` (291), `"The Food Story"` (296),
`"Did you know?"` (309), `"Location & Directions"` (316), `"Dining Tips"`
(349), `"About this information"` (362), the Official/Reported/Inferred
explanation (364-366), the `<dt>` labels `Location`/`Dietary`/`Last
checked` (371, 378, 386), and the Copy/Copied and share button labels if
still hardcoded. The `kr="이야기"` decoration stays as-is.

- [ ] **Step 2: Route the stored provenance values through the label layer**

Line ~373 renders `restaurant.coordinates.source` raw. Wrap it:
`{sourceLabel(restaurant.coordinates.source)}`. Do the same for any
`method` rendered nearby. Nothing else about that block changes.

- [ ] **Step 3: Fix the dead email (a correctness fix, not a translation)**

Line ~396 reads: `To suggest an edit, email hello@kfoodmap.com`. **That
mailbox does not exist** — it was never registered; the project's real
contact is `PRIVACY_CONTACT` and the app now has its own report flow.
Replace the sentence with one that points at the report form already
linked in this same screen (the "Report incorrect info" link), e.g.
`detail.suggestEdit: 'Something wrong? Use “Report incorrect info” above.'`
Do **not** invent a new address, and do not put the privacy contact here —
that address is for privacy requests, and the report form is the path this
project actually reads.

- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build`, and
  `git diff src/components/RestaurantDetail.jsx | grep -c "^-.*hello@kfoodmap"` → `1`.

---

### Task 4: The remaining screens

**Files:** `src/components/JournalPanel.jsx`, `src/components/BottomSheetList.jsx`,
`src/components/TabPanel.jsx`, `src/components/TabBar.jsx`,
`src/components/MapComponent.jsx`, `src/App.jsx`, `src/i18n/locales/en.js`

This is one batched task: the same mechanical change in six files.

- [ ] **Step 1: JournalPanel** (`journal.*`): `aria-label="Journal"`,
  `"Your Food Passport"`, the three stat labels `Visited`/`Saved`/`Areas`,
  `"Badges"`, `"Visited Places"`, `"Saved for Later"`, `"Your passport is
  empty"`. Keys that already exist (`journal.firstTaste`, `plantBased`,
  `sample`, the three empty-state steps) are reused, not duplicated.

- [ ] **Step 2: BottomSheetList** (`list.*`): `"Nearest first"`, `"No
  places match"`, `"Try removing a filter or searching a different name or
  area."` The ESG caveat line, if hardcoded, moves too.

- [ ] **Step 3: TabPanel** (`discover.*`, `profile.*`): the Discover
  headers `"Food Journeys"`, `"Themed half-days through already-verified
  restaurants."`, `"Culture Hub"`, `"Explore the history and traditions
  behind Korean food."`, `"Read Story"`; the Profile header `"Settings"`,
  `"Manage your preferences and app settings."` and the settings rows
  `"Food Preferences"`, `"Dietary Preferences"`, `"Saved Places"`, `"About
  K-Food Map"`, and their values `"Not set"`, `"View Journal"`, `"v1.0"`.
  **Journey titles and descriptions from `journeys.js` are editorial — do
  not extract them.**

- [ ] **Step 4: The three one-liners** — `TabBar.jsx`'s
  `aria-label="Primary"` (`app.primaryNav`), `App.jsx`'s
  `aria-label="Restaurant list"` (`app.restaurantList`) and the offline
  banner `"Offline — showing saved data"` (`app.offline`).
  `MapComponent.jsx`'s tile `attribution` is legally required credit
  markup, not UI copy — **leave it**, and say so in a one-line comment.

- [ ] **Step 5:** `npm test`, `npm run lint`, `npm run build`, then
  `grep -rnE ">[A-Z][a-z][^<>{}]{3,}<" src/components/*.jsx src/App.jsx | grep -v "t(" | wc -l` and record the remaining count in the report — a straggler list, not a failure.

---

### Task 5: Gates, browser parity, documentation, one commit

- [ ] **Step 1: All gates** — the seven from Global Constraints.

- [ ] **Step 2: Filter parity in the browser (§11 rule 16).** With the dev
  server running, for each of the seven chips: record
  `document.querySelectorAll('.place-card').length` before this change
  (from `git stash`/`master` if needed) and after; they must match. Then
  confirm: `Sustainability` still turns the list into the ESG lens;
  `Vegan` + `Halal` together still AND; clearing all chips restores the
  full list; the trust badges, the detail page's provenance block, the
  Journal and the Discover/Profile rows read exactly as before.

- [ ] **Step 3: Documentation** — `HANDOFF.md`: §2.1 "i18n" gains what
  this change did and the `{ id, labelKey }` rule (with the reason:
  translating an identifier matches nothing *silently*); §7 #27 updated —
  the extraction half is done, the **content** half is still blocked on
  verified translators; a note that `hello@kfoodmap.com` was a dead
  address now removed. Header date/base commit re-measured.
  `docs/GROWTH-PLAN.md`: Stage 3's "나머지 화면 문자열 추출" ⬜ → ✅ with
  one line, gate list test count re-measured, and the remaining ⬜ stays
  honest: 번역 콘텐츠 0.

- [ ] **Step 4: Report and ask for approval — do not commit yet.**
  Include the straggler count from Task 4 Step 5, the filter parity
  numbers, and the proposed commit message.

- [ ] **Step 5: Commit and push after approval**, then confirm the
  deployment reads `success` and spot-check the live site: filters still
  return places, the detail page still shows its provenance block, and the
  dead email is gone.
