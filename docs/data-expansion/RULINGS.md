# Data expansion 2026-09-28 — controller rulings

## Incheon (5 drafted)
- yangwon — ACCEPT. halal friendly/supported: itour.incheon.go.kr names it and states the lamb is halal-certified. A claim about the meat, not the kitchen, which is exactly what `friendly` means.
- manokamana-songdo — ACCEPT. halal friendly/supported: named by branch in the same government halal feature. Indian, not Korean — precedent: bombay-brau, kampungku.
- earthborn-vegan — ACCEPT. vegan full/supported: government tourism site and a founder interview both state 100% plant-based. Halal correctly unknown (no chaining).
- nimat-incheon-airport — HOLD. The halal evidence is 2015-era press. The researcher set hours `unknown` for being a decade old, then set halal `supported` from the same era — an inconsistent standard, and halal is the field where staleness matters most: certificates lapse, and an airport is where a Muslim traveller has no alternative if we are wrong. Also two branches exist (Kakao: T1 공항로 272, and T2); the 2015 claim can only be about T1, since T2 opened in 2018. Revisit with a current source.
- halalway — REJECT. The only halal evidence is the venue's name. `matchesDietary` accepts any known confidence, `inferred` included, so this would appear under the Halal filter on the strength of a sign. The brief forbade inferring halal from a name; DATA.md's SELF_DECLARED allowance was written for an operator's declaration, not a trading name.

## Tooling
- Naver search MCP unavailable all session (gateway error, confirmed by the controller). Coordinates are Kakao-only → `supported`, not `confirmed`. Upgrade when Naver returns.

## Seoul south (5 drafted)
- legume, cosmos-shop, nammi-plant-lab — ACCEPT. vegan full/supported. cosmos-shop and nammi-plant-lab rest on government tourism sources (tier 2); legume on the Michelin Guide plus DiningCode.
- glunic, morococo — ACCEPT. vegan options/supported from HappyCow (directory tier). Modest claims at the confidence a directory supports. morococo: DiningCode's silence on vegan is absence, not contradiction, so no conflict rule applies.
- All five: halal unknown — correct, nothing was forced.
- Researcher exclusions outside the brief, recorded for the next pass rather than overruled now:
  - Vege Green (Gaepo-dong, 100% vegan buffet) — rejected for being 2.5 km from a subway. Transit distance was never a criterion; evidence is solid. Candidate for round 2.
  - HAJJ Korea Halal Food (Hannam-dong) — rejected as "duplicate territory" beside eid/makan/kampungku. Halal is the dataset's thinnest axis (4 friendly); clustering is not a reason to drop a halal candidate. Candidate for round 2.

## Seoul north (4 drafted)
- urt — ACCEPT. vegan full/supported on HappyCow's '100% vegan' category, which has a URL. The draft's second leg ("a research aggregation of blog coverage") had none and is removed. The story's "Instagram following of 15K" is also removed: the researcher reported the Instagram page as unretrievable.
- persian-palace — ACCEPT. halal friendly/supported from Zabihah. The researcher omitted `halalCertClaim` because no body was named; the existing entries (kampungku) record exactly that case, so the claim is added as a claim.
- vegan-kitchen-myeongdong — HOLD. The only evidence for "the entire menu is vegan" is "a research aggregation of the venue's own description" with no URL. Evidence nobody can reopen is not evidence here.
- halal-busan-jib — HOLD, despite being the best fit in the round (Korean food, halal). Three sources give three addresses (명동8길 11-4, 명동8길 11-6, 명동9길 12); the researcher picked Kakao's and recorded the conflict. That is the "pick one" the rule forbids, and 더케밥 was rejected in Incheon on the same ground. Its story also stated floor-by-floor dishes as fact while its own `menus` fact was `unknown` because no menu was sighted. A Naver place registration would settle which address is registered: first thing to re-check when Naver returns.

## Controller corrections applied during integration
- legume — vibe said "Asia's first Michelin-starred vegan restaurant"; the story and every cited source say Michelin-*listed*. Starred and listed are different claims. Vibe rewritten to "Michelin-listed". Menus set to unknown: DiningCode 150k/250k KRW (rising 1 Oct) vs NOL World 69k/99k KRW is a disagreement of more than double.
- nammi-plant-lab — dropped "popular enough with both vegan and non-vegan diners that a reservation is recommended": a popularity claim of the kind the brief ruled out.
- One method string used a straight apostrophe ("operator's") where the canonical value has a curly one; the label test caught it — it would have shipped a provenance line with no display label.

