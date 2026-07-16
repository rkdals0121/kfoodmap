# Restaurant data — schema v2

The app's credibility rests on this file being honest. Two rules govern it:

1. **Never infer.** A value is only stated when a source states it. Where the
   source is silent, ambiguous, or contradicts itself, the answer is `unknown`.
2. **Never chain.** A value derived from another unverified value is inference,
   not evidence. "Plant-based, therefore halal" is exactly the mistake v1 made.

`unknown` is always preferable to a plausible guess. A traveller can work with
"we don't know"; they cannot work with a wrong badge.

---

## The `fact()` wrapper

Every field a user might act on carries its provenance:

```js
hours: fact('11:30 AM – 9:30 PM', {
  status: STATUS.ESTIMATED,
  source: SOURCE.DRAFT,
  lastCheckedAt: null,
})
```

| Key | Meaning |
|---|---|
| `value` | The value, or `null` when unknown |
| `status` | `verified` \| `estimated` \| `unknown` |
| `source` | Where it came from (`SOURCE.*`) |
| `lastCheckedAt` | ISO date of the last confirmation, or `null` |
| `evidence` | Free text: the quote or reasoning behind the value |

`fact()` enforces the invariant that an `unknown` fact has no value, and a
valueless fact is `unknown` — the two can never disagree.

### Status meanings

- **`verified`** — confirmed against a primary source (on-site visit, official
  registry, or the operator). **Nothing in the dataset is `verified` today.**
- **`estimated`** — from project research, not confirmed. Treat as a lead.
- **`unknown`** — we don't know. The UI must not render it as fact.

Helpers: `isKnown(f)`, `isVerified(f)`, `needsCheck(f)`.

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
not just ingredients. Where a certificate is *claimed* but unsighted, record it
as `halalCertClaim` and leave the level at `friendly`. The UI prints the claim
as a claim.

`porkFree` exists for when someone confirms it directly. It is **not** derived
from a `full` vegan level: that would chain one unverified value onto another.

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

## Migration v1 → v2

Performed by `scripts/migrate-dietary-v2.mjs`, which is the migration record:
every dietary judgement is in its decision table with the evidence quoted from
the v1 draft. Re-run `--dry` to review the reasoning without writing.

| v1 | v2 |
|---|---|
| `tags: ['Vegan', 'Mild Taste']` | `dietary.vegan` + `traits: ['Mild Taste']` |
| `lat`, `lng` | `coordinates: fact({lat,lng}, …)` |
| `address` (string) | `address: fact(string, { precision: 'street' \| 'area' })` |
| `hours` (string \| null) | `hours: fact(…)`; `null` → `unknownFact` |
| `menus` (array) | `menus: fact(array, …)` |
| `rating`, `reviews`, `food_mile` | removed |
| `vibe`, `story`, `esg_point` | unchanged (editorial; claims inside unverified) |
| `image`, `photo`, `coverImage`, `gallery` | unchanged |

Two integrity fixes landed with the migration:

- **`bombay-brau`** — was tagged `Vegan` while its menu lists Halal Tandoori
  Chicken. Now `vegan: options`. A vegan filtering the map no longer gets a
  place that serves chicken under a "Vegan" badge.
- **`maji`** — was tagged `Halal` on the reasoning "plant-based, therefore
  naturally halal". That inference is removed: `halal: unknown`.

Bookmarks are keyed by `id` and are unaffected; no localStorage migration.

### Adding or updating a place

1. Write the value with the **weakest** level the evidence supports.
2. Set `status`, `source`, and quote the evidence.
3. If you had to reason from another field to get there — stop. That's `unknown`.

### Promoting to `verified` (P1)

Confirm against a primary source, then set `status: STATUS.VERIFIED`, a real
`source`, and `lastCheckedAt`. The UI's disclosure text keys off `status`, so it
quietens down on its own as real verification arrives.
