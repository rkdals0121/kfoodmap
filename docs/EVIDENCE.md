# The evidence layer

A fact says **what we believe and how strongly**. Evidence says **why**, in a
form someone else can re-run without reading a line of application code.

```
Restaurant → Fact → EvidenceRef → EvidenceRecord → EvidenceVersion → Source
```

A reviewer should be able to open `data/evidence/<id>.json` and answer:

| Question | Where it is answered |
|---|---|
| Why is this fact here? | the version's `excerpt` — what the page actually said |
| Which evidence supports it? | the fact's `evidenceRefs` |
| When was it checked? | `capturedAt` / `checkedAt` |
| Who checked it? | `retrievedBy` |
| Which version was used? | the ref's pinned `version` |
| Can I reproduce it? | `url` + `method` |

---

## Layout

```
data/evidence/sources.json         one registry of sources, shared
data/evidence/<restaurantId>.json  one file per restaurant
src/data/evidence.js               vocabularies + evidenceRef() (bundled)
scripts/lib/evidence-store.mjs     loading, hashing, resolution (Node only)
scripts/lib/check-evidence.mjs     the validation rules
scripts/evidence-hash.mjs          seals versions
```

**Evidence is not bundled.** It lives outside `src/`, is JSON, and is read only
by `scripts/`. The app never imports it. That is deliberate: at 500 restaurants
this store is megabytes of excerpts and licence notes that no visitor needs, and
keeping it out of `src/` means the browser never pays for the audit trail.

**One file per restaurant**, not one index. Diffs stay readable, two people can
verify different venues without conflicting, and auditing one venue means
opening one file.

---

## What lives where

Facts stay small. They keep only what the UI renders plus a pin:

```js
address: fact("43 Chinatown-ro, Jemulpo-gu, Incheon", {
  confidence: CONFIDENCE.CONFIRMED,
  source: SOURCE.MAP_SERVICE,
  lastCheckedAt: "2026-07-17",
  precision: "street",
  evidence: "Naver, Kakao and Incheon city all give 제물포구 차이나타운로 43",
  evidenceRefs: [
    evidenceRef("ev-gonghwachun-naver-place", 1),
    evidenceRef("ev-gonghwachun-kakao-map", 1, "independent corroboration"),
    evidenceRef("ev-gonghwachun-itour", 1),
  ],
}),
```

`evidence` here is a one-line summary for the badge tooltip — not the audit
trail. URLs, dated excerpts, licences and who fetched what live in the record.
A fact never carries them inline once migrated.

Editorial copy carries `storyRefs` at the restaurant level, because prose is
where an unsourced claim does the most damage.

---

## Records and versions

```jsonc
"ev-gonghwachun-itour": {
  "id": "ev-gonghwachun-itour",
  "sourceId": "src-itour-incheon",
  "title": "공화춘 | 여행지 | 인천투어",
  "url": "https://itour.incheon.go.kr/...",
  "versions": [
    {
      "version": 1,
      "method": "GOV_LISTING",       // how it was read
      "confidence": "supported",     // the ceiling this retrieval can justify
      "status": "active",
      "capturedAt": "2026-07-17",    // when the excerpt was taken
      "checkedAt": "2026-07-17",     // when we last saw it still say this
      "retrievedBy": "claude-opus-4-8",
      "excerpt": "주소: 인천 제물포구 차이나타운로 43 / …",
      "license": { "type": "unknown", "commercialUse": null, "note": "…" },
      "notes": "…",
      "supersedes": null,
      "hash": "ea0e4dd587ff9034"     // seals the frozen fields
    }
  ]
}
```

### `confidence` on a version is a ceiling, not a duplicate

This is the one subtle field. It is **the strongest a fact may claim on this
evidence alone** — not how confident we are of any value.

- an operator's own site → `confirmed`
- a single map lookup → `supported`; the *same* lookup cross-checked against
  the other map service → `confirmed`
- a government listing → `supported` (authoritative, but curated and liable
  to go stale)
- a directory → `supported`