## Result
10 places added: active 18 → 28; Vegan filter 14 → 21; Halal filter 4 → 7; halal certified 0.
Round 2 candidates: halal-busan-jib and vegan-kitchen-myeongdong (both need a traceable source), nimat (needs a current halal source, and a branch), Vege Green, HAJJ Korea Halal Food. All coordinates in this round are Kakao-only → promote with a Naver cross-check.

## Round 2
Naver unreachable from every tool: the search MCP is down, and naver.com is blocked by safety policy in both the Chrome extension and the built-in browser. Round 2 therefore leaned on the operator's own pages, which outrank the maps in §2.11 anyway.

ACCEPTED (10): halal-busan-jib, busan-jib-hongdae, vegan-kitchen-myeongdong, hajj-korea-halal-food, cherry-garden-dongdaemun, vege-green, zero-vegan, le-vege-wang-yeouido, chick-peace-seongsu, nimat-incheon-airport-t2.
- halal-busan-jib: round 1's three addresses were all wrong. The operator's Instagram → its own Linktree → its own map link gives 명동8길 11-8, and Kakao agrees exactly; 11-6 was an older listing for the same brand. Picking one of round 1's three would have sent people to the wrong door.
- nimat T2: controller re-fetched DiningCode and saw '니맛(할랄식)' in the vendor list itself. Corrected the draft's address ('444 … Jung-gu', no source) to the page's '영종구 제2터미널대로 446', which also matches earlier research. T1 stays held: operating, but no current halal source.
- hajj: removed an unlinked "several aggregators say" sentence from the evidence.
- Stories: removed process talk that would have reached travellers ("transit distance was not treated as a reason…", "which is why this is recorded as…"), a popularity claim, and an unattributed "Korea's first" in a vibe line (the story attributes it to opening press, and still does).

HELD: sinchon-burger — address is the strongest in the round (operator Instagram + Kakao agree), but the halal evidence is one menu item labelled '(halal)' on a receipt. The Halal filter would present the whole restaurant as safe on the strength of one item.
REJECTED: ilyonghal-yangsik — a duplicate of the existing `iryonghal` under a different romanisation. Caught by comparing Korean names, which the id check could not.

Result: active 28 → 38; Vegan 21 → 27; Halal 7 → 13; halal certified 0.

## Batch 3 (first 7 of 9 areas) — 2026-09-28
Nine researchers on one shared brief (BRIEF.md). Every draft run through scripts/review-drafts.mjs before a person read it.

ACCEPTED 26: Ansan 5 (Gyeonggi Tourism Organization's own Muslim-friendly dataset, read as raw CSV), Incheon 1, southwest Seoul 3 (two Korean temple-food kitchens), Mapo 5, Yongsan 4, Gangnam 5 (incl. Bium, Michelin-listed temple cuisine), Dongdaemun 3 (Seoul tourism site's structured "Muslim cooks ○ / alcohol ✕" fields).

CORRECTED:
- gosame-sinchon: halal friendly → porkFree. The only source says no pork and no alcohol; no source opened says halal. The researcher's gloss ("framing it as accommodating Muslim diners") was the only halal in the evidence. porkFree renders as "Pork-free" and is not matched by the Halal filter. This one reached review as PASS, which is how the quote-only rule entered the reviewer.
- daddys-lamb-hapjeong: added halalCertClaim for the government site's "uses only Halal-certified young lamb" (meat claim, as with yangwon).

HELD:
- bihani-bupyeong — halal rests on one expat blog. Ruling: a place shown under the Halal filter needs at least one source above a personal blog (operator, government, press, or a directory).
- bappulkkot-eunpyeong — vegan full rests on "모든 메뉴는 채식이다". 채식 is vegetarian; eggs and dairy are often in, and the operator's own 2020 interview says its delivery meals include fish and eggs. The only "비건" in the evidence is a visitor-applied tag.

Reviewer calibration during this batch: six false-positive patterns fixed (apostrophes read as quotes, "rather than/neither … certified" negations, "reservation-only", "first floor"/"on the first", attribution verbs "notes/states/told"). Regression-checked after each change against rounds 1–2: every real issue from those rounds is still caught.

Result: active 38 → 64; Vegan 27 → 37; Halal 13 → 28; pork-free 1; halal certified 0.

