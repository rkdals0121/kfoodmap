# Review brief — translated place stories (K-Food Map)

K-Food Map is a food map of Korea for foreign visitors. Each place has a short English `story` (and sometimes an `esg` line). They were machine-translated into the target language. Your job: read EVERY entry in your file, compare the translation (`tr_story`, `tr_esg`) with the English (`en_story`, `en_esg`), and write corrections for real defects only.

## What counts as a defect (fix these)
1. Meaning differs from the English: something added, dropped, reversed, a number/date/price/floor/distance changed, a wrong dish or ingredient.
2. Trust level changed. The English is carefully hedged. "reported", "is said to", "according to", "describes itself as", "no certificate has been sighted" (= we have not seen one; NOT "could not be confirmed" and NOT "does not exist"), "halal-friendly" vs "halal-certified", "vegan options" vs "fully vegan", "pork-free" (not halal) must keep exactly that strength. Never stronger, never weaker.
3. Diet words added that the English does not have (vegan / halal / certified / Muslim-friendly).
4. Text a native reader would find wrong or clearly unnatural: grammar errors, mixed politeness level inside one entry (Japanese must be です・ます throughout; Korean 해요체 throughout), wrong particles, calques that read as nonsense, wrong established name for a dish or a well-known place/station, half-width punctuation in Chinese running text, Simplified characters in the Traditional file or the reverse.
5. Leftover English words that have an ordinary word in the target language (but see "leave alone").

## Leave alone (NOT defects)
- Place names, street names and romanised Korean (e.g. "Balwoo Gongyang", "Ujeongguk-ro", "Insadong-gil") kept in Latin letters — intended.
- Hangul or quoted source text kept verbatim.
- Mere style preferences where the current wording is correct and natural. Do not rewrite for taste.

## Output
Write a JSON file (path given in your task) containing an array. One object per correction:
{"id": "<place id>", "field": "story" | "esg", "find": "<exact substring of the CURRENT translation>", "replace": "<corrected substring>", "kind": "meaning" | "trust" | "language", "why": "<short reason in English>"}
- `find` must occur EXACTLY ONCE in that field's current translation (copy it character for character; make it long enough to be unique, short enough to be a targeted fix). Before finishing, verify this programmatically for every correction (e.g. with a small node or python script reading your input file) and fix any that fail.
- If a whole entry is badly wrong, `find` may be the whole field.
- If the file has no defects, write [].
Then reply with: how many entries you read (must equal the number in the file), how many corrections by kind, and the 3 most serious ones in one line each. No other prose.
Do not edit any other file. Do not touch the project repository.
