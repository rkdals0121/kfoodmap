# Changelog

## Unreleased — 2026-10-02 / 10-03

### Added

- **Open now** filter. Opening hours are read on Korean time, whatever the device's time zone; places past last order are left out, and the list says how many places have no recorded hours.
- **My location** — centres the map on you and shows distances from you. Asked once per press, used only in the browser, never stored or sent (the privacy policy was updated in the same change).
- **Saved** filter (your shortlist on the map, framed) and **Fully vegan** filter (all-vegan kitchens only).
- **Food journeys can be followed** — "Stop 2 of 3", previous and next stop, straight-line distances between stops.
- **Korean cards to show restaurant staff** (`/cards`) — a vegan card and a Muslim card in polite Korean, questions about hidden ingredients, likely answers, words to look for; "Show large" for handing the phone across a counter.
- **Name in Korean** on each place, to copy or show large.
- **Six languages** — English, Japanese, Simplified and Traditional Chinese, Indonesian, Korean. Detected from the browser on a first visit; chosen in Profile or on the welcome screen. Journeys, dining tips and the staff cards' meanings are translated; place names, stories and menus stay in English.
- **Share a saved list** — a link that opens the map on those places, with "Save all".
- **Also nearby** on a place page — up to three other places within 800 m, straight-line distance.
- **Saved places are hearts on the map**, at every zoom.
- **A journey on the map** — its stops alone, numbered in route order on the map and in the list.
- **The week's hours** on a place page; a day the record does not cover says so.
- **Area suggestions** in the search box, and "/" to reach it from the keyboard.
- **"Last order soon" / "Closes soon"** in amber; 24-hour places say "24 hours".
- **Older spellings** in search — Pusan, Cheju, Kangnam, Myungdong.
- **Open at…** — places open on a weekday and time you choose (Korean time).
- **Add to Home Screen** from Profile; the Journal says saved places open offline.
- **Wide screens** — list, place and map side by side from 1200 px.
- **Your search and filters survive a reload** and can be shared as a link; the welcome screen can start the map on Vegan or Halal.
- **Copy your saved list as text** — names in Korean, addresses, links.
- **Browse by area** in Discover, and area guides on the web (`/find/halal-busan` …) with every place linked.
- **Search in other scripts** — areas typed in Korean, Japanese or Chinese (釜山, 明洞, 이태원), and the diet words of each language.

### Changed

- A place's dietary source names the site it was read from ("The restaurant (mahinavegan.com)").
- Menus of places with vegan options say that not every dish is vegan.
- Map buttons come before the address on a place page.

### Fixed

- Open / closed was computed on the device clock, wrong for anyone planning from another time zone.
- Search matched inside words ("Seomyeon" found Wanju's "Iseo-myeon").
- An unsourced "food mileage" tip shown on 187 places was removed; 26 stories' walking times now match the routed figure on the same page.

Translations were drafted and cross-reviewed by automated agents with a fixed glossary for the four claim words; they have not yet been read by native speakers.

## v1.0.0

**Release Date:** 2026-07-18

### Added

- **Interactive K-Food Map** — search, dietary filter chips, an always-visible map and restaurant list, scannable place cards with images and distance sorting.
- **Restaurant Story** — a cultural storytelling journey for each place: quick facts, practical info, menu, food story, sustainability, and dining tips.
- **Journal / Passport** — bookmarked places rendered as dated stamps, with a distance-based "next stop" suggestion.
- **Bookmark** — save any restaurant, no account required.
- **Restaurant Trust Information** — every restaurant page shows how sure we are about each fact — Official, Reported, or Inferred — and where it came from, right where you're reading it.
- **Responsive UI** — mobile, tablet, and desktop, with AA-contrast design.

**Trust Model** — the system behind Restaurant Trust Information above. A Confidence Model grades every fact instead of just stating it; an Evidence Layer pins facts to versioned, tamper-evident sources instead of an unreviewable claim; and a Lifecycle quarantines restaurants whose existence or continued operation can't be confirmed, rather than showing them as open.

### Improved

- **Verified restaurant information** — 18 of 20 restaurants now have at least one independently confirmed fact, up from zero at project start.
- **Accurate coordinates** — 18/20 restaurants have confirmed map coordinates.
- **Street-level addresses** — 19/20 restaurants have a confirmed street address.
- **Structured opening hours** — real weekly schedules where the source supports them, honestly marked unknown rather than guessed when sources disagree.
- **Better dietary information** — vegan and halal claims were re-checked against operators, government listings, and menus; several overstated claims were corrected to what the evidence actually supports.
- **Stronger validation** — every fact now has to pass automatic checks for sourcing and certification requirements before it can ship.

### Fixed

Every active restaurant was re-verified end to end against primary sources. Representative defects corrected:

- **Wrong districts** — two Incheon restaurants (`iryonghal`, `meat-morning`) were filed under the wrong district; corrected to their confirmed location.
- **A fabricated address** — `kampungku`'s listed address was in the wrong part of Seoul, roughly 4 km from where the restaurant actually is; replaced with the confirmed real location.
- **Overstated vegan claims** — four records (`bombay-brau`, `chaeyuk-songdo`, `meat-morning`, `rim`) marked a kitchen "Fully vegan" when it serves meat or dairy; corrected to the level the evidence actually supports.
- **An overstated halal certification** — one record (`arabesque`) implied certification that no source names; held at the evidence-backed "halal-friendly" level.
- **A false heritage claim** — `gonghwachun`'s story asserted continuity with a restaurant that closed in 1983; corrected to what the historical record shows.
- **Closed restaurants surfaced and quarantined** — `makan` (confirmed closed by Seoul's own tourism site) and `akiya` (existence unconfirmed on any map service) are now excluded from every discovery surface instead of shown as open.
- **Stale, relocated records** — `rim` and `nono-shop` had each moved since their records were written; re-verified at their current locations.
- **Invented data removed project-wide** — fabricated ratings and reviews, an invented "food mile" sustainability figure, and fabricated menu items and prices were removed rather than replaced with new guesses.

### Documentation

- `HANDOFF.md` — the canonical engineering handoff: architecture, data model, technical debt, known risks, and roadmap.
- `README.md` — project introduction, features, trust model, status, and setup.
- The six-phase project roadmap (Foundation → Production Infrastructure → Production Data → Final QA → v1.0 → Feature Phase 2) was formally adopted and written into `HANDOFF.md`.
- Two known integration gaps (a Journal display inconsistency for quarantined records; an evidence-validation coverage gap that cannot currently trigger) were formally accepted as post-v1.0 debt rather than left undocumented.

### Validation

- `check-data` — 20 places, 0 violations.
- `lint` — 0 errors.
- `build` — clean production build.
- Bundle hygiene — evidence provenance fields never ship to the client bundle.
- `evidence-hash --check` — 0 pending, 0 drifted.
- Browser QA across every core screen and responsive breakpoint, with no console errors.
