# Research notes in other languages

`notes-<lang>-<n>.js` — the notes shown under "Why?" beside a dietary claim
(`dietary.vegan.evidence`, `dietary.halal.evidence` of a record, as
`plainNote()` words them), translated. Sixteen files per language so a
place page fetches about a sixteenth of them (`noteShard` in
`src/hooks/useNotes.js` says which).

Each entry: `{ of, vegan?, halal? }`. `of` is a hash of the English notes
it was made from; `scripts/tests/notes.test.mjs` fails when a record's
note changes — retranslate that entry or delete it (the English shows).

Rules of the translation: complete, nothing added, every hedge and every
limit of a source kept at its strength, quotations kept as quotations,
URLs and source names untouched.

An entry may also carry `cert: { body, note }` (the record's
`dietary.halalCertClaim`, shown as "Certification claimed: …") and
`timeline` (the record's timeline events, in order), with `of2` as the hash
of their English.