## Batch 3 (remaining 2 areas)
ACCEPTED 9: Jongno/Jung-gu 5 (vegan-insa, gosari-express, saffron-myeongdong, eojjeoda-nongbu-namdaemun, blu-seoul), east 4 (aladdins-lamb-jamsil, kebab-inn-konkuk, mokro-garden-seongsu, room-temperature-seongsu).
- saffron-myeongdong: menus held `[]` under `unknown` — the fact() invariant; set to null. Its halal quote says "이슬람 율법대로 도축한 고기만" without the word 할랄; the reviewer's halal vocabulary now includes 이슬람/Islamic/zabiha.
- kebab-inn-konkuk: halal rests on DiningCode's own category tag. Meets the directory-own-listing bar.
HELD: veganature-seokchon — "100% vegan" rests on one customer review quoted on DiningCode, not DiningCode's own classification. Same bar as bihani: a level shown under a filter needs at least a directory's own listing.
Batch 3 total: 35 added (active 38 → 73); Vegan 27 → 44; Halal 13 → 31; halal certified 0.

## Batch 4 — Gyeonggi beyond Ansan
ACCEPTED 8 (Suwon 4, Seongnam 3, Goyang 1) from the remaining rows of the Gyeonggi Tourism Organization's Muslim-friendly dataset. Each address agrees with Kakao; each still trades per a dated 2025–2026 review. All passed review-drafts with nothing flagged.
NOT PROPOSED: 델리다바 (Suwon, not on Kakao); 아시아아시아 (Goyang, address agrees but no current trading evidence found in the time budget).
NOT YET INVESTIGATED: the dataset's rows for Gimpo, Bucheon, Dongducheon, Anseong, Anyang, Osan, Yongin, Uijeongbu, Paju, Pyeongtaek, Hanam, Hwaseong — the cheapest next round, since the source is a government dataset and needs no web search.

## End of day, 2026-09-28
Active 18 → 81. Vegan 14 → 44. Halal 4 → 39. Halal certified 0.
45 active places have Kakao-only coordinates (SUPPORTED): run the Naver cross-check first when Naver is reachable.

## Batch 5 — Gyeonggi remaining cities (stopped at the time limit, nothing shipped)
The full dataset (52 rows) was re-downloaded and every row for the ten cities below checked against Kakao Map. Nothing was proposed, because none reached the "still trades" check in the time allowed — and the survey is from May 2024, so a row without a 2025–2026 sighting is not shippable.

**Resume here — address already agrees with Kakao; only the trading check is left:**
- Yongin: 갠지스 보정점 (죽전로15번길 7-15)
- Hanam: 에베레스트 하남스타필드점 (미사대로 750)
- Bucheon: 마살라 인디안레스토랑 (석천로169번길 30)
- Pyeongtaek: 스파이스빌리지 (쇼핑로 17-1)
- Osan: 이타지마할인디안레스토랑 (대원로 8-8)
- Hwaseong: 갠지스 동탄점 (동탄공원로2길 33-11)
**Why it stalled, so the next round does not repeat it:** both DiningCode's search results and Kakao's place pages are rendered client-side. WebFetch and curl return the page shell — the title, or a generic "popular nearby" JSON block — never the reviews, so no review date can be read that way. Researchers in batch 3 got past this by driving the **built-in browser** (it runs the page's JavaScript) for DiningCode; do that. A guessed Kakao review endpoint (`place.map.kakao.com/main/v/<id>`) returns 404.

A second note: the researcher first reported stopping at its 12-minute limit after 2 minutes 45 seconds. Check a subagent's reported elapsed time against the harness's duration before accepting "out of time" as the reason nothing shipped.

NOT PROPOSED: Paju 더히말라얀 금촌점 (dataset 새꽃로 194 vs Kakao 196 — a disagreement); Anyang 긴자인도레스토랑 (the Anyang address is not on Kakao; the name resolves only to a Gunpo location).
UNTRIED: Bucheon 안나푸르나, Uijeongbu 두르가, and Gimpo's four rows (KB케밥&닭강정, FORTUNE, 말리오보로, 할랄 인디안 레스토랑).

## Open items for the next session (2026-09-28, 22:4x)
1. **Naver is still unreachable.** The error from the Naver search tool points at https://playmcp.kakao.com — the tool is routed through the operator's Kakao PlayMCP account, so it may simply need re-enabling there. Once it answers, cross-check the 45 Kakao-only places first.
2. **Quality pass without Naver:** an address stated by the operator (Instagram bio, own site) that agrees exactly with Kakao can be CONFIRMED — the sinchon-burger research did exactly that. This raises existing places, which is what Phase 3 of the roadmap is actually for.
3. **Pin density:** with 81 pins, the default map view needs measuring (overlap at default zoom). Not measured tonight — the browser pane was hidden, so any number would have been made up.
