# Review brief — translated research notes (K-Food Map)

K-Food Map is a food map of Korea for foreign visitors. Under each dietary claim ("Vegan options · Reported", "Halal-friendly · Reported") a "Why?" note says what the claim rests on. The English notes (`en_vegan`, `en_halal`; sometimes `en_cert_body`, `en_cert_note`, `en_timeline`) were machine-translated (`tr_…`). These notes are the trust core of the product: a reader with a religious or ethical diet decides from them. Read EVERY entry in your files and compare translation with English. Write corrections for real defects only.

## Defects (fix)
1. Meaning differs: something added, dropped, reversed; a date, number, price, count, floor, distance, name of a source or body changed; a sentence missing.
2. Trust strength changed — the most important class. Keep exactly: "says / lists / describes / reports / claims / according to", "is said to", "may", "appears", "not stated", "no source says", "unverified". "No certificate has been sighted / we have not seen a certificate" = we have not seen one — NOT "could not be confirmed", NOT "does not exist". "Halal-friendly" is not "halal-certified"; "Muslim-friendly" listing is not certification; "pork-free" is not halal; "vegan options" is not "fully vegan"; "self-certified" is the owner's own statement. A claim attributed to a source must stay attributed (not become a plain fact).
3. Diet words (vegan / halal / certified) added where the English has none.
4. Quotations: text inside quotation marks that is Hangul must be verbatim (unchanged); a translated quotation must be in plain form and say what the English gloss says. URLs must be present and unchanged (character for character).
5. Language a native reader finds wrong or clearly unnatural: grammar, mixed politeness inside one field (Japanese です・ます; Korean 해요체), nonsense calques, wrong established names, wrong script variant (Simplified vs Traditional), half-width punctuation in Chinese running text.

## Leave alone
- Source and site names (HappyCow, Zabihah, Naver Place, Kakao Map, DiningCode…), romanised place names, Hangul kept verbatim, ISO dates (2026-06-05) — intended.
- Correct, natural wording you would merely phrase differently. Do not restyle.
- Internal-process phrases that are also in the English (e.g. "read twice").

## Output
One JSON file per input file (paths in your task): an array of
{"id": "<place id>", "field": "vegan" | "halal" | "cert.body" | "cert.note" | "timeline.<index from 0>", "find": "<exact substring of the CURRENT translation of that field>", "replace": "<corrected substring>", "kind": "meaning" | "trust" | "quote" | "language", "why": "<short reason in English>"}
- `find` must occur EXACTLY ONCE in that field's current translation; keep it as short as uniqueness allows. Verify this for every correction with a small script before finishing (helper files: use the unique prefix given in your task and delete them at the end).
- `replace` must not change any URL or any Hangul quotation.
- No defects → [].
Reply per file: entries read (must equal entries in the file), corrections by kind, the 3 most serious in one line each. Nothing else. Do not edit other files or the project repository.
