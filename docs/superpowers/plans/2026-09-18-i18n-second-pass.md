# i18n Second Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two things the first extraction pass deliberately left:
the provenance paragraph that a translator cannot reorder because it is six
sentence fragments, and the ~12 named strings the line-based grep could not
see (interpolated copy, attribute text, and two hardcoded `en-GB` date
formats).

**Architecture:** `<Trans>` from the already-installed `react-i18next` for
the one paragraph that carries inline `<strong>`; ordinary keys with
interpolation for the rest; i18next plural keys for the one count; a single
date formatter that follows the active language instead of a literal
`'en-GB'`.

**Tech Stack:** react-i18next 17 (`Trans` confirmed exported), i18next,
`node:test`. **No new dependency. No data changes. English stays the only
language.**

**Spec:** `docs/superpowers/specs/2026-09-18-i18n-extraction-design.md`
(this pass closes that spec's two recorded follow-ups; HANDOFF §7 #27
carries the straggler list)

## Global Constraints

- **Rendered English must stay byte-identical.** Every string here is
  already on screen; this changes how it is assembled, never what it says.
  Where whitespace is load-bearing (the provenance paragraph's `<strong> Reported</strong>`
  leading space), reproduce it exactly.
- No data file changes; no new dependency; `src/data/verification.js` stays
  UI-free; `selectedFilters` keeps holding untranslated ids.
- Gates: `npm run check-data` ("No violations."), `npm run lint` (baseline
  **1** warning, `src/utils.js:157`), `npm test`, `npm run build`,
  `grep -rc retrievedBy dist/` → 0,
  `grep -rliE "service_role|sb_secret_|KakaoAK" dist/ | wc -l` → 0,
  `node scripts/evidence-hash.mjs --check` → 0/0.
- **Watch the all-keys-resolve test** in `scripts/tests/labels.test.mjs`: it
  asserts `i18next.t(key) !== key` for every static `t('…')`. A plural key
  has no bare form, so calling it without `count` returns the key and the
  scan fails. Whatever you add must leave that test green — adapt the scan
  (pass `{ count: 1 }`) rather than skipping the key.
- Browser verification before claiming it works (§11 rule 16).
- One commit at the end, after the user approves. Trailer:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The provenance paragraph becomes translatable sentences

**Files:** `src/components/RestaurantDetail.jsx`, `src/i18n/locales/en.js`

Today (`RestaurantDetail.jsx:372-375`) the paragraph is assembled from six
fragment keys — `detail.provenanceOfficial` + `detail.officialMeans` +
`detail.provenanceReported` + `detail.reportedMeans` +
`detail.provenanceInferred` + `detail.inferredMeans`. A translator cannot
move the bolded word, change clause order, or re-punctuate, which is
exactly what most languages need.

- [ ] **Step 1: Replace with `<Trans>` over whole sentences.**

Import `Trans` from `react-i18next`. Use **three** keys, one per sentence,
each carrying its own emphasis markup — e.g.

```js
    provenanceOfficialSentence: '<0>Official</0> means we checked it against a map service or registry;',
    provenanceReportedSentence: '<0>Reported</0> means a source states it;',
    provenanceInferredSentence: '<0>Inferred</0> means we read it from context. Hours, prices and dietary details change — treat this as a starting point.',
```

rendered as `<Trans i18nKey="detail.provenanceOfficialSentence" components={[<strong key="0" />]} />`,
with the same spacing between sentences the current JSX produces.

**The output must be byte-identical.** Before you change anything, capture
the current rendered text (e.g. a small Node script that renders nothing —
instead read the JSX and write down the exact expected string, including
the space inside `<strong> Reported</strong>`), then compare after. State
both strings in your report.

- [ ] **Step 2: Delete the six now-unused fragment keys** from `en.js`, and
  confirm nothing else references them (`grep -rn "officialMeans\|reportedMeans\|inferredMeans\|provenanceOfficial\|provenanceReported\|provenanceInferred" src`).

- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build`.

---

### Task 2: The remaining hardcoded strings

**Files:** `src/components/RestaurantDetail.jsx`, `src/components/JournalPanel.jsx`,
`src/components/BottomSheetList.jsx`, `src/App.jsx`, `src/i18n/locales/en.js`,
`scripts/tests/labels.test.mjs` (only if the plural key needs the scan adapted)

- [ ] **Step 1: Interpolated copy**
  - `BottomSheetList.jsx:115` — `{sorted.length} {sorted.length === 1 ? 'place' : 'places'}` → an i18next plural key (`list.placeCount_one` / `list.placeCount_other`, called as `t('list.placeCount', { count: sorted.length })`). English output stays `1 place` / `18 places`.
  - `JournalPanel.jsx:75` — `{earnedCount} Earned` → `t('journal.badgesEarned', { count: earnedCount })`.
  - `RestaurantDetail.jsx:230` — `(today {today})` → a key with `{{hours}}`.
  - `RestaurantDetail.jsx:242-243` — `, exit {exit}` and `· {n} min walk` → keys with `{{exit}}` / `{{minutes}}`. Keep the separators and spacing exactly.
  - `RestaurantDetail.jsx:212` — `Price not listed`; `:332` — ` — area only`; `:381` — ` · address is area-level`; `:401` — `Last verified: {date}` (interpolate the date).

- [ ] **Step 2: Attribute text**
  - `RestaurantDetail.jsx:418` — `alt="Gallery item"`.
  - Name-interpolated aria-labels: `BottomSheetList.jsx:70` (`Read the story of {name}`), `:87` (`Get directions to {name}`), `RestaurantDetail.jsx:289` (`Share {name}`), plus the bookmark/visited labels in both files — find them with
    `grep -rn "aria-label" src/components/*.jsx src/App.jsx | grep -v "t("`.
  - `App.jsx` — the sidebar toggle's `Expand sidebar` / `Collapse sidebar`.

- [ ] **Step 3: Dates follow the language**

  `JournalPanel.jsx:8` and `RestaurantDetail.jsx:401` hardcode `'en-GB'`.
  Replace with the active language (`i18next.language`, or `useTranslation`'s
  `i18n.language`) and keep the same option objects, so English output is
  unchanged today and a future locale formats its own way. If you add a
  shared helper, put it in `src/utils.js` beside the other formatters, not
  in `src/data/`.

- [ ] **Step 4: Keep the all-keys scan green.** If a plural key breaks it,
  adapt the scan in `scripts/tests/labels.test.mjs` to call `t(key, { count: 1 })`
  — do not add an exclusion list.

- [ ] **Step 5:** `npm test`, `npm run lint`, `npm run build`, then re-run the
  straggler sweep and report what is left:
  ```bash
  grep -rnE ">[A-Z][a-z][^<>{}]{3,}<|aria-label=\"[A-Z]|aria-label=\{`|alt=\"[A-Z]|'[A-Z][a-z]+ [a-z]" src/components/*.jsx src/App.jsx | grep -v "t("
  ```

---

### Task 3: Browser check, docs, one commit

- [ ] **Step 1: Browser (§11 rule 16).** Detail page: the provenance
  paragraph reads exactly as before (bold words, spacing, punctuation);
  hours, transit, price, area-only and last-verified lines unchanged; the
  Journal's badge count and the list's "N places" heading unchanged
  (check both 1 and many). No key names on screen, no console errors.
- [ ] **Step 2: All gates.**
- [ ] **Step 3: Docs.** HANDOFF §2.1 i18n: the provenance paragraph is now
  whole sentences via `<Trans>`; dates follow the active language; the
  straggler list in §7 #27 shrinks to what genuinely remains (update it,
  don't delete it). Re-measure the test count. GROWTH-PLAN Stage 3: one
  line that the extraction is now complete, 번역 콘텐츠는 여전히 0.
- [ ] **Step 4: Report and ask for approval — do not commit yet.**
- [ ] **Step 5: After approval:** commit, push, confirm the deployment reads
  `success`, and spot-check the live detail page's provenance paragraph.
