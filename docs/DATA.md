# Restaurant data — schema v3

The app's credibility rests on this file being honest. Two rules govern it:

1. **Never overstate.** A value is stated only as strongly as its evidence. Where
   the source is silent, ambiguous, or contradicts itself, the answer is `unknown`.
2. **Never chain.** A value derived from another unconfirmed value is not
   evidence. "Plant-based, therefore halal" is exactly the mistake v1 made.

`unknown` is always preferable to a plausible guess. A traveller can work with
"we don't know"; they cannot work with a wrong badge.

Run `npm run check-data` to enforce these mechanically.

---

## Two axes, not one

Every fact carries **confidence** (how far we trust it) and **source** (where it
came from). These answer different questions and are kept apart on purpose:
a single enum mixing them cannot express "community-reported *and* we confirmed
it" or "official *but* three years stale". The UI collapses the pair into one
badge — model expressiveness and screen simplicity are not a trade-off.

```js
hours: fact('11:30 AM – 9:30 PM', {
  confidence: CONFIDENCE.SUPPORTED,
  source: SOURCE.RESEARCH,
  lastCheckedAt: null,
})
```

| Key | Meaning |
|---|---|
| `value` | The value, or `null` when unknown |
| `confidence` | `confirmed` \| `supported` \| `inferred` \| `unknown` |
| `source` | Where it came from (`SOURCE.*`) |
| `lastCheckedAt` | ISO date of the last confirmation, or `null` |
| `evidence` | The quote or reasoning behind the value |

`fact()` enforces the invariant that an `unknown` fact has no value, and a
valueless fact is `unknown` — the two can never disagree.

### Confidence

- **`confirmed`** — checked against a primary source: a registry, the operator,
  or an on-site visit. Requires `lastCheckedAt`. **Nothing is `confirmed` today.**
- **`supported`** — a source states it outright ("100% vegan meals"; a menu
  lists it), but nobody has checked it.
- **`inferred`** — our reading of context: the kind of kitchen, or how the venue
  brands itself. The reasoning goes in `evidence`.
- **`unknown`** — we don't know. Never rendered as fact.

The `supported` / `inferred` split is why the app can now say *"the kitchen
describes itself as 100% vegan"* rather than flattening that into the same
"unverified" as *"we assumed, because it's a temple"*.

### Source

`OFFICIAL` · `OPERATOR` · `COMMUNITY` · `RESEARCH` · `SELF_DECLARED` ·
`GEOCODER` · `AREA_FALLBACK`

`COMMUNITY` is reserved for traveller reports. It must not carry `confirmed`
until a moderation policy exists — for a public-diplomacy project, unmoderated
crowd claims about halal would be worse than no data at all.

### The badge

`trustBadge(fact)` collapses the pair into one word:

| Confidence × source | Badge |
|---|---|
| confirmed + OFFICIAL | **Official** |
| confirmed + COMMUNITY | **Community-checked** |
| confirmed (other) | **Confirmed** |
| supported | **Reported** |
| inferred | **Inferred** |
| unknown | **Unknown** |

Helpers: `isKnown(f)`, `isConfirmed(f)`, `needsCheck(f)`, `dietaryConfidence(place)`.

---

## Dietary schema

Dietary data is safety-critical, so it is structured rather than tagged.

```js
dietary: {
  vegan: fact(VEGAN.OPTIONS, { status, source, evidence }),
  halal: fact(HALAL.FRIENDLY, { status, source, evidence }),
  halalCertClaim: { body, status },   // optional, see below
}
```

### `VEGAN`

| Level | Means |
|---|---|
| `full` | The whole kitchen is plant-based |
| `options` | Serves animal products **and** has vegan dishes |
| `none` | Known to have nothing vegan |
| `unknown` | Not established |

### `HALAL`

| Level | Means |
|---|---|
| `certified` | Certified by a recognised body. **Requires a certificate reference.** |
| `friendly` | Caters to Muslim diners; no certificate on file |
| `porkFree` | Confirmed to serve no pork; says nothing about certification |
| `none` | Known to serve pork |
| `unknown` | Not established |

**`certified` may never be derived** from a venue's name, its menu wording, or a
vegan claim. Halal concerns slaughter, cross-contamination and certification —
not just ingredients. It requires `confidence: CONFIRMED` **and** a `cert`
reference; `validateDietary()` rejects anything less. Where a certificate is
*claimed* but unsighted, record it as `halalCertClaim` and leave the level at
`friendly`. The UI prints the claim as a claim.