`check-data` enforces `fact.confidence ≤ max(ceiling of its evidence)`. That is
how the project's source-priority order becomes mechanical instead of a habit.
Source **tier** is a separate axis: it decides *whose word wins* when sources
disagree, not how sure we get to be.

### Status

`active` · `superseded` · `partial` (we only got part of the page) ·
`unreachable` (URL is gone; the excerpt is all that survives) · `disputed`.

Only the newest version may be `active`; every older one must be `superseded`.

---

## Immutability

A published version is frozen. `hash` is a SHA-256 over exactly these fields:

```
version, method, confidence, capturedAt, checkedAt,
retrievedBy, excerpt, license, supersedes
```

Edit any of them in place and `check-data` fails with the stored and actual
hashes. `status` is deliberately outside the hash — superseding a version must
not require rewriting it.

**To record that the world changed, append a version:**

```jsonc
{ "version": 1, "status": "superseded", "supersedes": null,  … }
{ "version": 2, "status": "active",     "supersedes": 1,     … }
```

Then re-verify the fact and move its pin to `@2`. Until you do, `check-data`
says so:

> `gonghwachun.hours: pins ev-gonghwachun-itour@1 while v2 exists — re-verify,
> then move the pin`

That warning is the feature. A fact must never inherit a newer claim nobody
re-checked; the pin makes "this fact is behind its evidence" visible instead of
silent.

`scripts/evidence-hash.mjs --reseal <id>@<version>` exists for when a seal
itself was wrong. It is loud and names what it rewrites. It is not for
recording change — appending is.

---

## Adding evidence

1. Fetch the source. Take an excerpt of **what it actually says**, not your
   reading of it.
2. Add or reuse the source in `data/evidence/sources.json`.
3. Add the record to `data/evidence/<restaurantId>.json` with `"hash":
   "PLACEHOLDER"`.
4. `node scripts/evidence-hash.mjs` — seals it.
5. Point the fact at it with `evidenceRef(id, version)`.
6. `npm run check-data`.

If two sources disagree, the field stays `unknown` and both records are kept
with `status: "disputed"`. Never average, never pick the convenient one.

---

## What `check-data` enforces

| Rule | Fails when |
|---|---|
| duplicate ids | the same evidence id appears in two files |
| broken references | a fact pins an id or version that doesn't exist |
| orphan evidence | a record no fact cites |
| invalid version chains | versions skip a number, `supersedes` doesn't point at the previous one, or an old version is still `active` |
| impossible timestamps | not `YYYY-MM-DD`, dated in the future, `capturedAt` after `checkedAt`, or a version captured before the one it supersedes |
| missing URLs | a record has no `url`, `title`, or `sourceId` |
| unsupported methods | `method` isn't one of the seven known methods |
| immutable violations | a sealed version's frozen fields changed |
| over-claiming | a fact's confidence exceeds what its evidence can bear |
| stale pins | newer evidence exists than the fact was verified against |

Dates are compared against **today in Seoul**. Every date here is a Korean
calendar date, and a UTC "today" would call this morning's work the future for
nine hours a day.

---

## Migration

One restaurant is on the layer: **gonghwachun**, chosen because its rewrite
rests on press and encyclopedia sources, so it exercises the parts a simple
address lookup wouldn't.

The other 19 are untouched and still carry inline `url` / `method` / `evidence`.
Both shapes are valid: `check-data` accepts a `CONFIRMED` fact backed by an
inline method **or** by an evidence ref. Nothing breaks while the two coexist.

Migrating one restaurant:

1. Create `data/evidence/<id>.json` from the facts' existing inline `url`,
   `method` and `evidence` — you are moving what is already there, not
   re-researching. Where the inline evidence is only a summary and the real
   quote is gone, capture the page again rather than inventing an excerpt.
2. Seal, point the facts at the refs, drop the now-duplicated inline `url` and
   `method`, and trim `evidence` to a one-line summary.
3. `npm run check-data`.

Do not migrate in bulk. The value is in re-reading each claim while you move it —
that is how gonghwachun's false heritage claim surfaced in the first place.
