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
3. **Pin density — measured later that night:** at the default zoom on a 375x812 phone viewport, 30 of the 38 pins inside the map have their tap target covered by another pin (it was 10 with 18 pins that morning). Marker clustering is the fix; see HANDOFF §7 #37. Re-measure after every batch.

## Batch 6 (2026-09-29) — capital region, second pass
Brief: BRIEF.md plus `.superpowers/data-expansion/B6-ADDENDUM.md` (lastCheckedAt 2026-09-29, EXISTING.txt for duplicates, ≤25 WebSearch, KTO/VisitKorea Muslim-friendly categories mapped to our levels).

**The Gyeonggi trading stall is solved without a browser.** The gyeonggi-south researcher found endpoints that return dated data as plain HTTP: Kakao `place-api.map.kakao.com/places/panel3/<placeId>` with header `pf: web` (address, operator menu with edit dates, tags, dated reviews); DiningCode search `POST im.diningcode.com/API/isearch/` (URL-encode Korean in Python — Git Bash garbles it and a garbled query silently returns a generic list); DiningCode profile pages carry review dates as JSON-LD `datePublished`.

gyeonggi-south — 22 accepted. Five of batch 5's six resume rows went in with dated trading evidence (Hanam, Bucheon, Pyeongtaek, plus Suwon/Anseong/Hwaseong rows).
- HELD tteulanchae-suwon (뜰안채 채식뷔페): the vegan level rests on Kakao Map tags ('비건푸드') and DiningCode '채식'. 채식 is vegetarian, and who sets Kakao tags is unknown — not a directory's own classification in the sense the bar means.
- NOT PROPOSED 갠지스 보정점: in the Muslim-friendly dataset, but its DiningCode menu lists 포크 빈달루/마살라/칠리. **A dataset listing does not survive pork on the current menu.** This prompted a menu check of every dataset-based halal entry (`pork-check.md`).
- DiningCode's own '할랄' category term is accepted as a directory listing (kebab-inn-konkuk precedent) — bat-kebab, dastarkhan, yd-kebab, troy-kebab rest on it alone. Open doubt, recorded so a stricter pass can revisit: the term appears only when the search matches it, and it is not visible whether DiningCode assigns it or derives it from review text.

seoul-east-north — 9 accepted. bina-anam is halal `friendly` on Halalfoodle's current "Halal Meat" listing plus KTO's 2021 guide; it serves alcohol, and its story says so. epikore-seongsu's 약고추장제육 bowl is plant-based per HappyCow's and DiningCode's vegan classification of the whole restaurant.

seoul-southwest — 5 accepted. Most KTO-2022 Muslim-friendly listings in Yeongdeungpo/Guro no longer trade (gone from Kakao or another business at the address). Nakwon (Mayfield Hotel) is in KTO 2022 but its August 2026 menu lists pork — not proposed, same rule as 갠지스. rudys-vegan-dangsan `full` on DiningCode's primary '비건' category plus an all-plant menu (chahororok precedent). otsal-seoul-univ `friendly` on KTO's 2022 guide plus 2025–26 trading; its vindaloo was sent to the pork check. New source: Seoul's vegetarian-restaurant list (func.seoul.go.kr/user/vegetarian/restaurantList.do) rates individual dishes — supports `options` at most.

gyeonggi-north — 6 accepted, all halal `friendly`. asia-asia-ilsan (held in batch 4 for trading) now has a 2025 Kakao review and 2026 blogs. sarbon-gimpo rests on the owner's own intro on a business-verified Kakao listing ("우즈베키스탄 할랄음식점이며…") plus DiningCode's 할랄 tag; its osh contains horse meat and the entry says so. Korean candidates (Namisum Kkokko dakgalbi, 대복복집) rest on KTO 2021 alone — held on the nimat staleness ruling; worth re-checking against a current KTO listing.

mapo — 13 accepted. Two batch-6 entries (annapurna-bucheon, asia-asia-ilsan) shipped hours as a plain string and failed check-data after appending; fixed to { raw, weekly } and `review-drafts.mjs` now flags that shape before appending.
- HELD gosame-hapjeong: Visit Seoul says it is "well-known among international travelers looking for halal-friendly Korean food" — reputation, not a statement by anyone that the food is halal — and records no Muslim cooks; no source states a no-pork policy either, so neither `friendly` nor `porkFree` is supported. (Its Sinchon branch is `porkFree` on its own no-pork evidence.)
- seoul-iya-yeonnam and nusantaraku-hongdae: Visit Seoul's own text says halal, with "Muslim Cooks Availability Ⓞ" and no alcohol — the strongest halal evidence this batch.
- eid-bbq-hongdae, istanbul-grill-gongdeok, afc-kebab-sangsu: DiningCode '할랄' category alone (precedent; see the open doubt above).

