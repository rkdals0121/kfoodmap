# K-Food Map — Engineering Handoff

**Status:** working prototype, production-grade data architecture, incomplete data.
**Last updated:** 2026-08-03 · **Base commit:** `118335a` (Offline MVP spec
correction + plan, on top of `4f882c1`/`269dc58`/`07e0900`/`125667d`/
`b21db67`/`84c3b3d`/`d501e1f`/`875a148`/`2b1e6ac`/`cb360f8`/`dd0c7a4`; see
§2.16 and §7 for that history; Phase 6 underway, four MVPs shipped; v1.0 at
`07feea7`). **This edit lands together with the Offline MVP commit** it
describes — the last Stage 2 item, no data changed.
**Places:** 20 (18 active, 2 quarantined)

This document is the canonical handoff. It should be enough to continue work
without reading any prior conversation. Where it states a number, that number
was measured from the repository at the commit above **plus the working
tree**, not remembered. **One caution this update exists to record:** commits
`9b84565..b160514` (2026-07-23/24) reworked the app shell outside the
engineering log and outside the validation gates — see §2.16 for what they
contain and §7 Low #20 for the debt they left.

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
| Data | **Phase A verification complete.** 20 places (18 active, 2 quarantined); 18 have ≥1 confirmed field; 2 have zero — both are `akiya` and `makan`, both quarantined, not pending verification. **Every active restaurant now has at least one confirmed field and a street-precision address.** (No single "% verified" figure is meaningful here — see §8 for the field-level breakdown; many honestly unknown fields remain by design, not by omission.) |
| Evidence migration | **1 of 20** restaurants migrated (demonstration only). |
| Content (stories) | **Draft quality.** Marketing tone in 13/20; one story corrected so far. |

The gap between "architecture done" and "data done" is the whole point of the
current phase. **Do not add features. Fill the data.**

---

## 2. Current Architecture

### 2.1 Stack

React 19 + Vite 7 + react-leaflet 5 + Leaflet 1.9 + react-router 8. No
backend, no state library. Most state is still `useState` in `src/App.jsx`;
which restaurant's detail is open is now derived from the URL instead (see
**Routing**, below). The journal persists to `localStorage` under
`kfm-bookmarks` as `[{ id, savedAt, visitedAt }]` — see §2.15. Lint is
`oxlint`.

**Why no backend:** it was a hard constraint from the outset, and it has been
load-bearing rather than limiting. Everything — verification, evidence,
validation — happens at authoring time in Node and ships as static data.

**Routing (2026-08-03, GROWTH-PLAN decision C).** The "no router" half of
this constraint was amended: `src/main.jsx` wraps `<App />` in
`react-router`'s `<BrowserRouter>`; `src/App.jsx`'s former single component
is now `AppShell` (the same shell as before, unchanged visually) plus a
thin `App` that routes `/` and `/place/:id` to it. `AppShell` derives
`selectedRestaurant` from `useParams().id` via `activeRestaurants.find` —
`activeRestaurants` already excludes quarantined places (§2.14), so a
quarantined or unknown id both resolve to `null` and a `useEffect` redirects
home; there is exactly one place that decides "is this restaurant visible,"
not two. `openDetail`/`openStory` now `navigate()` instead of setting state,
so back/forward and reload are native browser behavior, not custom code.
`focusStory` (the scroll-to-story-timeline flag) rides router `state`
(`navigate(url, { state: { focusStory: true } })`), not the URL, since it's
a transient in-app affordance, not something worth a shareable link.
`activeTab`, filters, and search stay plain `useState` — untouched, out of
scope for this change (see docs/GROWTH-PLAN.md §4 Stage 1).

For non-JS link-preview crawlers (KakaoTalk, Facebook, Twitter — none
execute JS), `scripts/prerender-places.mjs` runs after `vite build`
(wired into the `build` npm script) and writes `dist/place/<id>/index.html`
per active restaurant: a copy of the built `dist/index.html` with
`<title>`/`og:*`/canonical swapped to that restaurant's data, no headless
browser involved. Every `<script>` tag is untouched, so a human opening the
link still gets the full interactive SPA. No `vercel.json` rewrite is
needed — every valid `/place/:id` is a real file at build time, so an
unknown id is a genuine 404, and no new id can silently drift out of sync
with `restaurants.js` since the script reads it directly, the same way
`scripts/check-data.mjs` already does. Full design rationale:
`docs/superpowers/specs/2026-08-02-routing-design.md`; implementation plan
and task-by-task review record: `docs/superpowers/plans/2026-08-02-stage1-routing.md`.
`react-router@8.3.0` requires Node ≥22.22.0 (local dev Node is v24.18.0,
fine) — worth confirming the Vercel project's Node runtime is on 22.x or
newer before this deploys, since npm only warns on an engine mismatch
rather than failing the build.

