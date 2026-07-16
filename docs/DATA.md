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