yongsan — 15 accepted. mr-kebab-itaewon was flagged for sharing 192 Itaewon-ro with dubai-restaurant-itaewon and kervan-itaewon: a separate business in the same building (own Kakao place id, DiningCode page, phone, cuisine), so accepted — the map lists same-building places when their badge is tapped. Its halal rests on Visit Seoul's 2022 Muslim guide listing it under 'Halal Certified' plus Zabihah ('certificate on file'); no certificate sighted → `friendly` + halalCertClaim. Ten Itaewon halal entries rest on DiningCode's '할랄' category (precedent). plantude-yongsan `full`: Pulmuone's own 2023 newsroom — 100% plant-based menu, Vegan Standard Certification Institute certified. NOT PROPOSED 집밥김선생 (halal Korean home cooking — worth the effort): Visit Seoul 2022 gives 녹사평대로46길 28, Kakao/DiningCode/delivery give 녹사평대로32길 3; needs the operator's address.

jung-jongno — 12 accepted. Visit Seoul's `#salamseoul` tag is not itself a halal claim: only pages whose own text says halal, or that show "Muslim cooks Ⓞ / alcohol Ⓧ", were used. Four Korean halal places (BSJ Chicken & WOK, IFTAR, Myeongdongjeong, Myeongdong Chaeum). Zabihah's own "Fully halal / admin-confirmed" listing counts as a directory listing (mari-meokja, jayeondo bakery), but Zabihah's "active issue report under review" disqualifies (Gurkha, City Hall Halal Korean BBQ, Baku, Potala). SAMARKAND (마른내로) not proposed: its Visit Seoul page copies another restaurant's data word for word.

incheon — 9 accepted. nimat-incheon-airport-t1, held since round 1 for want of a current source, now has one: Incheon Airport's own dining directory entry 3202 (registered 2025-10-17) calls it a "Muslim-friendly restaurant" using "Kosher-certified ingredients" — `friendly`, and no halalCertClaim because nobody claims a halal certificate (the reviewer's FLAG reacted to "Kosher-certified"; overruled). HELD 집밥유희: HappyCow "Vegan" vs the operator's own "채식밥집" and a frittata on its 2026-09-13 menu — conflict, vegan unknown. Ten Incheon kebab/Arab places not proposed: DiningCode's own category does not say halal; the word comes only from blogs, signs or trading names.

gangnam-songpa — 6 accepted. HELD baba-india-gangnam: the only halal source is a DiningCode menu line "모든 메뉴는 할랄푸드 입니다 탄두리치킨은 제외" — of unknown authorship, and it says itself that the kitchen is not all-halal. kervan-famille-station: Visit Seoul page edited May 2026 says "Halal-certified", no body → friendly + halalCertClaim.

**RULING (07:00) — DiningCode's '할랄' tag is withdrawn as evidence.** Raised by the gangnam-songpa researcher, verified by the controller: DiningCode's isearch API returns '할랄' in a restaurant's category string only when the query contains 할랄 — `수원 할랄` gives YD케밥하우스 "케밥, 할랄", `수원 케밥` gives the same place "케밥" — and profile pages carry no such tag. It is a search-index match (most likely review/blog text), not DiningCode's classification, so it is below the bar and the kebab-inn-konkuk precedent is overturned. Kakao's '할랄푸드' keyword tag is treated the same (origin unknown). 26 live entries whose halal rests mainly on it are being re-sourced (`.superpowers/data-expansion/dc-resource-list.txt`): each gets a qualifying source or goes to unknown.

**Pork/alcohol check (pork-check.md), 38 dataset/KTO-based halal places:** no pork found anywhere — but only 3 menus (suembu-suwon, bella-tunisie-suwon, asia-asia-ilsan) are complete and current enough to rule it out; the other 35 are partial, old or missing (Kakao's Yogiyo menus always stop at 30 items; DiningCode menus are undated). So these stay `friendly` on their listing, with pork not ruled out — the same blind spot that hid 갠지스's pork. Alcohol shown on a menu or owner notice at 7 places; each one's halal evidence now says so (the detail view shows it). Two more (grey-paju, annapurna-bucheon) rest on one customer review — not added.

gap-korean-vegan — 8 accepted, all Korean. No temple in the capital region turned out to run a restaurant open to visitors (진관사, 봉은사, 길상사, 화계사, 용주사, 봉선사, 전등사, 봉녕사 → education centres, a tea house, or a mixed-menu canteen). Seoul's vegetarian register conflicts with a current menu for 자하손만두 (register: 손만두(비건); Kakao menu: beef and pork) → vegan unknown, not proposed.

gap-vegan — 8 accepted, all `full`. HELD little-gangster-hyochang: the yongsan researcher found Korea Times giving 새창로12길 11-8 against Kakao/DiningCode's 11-3; two independent researchers, one conflict — rule 3 (needs the operator's own address). Neither vegan certification body publishes a restaurant list; Plantude is the only certified restaurant found.