Halal may only be `inferred` from the venue's own declaration (`SELF_DECLARED`)
— never from a category or another dietary field.

`porkFree` exists for when someone confirms it directly. It is **not** derived
from a `full` vegan level: that would chain one unconfirmed value onto another.

### Filtering

`matchesDietary()` is the only way a dietary chip may match. `unknown` never
matches, so a filter never sends someone somewhere we can't vouch for. Badges
print the exact level (`Vegan options` ≠ `Fully vegan`), which is what the v1
tag system got wrong.

---

## Lifecycle (optional field, MVP)

A restaurant's existence/publication state, kept apart from field-level
`confidence` for the same reason confidence is kept apart from source: they
answer different questions. A record can have well-sourced facts and still
need excluding from the live app — because its existence *as an entity* is in
doubt, or because it existed and has since stopped operating.

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

The field is **optional** — a record with no `lifecycle` key is `ACTIVE` by
default (`isQuarantined()` reads `restaurant?.lifecycle?.status`, which is
`undefined` and therefore not `QUARANTINE` for every unmigrated record). No
existing record needed a migration to adopt this.

| Status | Implemented? | Meaning |
|---|---|---|
| `ACTIVE` | Yes (the default) | Renders everywhere: map, search, cards, Journal. |
| `QUARANTINE` | Yes | **Excluded pending better evidence.** Not rendered on any discovery surface; direct navigation to detail is a no-op. Never a claim that the place is fake. Currently carries two different findings — see below. |
| `ARCHIVED` | No — named only, `TODO(lifecycle)` | Reserved for confirmed prior existence + confirmed closure. **Until it exists, that case is filed under `QUARANTINE`.** |
| `DELETED` | No — named only, `TODO(lifecycle)` | Reserved for removal from the active array while retaining the evidence file. Nothing enforces the retention yet. |

### Two findings share `QUARANTINE`. Read the `determination`, not the status.

`ARCHIVED` is the right label for "this existed and has closed," but it is
unimplemented — so that case is filed under `QUARANTINE` alongside "we could
never establish this exists." Both live examples are real:

| Finding | Example | Determination says |
|---|---|---|
| Existence never established | `akiya` | no trace on either map service, the geocoding pipeline, or git history |
| Existed, evidence it has closed | `makan` | Seoul's tourism site marks it "[운영중지]"; dropped by both map services; a decade of prior write-ups confirms it was real |

These are **not** the same claim — *we cannot find this* versus *this was
real and is gone*. They share a status only because both need the same
outcome today (keep it off the map) and `ARCHIVED` would need transition
logic, a rule for what evidence promotes `QUARANTINE` → `ARCHIVED`, and a UI
decision nobody has made (a closed venue may be worth *showing* as closed
rather than hiding). Deferred deliberately, not overlooked.

**Consequence for anyone reading a record:** do not infer the finding from
the status. `lifecycle.determination` is the audit record — it carries the
finding, its source, its method, and its date. That is why it is a `fact()`
and not a boolean.

**`QUARANTINE`, never `DELETE` — for either finding.** Deleting a record is
an unevidenced claim of its own, and this project does not skip its own
evidence bar just because the claim is negative. For a search-absence finding
(`akiya`), deletion would assert an absence nobody proved. For a closure
(`makan`), it would discard a decade of sourced history including the closure
finding itself — which is worth keeping precisely so nobody re-adds the venue
next year.

**The determination is a `fact()`, not a new mechanism.** Reuse, not a
parallel system: `check-data` requires `lifecycle.determination` to be
auditable (an evidence ref, or an inline `method` + `evidence`) before it
will accept `QUARANTINE`, exactly like it requires of any `CONFIRMED` fact.

**Deliberately not on the Evidence Layer — for a search-absence finding.**
`akiya`'s determination is not a sourced claim about the venue; it is a
statement about our own search coverage, so it is recorded inline rather than
as a `data/evidence/<id>.json` record. See `EVIDENCE.md` for what does belong
on the layer.

A closure finding is different: `makan`'s determination cites a government
page at a stable URL with a quotable marker, so by that rule it *is*
evidence-layer-eligible. It is inline anyway because 19 of 20 restaurants
still carry inline `url`/`method`/`evidence` and migration is deliberately
one-restaurant-at-a-time — existing migration debt, not a lifecycle
exemption. Migrate it with the rest of `makan`'s facts, not before.

