# Review brief — menu glosses (K-Food Map)

K-Food Map shows each restaurant's recorded menu names (many are Korean, some English or mixed, e.g. "연잎밥정식 (lotus-leaf rice set)"). Under each name a small gloss in the reader's language says what the dish is. Your file is a JSON array of {"name", "gloss"}: `name` is the recorded menu name, `gloss` the current gloss in the target language. Read EVERY item.

## A gloss is wrong (fix) when
1. It says something the name does not: an ingredient, cooking method, portion, spiciness, or — most serious — a diet word (vegan / vegetarian / halal / pork-free / no-meat) that is not in the name. It must never drop a diet word or a caveat that IS in the name ("(made with butter)", "for vegans", "per person", "2 people minimum", sizes, counts).
2. It mistranslates the dish: wrong main ingredient (e.g. 메밀 buckwheat ≠ wheat; 들깨 perilla ≠ sesame; 도토리묵 acorn jelly ≠ agar; 순두부 soft tofu; 곰탕 beef-bone soup; 육회 raw beef; 양고기 lamb/mutton ≠ goat; brown rice ≠ red rice; smoothie ≠ milkshake; "ragu/kebab/cutlet" used for a plant dish must not gain a meat word), wrong dish type (전 pancake, 찌개 stew, 탕/국 soup, 덮밥 rice bowl, 정식 set meal, 백반 home-style set).
3. It is not the natural, established word a native reader uses for that dish in the target language (Japanese: キンパ, ビビンバ, チヂミ, スンドゥブチゲ, サムゲタン…; Chinese: 紫菜包饭/紫菜包飯, 拌饭/拌飯, 嫩豆腐锅/嫩豆腐鍋, 参鸡汤/蔘雞湯…; Indonesian: use the Korean dish name plus a short explanation where there is no local word), or it is ungrammatical, a nonsense calque, wrong script variant (Simplified vs Traditional), or leaves an English/Korean word untranslated that has an ordinary word (shop-specific names and romanised Korean dish names may stay).
4. Korean file only: `name` is English and `gloss` is Korean — the gloss must be how a Korean menu would naturally call that dish, with nothing added.

## Leave alone
Correct glosses you would merely word differently. Do not restyle. Do not add explanations the name does not support.

## Output
Write a JSON array to the output path given in your task: {"name": "<exact name from the file>", "gloss": "<corrected gloss>", "kind": "added" | "dropped" | "mistranslation" | "language", "why": "<short reason in English>"}. Only items you change. Verify with a small script that every `name` exists in your input file (helper files: unique prefix from your task; delete them at the end). No defects → [].
Reply: items read (must equal the file's count), corrections by kind, the 5 most serious in one line each. Do not edit other files or the project repository.