**Re-sourcing after the 07:00 ruling (dc-resource.md):** of 26 places, 14 found a qualifying source — VisitKorea's current Muslim-friendly database (2025 entries) for Taj Palace, Little India, Pak India and Arabesque Itaewon (KTO 2021 "Self-certified" recorded as a halalCertClaim worded as self-declaration); Incheon Airport's directory for Nimat T2; the operators' own Instagram for Hojibobo, King Kebab (chain-level), Troy ×2, Istanbul Grill (free wine corkage, said in its story), Aladdin's Lamb (serves soju and beer), EID BBQ, The Halal Fitzza, and Welcome to Dubai (a '#할랄푸드' hashtag in its own bio — thin, but the operator's own word). **12 found none and were removed from the dataset**, since with halal unknown and no vegan level they carry no dietary claim and a 'world-halal' category would still read as one: abi-kebab-itaewon, alpedo-kebab-itaewon, ankara-picnic-itaewon, bat-kebab-ansan, dastarkhan-hyangnam, hasan-baba-beondong, kebab-inn-konkuk (batch 3), ramada-ongnyeon, sarai-doner-kebab-ansan, siti-sarah-itaewon (operator site behind Cloudflare, not bypassed), yd-kebab-house-suwon, afc-kebab-sangsu. Their records stay in git history (4e86f13) and in the b6 draft files should a source turn up.

gap-halal — 7 accepted, 3 Korean (Ever Halal bulgogi buffet near Everland — operator site says the beef is halal-certified, address confirmed; Kwanho lamb BBQ on Halalfoodle "Halal Meat" + halal-labelled lamb dishes; plus Zabihah-listed places). No KMF certificate list exists online any more (koreanmuslim.or.kr / kmfhalal.* dead; haikorea.org publishes none) — so `certified` stays 0. Best lead toward it: sechawan-hoehyeon, where Zabihah reports "A halal certificate is clearly visible on the premises" — someone on site could record body and number. HELD yanginhwandae-bukchang (halal Korean lamb BBQ, the most valuable find): Zabihah shows an active issue report under review — same rule as Gurkha. Sammimi KBBQ: Zabihah itself says "Serves pork".

gap-kto — 16 accepted, including four pork-free Korean places (별난오리, 형제육회, 일도씨닭갈비 ×2) and a halal-friendly Korean crab restaurant (함초간장게장). KTO's current VisitKorea listing shows no category; the level comes from its newest guide (valid Dec 2021) and requires the place to be still listed today, the same address on Kakao, and no pork on the current menu. Zaffran and Itaewon Kitchen trade on tourism-listing evidence alone (VisitKorea 2025, Visit Seoul 2026-04). 23 places KTO added in 2025 have no category anywhere → not proposed. **Cheapest next round:** 11 Muslim-friendly KTO places that already passed address/menu/trading checks but were not written up (옴 광화문, 옴 공덕, 키친오브인디아, 포탈라 종로, 머노까머나 신촌, 뿌자2, 다르샨나마스떼, 아건 이대, 타지 명동, 여우골초밥 서교점, 델리인디아). 집밥김선생 still held (Visit Seoul 2022 address differs from KTO 2025 + Kakao; needs the operator).

## Batch 7 (2026-09-29) — capital leftovers, then the regions
capital-leftovers — 8 accepted (KTO 2021 Muslim-friendly, still on VisitKorea's listing, Kakao-agreeing address, no pork seen; alcohol stated where sold). HELD potala-jongno: DiningCode's menu has kormas cooked with wine, and Zabihah shows an active issue report — cooking with wine outweighs a 2021 listing. Not proposed: 다르샨나마스떼 and 모모야마 (no menu complete enough for a pork check), 더 플라자 도원 (pork jowl on the menu; temporarily closed).

chungcheong — 4 accepted (thin region: no current KTO listing outside Seoul, so KTO-2021-only places — 송정꽃게집, 봉학골가든, 남한강 — are stale holds). yeobeop-bapsang-daejeon (temple food) is `options`, not `full`, despite HappyCow "Vegan": a 2026 blog excerpt shows galbi served for a group booking. afiya-halal-gungdong rests on the operator's Instagram bio alone (b6 precedent). **Open for a second pass:** Cheonan/Cheongju/Eumseong/Sejong/Dangjin kebab and Uzbek places surfaced only by DiningCode search — need operator or directory sources; 알리바바 트레져 needs the operator's own address.

gangwon — 4 accepted. 동문 (Nami Island): the island operator's own site calls it a "Certified Halal Restaurant" (no body sighted → friendly + halalCertClaim; address confirmed). plantiful-gangneung `full` on the owner's intro "비건 크리머리 & 베이커리" on a business-verified Kakao listing (sarbon-gimpo precedent). About 20 KTO-2021 Muslim-friendly / Pork Free listings — mostly Korean (dakgalbi, sundubu, hwangtae, grilled fish) — held as stale: VisitKorea's current Muslim-friendly database covers Seoul only. Best halal lead: 무사피르 (Chuncheon, Uzbek) needs an operator statement.

jeju — 14 accepted. Two Korean halal finds: 비원삼계탕 and 크랩스토리 (airport) — the press (Gukje News, 2025-12-11/14) reports four Jeju restaurants receiving a premises-based Indonesian halal certificate from PT SUCOFINDO / HPN-K on 13 Nov 2025. No certificate sighted → friendly + halalCertClaim. Weak point recorded in each: the press gives names, not addresses; identity rests on a guide site plus the only Kakao listing of that name (and, for Crab Story, a matching phone). 오름해산물 and 무한정 (the other two) not proposed — no address source at all. visitjeju.net's Muslim-friendly list no longer exists. ~12 KTO-2021 Korean Muslim-friendly places held as stale.

ulsan-gyeongnam — 8 accepted, 7 fully vegan. mimigotgan-ulsan `full` on HappyCow's own description "A vegan bakery" (its print view shows no category for bakeries) — a directory's own words, so it meets the bar. loving-hut-jinju trades on the operator's current branch list plus Kakao menu edits in 2025–26. Every Ulsan halal place on Zabihah carries an active issue report → none proposed. **New tool:** HappyCow's `/print` city pages return full listings as plain HTML with no CAPTCHA. Leads: Maharaja (Changwon) has a Halalfoodle "Halal Meat" listing not yet verified.

daegu-gyeongbuk — 14 accepted, all Daegu. The halal levels rest on a **current** government list: Daegu city's live Muslim-friendly page (daegufood.go.kr/kor/sub/halal.asp), read twice; five rows commented out of its HTML were treated as delisted. Four Korean pork-free places in Hyeonpung/Nongong (gomtang, samgyetang ×2, mushroom hotpot) plus a Korean eel restaurant marked friendly. Daegu's own vegetarian list mixes in seafood and duck restaurants — not evidence of vegan food. Gyeongbuk: nothing proposed (KTO-2021-only, stale); best lead 연화바루 (Gyeongju temple food, DiningCode says 채식 — needs an operator statement).

**RULING (07:40) — reviving stale KTO-2021 listings as `porkFree`.** Outside Seoul there is no current KTO listing, so dozens of Korean restaurants that KTO listed as Muslim-friendly or Pork Free in 2021 were held. A 2021 listing cannot carry `friendly` today (staff and suppliers change), but `porkFree` is a fact about the menu: it may be set when (1) KTO 2021 listed the place, (2) it trades in 2025–26, (3) its address agrees with Kakao, and (4) a **complete, current** menu (owner-entered, whole menu, edited within the last 12 months) shows no pork. Evidence quotes the menu and its date; the story mentions the 2021 listing only as history. An incomplete menu → still held.

busan — 12 accepted: three fully vegan Korean restaurants (temple food at Vegenarang; home cooking at Soban and Pyeonhan Jipbap, addresses confirmed), a Michelin-listed "100% vegan menu" (ARP), and eight halal. Busan's own Muslim-friendly lists (city 2017, KTO 2021) were never used alone; each halal entry also has Zabihah, Halalfoodle or the live (undated) Visit Busan page. Five rest on one Halalfoodle "Halal Meat" badge — the bina/kwanho bar. 12 Korean places from the 2017/2021 lists go to the KTO-revival researcher (porkFree only on a complete current menu). Beomeosa's temple-food centre (2025) is an experience centre, not a walk-in restaurant.

jeolla — 13 accepted, all vegan (5 `full`, 8 `options` on HappyCow's own listings, incl. a temple-food buffet at Mudeungsan and Hanok Village bibimbap). No halal place in the region clears the bar: every Gwangju/Jeonju halal candidate rests on tags, blogs or names; Zabihah has no Gwangju listings. Kakao now prints Gwangju and Jeollanam-do addresses as 전남광주통합특별시; English addresses keep "Gwangju"/"Jeollanam-do" and the evidence notes the rename. Leads: 남한산성 하루채 (Iksan, likely relocated), 담은하늘채 (Mokpo); the KTO-2021 Jeolla rows go to the revival researcher; ~30 HappyCow options-level places left in b7-jeolla.md.