**Known gap:** `scripts/lib/check-evidence.mjs`'s `factsOf()` — the list of
fields the evidence-layer rules walk — does not include `lifecycle`. If a
future determination used `evidenceRefs` instead of an inline method, those
refs would not get the broken-reference/ceiling/stale-pin checks that every
other fact's refs get. Not triggered by either live example — `akiya` and
`makan` both use an inline method — but real the moment someone writes a
determination that cites `evidenceRefs`. `makan` is the likely trigger: its
determination is evidence-layer-eligible (above), so whoever migrates it
should extend `factsOf()` in the same pass.

### Filtering (extended)

`isQuarantined(restaurant)` is applied once, at the top of `src/App.jsx`
(`activeRestaurants = restaurants.filter(r => !isQuarantined(r))`), and again
at the `openDetail`/`openStory` choke point so a stale reference (a map pin
built before a filter re-render, a Journal stamp) cannot open detail for a
quarantined place. `src/components/JournalPanel.jsx`'s stamp grid and
passport-progress count do **not** go through this filter yet — see
`HANDOFF.md` §7 Medium #11.

---

## Removed in v2

| Field | Why |
|---|---|
| `rating` | Invented. 20 scores in a 4.3–4.9 band is statistically impossible; shown as if real. |
| `reviews` | Invented counts. |
| `food_mile` | Invented kilometres presented as ESG data — greenwashing. All 20 were multiples of five. |

**They are not replaced with new estimates.** If a sourced value appears later
it can return as a `fact()`.

---

## Migrations

The scripts are the migration record: every judgement sits in a decision table
citing the evidence it rests on. Run either with `--dry` to review the reasoning
without writing.

### v1 → v2 — `scripts/migrate-dietary-v2.mjs`

| v1 | v2 |
|---|---|
| `tags: ['Vegan', 'Mild Taste']` | `dietary.vegan` + `traits: ['Mild Taste']` |
| `lat`, `lng` | `coordinates: fact({lat,lng}, …)` |
| `address` (string) | `address: fact(string, { precision: 'street' \| 'area' })` |
| `hours` (string \| null) | `hours: fact(…)`; `null` → `unknownFact` |
| `menus` (array) | `menus: fact(array, …)` |
| `rating`, `reviews`, `food_mile` | removed |
| `vibe`, `story`, `esg_point` | unchanged (editorial; claims inside unconfirmed) |
| `image`, `photo`, `coverImage`, `gallery` | unchanged |

### v2 → v3 — `scripts/migrate-confidence-v3.mjs`

Splits v2's single `estimated` level into `supported` / `inferred` and renames
`status` → `confidence`. The ceiling does not move: nothing becomes `confirmed`.

Outcome: 11 vegan and 4 halal facts are **Reported**; 3 vegan and 2 halal are
**Inferred** (temple category; venue self-naming).

v2 records import a `STATUS` export that v3 no longer has, so they cannot be
loaded in place. Extract a v2 copy from git and pass it in:

```bash
mkdir -p /tmp/v2 && echo '{"type":"module"}' > /tmp/v2/package.json
git show <v2-commit>:src/data/verification.js > /tmp/v2/verification.js
git show <v2-commit>:src/data/restaurants.js  > /tmp/v2/restaurants.js
node scripts/migrate-confidence-v3.mjs --dry --input=/tmp/v2/restaurants.js
```

Two integrity fixes landed with the migration:

- **`bombay-brau`** — was tagged `Vegan` while its menu lists Halal Tandoori
  Chicken. Now `vegan: options`. A vegan filtering the map no longer gets a
  place that serves chicken under a "Vegan" badge.
- **`maji`** — was tagged `Halal` on the reasoning "plant-based, therefore
  naturally halal". That inference is removed: `halal: unknown`.

Bookmarks are keyed by `id` and are unaffected; no localStorage migration.

### Adding or updating a place

1. Write the value with the **weakest** confidence the evidence supports.
2. Set `confidence`, `source`, and quote the evidence.
3. Does a source state it? `supported`. Did you reason it out? `inferred`, and
   say so in `evidence`. Did you reason it from another unconfirmed field?
   Stop — that's `unknown`.
4. Run `npm run check-data`.

### Promoting to `confirmed` (P1)

Check against a primary source, then set `confidence: CONFIDENCE.CONFIRMED`, a
real `source`, and `lastCheckedAt`. The UI's badges and caveats key off
`confidence`, so the page quietens down on its own as real checks arrive — no
UI work needed to cash in the improvement.
