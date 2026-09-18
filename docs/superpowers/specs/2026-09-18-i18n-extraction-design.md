# i18n extraction design — GROWTH-PLAN Stage 3, the remaining screens

**Date:** 2026-09-18 · **Decides:** how the rest of the UI becomes
translatable without breaking filtering, and what stays English
· **Base commit:** `49d9039`

## Why

Stage 3 shipped the i18n infrastructure on 2026-08-03 and deliberately
stopped at four screens to keep the first diff reviewable. HANDOFF §7 #27
recorded what remained and, more importantly, **why the rest is not
mechanical**: two groups of strings are simultaneously display text and
data identifiers, so translating them in place would silently break
behaviour rather than fail loudly.

This closes that gap. It adds **no translated content** — English stays
the only language, because the project's rule holds: a mistranslated
"Halal-friendly" is the same class of failure as an unverified halal
claim, and verified translators do not exist yet. What ships is the
structure that makes translation, when it comes, a data task instead of
an archaeology task.

## The problem, measured (2026-09-18)

- **Filter chips are identifiers.** `FilterBar.jsx`'s `CHIP_GROUPS` holds
  `'Vegan'`, `'Halal'`, `'Sustainability'`, `'Zero-waste'`, `'Local
  Sourcing'`, `'Mild Taste'`, `'Fermented'`. `App.jsx` compares those same
  strings against `DIETARY_CHIPS`, `TRAIT_GROUPS` and each restaurant's
  `r.traits`. Translate the label and every chip matches zero places —
  silently, because a filter that finds nothing looks like a filter that
  found nothing.
- **`source` / `method` are stored data that reaches the screen.** The
  values live in `restaurants.js` on every fact. Measured: **8 distinct
  `source` values and 7 distinct `method` values** in the data, and some
  are not in `verification.js`'s `SOURCE`/`METHOD` constants at all
  (`Project research`, `Neighbourhood centre placeholder`, `Venue name or
  branding`, `Traveller reports`, `Independent sources agree`). They reach
  the UI in exactly **one** place: `RestaurantDetail.jsx` renders
  `restaurant.coordinates.source`.
- **Remaining hardcoded English**, by file: `RestaurantDetail.jsx` ~19,
  `JournalPanel.jsx` ~9, `TabPanel.jsx` ~7, `BottomSheetList.jsx` ~3,
  `FilterBar.jsx` 2 + the chips, `TabBar.jsx` 1, `MapComponent.jsx` 1,
  `App.jsx` 1 (the offline banner).

## Decision: separate the label from the identifier, leave the data alone

`{ id, labelKey }` for chips; a display lookup for `source`/`method`.
Matching keeps using the id exactly as today, so **no data migration, no
evidence re-sealing, no `check-data` change**.

The alternative — renaming trait values to slugs (`vegan`,
`zero-waste`) in `restaurants.js` — was rejected: it edits 20 verified
records and their evidence trail to buy nothing the mapping does not
already buy. The English-looking identifiers are data keys that happen to
read as words; that is normal, and it is now written down rather than
implied.

## Architecture

**Chips.** `FilterBar.jsx`'s `CHIP_GROUPS` becomes
`[{ labelKey, chips: [{ id, labelKey }] }]`. The button renders
`t(chip.labelKey)` and calls `onToggleFilter(chip.id)`. `App.jsx` is
untouched in its matching logic — `selectedFilters` still holds ids.

**Source / method.** A new display map in `src/i18n/` (not in
`verification.js`, which is imported by Node scripts and must stay free of
UI concerns) maps each stored value to a key. **Unknown values fall back
to the stored string**, so a value added to the data before its label
exists shows the English it already shows today rather than a blank or a
key name — honest degradation, the same stance as `unknown` beating a
fabricated value.

**Everything else** is key extraction: each hardcoded string moves to
`src/i18n/locales/en.js` under a namespace matching its screen
(`detail.*`, `journal.*`, `discover.*`, `profile.*`, `list.*`,
`filters.*`, `map.*`, `app.*`), and the component calls `t()`.

**Not extracted, deliberately:** editorial content in `restaurants.js`,
`culture.js` and `journeys.js` (`story`, `vibe`, `esg_point`, dining tips,
journey titles). That is written content, not UI chrome; translating it is
the Stage 3 content problem, which needs the translators this spec does
not have. The Korean accents already in the UI (`· 이야기`) stay as they
are — they are typographic decoration on an English screen, and moving
them into keys would imply a Korean UI that does not exist.

## Two tests that make a silent break loud

1. **Every chip id exists in the data.** For each `id` in `CHIP_GROUPS`
   that is not a dietary chip or a group name, assert some active
   restaurant carries it in `traits`; for dietary chips, assert
   `matchesDietary` accepts the id. A renamed or mistyped id fails here
   instead of returning zero places at runtime.
2. **Every `labelKey` resolves.** Assert each key used by the chips and
   the source/method map exists in `en.js`. A key typo fails the suite
   rather than rendering the key name to a visitor.

A third, cheaper check comes free: a test asserting every distinct
`source`/`method` value in `restaurants.js` has a display entry, so adding
a new source to the data forces adding its label in the same commit.

## Verification plan

- The five gates plus `npm test`.
- **Filter parity in the browser:** for each chip, the result count before
  and after must match; the ESG lens (`Sustainability`) must still turn the
  list into the lens; two dietary chips together must still AND.
- Trust badges, the detail page's practical rows, the Journal's stamps and
  the Discover/Profile rows must read exactly as they do today — this
  change moves strings, it does not rewrite copy.
- English stays the only language offered in Profile.

## Risks

- **A missed string is invisible.** Nothing fails when a string stays
  hardcoded; it simply will not translate later. Accepted: the point is to
  remove the *structural* blocker, and a later pass can catch stragglers.
- **Key churn.** Namespaces are chosen once here; renaming them later
  touches every locale file that exists by then. Chosen to match screens,
  which are the stable unit.
