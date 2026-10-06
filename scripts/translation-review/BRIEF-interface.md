# Review brief — interface strings (K-Food Map)

K-Food Map is a mobile-first food map of Korea for foreign visitors (vegan / halal-friendly places; every dietary claim carries a confidence level: Confirmed / Reported / Our reading / Not known). Your file is a JSON array of {"key", "en", "tr"}: the i18n key, the English source string, and the current translation. `{{name}}`-style placeholders and `<0>…</0>` tags are markup. Read EVERY row as a native speaker using the app on a phone.

## Fix when
1. Meaning differs from the English, or a placeholder/tag is missing, duplicated or altered.
2. Trust wording is stronger or weaker than the English ("Reported, not confirmed", "we have not seen the certificate", "halal-friendly" vs "halal certified", "vegan options" vs "fully vegan", "pork-free" is not halal). The same concept must use the same term everywhere in the file (check consistency of: Confirmed, Reported, Our reading, Not known, Fully vegan, Vegan options, Halal-friendly, Halal certified, Pork-free, Save/Saved, Journal, Passport, Stamp, Directions, Open now/Closed).
3. Unnatural for an app: translationese, wrong register (Korean: 해요체; Japanese: です・ます, concise UI style; Chinese: concise UI style, correct script variant; Indonesian: neutral, concise), awkward button labels, text that is much longer than needed for a button or chip (keep button/chip/tab labels short), wrong punctuation conventions, grammar errors, inconsistent terms.
4. Leftover English that should be translated (brand names "K-Food Map", "Naver Map", "Kakao Map", "Google Maps", "HappyCow" etc. stay).

## Leave alone
Correct, natural strings you would merely phrase differently.

## Output
Write a JSON array to the output path in your task: {"key", "tr": "<corrected full string>", "kind": "meaning" | "trust" | "consistency" | "language" | "markup", "why": "<short reason in English>"} — only rows you change. Before finishing, verify with a script that every key exists in the input and that the set of placeholders ({{…}}) and tags (<n>, </n>) in your `tr` equals that of `en` (helper files: unique prefix given in your task, deleted at the end). Reply: rows read (must be 505), corrections by kind, the 8 most important in one line each.
Do not edit other files or the project repository.
