# Research brief — K-Food Map data expansion, batch 3 (2026-09-28)

You are adding verified restaurants to K-Food Map, a map for foreign visitors to Korea. Its whole value is that its dietary claims — vegan, halal — can be checked. A wrong halal mark sends a Muslim traveller to eat somewhere unsafe for them; a wrong address sends anyone to the wrong door. **Unknown beats fabricated certainty.** Leaving a field `unknown` is a correct answer, not a failure.

## Read first
- `docs/DATA.md` — schema, confidence levels, dietary rules.
- `HANDOFF.md` §2.11 — source priority: operator site/SNS → government/tourism → map listings → directories.
- `.superpowers/data-expansion/RULINGS.md` — what rounds 1 and 2 got wrong. Every rule below exists because a researcher broke it.
- Model entries in `src/data/restaurants.js`: `cosmos-shop` (vegan), `halal-busan-jib` (halal, operator-sourced), `persian-palace` (halal with an unsighted certificate claim recorded in `halalCertClaim`). Match their shape field for field.

## Hard rules
1. **Only cite pages you actually opened, with their URL.** A WebSearch result summary, "a research aggregation", "several aggregators", or "blog coverage says" without a URL is not evidence and must not appear anywhere — not in `evidence`, `story` or `vibe`. WebSearch is for discovery only; then open the page.
2. **A WebFetch result is a summary written by another model, not the page.** For any quote that decides a dietary level or an address, fetch it twice and use it only if both fetches give the same literal text.
3. **If two sources disagree on a field, that field is `unknown`.** Never pick the convenient one and "note the conflict". **If they disagree on the address or location, do not propose the place at all** — unless the operator's own page settles it (the operator outranks every map).
4. **Halal `certified` is forbidden** unless you sighted a certificate naming the certifying body with a number. A claimed-but-unsighted certificate → `halalCertClaim` (see `persian-palace`), level `friendly`. Halal is never inferred from a trading name, a cuisine, a vegan claim, or **a single item labelled halal** — `friendly` means the restaurant as a whole caters to Muslim diners.
5. **Vegan `full`** needs a source saying the whole kitchen/menu is plant-based. Vegan dishes on a mixed menu is `options`.
6. **`story` and `vibe` are shown to travellers.** They may state nothing the facts leave `unknown` (if `menus` is unknown, name no dishes as fact). No popularity ("loved by", "long-standing following", "popular"), no follower counts, no superlatives unless attributed to a named source ("which its opening press called Korea's first"). **No process talk** — never "this is recorded as…", "we did not treat X as…", "this project chose…". The one exception worth keeping: "no certificate has been sighted" is information a traveller needs.
7. **`source` and `method` must be exact values** from `SOURCE` and `METHOD` in `src/data/verification.js`. Copy them, including the curly apostrophe in `Read from the operator’s own website`.
8. **Naver is unreachable** (API down; naver.com blocked in every browser). Do not try to work around it. Coordinates come from Kakao — read the destination lat/lng from its walking-route link — and are `supported`, never `confirmed`, unless the operator's own page gives the address and Kakao agrees exactly.
9. **Check for duplicates by Korean name and by address**, not only by id. Round 2 nearly re-added an existing restaurant under a new romanisation. Every place in `src/data/restaurants.js` is off-limits.
10. **Closed places.** Look for evidence the place still trades (a post, review or listing from 2025–2026). A place last seen in 2020 is not proposed.
11. **Do not exclude for reasons outside these rules** (distance from a subway, being near another entry). If transit is long, say so honestly in `transit`.
12. `confirmed` needs `lastCheckedAt: '2026-09-28'`, a `method`, and quoted `evidence`. No photos: `photo`/`coverImage` null, `gallery` empty.

## Priority
Halal is the thinnest axis; a halal place with good evidence is worth more than a vegan café. **Korean food** — vegan temple cuisine, vegan Korean home cooking, halal Korean BBQ — is worth more than any other cuisine, because the app is about Korean food.

## Output
Do not touch anything under `src/`. Do not commit. Do not dispatch subagents.
- `.superpowers/data-expansion/b3-<area>.json` — array of complete entries.
- `.superpowers/data-expansion/b3-<area>.md` — per place: every URL opened and its tier, every field left unknown and why; then every place investigated and **not** proposed, with the reason.

Return only: entries written (id, Korean name, vegan level/confidence, halal level/confidence) and the not-proposed list in one line each.
