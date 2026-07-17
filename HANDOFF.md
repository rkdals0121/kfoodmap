# K-Food Map — Engineering Handoff

**Status:** working prototype, production-grade data architecture, incomplete data.
**Last updated:** 2026-07-17 · **HEAD:** `10b2374` **+ uncommitted changes**
(Lifecycle MVP, §2.14) · **Places:** 20 (19 active, 1 quarantined)

This document is the canonical handoff. It should be enough to continue work
without reading any prior conversation. Where it states a number, that number
was measured from the repository at the commit above **plus the working
tree**, not remembered. The working tree currently differs from `HEAD` —
`git status` shows five modified files, no commit — see §2.14 and §7 High #5
before assuming this document describes committed code.

---

## 1. Project Overview

### What this is

A map-first web app that helps foreign visitors find Korean restaurants matching
their dietary needs (vegan, halal, mild, fermented, zero-waste, local sourcing)
and — the part that matters — understand the food culture behind them.

It is part of a **digital public diplomacy** initiative. That single fact drives
every architectural decision in this repo. A restaurant finder that is wrong is
annoying. A state-adjacent cultural project that tells a Muslim traveller a
restaurant is halal when nobody checked, or presents a contested commercial
claim as national heritage, is a different category of failure. **Restaurant
discovery is the entry point; cultural storytelling is the product.**

### Target users

First-time international visitors to Seoul and Incheon, typically with a
dietary constraint (religious or ethical) and no Korean. Secondary: anyone
curious about Korean food culture.

### Design philosophy

- **95% modern global UI, 5% Korean identity.** The interface should be
  instantly familiar (Google/Apple Maps, Airbnb, Notion). Korean identity comes
  from *content* — food stories, cultural explanations, the passport journal,
  a few bilingual labels — not from paper textures or ornamental typography.
- **Honest over complete.** `unknown` always beats a plausible guess.
- **The map is the hero**, but never the whole screen: the first view is
  search → filters → map (~46vh) → restaurant list, all without interaction.

### Core user journey

```
Discover (map + filters + list)  →  Restaurant Detail  →  Journal
```

The detail page is deliberately a reading journey:

```
hero → quick facts ("can I eat here?") → practical (directions/hours/address)
     → menu → why it's special (hook) → food story + "did you know?"
     → sustainability → dining tips → provenance footer
```

### Maturity

| Layer | State |
|---|---|
| UI / UX | **Done.** Five approved steps; responsive mobile/tablet/desktop; AA contrast; no known regressions. |
| Trust & evidence architecture | **Done.** Production-grade, validated, documented. |
| Lifecycle (existence/publication state) | **MVP, uncommitted.** `ACTIVE`/`QUARANTINE` implemented and enforced by `check-data`; `ARCHIVED`/`DELETED` are named only, no logic. See §2.14. |
| Data | **Partly verified.** 20 places (19 active, 1 quarantined); 10 have ≥1 confirmed field; 10 have zero — one of those ten (`akiya`) is quarantined rather than pending verification. (No single "% verified" figure is meaningful here — see §8 for the field-level breakdown.) |
| Evidence migration | **1 of 20** restaurants migrated (demonstration only). |
| Content (stories) | **Draft quality.** Marketing tone in 13/20; one story corrected so far. |

The gap between "architecture done" and "data done" is the whole point of the
current phase. **Do not add features. Fill the data.**

---

## 2. Current Architecture

### 2.1 Stack

React 19 + Vite 7 + react-leaflet 5 + Leaflet 1.9. No backend, no router, no
state library. State is `useState` in `src/App.jsx`. Bookmarks persist to
`localStorage` under `kfm-bookmarks`. Lint is `oxlint`.

**Why no backend:** it was a hard constraint from the outset, and it has been
load-bearing rather than limiting. Everything — verification, evidence,
validation — happens at authoring time in Node and ships as static data.

### 2.2 Restaurant data model — `src/data/restaurants.js` (928 lines)

One flat array of 20 objects. Fields split into three groups:

```js
{
  // identity — plain values
  id, name, zone, category, image, photo, coverImage, gallery, traits,

  // facts — value + provenance (see 2.3)
  coordinates, address, hours, menus, phone, officialUrl, instagram, transit,
  dietary: { vegan, halal, halalCertClaim? },

  // editorial — prose, sourced via storyRefs
  vibe, story, esg_point, storyRefs?,

  // research metadata, never rendered
  imageLeads?,
}
```

`photo` / `coverImage` / `gallery` are the **image contract**: all null today.
`PlaceImage` renders real photography when present and a designed illustration
placeholder otherwise, so shipping photos later is a data change, not a code
change.

`traits` holds non-safety descriptors (`Mild Taste`, `Fermented`, `Zero-waste`,
`Local Sourcing`). Dietary is deliberately **not** a trait — see 2.5.

### 2.3 Fact system — `src/data/verification.js` (278 lines)

Every field a user might act on is wrapped:

```js
fact(value, {
  confidence,     // how far we trust it
  source,         // where it came from
  url, method,    // how to repeat the check (pre-evidence-layer records)
  lastCheckedAt,  // when
  evidence,       // one-line summary for the UI badge tooltip
  evidenceRefs,   // pins into the evidence layer (post-migration)
  precision,      // address only: 'street' | 'area'
})
```

`fact()` enforces one invariant: **an unknown fact carries no value, and a
valueless fact is unknown.** The two can never disagree, because the constructor
normalises them. This is why no UI code ever needs a `value != null &&
confidence !== 'unknown'` dance.

Helpers: `isKnown`, `isConfirmed`, `needsCheck`, `trustBadge`,
`dietaryBadges`, `dietaryConfidence`, `matchesDietary`, `validateDietary`.

### 2.4 Confidence model — the two axes

The single most important design decision in the repo. **Confidence and source
are orthogonal and stay orthogonal.**

```js
CONFIDENCE = { CONFIRMED, SUPPORTED, INFERRED, UNKNOWN }
SOURCE = { OFFICIAL, OPERATOR, GOVERNMENT, MAP_SERVICE, DIRECTORY,
           COMMUNITY, RESEARCH, SELF_DECLARED, GEOCODER, AREA_FALLBACK }
METHOD = { OPERATOR_SITE, GOV_LISTING, MAP_LOOKUP, MAP_CROSSCHECK,
           ROUTING_API, DIRECTORY_LISTING, CORROBORATED }
```

- **`confirmed`** — checked against a primary source: a registry, the operator,
  or an on-site visit. Requires `lastCheckedAt`, a `method` (inline or via
  evidence), and `evidence`.