**Offline (2026-08-03, GROWTH-PLAN Stage 2 item 4, the last one).**
`vite-plugin-pwa` (Workbox `generateSW` strategy) precaches the app shell
and all bundled static assets on first online visit — restaurant data is
already inside the JS bundle, so precaching the bundle *is* precaching the
data. **The 18 crawler-prerendered `dist/place/<id>/index.html` pages are
NOT in the precache manifest** — found during implementation, not
designed in: `npm run build` is `vite build && node
scripts/prerender-places.mjs`, two separate shell steps, and
`vite-plugin-pwa` finalizes the precache manifest as part of `vite build`
itself, before `prerender-places.mjs` ever creates those files. This
turned out not to matter: `workbox: { navigateFallback: '/index.html' }`
was already configured, and it handles exactly this case — any offline
navigation request that isn't an exact cache hit falls back to the cached
shell, and `react-router` with its bundled data renders the correct
restaurant from there, verified end-to-end with a `/place/:id` never
opened in the test session, opened cold while genuinely offline (see the
plan's Task 4 for the script). A small `useOnlineStatus()` hook
(`src/hooks/useOnlineStatus.js`, plain `navigator.onLine` +
`online`/`offline` window events) drives a banner over the map when
offline — map tiles need network and stay uncached, per the frozen scope;
everything else works offline regardless. `public/apple-touch-icon.png`
(180×180, rasterized once from `favicon.svg` via
`scripts/rasterize-apple-touch-icon.mjs`, not part of the build) covers
iOS home-screen install, since iOS doesn't reliably read Web App Manifest
icons the way Android/Chrome does — same class of format gap as the
`og:image` SVG issue, §7 #22, handled proactively this time. **Testing
note:** Playwright's `context.setOffline(true)` reliably blocks network
requests (proving the service-worker/navigateFallback path works) but
does not reliably update `navigator.onLine` for a document created by a
*fresh navigation* while already offline — confirmed by manually
dispatching a real `offline` event afterward, which made the banner
appear immediately and correctly. This is a Playwright/CDP emulation gap,
not an app bug: a genuine OS-level disconnection (what a real user
experiences) always fires the DOM event correctly. Design spec:
`docs/superpowers/specs/2026-08-03-offline-mvp-design.md`; implementation
plan and task-by-task review record:
`docs/superpowers/plans/2026-08-03-offline-mvp.md`.

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
npm run build && grep -rc retrievedBy dist/   # must be 0
```

### 2.14 Restaurant lifecycle — ACTIVE / QUARANTINE (MVP)

A restaurant record's existence/publication state, kept separate from
field-level `CONFIDENCE` (§2.4). A record can have well-sourced facts and
still need excluding from the live app — because its existence *as an
entity* is in doubt, or because the entity existed and has since stopped
operating. `CONFIDENCE` has no vocabulary for either question: it grades how
far we trust a *field*, and conflating the two would mean either blocking a
well-verified place because one field is shaky, or shipping a restaurant
that closed last year with impeccably-sourced hours.

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
`restaurant?.lifecycle?.status`, so a restaurant with no `lifecycle` key is
unaffected and needs no migration.

**Two different findings currently share `QUARANTINE`. Read the
`determination`, not the status, to know which.** The MVP implements two
statuses, but three distinct situations have already arisen:

| Finding | Example | Status today | Status once `ARCHIVED` exists |
|---|---|---|---|
| Existence never established | `akiya` — no trace on either map service, the geocoding pipeline, or git history | `QUARANTINE` | `QUARANTINE` (unchanged — nothing was ever confirmed to archive) |
| Existence well-established, credible evidence it has stopped operating | `makan` — a decade of independent write-ups and 112 reviews, but Seoul's tourism site marks it "[운영중지]" and both map services have dropped it | `QUARANTINE` | `ARCHIVED` |
| Operating normally | the other 18 | `ACTIVE` | `ACTIVE` |

The two are **not** the same claim, and the distinction is real: one says
*we cannot find this place*, the other says *this place was real and is
gone*. They collapse onto one status only because `ARCHIVED` is unimplemented
(above), and both need the same user-facing outcome today — excluded from
every discovery surface. Implementing `ARCHIVED` to separate them is a
deliberate deferral, not an oversight: it would need transition logic, a UI
treatment (an archived venue is arguably worth *showing* as closed rather
than hiding, which is a design question nobody has answered), and a rule
about what evidence promotes `QUARANTINE` → `ARCHIVED`. None of that is
needed to keep a closed restaurant off the map, which is the whole job
today. **Until then, a reader must not infer the finding from the status** —
`akiya` and `makan` read identically as `QUARANTINE` and mean different
things. Each record's `lifecycle.determination` carries the actual finding,
its source, and its method; that fact, not the enum, is the audit record.
This is also why the determination is a `fact()` rather than a boolean.

**Why QUARANTINE and not DELETE:** deletion is a claim of its own — that the
place definitely does not exist — and the project holds that claim to the
same evidence bar as every other field (§11 rule 4–5: unknown beats
fabricated certainty; never invent a value). `akiya`'s investigation found
*no trace*, not *proof of absence*. Quarantine excludes it from every
discovery surface without asserting a negative nobody has proven, and
without discarding the record (and its evidence file, once it has one) if
better evidence later confirms or refutes it. The answer holds for `makan`
for the opposite reason: it demonstrably *did* exist, and deleting it would
discard a decade of sourced history — including the finding that it closed,
which is worth keeping precisely so nobody re-adds it next year.

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

**Not on the Evidence Layer, by design — for `akiya`.** Its determination is
inline, not a `data/evidence/akiya.json` record. The finding is "our search
coverage turned up nothing," which is a statement about our own search, not a
sourced claim about the venue — the Evidence Layer (§2.7) exists for the
latter. This is also why the store gained no "negative evidence" record type:
it keeps storing only evidence that says something about a source; an
absence-of-listing finding stays where it was judged, on the fact itself.

**`makan`'s determination is inline for a weaker reason, and that is worth
knowing.** Unlike `akiya`'s, it *is* a sourced claim about the venue: a
government page, at a stable URL, with a quotable marker ("[운영중지]") and a
retrieval date. By the rule above it is evidence-layer-eligible, and a
reviewer who notices the mismatch is reading correctly. It is inline anyway
because 19 of 20 restaurants still carry inline `url`/`method`/`evidence`
(§7 High #1) and migration is deliberately one-restaurant-at-a-time (§10
Phase B) — so this is the project's existing migration debt, not a new
exemption for lifecycle. When `makan` is migrated, its determination should
move onto the layer with the rest of its facts; `akiya`'s should not.

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
  either quarantined record; it is a code-level gap, not an observed defect.
  See §7 Medium #11.
- `scripts/lib/check-evidence.mjs`'s `factsOf()` — the whitelist the
  evidence-layer rules (broken references, confidence ceilings, stale pins)
  walk — does not include `lifecycle`. `check-data`'s quarantine rule only
  checks that a determination *has* evidence refs (a presence check, via
  `hasEvidence()`), not that they resolve or respect the confidence ceiling.
  Not triggered today — `akiya` and `makan` both use inline
  `method`/`evidence`, no `evidenceRefs` — but a determination that cited
  evidence refs would bypass those checks until `factsOf()` is extended.
  `makan` is the likely trigger, since its determination is
  evidence-layer-eligible (above). See §7 Medium #12.

**Status as of this writing:** the mechanism is **committed** at `b4c0e4b`
(`LIFECYCLE`, `isQuarantined()`, the `check-data` rule, the `App.jsx`
filters, and `akiya`'s determination). The `makan` determination described
above is a **separate, uncommitted change** on top of it —
`src/data/restaurants.js` and this file. All gates pass against the working
tree: `check-data` (20 places, 0 violations), `lint`, `build`,
`node scripts/evidence-hash.mjs --check`, and a live `npm run dev` check
confirming 18 of 20 cards render with no "Akiya"/"Makan" text anywhere on
the page. See §12.

### 2.15 Journal state — saved vs visited (Passport Enhancement MVP)

The journal entry, in `localStorage` under `kfm-bookmarks`:

```js
{ id, savedAt, visitedAt }   // visitedAt: timestamp, or null
```

**Two states, one entry.** `savedAt` is the wishlist — a place you mean to go.
`visitedAt` is the visit record — a place you have been. They are not
independent: **`visitedAt != null` implies `savedAt != null`.** A visit is
recorded on a place already in the journal, so the visit control in
`RestaurantDetail` stays disabled until the place is saved, and removing a
bookmark drops the whole entry, taking the visit with it. `handleToggleVisited`
only ever edits an existing entry — it cannot create one — so the invariant
holds by construction rather than by check.

**The passport counts visits, not saves.** Since the §2.16 shell rework the
UI expression changed: the "N of 20 stamped" progress bar is gone, and the
cover instead shows three counters — Visited, Saved, and Areas (distinct
zones among visited places). Stamps render in two text-labelled sections,
"Visited Places" (dated by `visitedAt`) and "Saved for Later" (dashed ring,
dated by `savedAt`). A fully inked stamp still always means "you have been
here". Quarantined places are filtered out of both sections.

**Migration is read-time, reusing the existing pattern** in `loadBookmarks()`.
Two older shapes normalise: `{ id, savedAt }` gains `visitedAt: null`, and the
original plain id strings become `savedAt: 0` — "saved at an unknown time"
rather than `null`, so "is it saved" stays a plain `savedAt` test with no legacy
special case. `0` is falsy, so date rendering is unchanged for those records,
and they can still be marked visited like any other.

**Not in this MVP:** cross-device sync of this state. (The original MVP also
left the saved/visited distinction visual-only; the §2.16 shell rework later
gave the two states separate, text-labelled sections, closing that gap.)

### 2.16 App-shell rework and the repository incident (2026-07-23 → 08-02)

Two things happened outside this document's log, recorded here after the fact.

**The shell rework** (`9b84565..b160514`, six commits, 2026-07-23/24) — real
product work, but it ran without the §11 process: no HANDOFF sync, no gate
run, no one-unit-per-commit discipline. What it contains:

- **Prologue** (`Prologue.jsx/.css`, new): a 4-step onboarding gate shown
  before the app until completed once; completion persists to `localStorage`
  under `kfm-prologue`.
- **New layout shell** (`App.jsx`, `index.css` ±956 lines): desktop gets a
  collapsible sidebar (`isSidebarCollapsed`) holding filters/list/tabs beside
  a full-height map; mobile gets a three-state bottom sheet
  (collapsed/half/expanded, `sheetState`) driven by swipe gestures and a
  drag handle. Non-map tabs now render inside the sidebar instead of covering
  the map.
- **Naver/Kakao directions** (`utils.js`, `RestaurantDetail.jsx`):
  `naverMapUrl()` / `kakaoMapUrl()` beside the existing Google deep link —
  three buttons in the detail page. (Kakao's link format carries no origin.)
- **JournalPanel redesign**: passport cover now shows Visited/Saved/Areas
  stat boxes; stamps split into text-labelled "Visited Places" and "Saved for
  Later" sections; a Badges grid was added. The progress bar, "N of 20
  stamped" line, next-stop card and "Recently saved" line were removed. Two
  §7 debts got fixed in passing: the quarantine bypass (old Medium #11 —
  `stamped` now filters `isQuarantined`) and the visual-only saved/visited
  distinction (old Low #18). One new debt arrived: the Badges grid is a
  **hardcoded mockup** ("1 Earned", "First Taste" always earned) — see §7
  Low #20.
- Also: a GitHub Pages deploy workflow (`.github/workflows/deploy.yml`), and
  `temp.js` + `.claude/launch.json` became tracked files.

**The repository incident** (2026-08-02) — a second app (밥친구/Eatple, a team
project that grew out of this codebase in a sibling folder) was merged into
`rkdals0121/kfoodmap` `master` and briefly served from `kfoodmap.vercel.app`.
Resolution, done in a separate session: the sibling folder's remote now points
only at `rkdals0121/test` (with a `pre-push` hook and a `where-this-deploys`
doc guarding it), and `dd0c7a4` restored this repo's `master` to a tree
**byte-identical to `b160514`** — as a normal commit on top, so no history was
rewritten; the 87 밥친구 commits remain reachable and also live in the `test`
repo. Pre-incident state is kept at `backup/master-before-restore-2026-08-02`.
Ownership now: this folder → `rkdals0121/kfoodmap` → `kfoodmap.vercel.app`.

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
│   ├── App.jsx             route table (App) + shell (AppShell); filter +
│   │                       search state; detail view is URL-derived, not state
│   ├── utils.js            haversine, formatDistance, coordsOf,
│   │                       getOpenStatus, todaysHours, directionsUrl, MAP_CENTER
│   ├── index.css           design tokens + every style (no CSS-in-JS)
│   ├── hooks/
│   │   └── useOnlineStatus.js  navigator.onLine + online/offline events
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
│       ├── culture.js      Korean food culture by category (82 lines)
│       └── journeys.js     Food Journeys — editorial theme curation over
│                            verified restaurants, no new facts
│
├── data/evidence/          audit data — NOT bundled, read only by scripts/
│   ├── sources.json        7 sources, shared
│   └── gonghwachun.json    5 records / 5 versions (the one migrated place)
│
├── scripts/                Node-only tooling
│   ├── check-data.mjs      the QA gate
│   ├── evidence-hash.mjs   seal / --check / --reseal
│   ├── prerender-places.mjs  per-restaurant static HTML for crawler og:* meta;
│   │                          runs after `vite build` (see package.json)
│   ├── rasterize-apple-touch-icon.mjs  one-off, not wired into the build;
│   │                          re-run manually if favicon.svg ever changes
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
├── public/                 favicon.svg, apple-touch-icon.png (180×180,
│                           rasterized once, see scripts/ above)
│   └── images/             7 food illustration SVGs + fallback
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
2. **2 of 20 restaurants have zero confirmed fields — `akiya` and `makan`,
   and both are `QUARANTINE`d (§2.14).** No active restaurant has zero
   confirmed fields any longer. (`chaeyuk-songdo`, `iryonghal`, `rim`,
   `meat-morning`, `bombay-brau`, `arabesque`, `kampungku` and `nono-shop`
   all left this list on 2026-07-17 — **Phase A is complete**; see §10 and
   §12.) Their gap is no longer "unverified," it is "not currently
   operating" (`akiya`: existence never confirmed; `makan`: prior existence
   well-evidenced, but Seoul's tourism site marks it "[운영중지]" and it is
   absent from both map services) — see §12.
3. **`akiya`'s stale `Jung-gu` address is now moot, not fixed.** The district
   merger (`Jung-gu` → 제물포구, effective 2026-07-01) that originally put
   `akiya` on this list is superseded by a bigger finding: the place itself
   has no trace on Naver Place, Kakao Map, or the geocoding pipeline. It was
   quarantined on 2026-07-17 rather than corrected — see §2.14. The stale
   address text is left in the record as-is; it is inert while the record is
   hidden from every discovery surface.
4. **0 area-level addresses among active restaurants.** Every active
   restaurant is now at street precision.
   (`iryonghal`, `rim`, `meat-morning`, `bombay-brau`, `arabesque` and
   `nono-shop` all left this list 2026-07-17 — in `bombay-brau`'s and
   `arabesque`'s cases the draft's area value was actually close to or
   already in the correct district, but had never been confirmed against a
   source; the others had the wrong district entirely, and `nono-shop`'s
   area value described a location the venue had since relocated away from;
   see §12. `makan`'s area-level address is not counted here: it is
   quarantined and hidden from every discovery surface.)
5. **Resolved.** The Lifecycle MVP (§2.14) is committed at `b4c0e4b`, and the
   `nono-shop` investigation — the last Phase A restaurant — is committed at
   `f0e5af4`. Both previously sat uncommitted on top of each other; neither
   does now. No residual risk from this item. See §12.

### Medium

6. **5 restaurants have unknown hours** (re-measured 2026-07-18: `makan`,
   `akiya`, `maji`, `iryonghal`, `meat-morning` — down from 10 as Phase A
   verification progressively resolved most of them; this line had drifted
   from the true count across several Phase A commits without being moved,
   the exact class of staleness §7 Low #16 warns about). The UI is honest
   ("Opening hours unknown — check before you go") but it is a real gap.
7. **Story tone.** 12/20 stories carry marketing superlatives ("pinnacle",
   "zenith", "uncompromising", "artisanal" ×5) — residue of the original AI
   draft, and at odds with `culture.js`'s plain voice. `gonghwachun` and
   `chaeyuk-songdo` have been rewritten; the latter was not a tone fix but a
   correctness one — its draft story asserted the kitchen "replaces pork …
   creating a surprisingly realistic vegan alternative", which contradicted
   the record's own corrected badge (rule 16's defect class, and the second
   time it has bitten after EID).
8. **Culture content is category-shared with 0/20 overrides.** Five Itaewon
   vegan places print the identical "Did you know?". The override hook
   (`place.didYouKnow` / `place.diningTips`) exists and is unused.
9. **Coverage gaps vs. the project's own proposal:** 0 reusable-container
   restaurants, 0 traditional markets — both named in the founding proposal.
   Itaewon is 6 of 12 Seoul places.
10. **No exit numbers** except `gonghwachun`. Kakao's routing API does not return
    them.
11. **Resolved (2026-07-23, §2.16 shell rework).** `JournalPanel` no longer
    bypasses the quarantine filter: `stamped` now filters
    `!isQuarantined(b.place)`, so a stale bookmark for a quarantined place
    renders nothing and counts nowhere. The old "of 20" denominator this item
    worried about was removed outright along with the progress bar. History:
    accepted as post-v1.0 debt at Phase 4 QA; fixed in passing by the
    external rewrite rather than by a scoped commit.
12. **`check-evidence.mjs`'s `factsOf()` whitelist excludes `lifecycle`
    (§2.14).** The evidence-layer rules (broken references, confidence
    ceilings, stale pins) never walk a `lifecycle.determination` fact.
    `check-data`'s quarantine rule only checks that a determination *has*
    evidence refs, not that they resolve or respect the ceiling. Not
    triggered today — `akiya` and `makan` both use an inline
    `method`/`evidence`, no `evidenceRefs` — but a determination that cited
    evidence refs would bypass those checks until `factsOf()` is extended to
    include `lifecycle`. Extend it when `makan` is migrated (§2.14).
    Re-confirmed inert during Phase 4 QA (2026-07-18): 0/20 quarantine
    determinations use evidence-layer refs, so no violation is currently
    possible through this gap.
    **Phase 4 QA disposition (2026-07-18): accepted as post-v1.0
    Documentation/tooling debt, not a Release Blocker.** The gap cannot fire
    against any data that exists today; it only becomes live risk if/when
    `makan`'s determination is migrated onto the Evidence Layer, which is
    Phase B work and out of scope for v1.0. Extend `factsOf()` at that
    migration, not before.

### Low

13. **Resolved (2026-08-02, Stage 0 housekeeping).** `temp.js` and
    `.claude/launch.json` are untracked (removed from git, added to
    `.gitignore`; `temp.js` itself is also deleted since it was 0 bytes and
    unreferenced). `verify.cjs` and `src/data/restaurants.json` remain dead
    and untouched — not part of this pass, still zero references from live
    code.
14. **Resolved (2026-08-02, Stage 0 housekeeping). `oxlint` baseline moved:
    15 → 1 warning.** The 13 unused imports/variables from the §2.16 shell
    work were removed (`JournalPanel.jsx`, `RestaurantDetail.jsx` — including
    two genuinely dead pieces of state, `showDirections` and the gallery's
    `galleryIdx`, both write-only and never read — and `TabPanel.jsx`); the
    two in dead `geocode_and_build.cjs` were fixed directly (unused `reject`
    param, unused `catch` binding). **One warning is left deliberately:**
    `kakaoMapUrl`'s unused `origin` parameter in `src/utils.js`, documented
    in a comment there — it's the same "Kakao's link format carries no
    origin" gap noted in §2.16, and fixing it is a real feature (wiring
    Kakao's `from/.../to/...` routed-link format), not a lint chore. Left for
    a future Stage 2/Nearby-Route-adjacent commit, not silently suppressed.
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
17. **`.icon-btn--lg` suppresses the tinted state background — pre-existing.**
    Inside the detail action row, a large icon button never shows its state
    tint: `.icon-btn--lg` sets `background: var(--surface)` and, being later in
    `index.css` at equal specificity, wins over `.icon-btn--saved` and
    `.icon-btn--visited`. Found while verifying Passport Enhancement, and
    confirmed **not** a regression from it — the shipped `--saved` state behaves
    identically, and both classes resolve correctly in isolation (verified:
    `--visited` yields `#ECF8F2` / `#0E9F6E` / `#087F5B` on a bare `.icon-btn`).
    Border and text colour do apply; only the background is lost. Left alone
    deliberately: fixing it would have expanded a scoped feature commit into a
    change to shipped visual behaviour. *(2026-08-02: not re-verified since
    the §2.16 CSS overhaul — re-check before citing.)*
18. **Resolved (2026-07-23, §2.16 shell rework).** Saved vs visited is no
    longer visual-only: the journal now renders the two states in separate
    sections with text headings ("Visited Places" / "Saved for Later"), which
    screen readers announce. History: recorded as debt at the Passport
    Enhancement MVP; fixed in passing by the external rewrite.
19. **The sustainability axis is thin, and `esg_point` is not an ESG field.**
    Measured 2026-07-18 while building ESG Explorer, and recorded as a limit of
    the current data rather than a reason to revisit the plan. Of 18 active
    restaurants, **4** carry a sustainability trait (`Zero-waste` ×3,
    `Local Sourcing` ×1), so the axis filters to 4. And while `esg_point` is
    present on 18/18, reading all of them shows it is a mixed "what this place
    stands for" line, not a sustainability field: some are environmental
    (`sanchon`, `ggot-epida`), several restate the dietary record
    (`osegyehyang`, `camouflage`), and some are cultural or commercial
    (`eid`, `kampungku`, `gonghwachun`). **This is why the MVP surfaces
    `esg_point` verbatim and never classifies, scores or aggregates it** —
    deriving a sustainability category from that text would be inventing ESG
    facts, which is permanently out of scope. Widening the axis is a content
    problem (the content pass, §10 Cross-cutting), not a UI one.
20. **Debt left by the §2.16 shell rework (2026-08-02 audit).** Beyond the
    lint baseline (#14) and the newly tracked scratch files (#13), both
    resolved above:
    - **Resolved (2026-08-02, Stage 0 housekeeping).** The Badges grid no
      longer hardcodes state. `JournalPanel` now computes two badges from
      the actual journal: **First Taste** (earned once `visitedAt` is set on
      any bookmark) and **Plant Based** (earned once a *visited* place has
      `dietary.vegan.value === VEGAN.FULL`, via `isKnown`/`VEGAN` from
      `verification.js` — never inferred, only a fact already marked known).
      **Spicy Master was removed outright**, not wired: there is no spice-
      level field anywhere in the data model, so there was nothing honest to
      compute. The earned count in the header (`"N Earned"`) is now derived
      from the same two badges, not a literal string.
    - **Inline brand hexes** on the Naver/Kakao direction buttons
      (`#03c75a`, `#FEE500`, `#191919` as `style=` props in
      `RestaurantDetail.jsx`) — the first colours outside `:root` since the
      token system landed (§11 rule 19). Brand colours may justify an
      exception; decide, then either tokenise or record the exception here.
      **Untouched by the Stage 0 housekeeping commit** — out of its scope.
    - **Resolved (2026-08-02, Stage 0 housekeeping — user decision A).** The
      GH Pages workflow (`.github/workflows/deploy.yml`) is deleted. Vercel
      is the sole deploy target now; there is no dual-deploy question left.
    - **Resolved (2026-08-03, found and fixed while browser-verifying Stage
      1 routing on a real phone).** On mobile (`max-width: 767px`), the
      §2.16 rework gave `.sidebar-region` (the bottom sheet) `z-index: 100`
      and `.tab-bar` `z-index: 200`, but never raised `.detail-backdrop`/
      `.detail-sheet` above their pre-rework values of `20`/`21` — so
      opening a restaurant's detail on a phone rendered it **behind** the
      bottom sheet and tab bar, with only a sliver visible at the top of
      the screen (looks like "nothing happened" or "opened behind the
      map," depending on sheet height). Root cause confirmed via
      `src/index.css`: `.app-shell` has `position: relative` but no
      `z-index`, so it creates no stacking context, and `.detail-sheet`
      (`position: fixed`) competes directly against `.sidebar-region` in
      the *global* stacking context regardless of DOM order — 100 beats
      21. Not caused by the routing change (the JSX/CSS for
      `RestaurantDetail` is untouched by Tasks 1-3 of that work; only how
      `selectedRestaurant` gets its value changed) — it was there since
      the shell rework, just never exercised on an actual narrow
      viewport until this session's browser check. Fix: raised
      `.detail-backdrop`/`.detail-sheet` to `z-index: 210`/`211` —
      clears the mobile tab bar (200) with room to spare, still well
      below the gallery lightbox (`9999`/`10000`), which must stay above
      the detail sheet itself. The fix is not media-query-scoped, so it
      applies at every breakpoint, not just mobile — checked at a
      1440×900 desktop viewport too: the only behavioral change there is
      that the sidebar-collapse chevron (`.sidebar-toggle`, `z-index: 30`)
      is now covered by the modal backdrop while a detail is open, which
      is correct modal behavior, not a regression. Landed at `d501e1f`,
      its own commit separate from the routing commit, since it's an
      unrelated pre-existing bug.
    - The rework was **never gate-checked or browser-QA'd under §11 rule
      16** — still true for the shell as a whole (Prologue, sidebar/bottom
      sheet, layout) apart from the one detail-view stacking bug just
      fixed above. The Stage 0 housekeeping commit itself passed all five
      gates; its one UI-visible change (the Badges grid) was checked in a
      running `npm run dev` session with the user confirming the result
      directly, since the browser-automation tool was unavailable in that
      session.
21. **Two minor findings deferred from the Stage 1 routing review
    (2026-08-03), parked rather than fixed — neither is a bug today:**
    - `src/App.jsx`'s `AppShell` introduced an outer `const { id } =
      useParams()`. Two pre-existing handlers, `handleToggleBookmark(id)`
      and `handleToggleVisited(id)`, take a same-named local parameter
      (a restaurant id, not the route id) — a shadow relationship that
      didn't exist before this change. Both bodies only ever reference
      their own local `id`, so it's inert today; a rename wasn't done
      because it's outside those functions' actual change surface. Worth
      renaming if either function is touched again for an unrelated reason.
    - `scripts/prerender-places.mjs`'s tag replacement is regex-`.replace()`
      against the built `index.html` template — if a future edit to
      `index.html` ever removes one of the six `og:*`/`title`/`description`
      tags, the affected prerendered pages would silently keep the generic
      value with no build failure. Today this can't happen (Step 1 of the
      routing plan guarantees all target tags exist), but there's no
      assertion catching future drift. Worth an explicit check
      (`if (html === before) throw ...`) if this script grows more tags.
22. **og:image intentionally omitted from both the homepage and all 18
    prerendered restaurant pages (2026-08-03).** Every restaurant's `image`
    field today is a category illustration SVG (§2.2's image contract — no
    real photos yet), and Facebook/Twitter/KakaoTalk link-preview crawlers
    all require JPEG/PNG/GIF/WebP, silently dropping `og:image` values
    pointing at SVG. Rather than ship a tag that never renders, it was
    removed for now — `og:title`/`og:description` still work correctly and
    are the substantive part of the crawler-visibility improvement.
    Restoring `og:image` needs raster (PNG/JPEG) versions of the
    illustrations, or real restaurant photos once available — not
    scheduled.
23. **A first-time visitor following a shared `/place/:id` link sees the
    4-step Prologue onboarding before the shared restaurant, not the
    restaurant itself.** It's recoverable — the URL is untouched, so
    completing onboarding lands on the correct place — but Stage 1 exists
    specifically to make links reachable by strangers, and this onboarding
    gate is the first thing they'd hit. Decided (2026-08-03) to leave as-is
    for now rather than special-case it; revisit if real usage shows
    meaningful drop-off on shared links before completing Prologue.
24. **Two small SEO extensions were suggested but not built (2026-08-03
    review):** a `twitter:card`/`summary_large_image` tag (X falls back to
    `og:*` today, rendering a smaller card) — one line in
    `scripts/prerender-places.mjs`'s `replacements()` table if added; and a
    `sitemap.xml`/`robots.txt` pointing crawlers at the 18 prerendered
    `/place/:id` URLs (there's no `public/robots.txt` or sitemap today).
    Neither is scheduled — recorded so they're a deliberate future choice,
    not an oversight.
25. **`--ink-title` CSS custom property is referenced 12 times across
    `index.css`/`Prologue.css` but never declared anywhere** — found
    2026-08-03 while building the offline banner (`.offline-banner`),
    which needed a `background: var(--ink-title)` per the original plan
    and rendered with an invisible (transparent) background as a result.
    Root cause: `color` is an inherited CSS property, so the other 11
    pre-existing `color: var(--ink-title)` usages silently fall back to
    whatever dark color their ancestor already resolves to (ultimately
    `body`'s `color: var(--ink)`) and look correct by accident;
    `background` is not inherited, so the same invalid reference resolves
    to `transparent` instead, which is how this stayed hidden until a
    `background` usage finally exposed it. Fixed locally: the banner uses
    `var(--ink)` (the actual defined variable, `#1F2328`) instead. The
    other 11 pre-existing usages were deliberately left untouched —
    currently harmless, out of that task's scope. Future cleanup should
    either declare `--ink-title` in `:root` (as an alias to `--ink`, if
    that's genuinely what all 12 sites meant) or rename all 12 references
    to `--ink` directly. Not scheduled.
26. **Two more offline gaps found by the final whole-branch review
    (2026-08-03), not fixed in the same pass as #1 (illustration SVGs,
    which WAS fixed):** (1) The Inter webfont (`src/index.css:1`, `@import`
    from `fonts.googleapis.com`) is a cross-origin request the service
    worker doesn't cache — offline, the app silently falls back to system
    fonts. Fixing it needs a Workbox `runtimeCaching` rule for
    `fonts.googleapis.com`/`fonts.gstatic.com` (the standard CacheFirst
    recipe) or self-hosting the font; neither was done here to avoid
    guessing at unverified Workbox runtime-caching config syntax, matching
    this project's practice of not shipping unverified assumptions (see
    the build-ordering and `navigateFallbackDenylist` corrections earlier
    in this same feature). (2) A restaurant added to `restaurants.js`
    after a user's service worker last updated won't appear if they open a
    deep link to it while offline — the cached shell's JS bundle is the
    version at last update, so it doesn't know about the new restaurant
    and redirects home via the existing bad-id guard, same as a genuinely
    nonexistent id. Neither gap is scheduled; both are edge cases (a
    returning offline user hitting exactly these paths) rather than the
    core scenario (browsing already-known restaurants offline), which
    works correctly.

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
| Data verification | 18/20 have ≥1 confirmed field; 18/20 confirmed coordinates; 19/20 street addresses (the 20th is `makan`, quarantined); 14/20 structured hours | high (measured 2026-07-17) |
| Lifecycle rollout | 2/20 (`akiya`, `makan`) quarantined; 18/20 `ACTIVE`; mechanism (§2.14) committed at `b4c0e4b`, `makan`'s determination committed at `55490f1` | high (measured, incl. live browser check) |
| Evidence migration | 1/20 | high |
| Story sourcing | 1/20 has `storyRefs` | high |
| Image rights research | 5/20 have leads; **8 leads, 0 reusable** | medium — only 5 venues surveyed |
| Contact data | officialUrl 8/20, phone 15/20, instagram 7/20, transit 16/20 | high (measured 2026-07-17) |

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
| **`makan` — resolved, quarantined 2026-07-17** | Was **High** | Settled, not merely upgraded. Prior existence is well-evidenced (a decade of independent blog visits, 112 TripAdvisor reviews, a named owner) — this was never an "invented restaurant" risk. What settled it: Seoul's official tourism site (visitseoul.net, last modified 2025-11-17) marks it **"[운영중지]"** (operation suspended), corroborated by absence from both Naver Place and Kakao Map under every name/address variant tried, validated against a working control (`eid`, same street, resolves on both). No evidence dated after mid-2025 shows continued operation. Directory sites (TripAdvisor, trazy, ohmyseoul, 10mag) still list it as open — expected lag, not counter-evidence. Quarantined rather than archived only because `ARCHIVED` has no implemented logic yet (§2.14). See §12. |
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

**Project roadmap — six phases, adopted 2026-07-18.** This is the
authoritative statement of it. Prior discussion of this roadmap outside this
document was provisional — a decision meant to survive sessions is not
project state until it is written here (§11 rule 21 extended to governance,
not only data).

| # | Phase | State |
|---|---|---|
| 1 | Foundation | ✅ Done — see §1 Maturity |
| 2 | Production Infrastructure | ✅ Done — see §1 Maturity, §8 Completed |
| 3 | **Production Data** | **✅ Done, 2026-07-17, committed `f0e5af4`.** Phase A below is complete: every active restaurant verified. |
| 4 | Final QA | **Ready to begin** — not yet started; see §12 |
| 5 | Version 1.0 | Not started |
| 6 | Feature Phase 2 | Not started — begins only after Phase 5 |

Each phase depends on the last. Do not reorder without explicit approval.

### Phase 3 — Production Data *(✅ complete, 2026-07-17)*

This phase contains the existing implementation roadmap below, Phases A–D.
**Only Phase A gated Phase 4 and 5, and Phase A is now done.** Phases B, C
and D continue past Phase 3 but do not block Final QA or v1.0 — §7 High #1
already treats evidence migration as non-blocking debt; this makes that fact
part of the roadmap, not only the debt log. **Phase 4 (Final QA) is ready to
begin** — see §12.

#### Phase A — Data Verification *(✅ complete)*
Bring the remaining unverified restaurants to the Gonghwachun standard, one at
a time, each with a completion report.
**`akiya` and `makan` are both resolved, not verified.** `akiya` (investigated
2026-07-17): no trace on Naver Place, Kakao Map, or the geocoding pipeline;
existence itself unconfirmed. `makan` (investigated 2026-07-17): existence is
well-evidenced historically, but Seoul's tourism site marks it "[운영중지]"
and it is absent from both map services — a closure signal, not an
existence-unconfirmed one, though both land on `QUARANTINE` today since
`ARCHIVED` (the more precise label for confirmed-closure) has no implemented
logic — see §2.14. Neither was brought to production quality; both close out
of this queue without adding to the "verified" count.
`chaeyuk-songdo`, `iryonghal`, `rim`, `meat-morning`, `bombay-brau`,
`arabesque`, `kampungku` and `nono-shop` were all verified to the
Gonghwachun standard on 2026-07-17 and all eight stay `ACTIVE`. **Phase A is
complete: 8 restaurants verified, 2 quarantined, 0 remaining.** Between the
eight they show eight distinct ways a draft record goes wrong:
`chaeyuk-songdo`'s dietary level described a different kitchen, `iryonghal`
was filed under the wrong Incheon district outright, `rim` was accurate when
written but went stale, `meat-morning` combined both — wrong district and a
mislabelled vegan claim — `bombay-brau` was the mildest case (district and
vegan level already correct, one mislabelled menu item), `arabesque`
combined a real, government-sourced history (2003 as "Sahara Ten," renamed
2007) with an overstated dietary claim, `kampungku` was the most severe —
not a wrong district but a fabricated address in a different part of Seoul
entirely, ~4 km from the real location — and `nono-shop` closed the phase
with the `rim` pattern again: a real relocation (Itaewon to Hoehyeon
Station, documented across nine dated posts) that made an accurate draft
stale rather than wrong.
**Phase A is done.** No further restaurants are queued — see §12 for the
transition to Phase 4.
**Why first:** everything downstream compounds on the data. Migrating unverified
facts into evidence records just makes bad data auditable.

#### Phase B — Evidence Migration *(not required for v1.0)*
Move all 20 onto the evidence layer, retiring inline `url`/`method`.
**Why after A:** migration is a re-reading exercise. Migrate a verified fact and
you capture a real excerpt; migrate an unverified one and you fabricate one.
Doing A and B in one pass per restaurant is acceptable and probably optimal.

#### Phase C — Entity Layer *(not required for v1.0)*
Restaurants are not the only entities. `짜장면박물관` is a museum; `공화춘터` is a
heritage site; `ggot-epida` has two branches. Introduce a place-entity model
with typed relations (`branch-of`, `succeeded-by`, `near`, `commemorates`).
**Why after B:** relations need sourcing too. An entity graph built on unsourced
claims is a faster way to be confidently wrong.

#### Phase D — Knowledge Graph *(not required for v1.0)*
Link entities to culture concepts (jajangmyeon, 사찰음식, 발우공양, 오신채) and to
each other. This is where the public-diplomacy value compounds: a traveller
follows *fermentation* across four restaurants and a museum.
**Why last:** a graph is only as good as its nodes and edges.

#### Cross-cutting, any time after A *(not required for v1.0)*
- **Content pass:** strip marketing tone from the 19 remaining stories; write
  per-place `didYouKnow`/`diningTips` for the crowded categories.
- **Photography:** the licence research says every route needs permission.
  Commissioning original photos may be cheaper than clearing rights.
- **Staleness policy:** decide a re-check interval; have `check-data` warn.
- **Coverage:** add reusable-container venues and traditional markets — both in
  the founding proposal, both absent.

### Phase 4 — Final QA

One complete sweep, run only after Phase A has no unverified active
restaurants left. Reuses gates that already exist — no new tooling:

- `npm run check-data` — 0 violations
- `node scripts/evidence-hash.mjs --check` — 0 pending, 0 drifted
- confidence/lifecycle consistency — no active fact above its evidence
  ceiling (§2.7); the `JournalPanel` quarantine bypass resolved (§7 Medium #11)
- browser QA — responsive (375/768/1280/1440) and AA contrast re-check (§8)
- bundle hygiene — `grep -rc retrievedBy dist/` = 0
- documentation verification — every figure in this document re-measured
  against the repository at the release commit, not carried over (§7 Low #16)

**Why after Phase 3:** these gates check that Phase 3's work is true at the
release commit; running them earlier just means running them again later.

### Phase 5 — Version 1.0

Release once every Phase 4 gate is green. v1.0 means every visible claim is
either verified or honestly marked unknown — no speculation, no hidden
assumptions. Does **not** require Phase B/C/D complete, real photography,
i18n, or any Phase 6 feature — see §8 "Not started" for what ships absent.

### Phase 6 — Feature Phase 2

Begins only after Phase 5. No Phase 6 work starts before v1.0 ships.
Recommended order, frozen 2026-07-18 unless explicitly changed:

1. **Multilingual (i18n).** Largest reach limiter for a public-diplomacy
   product aimed at foreign visitors; touches every screen, so it goes first
   to avoid rework once more screens exist.
2. **Nearby Route.** Reuses coordinates already confirmed in Phase 3 and the
   Kakao routing already used at authoring time — low new-risk, high reuse.
   **MVP shipped.** The §2.1 question raised in §12 was settled by *not*
   routing in-app: `directionsUrl()` now deep-links to Google Maps with an
   origin (the current map centre) as well as the destination, so it opens a
   routed trip rather than a bare pin — a link, not a runtime routing call, so
   the no-backend constraint holds. Everything the planning notes filed under
   Future Expansion (in-app polyline, ETA, transit-mode choice, live location)
   stays out of scope. See §12. *(The §2.16 shell rework later added Naver and
   Kakao deep-link buttons beside the Google one — same link-not-runtime-call
   approach, so §2.1 still holds.)*
3. **Journey + Passport expansion.** Extends the existing Journal/passport
   already in the core loop; no new data risk.
   **Passport half: MVP shipped.** Saved and visited are now distinct states
   and passport progress counts visits — see §2.15 for the state model and §7
   Low #17 for the debt it left (#18 was later fixed by the §2.16 rework).
   **Story Timeline — the separate `Add`
   candidate this item was split into during Phase 6 planning — also shipped:**
   a sourced history timeline in the detail page, on the three venues whose
   story already carries one (§12).
   **Food Journey half: MVP shipped (2026-08-03, GROWTH-PLAN Stage 2 item 3).**
   `src/data/journeys.js` holds one editorially-curated journey — theme
   curation over already-verified restaurants, no new facts, same as
   `story`/`vibe` prose. **The frozen plan's example itinerary didn't
   survive contact with the data:** it named `eid` + `kampungku` as an
   "Itaewon half-day," but `kampungku`'s zone was corrected to Myeongdong/
   Jung-gu during 2026-07-17 verification — over 4 km from Itaewon, not a
   stale address but a different real street with no connection to the
   venue (see its record in `restaurants.js`). Itaewon's only other active,
   non-quarantined halal option is `makan`, which is quarantined
   (unconfirmed existence, §2.14) and cannot be used. Re-scoped, with the
   user's approval, to "Itaewon: A Half-Day of Dietary Diversity" — `eid`
   (halal) plus two of Itaewon's three verified vegan restaurants
   (`plant-cafe`, `monks-butcher`) — all three genuinely in the same
   neighborhood. Rendered in `TabPanel.jsx`'s Discover tab; each stop
   navigates via `useNavigate()` straight to `/place/:id` (no prop-drilled
   `onRestaurantClick` needed — any router descendant can call the hook
   directly). A journey is hidden entirely if any one of its stops is ever
   quarantined, rather than silently dropping a stop and leaving the
   editorial "N restaurants" claim wrong.
4. **ESG Explorer.** Gated on a content pass first — `esg_point` is
   currently thin and unaudited (the invented `food_mile` field was already
   deleted at P0; nothing sourced replaced it).
   **MVP shipped, deliberately below that gate — recorded as F4 in Phase 6
   planning, not an oversight.** The gate above describes the *full* feature:
   a richer ESG surface does need the content pass first. The MVP scoped
   under it does not, because it writes nothing — it surfaces the `esg_point`
   already rendered on the detail page, carrying the same "not independently
   audited" caveat, so no claim gets stronger by being easier to find. The
   two statements are both true at different scopes; read them together
   rather than treating either as settled on its own. See §7 Low #19 for what
   the current data can and cannot support, and §12.
5. **AI Food Guide.** Deliberately late. An inference layer is only safe on
   top of fully-sourced data and Phase C/D's entity/knowledge graph;
   attempted earlier, it risks reintroducing the confident-hallucination
   failure P0 removed.
6. **Offline Mode.** A packaging concern, largely orthogonal to the rest.
   Caching unstable content offline is worse than not caching, so it waits
   for content to settle rather than leading.
7. **User features.** The only item that breaks the load-bearing no-backend
   constraint (§2.1), and it carries a moderation obligation already reasoned
   about (§2.11: unmoderated crowd halal claims would be worse than no data).
   Last, and gated on an infrastructure decision not yet made.

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

**Phases 1–5 are closed.** Production Data (Phase 3) and Final QA (Phase 4)
completed 2026-07-18, and v1.0 shipped at `07feea7` with `README.md` and
`CHANGELOG.md`. The project is in **Phase 6 — Feature Phase 2** (§10).

**Four Phase 6 features are complete.**

**`Passport Enhancement` MVP** — committed at `c01db9c`. Saved and visited are
distinct states (`visitedAt` alongside `savedAt` under the same
`kfm-bookmarks` key, invariant holding by construction — §2.15), and passport
progress counts visits rather than saves. Debt at §7 Low #17 (#18 was later
fixed by the §2.16 rework).

**`ESG Explorer` MVP** — committed at `3a0ca9f`. A sustainability lens over the
list that **creates no data**: a `Sustainability` group chip (OR over its two
member traits, kept alongside them), and — while the axis is filtered — each
card showing that restaurant's `esg_point` **verbatim** with the detail page's
caveat printed once. Shipped below §10's stated content-pass gate on purpose
(§10 Phase 6 item 4, the F4 record); the data's measured limits are §7 Low #19.

**`Nearby Route` MVP** — committed at `8807bac`. The §2.1 question this section
previously flagged was settled by **not routing in-app**:
`directionsUrl(place, origin)` deep-links to Google Maps with the current map
centre as `origin` and the venue as `destination`, opening a routed trip
instead of a bare pin. `origin` is optional and falls back to the previous pin
URL, so the link can never break. No runtime network call is added, so the
no-backend constraint (§2.1) holds. In-app polyline, ETA, transit-mode choice
and live location are Future Expansion and were not built.

**`Story Timeline` MVP** — committed at `31e4b2f`. A sourced history timeline
in the detail page's Food Story section, and it **creates no new facts** —
every entry is drawn from the venue's existing `story`, all confirmed during
the 2026-07-17 Phase 3 verification, none newly researched:

- A new `timeline` **editorial field** (`[{ year, event }]`) on the data
  layer, at the same level as `story`/`vibe`/`esg_point` — not a `fact()`, so
  it inherits the story's sourcing rather than adding a parallel one, and
  `check-data` (which only validates the known fact fields) is unaffected.
- Present on **three** venues only — `gonghwachun`, `arabesque`, `rim` — the
  ones whose story carries **more than one** dated event. `nono-shop` and
  `chaeyuk-songdo` have a single dated event each (a relocation, a patent
  year), which is not a timeline; they get none. Not researching the absent
  ones is the point (Scope forbids new historical research), so partial
  coverage is correct, not a gap — the same stance as `storyRefs` 1/20.
- `gonghwachun`'s entry keeps the distinction its story is built around: the
  1905 original (closed 1983) and the separate business trading under the name
  today (trademark 2002, opened 2004) are four separate events, never merged
  into one lineage. Blurring them would repeat the false-heritage error that
  `gonghwachun`'s own verification (`e84f677`) existed to correct.
- Renders only where `timeline` is present; every other detail page is
  byte-unchanged. `restaurants.js` is edited for the first time since v1.0 —
  three records gain the field, no existing value is touched.

**After those four MVPs**, the §2.16 shell rework landed externally
(Prologue, sidebar/bottom-sheet layout, Naver/Kakao direction buttons, the
Journal redesign) and the repository incident was resolved with the `dd0c7a4`
restore. That is the state this HEAD describes.

### Next recommended task

A new growth-oriented development plan was drawn up on 2026-08-02 (informed
by a competitive study of eatpass.kr and the map/curation-app market) and is
written out in full — stages, open decisions, session-start procedure — in
**`docs/GROWTH-PLAN.md`**, the handoff for continuing this work in any
session. Its staged shape: **(0)** housekeeping → **(1)** shareable URLs + SEO →
**(2)** activation work that needs no backend (sample passport, empty states,
Food Journey MVP, offline) → **(3)** Multilingual → **(4)** the
backend-gated community features (UGC intake, Cross-Device Sync) plus a
verification-gated data-expansion pipeline — explicitly *not* a bulk import.

Immediately next, in order:

1. ~~**Housekeeping commit**~~ — **done, 2026-08-02.** Untracked `temp.js` /
   `.claude/launch.json`; lint 15 → 1 (one warning left deliberately, see §7
   #14); GH Pages workflow deleted (§7 #20, decision A); Badges grid wired
   to real journal state, Spicy Master removed rather than faked
   (§7 #20, decision B). Both decisions were the user's, per GROWTH-PLAN §5.
2. ~~**The §2.1 routing decision (GROWTH-PLAN decision C)**~~ — **done,
   2026-08-03.** User approved amending "no router." Implemented via
   `react-router` + build-time prerendering, brainstormed and planned
   through `superpowers:brainstorming`/`writing-plans`/
   `subagent-driven-development` (spec: `docs/superpowers/specs/2026-08-02-routing-design.md`;
   plan + review record: `docs/superpowers/plans/2026-08-02-stage1-routing.md`).
   See §2.1 for the resulting architecture. Two minor findings from the
   review loop were parked, not fixed — §7 Low #21.
3. Stage 2 features, one at a time, under the normal §11 discipline. The
   §2.1 "no backend" question (GROWTH-PLAN decision D) stays deferred until
   Stage 4 actually needs it — not asked yet, don't decide it early.
   - ~~**Trust surfacing**~~ — **done, 2026-08-03** (`125667d`). Prologue
     step 1 now states the active restaurant count (computed from data,
     not hardcoded) and "researched one at a time — every claim sourced,
     or marked honestly unknown." Deliberately not "verified"/a percentage
     — §8 already established no single such figure is meaningful here.
     Placed once, in Prologue, not as a persistent home-screen banner.
   - ~~**Sample passport**~~ — **done, 2026-08-03** (`4643137`).
     `JournalPanel`'s empty state (0 bookmarks) now previews 3 real
     restaurants (`SAMPLE_IDS` in `JournalPanel.jsx`, filtered through
     `isQuarantined` like everywhere else) rendered as stamps but tagged
     "SAMPLE" instead of a date — no fabricated visit/save data, per §11's
     honesty rule. Followed by a 3-step "how to start" guide, reusing
     `.journal-empty__steps`/`.journal-empty__step-num` CSS that existed
     but was unused since the §2.16 rework simplified the passport (dead
     code, not deleted, now doing something). This also substantially
     covers GROWTH-PLAN Stage 2 item 2 ("빈 상태 개선") for the Journal
     specifically; other dead-end screens (e.g. zero-filter-match) are
     lower priority since they already suggest a next action.
   - ~~**Food Journey MVP**~~ — **done, 2026-08-03** (`4f882c1`).
     See §10 Phase 6 item 3 for the full account, including why the
     frozen plan's original example itinerary (`eid`+`kampungku`) had to
     be re-scoped — it wasn't geographically real. Shipped as "Itaewon: A
     Half-Day of Dietary Diversity" (`eid` + `plant-cafe` + `monks-butcher`)
     in `src/data/journeys.js`, surfaced in Discover.
   - ~~**Offline MVP**~~ — **done, 2026-08-03** (`a7979a3`). See §2.1
     "Offline" for the full architecture. `navigateFallback` was already
     in the *drafted* Offline MVP config as a general safety net, and
     turned out to be the sole mechanism actually needed for `/place/:id`
     to work offline, once a build-ordering gap meant those pages are
     never precached; verified
     end-to-end with a never-visited `/place/:id` opened cold, genuinely
     offline. Design spec:
     `docs/superpowers/specs/2026-08-03-offline-mvp-design.md`; plan +
     review record: `docs/superpowers/plans/2026-08-03-offline-mvp.md`.
   - **Stage 2 is now fully shipped (all 5 items).** Stage 3
     (Multilingual) is next per GROWTH-PLAN §4 — not started, no work done
     toward it yet.

The remaining Phase 6 MVP scopes (Multilingual, AI Food Guide,
Cross-Device Sync, UGC) stay frozen from Phase 6 planning (Offline and
Food Journey are now both shipped, see above) and slot into the stages
above; implement them directly rather than re-planning.

**Do not:** repeat the §2.16 pattern — no work outside the gates and this
log; bulk-import restaurant data (the eatpass study is the cautionary tale:
3,867 unverified rows render a ghost town); derive any ESG category, score
or ranking from `esg_point` text (§7 Low #19); add in-app routing, ETA, or
live location to Nearby Route (Future Expansion, §10 item 2); research new
history to widen Story Timeline coverage (Scope forbids it — §10 item 3);
decide GROWTH-PLAN's open decisions (C, D) unilaterally — ask first.

---

### Quick start

```bash
npm install
npm run dev           # http://localhost:5173
npm run check-data    # the gate — must print "No violations."
npm run lint
npm run build && grep -rc retrievedBy dist/   # must print 0

node scripts/evidence-hash.mjs --check            # evidence seal drift
node scripts/migrate-dietary-v2.mjs --dry         # the dietary decision record
```

Read next: `docs/EVIDENCE.md`, then `docs/DATA.md`.

*Windows note: the repo path contains spaces and Korean characters. Some
tooling needs a junction (`mklink /J`) to a plain-ASCII path.*