- **`supported`** — a source states it outright; nobody has checked it.
- **`inferred`** — our reading of context (a category, a venue's own branding).
  The reasoning goes in `evidence`.
- **`unknown`** — never rendered as fact.

**Why not one flattened enum** (`Official / Community / Estimated / Unknown`,
which was proposed and rejected): it collapses two different questions. You
could not then express "community-reported **and** we confirmed it" or
"official **but** three years stale". `trustBadge()` collapses the pair into one
word for the reader — model expressiveness and screen simplicity are not a
trade-off.

`trustBadge(fact)` → `Official` · `Community-checked` · `Confirmed` ·
`Reported` · `Inferred` · `Unknown`, each with a `tone` for styling.

`dietaryConfidence(place)` returns the **weakest** known dietary level, because
that is the one a traveller would be most surprised by. The detail page's caveat
keys off it.

### 2.5 Dietary model — safety-critical, so structured

```js
VEGAN = { FULL, OPTIONS, NONE, UNKNOWN }
HALAL = { CERTIFIED, FRIENDLY, PORK_FREE, NONE, UNKNOWN }
```

Rules enforced by `validateDietary()` and `check-data`:

- **`HALAL.CERTIFIED` requires `CONFIRMED` confidence *and* a `cert` reference.**
  It may never be derived from a venue's name, its menu, or a vegan claim.
  Currently **0 places are certified** — including EID, where Seoul's own
  tourism site states KMF certification. See §9.
- **Halal may only be `INFERRED` from `SELF_DECLARED`** (the venue's own name),
  never from a category or another dietary field.
- A claimed-but-unsighted certificate lives in `dietary.halalCertClaim` and the
  UI prints it *as a claim*.
- `PORK_FREE` exists but is unused: deriving it from `VEGAN.FULL` would chain an
  inference onto an unconfirmed value.

`matchesDietary()` is the only path a dietary filter chip may match, and
`unknown` never matches — a filter must never send someone somewhere we cannot
vouch for. Badges print the exact level, so "Vegan options" never reads as
"Fully vegan". That distinction is the fix for the original defect (§6, P0).

### 2.6 Source model — `data/evidence/sources.json`

A source is the *publisher*, reusable across evidence records:

```jsonc
"src-itour-incheon": {
  "id", "name", "kind": "government", "tier": 2, "homepage", "note"
}
```

`kind` ∈ operator | government | map | sns | directory | press | reference.
`tier` mirrors the project's agreed priority (operator 1 → government 2 → map 3
→ sns 4 → directory 5 → press/reference 6). **Tier decides whose word wins when
sources disagree. It does not decide how confident a fact may be** — that
ceiling lives on the evidence version (§2.7), because the same source can be
read well or badly.

### 2.7 Evidence Layer — `src/data/evidence.js` + `data/evidence/*.json`

```
Restaurant → Fact → EvidenceRef → EvidenceRecord → EvidenceVersion → Source
```

An **EvidenceRecord** is one retrievable thing (a page). It has `id`,
`sourceId`, `title`, `url`, and an ordered array of **versions**:

```jsonc
{
  "version": 1,
  "method": "GOV_LISTING",
  "confidence": "supported",   // ← a CEILING, see below
  "status": "active",
  "capturedAt": "2026-07-17",
  "checkedAt": "2026-07-17",
  "retrievedBy": "claude-opus-4-8",
  "excerpt": "…what the page actually said…",
  "license": { "type": "unknown", "commercialUse": null, "note": "…" },
  "notes": "…",
  "supersedes": null,
  "hash": "ea0e4dd587ff9034"
}
```

**`confidence` on a version is a ceiling, not a second opinion.** It is the
strongest a fact may claim on *this evidence alone*:

| Retrieval | Ceiling |
|---|---|
| operator's own site | `confirmed` |
| single map lookup | `supported` |
| same lookup cross-checked against the other map service | `confirmed` |
| government tourism listing | `supported` (authoritative but curated, goes stale) |
| directory | `supported` |

`check-data` enforces `fact.confidence ≤ max(ceiling of its refs)`. **This is
how the source-priority order became a machine rule instead of a habit.**

`status` ∈ active | superseded | partial | unreachable | disputed. Only the
newest version may be `active`.

### 2.8 Version pinning

A fact pins the version it was established from:

```js
evidenceRefs: [evidenceRef("ev-gonghwachun-kakao-map", 1, "independent corroboration")]
```

When someone later appends v2 (the restaurant changed its hours),
`check-data` reports:

> `gonghwachun.hours: pins ev-gonghwachun-itour@1 while v2 exists — re-verify,
> then move the pin (this is a warning by design, not a silent re-point)`

**The warning is the feature.** A fact must never inherit a newer claim nobody
re-checked. Pinning makes "this fact is behind its evidence" visible instead of
silent.

### 2.9 Immutability — SHA-256 sealing

`hash` is a SHA-256 (truncated to 16 hex chars) over a canonical JSON encoding
of exactly these frozen fields:

```
version, method, confidence, capturedAt, checkedAt, retrievedBy,
excerpt, license, supersedes
```

`status` sits **outside** the hash, so superseding a version never requires
rewriting it. Edit any frozen field in place and `check-data` fails with both
hashes. Canonicalisation sorts object keys recursively, so key order cannot
change a hash.

- `node scripts/evidence-hash.mjs` — seals anything unsealed or `PLACEHOLDER`
- `--check` — reports drift without writing
- `--reseal <id>@<version>` — the loud escape hatch for a **bad seal**, not for
  recording change. To record change, append a version.

### 2.10 Story references

Editorial prose carries `storyRefs` at the restaurant level, not on a fact:

```js
storyRefs: [
  evidenceRef("ev-gonghwachun-sportsseoul-trademark", 1, "1905 founding, 1983 closure, 2002 trademark…"),
  evidenceRef("ev-jajangmyeon-museum-heritage", 1, "the old building is the museum, and is registered heritage"),
]
```

**Why prose gets its own refs:** editorial is where an unsourced claim does the
most damage. The Gonghwachun story asserted a lineage the venue does not have,
and no fact-level validation would ever have caught it, because it was not a
fact — it was a paragraph. Currently only `gonghwachun` has `storyRefs`.

### 2.11 Verification pipeline (human/agent process, not code)

Source priority when gathering: **operator site → government/tourism →
official map listings → operator SNS → trusted directory.**

1. Naver Place (official API) → address, road address, coordinates
   (`mapx`/`mapy` are lat/lng ×10⁷), website link, sometimes phone.
2. Kakao Map (official API) → cross-check address; walking routes give
   station + line + distance + duration. **The routing API does not return exit
   numbers** — only Gonghwachun has one, from corroborating write-ups.
3. Operator website (best source; `WebFetch`).
4. Government tourism (visitseoul.net, itour.incheon.go.kr).
5. DiningCode (fetchable, has per-day hours/break/last-order).
6. Naver web search (`search_webkr`) as the discovery layer.

**If sources disagree, the field stays `unknown`.** Never average. Never pick
the convenient one. (Applied: `maji` hours.)

### 2.12 `check-data` — `npm run check-data`

The QA gate. Exits non-zero on any violation. Two halves:

**Fact-level** (`scripts/check-data.mjs`, 118 lines)
- the `fact()` invariant (unknown ⟷ valueless)
- known facts must name a source
- `CONFIRMED` needs `lastCheckedAt`, `evidence`, and a method (inline **or** via
  evidence refs — both shapes valid during migration)
- `hours` must be `{ raw, weekly }` with `raw` preserved; `weekly` days must be
  valid keys, slots `HH:MM`
- `transit` needs station, line, walkingMinutes
- `validateDietary()` rules
- badges never render from unknown facts
- image leads: `reusable` needs a named licence and a settled `commercialUse`;
  **a lead may never coexist with a shipped file** in photo/coverImage/gallery

**Evidence-level** (`scripts/lib/check-evidence.mjs`, 180 lines) — ten rules,
each proven to fire against a deliberately mutated copy of the store:

| Rule | Fails when |
|---|---|
| duplicate ids | same id in two files |
| broken references | fact pins a nonexistent id/version |
| orphan evidence | a record no fact cites |
| invalid version chains | numbers skip, `supersedes` wrong, old version still `active` |
| impossible timestamps | not `YYYY-MM-DD`, future, `capturedAt > checkedAt`, or captured before the version it supersedes |
| missing URLs | no `url` / `title` / `sourceId` |
| unsupported methods | `method` outside the seven |
| immutable violations | sealed version's frozen fields changed |
| over-claiming | `fact.confidence` > evidence ceiling |
| stale pins | newer version exists than the fact was verified against |

**Dates compare against today in Seoul** (`Intl.DateTimeFormat` with
`Asia/Seoul`). Every date in this dataset is a Korean calendar date; a UTC
"today" called this morning's work "the future" for nine hours a day. That was a
real bug the rule caught on itself.

### 2.13 Build

`vite build` → `dist/`. Bundle ≈ 430 kB JS / 33 kB CSS (≈ 129 / 10.6 kB gzip).

**Evidence records are not in the bundle.** Verified by grepping the build:
`retrievedBy`, `capturedAt`, `supersedes` appear **0** times; only the small ref
id strings ship. Confirm after any change:

```bash
npm run build && grep -c retrievedBy dist/assets/*.js   # must be 0
```

### 2.14 Restaurant lifecycle — ACTIVE / QUARANTINE (MVP, **uncommitted**)

A restaurant record's existence/publication state, kept separate from
field-level `CONFIDENCE` (§2.4). A record can have well-sourced facts and
still need excluding from the live app if its existence *as an entity* is
itself in doubt — `CONFIDENCE` has no vocabulary for that question, and
conflating the two would mean either blocking a well-verified place because
one field is shaky, or shipping an entity nobody can find.

**Why this is an extension, not new architecture.** This was proposed after
the project's architecture froze at the Evidence Layer (`b13b084`), so it is
held to the same test every decision in §5 is: does it add a new
verification mechanism, a new layer, or a new pattern? No on all three —
`lifecycle.determination` is a `fact()`, accepted by the identical
`hasEvidence()` / inline-`method`-and-`evidence` dual path `check-data`
already applies to `CONFIRMED` facts (§2.12); no new axis was added
alongside `CONFIDENCE`/`SOURCE` — `LIFECYCLE` is an orthogonal, optional
field, not a competing confidence model; and it defaults to absent →
`ACTIVE`, so no existing record needed a migration. What's new is a name for
a question ("does this entity exist") the schema had no field for — added
vocabulary on an existing primitive, not a new one. This paragraph, §5's
decision entry, and DATA.md's Lifecycle section are this feature's design
record; no separate ADR was judged necessary, consistent with how every
other decision in this document is tracked.

```js
LIFECYCLE = { ACTIVE, QUARANTINE, ARCHIVED, DELETED }
isQuarantined(restaurant)   // false whenever restaurant.lifecycle is absent
```

Only `ACTIVE` and `QUARANTINE` carry logic. `ARCHIVED` and `DELETED` are
named in `src/data/verification.js` for vocabulary continuity — so the next
restaurant that needs them doesn't invent a fifth status — but have no
transition logic and no UI treatment; both are marked `TODO(lifecycle)` in
the source. Backward compatible by construction: `isQuarantined()` reads
`restaurant?.lifecycle?.status`, so the 19 restaurants with no `lifecycle`
key are unaffected and need no migration.

**Why QUARANTINE and not DELETE:** deletion is a claim of its own — that the
place definitely does not exist — and the project holds that claim to the
same evidence bar as every other field (§11 rule 4–5: unknown beats
fabricated certainty; never invent a value). `akiya`'s investigation found
*no trace*, not *proof of absence*. Quarantine excludes it from every
discovery surface without asserting a negative nobody has proven, and
without discarding the record (and its evidence file, once it has one) if
better evidence later confirms or refutes it.

**Determination reuses `fact()`, not a parallel mechanism.** Classifying a
record `QUARANTINE` is itself a claim, so it is written as one, using the
same primitive as every other field:

```js
lifecycle: {
  status: LIFECYCLE.QUARANTINE,
  determination: fact(LIFECYCLE.QUARANTINE, {
    confidence: CONFIDENCE.SUPPORTED,
    source: SOURCE.RESEARCH,
    method: METHOD.MAP_CROSSCHECK,
    lastCheckedAt: "2026-07-17",
    evidence: "…what was and wasn't found…",
  }),
}
```

`check-data` requires this fact to be auditable — an evidence ref **or** an
inline `method` + `evidence`, the same dual path already allowed for
`CONFIRMED` facts (§2.12) — before it accepts a `QUARANTINE` status.

**Not on the Evidence Layer, by design.** `akiya`'s determination is inline,
not a `data/evidence/akiya.json` record. The finding is "our search coverage
turned up nothing," which is a statement about our own search, not a sourced
claim about the venue — the Evidence Layer (§2.7) exists for the latter.
This is also why the store gained no "negative evidence" record type: it
keeps storing only evidence that says something about a source; an
absence-of-listing finding stays where it was judged, on the fact itself.

**`akiya` (아키야) — quarantined 2026-07-17.** Absent from Naver Place and
Kakao Map under the name near Gaehang-ro, absent from the geocoding
pipeline, and absent from git history predating this repo — unusual for an
operating restaurant; every other place in the dataset is on both map
services. Not proven fabricated, so `QUARANTINE`, not `DELETED`. Excluded
from map, search, cards, and the Journal's next-stop logic; direct
navigation to its detail page is a no-op (`App.jsx`'s `openDetail`/
`openStory`). This supersedes the prior "next task" for `akiya` (correcting
its abolished-district address, §7 High #3 as it read before this edit) —
the address is moot while the record is hidden, and was left as-is rather
than half-fixed. See §12 for what comes next.

**Known integration gaps, found by re-reading the diff against the existing
architecture (not yet fixed):**

- `src/components/JournalPanel.jsx` imports `restaurants` directly rather
  than a quarantine-filtered view. `nextStop` (line 26) filters with
  `isQuarantined`; `byId` (line 14), `stamped` (lines 17–22), and the
  passport-progress denominator `total` (line 38) do not. A restaurant
  bookmarked before it was quarantined would still render as a name/photo
  stamp card and count toward "of 20 stamped" — opening it stays blocked by
  the `App.jsx` choke point, so this is a display inconsistency, not an
  unverified-detail leak. No live bookmark currently exercises this for
  `akiya`; it is a code-level gap, not an observed defect. See §7 Medium #11.
- `scripts/lib/check-evidence.mjs`'s `factsOf()` — the whitelist the
  evidence-layer rules (broken references, confidence ceilings, stale pins)
  walk — does not include `lifecycle`. `check-data`'s quarantine rule only
  checks that a determination *has* evidence refs (a presence check, via
  `hasEvidence()`), not that they resolve or respect the confidence ceiling.
  Not triggered today — `akiya` uses inline `method`/`evidence`, no
  `evidenceRefs` — but a future determination that used evidence refs would
  bypass those checks until `factsOf()` is extended. See §7 Medium #12.

**Status as of this writing:** implemented in the working tree, not
committed — `git status` shows five modified files
(`scripts/check-data.mjs`, `src/App.jsx`, `src/components/JournalPanel.jsx`,
`src/data/restaurants.js`, `src/data/verification.js`) and no new commit.
`check-data`, `lint`, `build`, and `node scripts/evidence-hash.mjs --check`
all pass against the working tree; a live `npm run dev` check confirmed 19 of
20 cards render with no "Akiya"/"아키야" text anywhere on the page.

---

## 3. Directory Structure

```
k-food-map/
├── HANDOFF.md              ← this file
├── index.html              app shell; title/meta/theme-color live here
├── vite.config.js
├── package.json            scripts: dev, build, lint, check-data, preview
│
├── src/                    everything that ships to the browser
│   ├── App.jsx             all app state; filter + search logic; layout shell
│   ├── utils.js            haversine, formatDistance, coordsOf,
│   │                       getOpenStatus, todaysHours, directionsUrl, MAP_CENTER
│   ├── index.css           design tokens + every style (no CSS-in-JS)
│   ├── components/         presentational; no data fetching
│   │   ├── MapComponent.jsx    Leaflet; pins; ResizeSync; moveend → mapCenter
│   │   ├── FilterBar.jsx       search + dietary chips
│   │   ├── BottomSheetList.jsx place cards, distance-sorted
│   │   ├── RestaurantDetail.jsx the storytelling journey + provenance footer
│   │   ├── JournalPanel.jsx    passport: progress, next stop, stamps
│   │   ├── TabPanel.jsx        Discover / Profile placeholders
│   │   ├── TabBar.jsx          bottom tabs (left-panel nav ≥1024px)
│   │   ├── PlaceImage.jsx      photo ?? illustration placeholder
│   │   └── Icons.jsx           every icon, hand-drawn SVG (no emoji)
│   └── data/
│       ├── restaurants.js  the 20 places (928 lines)
│       ├── verification.js fact(), CONFIDENCE/SOURCE/METHOD/VEGAN/HALAL,
│       │                   trustBadge, validateDietary, imageLead (278 lines)
│       ├── evidence.js     evidenceRef(), vocabularies, IMMUTABLE_VERSION_FIELDS
│       │                   — the only bundled part of the evidence layer (113 lines)
│       └── culture.js      Korean food culture by category (82 lines)
│
├── data/evidence/          audit data — NOT bundled, read only by scripts/
│   ├── sources.json        7 sources, shared
│   └── gonghwachun.json    5 records / 5 versions (the one migrated place)
│
├── scripts/                Node-only tooling
│   ├── check-data.mjs      the QA gate
│   ├── evidence-hash.mjs   seal / --check / --reseal
│   ├── lib/
│   │   ├── evidence-store.mjs   load, hash, resolve, currentVersion
│   │   └── check-evidence.mjs   the ten evidence rules + todayInSeoul()
│   ├── migrate-dietary-v2.mjs      v1→v2 (historical record; decision table)
│   ├── migrate-confidence-v3.mjs   v2→v3 (historical record)
│   └── backfill-method.mjs         one-time, already applied
│
├── docs/
│   ├── DATA.md             schema, never-infer/never-chain rules, migrations
│   └── EVIDENCE.md         the evidence layer in depth
│
├── public/images/          7 food illustration SVGs + fallback
└── [DEAD — see §7]         temp.js (0 bytes), verify.cjs, geocode_and_build.cjs,
                            src/data/restaurants.json
```

**Migration scripts are kept on purpose.** They are the audit record of every
dietary judgement ever made — each carries a decision table quoting the evidence
it rested on. `--dry` still prints the reasoning. Do not delete them.

---

## 4. Data Pipeline

```
                    AUTHORING TIME (Node)                        RUNTIME (browser)
 ┌──────────────────────────────────────────────────┐  ┌────────────────────────┐
 │ Source          data/evidence/sources.json       │  │                        │
 │   ↓             (publisher, kind, tier)          │  │                        │
 │ EvidenceVersion immutable; sealed with SHA-256;  │  │                        │
 │   ↓             carries excerpt + ceiling        │  │                        │
 │ EvidenceRecord  data/evidence/<id>.json          │  │                        │
 │   ↓             one file per restaurant          │  │                        │
 │ EvidenceRef ────┼──────────── pinned {id,version} ──→ src/data/restaurants.js│
 │   ↓             │                                │  │        ↓               │
 │ Validation      scripts/check-data.mjs           │  │      Fact              │
 │                 + lib/check-evidence.mjs         │  │        ↓               │
 │                 resolves refs → records →        │  │   App.jsx (filter)     │
 │                 versions → sources; enforces     │  │        ↓               │
 │                 ceilings, seals, chains          │  │   Components → UI      │
 └──────────────────────────────────────────────────┘  └────────────────────────┘
```

**Where each stage runs:**

| Stage | Runs | Why |
|---|---|---|
| Source registry | Node only | audit data |
| Evidence record / version | Node only | megabytes of excerpts at scale; the browser must never pay for the audit trail |
| `evidenceRef` | **both** | tiny `{id, version}` pointers; must be authored inside the bundled data file |
| Fact | **browser** | it *is* the app's data |
| Validation | Node only (CI gate) | |
| UI | browser | reads only `value`, `confidence`, `source`, `precision`, `lastCheckedAt`, `evidence` |

That last row is measured, not assumed — the UI reads **no** `url` and **no**
`method`, which is exactly why they could be removed from migrated facts.

---

## 5. Important Engineering Decisions

Each of these was a deliberate choice with a rejected alternative.

**Evidence is not bundled.**
Audit data, not app data. At 500 restaurants the store is megabytes of excerpts
and licence notes no visitor needs. *Rejected:* keeping evidence in `src/` so
the UI could show excerpts — that trades every visitor's bandwidth for a tooltip.

**One evidence file per restaurant, not one index.**
Diffs stay readable; two people verify different venues without conflicting;
auditing one venue means opening one file. *Rejected:* a single `evidence.json`,
which becomes unreviewable at ~4,000 records.

**Evidence versions are immutable, enforced by SHA-256.**
A rule in a document is a suggestion; a hash is a gate. `status` is outside the
hash so superseding never rewrites history. *Rejected:* "please don't edit
published versions" in the docs.

**Facts pin evidence versions.**
So a stale fact is *visible*. *Rejected:* facts pointing at "current", which
would let a fact silently inherit a claim nobody re-checked — the exact failure
this project exists to avoid.

**Version `confidence` is a ceiling, not a second opinion.**
Turns the source-priority order into `fact.confidence ≤ max(ceiling)`.
*Rejected:* a per-evidence "how much do we trust this" number, which would be a
third confidence with no crisp definition.

**Provenance and confidence are separate axes.**
"Official" answers *where from*; "estimated" answers *how sure*. One enum cannot
say "community-reported and we confirmed it". *Rejected:* the flattened
`Official/Community/Estimated/Unknown` enum.

**Unknown beats guessing.**
A traveller can act on "we don't know"; they cannot act on a wrong badge.
Applied to: `maji` hours (sources conflict → unknown), `ggot-epida` menus
(draft contradicted → withdrawn), `makan` (unverifiable → nothing upgraded).

**No silent inference; no chaining.**
An inference must be *labelled* `INFERRED` with its reasoning in `evidence`.
A value derived from another *unconfirmed* value is banned outright —
"plant-based, therefore halal" is exactly the defect P0 removed.

**Invented data is deleted, not replaced.**
`rating`, `reviews`, `food_mile` were fabricated and are gone. No new estimates
took their place. 20 ratings in a 4.3–4.9 band is statistically impossible; an
invented ESG kilometre figure is greenwashing.

**Unconfirmed existence is quarantined, not deleted.**
`DELETE` is a claim too — that a place definitely is not real — and the
project holds itself to the same evidence bar it holds every other field to.
*Rejected:* deleting `akiya` outright on a search-absence finding, which
would assert a negative nobody has proven. See §2.14.

**Verification-first.**
The UI has been feature-complete since `c8b9089`. Everything since is data
integrity. Paradoxically, *the polished UI made the bad data more dangerous* —
it made unverified claims look authoritative.

**Nothing is CONFIRMED without a repeatable method.**
`check-data` rejects a confirmed fact with no method and no evidence. A
confirmation nobody can re-run is just an assertion.

---

## 6. Development Timeline

| # | Milestone | Objective | Major changes | Architectural impact |
|---|---|---|---|---|
| — | `9376f31` | snapshot | pre-redesign baseline | git init; every step is revertable |
| 1A-1 | `c9cdf30` | Home layout | design tokens, Inter, de-decoration (hanji texture/glass blur removed), search bar, chips, map at 46vh, always-on list | list no longer requires a filter — the single biggest discovery fix |
| 1A-2 | `8f6c7ff` | Cards & data | scannable cards, `PlaceImage`, haversine distance, card-level save/directions/Read Story, `photo`/`coverImage`/`gallery`/`category` added | image contract established; bookmark 2 taps → 1 |
| 1B | `31603f5` | Home polish | layered sheet, 4px spacing scale, micro-interactions, `prefers-reduced-motion`, theme-color | design system hardened |
| 2 | `50a5ff8` | Restaurant Detail | Quick Facts, section journey, `culture.js` (8 categories), "Did you know?", dialog semantics, Escape, clipboard fallback | **content architecture**: category-shared culture with per-place override hooks |
| 3 | `0222164` | Journal | passport cover, progress, next stop, dated stamps | bookmarks `["id"]` → `[{id, savedAt}]` with auto-migration |
| 4 | `9f23acf` | Discover/Profile | lightweight placeholders linking back to the core loop | no new state |
| 5 | `c8b9089` | Final polish | permanent split layout ≥768px, desktop dialog ≥1024px, token/radius/shadow QA, contrast fixes, legacy cleanup | UI complete; **feature work ends here** |
| **P0** | `4080f6e` | Eliminate unsafe data | structured dietary schema, `fact()` provenance, **rating/reviews/food_mile deleted** | **the pivot.** Fixed: `bombay-brau` tagged Vegan while serving chicken; `maji` tagged Halal because it was plant-based |
| — | `e341b27` | Refine trust model | `status`→`confidence` with 4 levels; SOURCE expanded; `trustBadge`; `validateDietary`; `check-data` born | nuance below the confirmed line, ceiling unmoved |
| P1·1 | `f32c987` | Jongno/Insadong ×5 | Naver+Kakao verification | **`ggot-epida` was the wrong venue entirely** (name wrong, coords 640 m off); structured `hours {raw, weekly}`; `transit`, `phone`, `officialUrl`, `instagram` |
| P1·2 | `6c9ce45` | Itaewon ×5 | operator sites reached | **first CONFIRMED dietary fact** (Plant Cafe, "100% vegan" from the operator); `makan` unverifiable; image-rights metadata |
| P1·3 | `e84f677` | Gonghwachun | one place to production quality | **heritage claim was false**; Incheon district merger found; `fact()` gains `url`+`method`; 41 facts backfilled |
| — | `b13b084` | **Evidence Layer** | normalized, versioned, immutable provenance | records/versions/sources; SHA-256 sealing; pinning; ten validation rules; `gonghwachun` migrated as demo |
| — | *uncommitted* | **Restaurant Lifecycle (MVP)** | separate a record's existence/publication state from field-level confidence | `LIFECYCLE.ACTIVE`/`QUARANTINE` implemented and enforced by `check-data`; `ARCHIVED`/`DELETED` named only; `akiya` quarantined (existence unconfirmed, not proven fabricated); see §2.14 |

---

## 7. Technical Debt

### Critical — *none.*
No known defect that misleads a user. That is the bar P0/P1 were run to; keep it.

### High

1. **19 of 20 restaurants are not on the evidence layer.** They still carry
   inline `url`/`method`/`evidence`. Both shapes validate, so nothing is broken —
   but the audit trail is one restaurant deep. *Rationale for the debt:*
   migrating in bulk would defeat the purpose; the value is in re-reading each
   claim while moving it. That is how Gonghwachun's false story surfaced.
2. **10 of 20 restaurants have zero confirmed fields.** `kampungku`,
   `nono-shop`, `chaeyuk-songdo`, `iryonghal`, `rim`, `meat-morning`,
   `arabesque`, `bombay-brau`, `akiya`, `makan` — each has ~3/8 fields known.
   One of the ten, `akiya`, is now `QUARANTINE`d (§2.14): its gap is no longer
   "unverified," it is "existence unconfirmed," and it needs a different
   resolution than the other nine — see §12.
3. **`akiya`'s stale `Jung-gu` address is now moot, not fixed.** The district
   merger (`Jung-gu` → 제물포구, effective 2026-07-01) that originally put
   `akiya` on this list is superseded by a bigger finding: the place itself
   has no trace on Naver Place, Kakao Map, or the geocoding pipeline. It was
   quarantined on 2026-07-17 rather than corrected — see §2.14. The stale
   address text is left in the record as-is; it is inert while the record is
   hidden from every discovery surface.
4. **7 area-level addresses:** `makan`, `nono-shop`, `iryonghal`, `rim`,
   `meat-morning`, `arabesque`, `bombay-brau`. Not routable to a door.
5. **The Lifecycle MVP (§2.14) is uncommitted.** Five files are modified in
   the working tree with no commit: `scripts/check-data.mjs`, `src/App.jsx`,
   `src/components/JournalPanel.jsx`, `src/data/restaurants.js`,
   `src/data/verification.js`. Every gate passes against the working tree —
   `check-data`, `lint`, `build`, `evidence-hash.mjs --check`, and a live
   browser check (19/20 cards render, no "Akiya"/"아키야" text on the page) —
   but none of it survives a lost session until it is committed.

### Medium

6. **10 restaurants have unknown hours.** The UI is honest ("Opening hours
   unknown — check before you go") but it is a real gap.
7. **Story tone.** 13/20 stories carry marketing superlatives ("pinnacle",
   "zenith", "uncompromising", "artisanal" ×5) — residue of the original AI
   draft, and at odds with `culture.js`'s plain voice. Only `gonghwachun` has
   been rewritten.
8. **Culture content is category-shared with 0/20 overrides.** Five Itaewon
   vegan places print the identical "Did you know?". The override hook
   (`place.didYouKnow` / `place.diningTips`) exists and is unused.
9. **Coverage gaps vs. the project's own proposal:** 0 reusable-container
   restaurants, 0 traditional markets — both named in the founding proposal.
   Itaewon is 6 of 12 Seoul places.
10. **No exit numbers** except `gonghwachun`. Kakao's routing API does not return
    them.
11. **`JournalPanel` partially bypasses the quarantine filter (§2.14).**
    `restaurants` is imported directly; `nextStop` filters with
    `isQuarantined`, but `byId`, `stamped`, and the passport progress
    denominator `total` do not (`src/components/JournalPanel.jsx:14,17,38`).
    A restaurant bookmarked before it was quarantined would still render as a
    stamp card and count toward "of 20 stamped." Opening it stays blocked by
    `App.jsx`'s `openDetail`/`openStory` choke point, so this is a display
    inconsistency, not an unverified-detail leak. No live bookmark currently
    triggers it for `akiya`.
12. **`check-evidence.mjs`'s `factsOf()` whitelist excludes `lifecycle`
    (§2.14).** The evidence-layer rules (broken references, confidence
    ceilings, stale pins) never walk a `lifecycle.determination` fact.
    `check-data`'s quarantine rule only checks that a determination *has*
    evidence refs, not that they resolve or respect the ceiling. Not
    triggered today — `akiya` uses an inline `method`/`evidence`, no
    `evidenceRefs` — but a future determination that used evidence refs would
    bypass those checks until `factsOf()` is extended to include `lifecycle`.

### Low

13. **Dead files, re-confirmed 2026-07-17:** `temp.js` (0 bytes, untracked),
    `verify.cjs`, `geocode_and_build.cjs` (18 kB), `src/data/restaurants.json`
    (18 kB, the pre-schema-v2 JSON `verify.cjs` reads and
    `geocode_and_build.cjs` writes). Re-grepped across `src/`, `scripts/`,
    `index.html`, `vite.config.js`, and `package.json` — zero references to
    any of the four from live code. `geocode_and_build.cjs` is the only one
    with salvage value (a re-geocoding pipeline; its embedded data is the
    pre-P0 marketing-tone draft and should not be reused as-is).
    Not deleted — no destructive action without explicit approval.
14. **`oxlint` warns ×2** — both inside dead `geocode_and_build.cjs`.
15. **No automated tests.** `check-data` is the only gate. The evidence rules
    were proven by a throwaway mutation harness that was not kept — worth
    formalising if this grows.
16. **Documentation rot.** ~15 quantitative claims across §1, §7, §8 and §9 are
    hand-maintained and go stale on the next data commit. Two were already
    wrong at drafting (street addresses stated as 12/20, actually 13/20;
    marketing-tone stories stated as ~14/20, actually 13/20) and were caught
    only by measuring against the repository, not by review. There is no
    `npm run metrics` to regenerate them and no rule requiring one. Until such
    a script exists, treat every number in this document as valid only at the
    `HEAD` stated in the header, and re-measure before citing it elsewhere.
    This edit (2026-07-17) is itself such a re-measurement: the Lifecycle
    section, `akiya`'s outcome, and the dead-file list were verified against
    the repository, not carried over from a prior draft.

---

## 8. Quality Status

### Completed (high confidence)

| Item | Evidence |
|---|---|
| UI/UX, 5 approved steps | responsive 375/768/1280/1440 verified in-browser |
| Accessibility | 44px touch targets, aria, keyboard focus, AA contrast (measured: 4.59–15.8:1) |
| Trust model | `check-data` 0 violations, 20 places |
| Evidence architecture | ten rules each proven to fire against a mutated store |
| Immutability | SHA-256 drift detected in a live test |
| Bundle hygiene | `retrievedBy`/`capturedAt`/`supersedes` = 0 occurrences in `dist/` |
| Dietary safety | 0 falsely-certified; unknown never matches a filter |

### Partially completed

| Item | State | Confidence |
|---|---|---|
| Data verification | 10/20 have ≥1 confirmed field; 10/20 confirmed coordinates; 13/20 street addresses; 9/20 structured hours | high (measured) |
| Lifecycle rollout | 1/20 (`akiya`) quarantined; 19/20 default `ACTIVE`; MVP **uncommitted** — §2.14 | high (measured, incl. live browser check) |
| Evidence migration | 1/20 | high |
| Story sourcing | 1/20 has `storyRefs` | high |
| Image rights research | 5/20 have leads; **8 leads, 0 reusable** | medium — only 5 venues surveyed |
| Contact data | officialUrl 7/20, phone 9/20, instagram 4/20 | high |

### Not started

- Real photography (contract ready, `photo`/`coverImage`/`gallery` all null)
- Discover tab content; Profile settings
- Entity layer (§10 Phase C)
- Any backend, auth, or user-generated content
- i18n (English only; Korean accents are hand-placed)

---

## 9. Known Risks

| Risk | Severity | Detail |
|---|---|---|
| **KMF certification unverified** | **High** | Seoul's official tourism site states EID is *"한국이슬람중앙회에서 할랄 인증을 받은 유일한 한식당"* — the strongest evidence in the dataset. Still held at `FRIENDLY`: no certificate number or expiry sighted, KMF's own register never reached, **and a lapsed certificate would read identically**. Recorded in `halalCertClaim`. Resolving this needs a call to the venue or KMF. Do not upgrade on the tourism page alone. |
| **`makan` may not exist** | **High** | Absent from *both* Naver Place and Kakao Map under every spelling tried — unusual for an operating Korean restaurant; the 18 other active places are on both. Only aggregators that retain closed venues (TripAdvisor, autoreserve) still list it. Nothing was upgraded. **Must be settled before any publication.** `akiya` had the identical signature and was quarantined 2026-07-17 rather than guessed at — see §2.14 and §12 for applying the same resolution here. |
| **Story evidence coverage** | **High** | 19/20 stories have no `storyRefs`. Gonghwachun proves the risk is real, not theoretical: the story asserted a heritage lineage the venue does not have, and no fact-level check could have caught it. |
| **Image licensing** | **Medium** | 8 leads, **0 reusable**. No KOGL notice on Seoul or Incheon tourism pages → default copyright. Instagram's terms grant no third-party reuse. **Every route requires written permission.** `check-data` blocks a lead from becoming a shipped file. |
| **Evidence migration drift** | **Medium** | While two shapes coexist, a reviewer must know which to trust. Mitigated: `check-data` accepts both; `hasEvidence(fact)` distinguishes them. |
| **Entity duplication** | **Medium** | `ggot-epida` has two branches (Bukchon + Insadong); we model one. `gonghwachun` is entangled with two *other* entities (짜장면박물관, 공화춘터) that are not restaurants but are central to its story. The flat model cannot express branch-of, near, or succeeded-by. |
| **`monks-butcher` vegan level** | **Medium** | Held `FULL`/`SUPPORTED`. Current sources tag it 비건레스토랑 and list no non-vegan dish, but the operator's own site never says so, and a 2019 write-up described *separate vegan and vegetarian menus*. Unresolved. |
| **Data staleness has no clock** | **Medium** | `lastCheckedAt` exists; nothing warns when it ages. Incheon's district merger (2026-07-01) silently invalidated addresses. |
| **Single-verifier bias** | **Low** | Every check to date was performed by one agent (`retrievedBy: claude-opus-4-8`). The field exists precisely so this is visible and a second verifier is distinguishable. |
| **`ggot-epida` menu withdrawn** | **Low** | `menus` is `unknown` — the draft menu was contradicted by the venue's listing. Honest, but the detail page shows no menu. |

---

## 10. Roadmap

Each phase depends on the last. Do not reorder.

### Phase A — Data Verification *(current; ~50% done)*
Bring the remaining unverified restaurants to the Gonghwachun standard, one at
a time, each with a completion report.
**`akiya` is resolved, not verified.** Investigation (2026-07-17) found no
trace of it on Naver Place, Kakao Map, or the geocoding pipeline; it is
`QUARANTINE`d rather than brought to production quality — see §2.14. That
closes it out of this queue without adding a 20th "verified" restaurant.
**Order for the remaining 9:** the Incheon cluster (`chaeyuk-songdo`,
`iryonghal`, `rim`, `meat-morning`, `bombay-brau`, `arabesque`), then the
Seoul remainder (`kampungku`, `nono-shop`), then `makan`. `makan` carries the
same "may-not-exist" risk `akiya` did (§9) and could be resolved out of turn
with the same Lifecycle mechanism — see §12 for the recommendation.
**Why first:** everything downstream compounds on the data. Migrating unverified
facts into evidence records just makes bad data auditable.

### Phase B — Evidence Migration
Move all 20 onto the evidence layer, retiring inline `url`/`method`.
**Why after A:** migration is a re-reading exercise. Migrate a verified fact and
you capture a real excerpt; migrate an unverified one and you fabricate one.
Doing A and B in one pass per restaurant is acceptable and probably optimal.

### Phase C — Entity Layer
Restaurants are not the only entities. `짜장면박물관` is a museum; `공화춘터` is a
heritage site; `ggot-epida` has two branches. Introduce a place-entity model
with typed relations (`branch-of`, `succeeded-by`, `near`, `commemorates`).
**Why after B:** relations need sourcing too. An entity graph built on unsourced
claims is a faster way to be confidently wrong.

### Phase D — Knowledge Graph
Link entities to culture concepts (jajangmyeon, 사찰음식, 발우공양, 오신채) and to
each other. This is where the public-diplomacy value compounds: a traveller
follows *fermentation* across four restaurants and a museum.
**Why last:** a graph is only as good as its nodes and edges.

### Cross-cutting, any time after A
- **Content pass:** strip marketing tone from the 19 remaining stories; write
  per-place `didYouKnow`/`diningTips` for the crowded categories.
- **Photography:** the licence research says every route needs permission.
  Commissioning original photos may be cheaper than clearing rights.
- **Staleness policy:** decide a re-check interval; have `check-data` warn.
- **Coverage:** add reusable-container venues and traditional markets — both in
  the founding proposal, both absent.

---

## 11. Coding Rules

These are enforced by `check-data` where a machine can; the rest are on you.

**Data**
1. Never silently infer. An inference is `INFERRED`, labelled, with reasoning in
   `evidence`.
2. Never chain. A value derived from another *unconfirmed* value is not
   evidence.
3. Never infer certifications. `HALAL.CERTIFIED` needs `CONFIRMED` + a `cert`
   reference. A name, a menu, or a vegan claim is not a certificate.
4. Unknown beats fabricated certainty. If sources disagree, the field stays
   unknown. Never average; never pick the convenient source.
5. Never invent a value to fill a field. Deleting an invented value is correct;
   replacing it with a nicer invention is not.
6. State a value at the **weakest** confidence its evidence supports.
7. Never downgrade provenance. Do not replace a specific source with a vaguer
   one, or drop `lastCheckedAt`, to make a record look tidier.

**Evidence**
8. Never overwrite a published evidence version. Append v2 with
   `supersedes: <n>`. `--reseal` is for a bad seal, never for recording change.
9. Never edit `data/evidence/*.json` by hand after sealing — the hash will
   catch it, which is the point.
10. Evidence belongs outside the bundle. Nothing in `src/` may import
    `data/evidence/`.
11. Every evidence version records what the source **actually said**
    (`excerpt`), not your reading of it.
12. Every story claim must eventually reference evidence (`storyRefs`).

**Process**
13. Never weaken `check-data` to make a change pass. If a rule is wrong, fix the
    rule deliberately and say so.
14. One restaurant at a time, with a completion report. Batches optimise for
    throughput; this project optimises for not being wrong.
15. Report every change to existing data: previous value, new value, source,
    reason. Never overwrite silently.
16. Verify in the browser before claiming a UI change works. Two real bugs
    (`DIET_CAVEAT` missing its `CONFIRMED` case; EID's editorial contradicting
    its own badge) were caught only by looking.

**Code**
17. Facts stay small. Bulky provenance goes in evidence records.
18. `src/` is browser code; `scripts/` is Node. The data layer uses explicit
    `.js` extensions so QA scripts can import it under plain Node.
19. Styles live in `index.css` with tokens. No CSS-in-JS, no new hex outside
    `:root`.
20. Do not modify unrelated files. Record out-of-scope findings in the report
    instead (see `akiya`).

**Documentation**
21. Update this document in the same commit as the change it describes. A
    handoff that lags the code is a trap: it is most trusted exactly when it is
    most wrong. If a change moves a number quoted in §1, §7, §8, or §9, move it
    there too — do not let the next reader discover the drift by measuring.
22. Bump `Last updated` and `HEAD` at the top of this document whenever you
    touch it. They are the reader's only signal of how far to trust the numbers
    below.

---

## 12. Next Recommended Task

**`akiya` is closed out — see §2.14.** It was not brought to production
quality; it was investigated and quarantined (existence unconfirmed). That
resolves the item this section previously recommended.

**Prerequisite before new restaurant work: land the Lifecycle MVP.** §2.14 and
§7 High #5 — five files are modified with no commit. Starting `makan` (below)
on top of an uncommitted, undocumented change mixes two units of work in one
diff and risks losing the Lifecycle change entirely if the session ends first.
Commit it (or explicitly decide not to) before picking up the next restaurant.

**Then: resolve `makan`'s existence, applying the same Lifecycle mechanism
just used for `akiya`.**

**Why this and not the next restaurant in the Incheon cluster:**

1. **Evidence.** `makan` already carries the identical failure signature
   `akiya` did — absent from *both* Naver Place and Kakao Map under every
   spelling tried, where all 18 other active places are on both (§9). That is
   not a new investigation; it is applying a now-tested method
   (`METHOD.MAP_CROSSCHECK`, `SOURCE.RESEARCH`, `fact()`-wrapped
   `lifecycle.determination`) to a second, already-documented case.
2. **Production priority.** §9 marks `makan` **High** severity and says
   explicitly: "**Must be settled before any publication.**" It is the single
   highest-severity open item in the entire Known Risks table. Resolving it
   — whether that means `QUARANTINE`, or turning up a listing that upgrades
   it to `ACTIVE` — outranks verifying a restaurant with merely-missing
   fields (the Incheon cluster's problem, which is real but lower severity).
3. **Existing plan.** §10 Phase A's own text names this exact reordering as
   acceptable: "`makan` last — or resolve its existence first." Taking that
   option now is not a deviation from the plan; it is exercising a branch the
   plan already anticipated, once a working, tested mechanism existed to act
   on it.

**Definition of done:** re-run the existence check (Naver Place, Kakao Map,
the geocoding pipeline, and any spelling variants not yet tried) dated
2026-07-17 or later; either a `lifecycle.determination` fact quarantining it
(mirroring `akiya`) or a confirmed listing that lets other fields proceed to
normal verification; `npm run check-data` clean; completion report with a
Data Change Log (previous value / new value / source / reason for every
field touched, per §11 rule 15).

**Do not:** start Phase C, add features beyond what Lifecycle already defines,
or resolve/verify more than one restaurant in the same pass.

---

### Quick start

```bash
npm install
npm run dev           # http://localhost:5173
npm run check-data    # the gate — must print "No violations."
npm run lint
npm run build && grep -c retrievedBy dist/assets/*.js   # must print 0

node scripts/evidence-hash.mjs --check            # evidence seal drift
node scripts/migrate-dietary-v2.mjs --dry         # the dietary decision record
```

Read next: `docs/EVIDENCE.md`, then `docs/DATA.md`.

*Windows note: the repo path contains spaces and Korean characters. Some
tooling needs a junction (`mklink /J`) to a plain-ASCII path.*
