# K-Food Map — complete functional test checklist

Source of truth: the code in `k-food-map/src` (App.jsx, components, hooks, filters.js, search.js, utils.js, i18n), `vite.config.js`, `api/`, `scripts/prerender-places.mjs`, `index.html`, `vercel.json`. Live site: https://kfoodmap.vercel.app

## How to read this

- Item form: `ID. action → expected result` then, where useful, the selector / aria-label / route.
- Sizes: **Phone** = 360x640 portrait (narrower than 768 px, and "short phone": height <= 700 px). **Desktop** = 1280x800 or wider. Other breakpoints the code has: 768 px (sidebar instead of sheet, place docks beside the map), 1024 px (sidebar collapse handle), 1200 px (three columns), phone landscape (`max-width:767px and orientation:landscape and max-height:500px`, e.g. 640x360), very narrow (<= 340 / 359 / 380 px).
- Tags: `[needs: sign-in]`, `[needs: geolocation]`, `[needs: offline]`, `[needs: touch]` (real touch events / gestures), `[needs: share API]`, `[needs: 2nd device]`, `[needs: deploy]`, `[needs: clock]` (depends on Korean time of day), `[phone]`, `[desktop]`.
- With `scripts/translation-review/shot.mjs` most tagged items can be checked without the real thing: a step's `init` runs a script before the page's own (a fixed clock for `[needs: clock]`: replace `Date` with a subclass offset to the wanted Korean time), `tz` sets the device's time zone, `block` fails chosen files, `throttle` and `cpu` slow the line and the phone, `media` and `print` emulate high contrast, reduced motion and paper. Say in the report which were emulated.
- Text in quotes is the English string (`src/i18n/locales/en.js`); in another language expect the translation.
- localStorage keys used: `kfm-prologue`, `kfm-language`, `kfm-text-size`, `kfm-bookmarks`, `kfm-passport-owner`, `kfm-session-ended`, `kfm-auth*`. To get a "first visit", clear site data (and unregister the service worker).
- Useful test places (ids from code): `balwoo`, `eid`, `plant-cafe`, `monks-butcher`, `gonghwachun`, `kampungku`, `osegyehyang`, `sanchon`, `halal-busan-jib`.

---

## A. First visit, loading screen, prologue

A1. Open `/` with cleared storage on a throttled connection → before React starts, a static loading screen shows the green logo, "K-Food Map", "The other side of K-food" and a `role=status` line "Loading the map…". (`#root [role=status]`) On a first visit it is replaced by the Prologue as soon as the small first file is in — before the map's code and the places are downloaded (the network panel shows `App-*.js`, `places-*.js`, `maplib-*.js` starting only after the Prologue has drawn).
A2. Same with browser language ja / ko / zh-CN / zh-TW / id → the loading line is in that language ("地図を読み込み中…", "지도를 불러오는 중…", …); with `kfm-language` stored, the stored language wins.
A3. Block the first JS file (`index-*.js`; or wait 20 s on a stalled load) → the status line changes to "This is taking a while. The connection may be slow." plus a green "Try again" button that reloads the page. A failed font stylesheet does not trigger it.
A4. Disable JavaScript and open `/` → a `<noscript>` paragraph says the app needs JavaScript and links to `/find/vegan` and `/find/halal`; the page scrolls.
A5. First visit to `/` (no `kfm-prologue`) → the Prologue screen replaces the whole app (`.prologue-layout`, `<main class="prologue-content">`): eyebrow "K-Food Map", H1 "The other side of K-food.", subtitle with the live count of active places ("A food map of N places…").
A6. Prologue language row (`.prologue-languages`, 6 buttons: English, 日本語, 简体中文, 繁體中文, Bahasa Indonesia, 한국어) → tapping one switches all prologue text at once; the pressed one has `aria-pressed=true` / class `is-current`; each button carries its own `lang`.
A7. "What are you looking for?" group (`.prologue-start`) → two toggle buttons Vegan and Halal; both can be on at once; `aria-pressed` reflects state; hint "Optional — you can change it on the map."
A8. Legend "How to read a claim" → 4 rows: "Fully vegan · Confirmed" (strong), "Halal-friendly · Reported" (medium), "Vegan options · Our reading" (weak), "Not known" (none), each with its explanation, then the note "Menus and kitchens change…".
A9. Press "Open the map" (`.prologue-btn`) with no diet chosen → the map screen opens with no chip on; `localStorage.kfm-prologue = 'true'`. If the map's files are not in yet, the interim screen of A18 shows first.
A10. Choose Vegan (or both) then "Open the map" → the map opens with those chips on (`.chip.active`), the list is filtered and the URL gains `#f=Vegan` (or `#f=Vegan,Halal`).
A11. Reload after A9 → Prologue is not shown again.
A12. First visit directly to `/place/<id>` or `/find/halal-busan` → Prologue is skipped (the place / guide shows); it is NOT marked seen, so a later first visit to `/` still shows it.
A13. First visit to `/?list=balwoo,eid` (at least one valid id) → Prologue is skipped; the shared list shows.
A14. First visit directly to `/cards`, `/discover`, `/journal`, `/profile`, `/privacy` or `/submit` → Prologue is shown first; after "Open the map" the requested sheet/tab is what appears.
A15. With storage blocked (private mode that throws on localStorage) → the app still opens; Prologue greets again on the next visit; nothing crashes.
A16. Slow language chunk on first visit (non-English browser) → the app waits at most 2.5 s for the language, then renders in English and switches when the strings arrive.
A18. First visit, press "Open the map" before the map's files have arrived (throttle, or block `*/assets/App-*`) → an interim screen (`.opening-map`: logo, "K-Food Map", `role=status` "Loading the map…") shows until the map is in; the diet chosen is on when it opens. Pressed after the files are in, the map opens at once with no interim screen.
A19. Same with `App-*.js` blocked for good → after two tries the interim screen says "This is taking a while. The connection may be slow." with a green "Try again"; pressing it reloads with the chosen diet in the address (`#f=Halal`), so the diet is still on when the map does open. No "Something went wrong" screen.
A20. Any visit that is not a first visit to the map (returning; `/place/<id>`; `/find/...`; `?list=`) → the head script adds `modulepreload` links for the language file and the map's files at once, and a `preconnect` to the tile server; a first visit to the map adds only the language file (`window.__kfmWelcome === true`). On such a visit the first loading screen stays until the map is in (no second loading screen in between); if the map's file cannot be fetched, the app's own screen says so with "Try again".
A21. The first loading screen's tagline is the welcome headline of the reader's language ("K-푸드의 또 다른 매력, 미식 지도", "K-フードの、もうひとつの魅力"); `<html lang>` is that language from the first script on (English on `/place/` and `/find/` pages until the app takes over).
A22. Welcome screen on a short screen (height <= 600 px: 360x560, 320x480, a phone on its side) → "Open the map" comes right after "What are you looking for?", before "How to read a claim" (on 360x560 it is on the first screen); on a taller phone it stays held to the bottom edge. In Profile → About the Close button is at the end.
A17. [phone] Prologue at 360x640 → the diet choice sits above the legend and is visible without scrolling; "Open the map" is held to the bottom of the screen and always visible, the legend scrolling under it (taller than 600 px; on a shorter screen it sits at the end of the page); no horizontal scroll.

## B. Map

B1. Open the map → Leaflet map centred on central Seoul (37.554, 126.988), zoom 12; OpenStreetMap tiles; attribution "© OpenStreetMap contributors" in the TOP-RIGHT corner with a working link (new tab).
B2. [phone] First paint → the start point sits in the middle of the strip of map visible above the list sheet (the map is shifted, not hidden under the sheet).
B3. Zoom out repeatedly → stops at zoom 6; dragging far away is resisted (bounds lat 10–52, lng 104–150): the world map can never fill the view.
B4. Zoom buttons (`.map-zoom__btn`, aria-labels "Zoom in" / "Zoom out") → each press changes zoom by 1 around the middle of the VISIBLE part of the map (above the sheet / right of the sidebar or docked place), not the hidden centre.
B5. At max or min zoom → the corresponding zoom button gets `aria-disabled=true` (still focusable); pressing does nothing.
B6. [phone] Pull the list sheet to full height → the zoom buttons are hidden (`.app-shell.sheet-full .map-zoom`); they stay visible in phone landscape.
B7. Below zoom 14 → single places are small dots (`.k-dot.k-dot--vegan|halal|both|other`, 32 px tap area); from zoom 14 they are teardrop pins (`.k-pin.k-pin--<kind>`) with a leaf (vegan), crescent (halal), both glyphs, or a plain dot (other). A pork-free place never gets the crescent.
B8. Hover a pin (desktop) → tooltip / `title` like "Name · Halal-friendly, reported" (claim + confidence word, lower-case).
B9. Overlapping places → a count circle (`.k-cluster`, `.k-cluster--few` under 5; four sizes by count) with title "N places here — tap to zoom in".
B10. Tap a count circle → the map zooms to fit that group into the visible area; if that would not zoom in, it zooms exactly one step around the group. Every tap gets closer.
B11. Group of places in one building (within ~20 m) or at max zoom → tapping the circle opens a popup (`.k-cluster-popup`) titled "N places at this spot" with one button per place; pressing a button closes the popup and opens that place.
B12. Tap a pin [phone, sheet at half or folded] → the place opens HALF height ("peek", `.detail-sheet--peek`): the tapped pin stays visible above it (the map pans only if the pin would be covered), the map stays interactive, the pin becomes the large green selected pin (`.k-pin--active`, 38x49).
B13. Tap a pin [phone, sheet fully open] or [phone landscape] → the place opens as the full page, not peek.
B14. Tap a pin [desktop >= 768] → the place docks beside the list (`.detail-sheet--docked`), map stays live; if the pin is off-screen or under the panel, the map pans to bring it into the visible part.
B15. While a place is open → its pin is always drawn separately (never folded into a count), a size larger and filled green; with a journey on the map it is the larger numbered circle (`.k-stop--active`).
B16. [phone] With a place in peek, tap bare map → after ~0.3 s the place closes. A double-tap (zoom) or a drag does not close it; tapping another pin switches place instead of closing.
B17. Saved places → shown as a round heart badge (`.k-saved`) at every zoom, never clustered; title ends "· Saved"; two saved places at the same spot are drawn side by side (second shifted 28 px) and each is tappable.
B18. Pan / zoom the map → the list re-sorts by distance from the centre of the VISIBLE map (after `moveend`).
B19. [phone] Change the sheet height (folded <-> half) → ~350 ms later the list re-sorts from the new visible centre; opening to full does not re-sort; standing within 1 km of "my location" it does not re-sort.
B20. Type a search naming an area ("Busan") while looking at Seoul → after ~0.4 s pause the map flies to fit the Busan places (max zoom 15), padded to stay above the sheet.
B21. Change a chip so that none of the results is in view → the map flies to the results; if at least one result is already in view and the search text did not change, the map does NOT move (user's pan/zoom is kept).
B22. Turn on "Saved" or open a shared list / journey → the map fits ALL of those places (even if some were in view).
B23. Load `/#q=Busan&f=Vegan` → on arrival the map frames the Busan results (not Seoul). Load `/place/<id>#q=Busan` → map stays on that place.
B24. "Search this area" button (`.map-area-btn`, top-left) → appears only after the user moves the map by hand (drag, pinch, wheel, double-tap, zoom buttons), ~350 ms after the move settles, and only if some but not all listed places are inside the visible box. Not offered after a pin tap moved the map.
B25. Press "Search this area" → the list is narrowed to places inside the visible map box; a line "Only places on the map" + "Show all" button (`.place-list__in-map`) appears; the count updates; the pins are NOT reduced; the button disappears.
B26. After B25: press "Show all", edit the search, turn on Saved / open a shared list, press My location (once a position has actually been found — a refusal or a failure keeps the narrowing), or change a chip so nothing/everything is in the box → the narrowing is dropped and the full list returns.
B27. "Search this area" is hidden while: a place is open, Saved/shared list is on, the locate status is asking/denied/unavailable/outside, or in phone landscape. At <= 340 px wide it shows text without the icon.
B28. Tile fails to load (flaky network) → that tile is requested again after 2 s, then 6 s (max 2 retries) without moving the map. [needs: throttling]
B29. Resize across 768 px (or rotate) → the map re-measures itself (no grey bands / cropped tiles).
B30. With "prefers-reduced-motion: reduce" → map moves triggered by search/locate/cluster are instant (no fly animation).
B31. Keyboard: Tab through the map screen → markers are NOT tab stops; the map container has `role=region` `aria-label="Map of the places"`; the marker and tile panes are `aria-hidden`.

### B (cont.) My location

B32. Before use → button `.map-locate__btn.has-label` shows a crosshair and the words "My location" (aria-label "My location").
B33. Press it and allow, inside Korea → state "asking" (class `is-asking`, visually hidden status "Finding your location…"), then a blue dot (`.k-you`, title "You are here"), an accuracy circle when accuracy > 30 m, and the map flies to it (max zoom 15). Button gets `is-on`, loses its label; aria-label "Go to my location". [needs: geolocation]
B34. After B33 → list header hint "Nearest to you"; every card shows a distance (e.g. "350 m", "2.4 km", "12 km"); place page meta shows "X from you". Before any location answer, cards show NO distance at all. [needs: geolocation]
B35. After B33, pan the map away → header hint becomes "Nearest the map centre · distance from you" (order from the map, distances from you). [needs: geolocation]
B36. Press the button again while located → asks again and flies back to the position. [needs: geolocation]
B37. Coarse fix (accuracy > 1000 m, e.g. desktop Wi-Fi) → hollow dot (`.k-you--coarse`, "You are about here") and message "Your location is approximate, so distances are too." [needs: geolocation]
B38. Position outside Korea (lat 32.8–38.9, lng 124.4–132.1) → no dot; message "You seem to be outside Korea, so the list stays ordered by nearness to the map centre." [needs: geolocation override]
B39. Permission denied → message "Location is blocked for this site. Allow it in your browser settings to see distances from you." [needs: geolocation]
B40. Prompt dismissed without answer / timeout (10 s API timeout, 20 s hard stop) / no geolocation API → "Your location could not be found. The list stays ordered by nearness to the map centre."; the button never stays stuck in "asking". [needs: geolocation]
B41. Any locate message (the visible bubble `.map-locate__message`; the same words are announced by the hidden `.map-locate__status`, `role=status`) → disappears by itself after 8 s; pressing the button again shows it again.
B42. Reload after locating → location is forgotten (never stored); the button is back to "My location".

## C. List, bottom sheet, sidebar, tab bar

C1. [phone] Initial sheet → half height (`.sidebar-region.sheet-state-1`); on a short phone (height <= 700 px portrait, i.e. 360x640) half is 66 % of the height, otherwise 60 %.
C2. [phone] Handle button (`.sheet-handle-area`) at half → aria-label "Show the list full screen"; press → full (`sheet-state-2`, shell class `sheet-full`); label becomes "Show more of the map"; press → half; now label is "Show more of the map" again and press → folded (`sheet-state-0`, header over the tab bar); label "Show more of the list"; press → half. (Up a step at a time, then down a step at a time.)
C3. [phone][needs: touch] Drag the sheet header (handle / search / chip area) vertically → the sheet follows the finger and on release snaps to the nearest of the three heights; a quick flick of >= 40 px moves at least one step in that direction.
C4. [phone][needs: touch] Drag horizontally on the chip row → the chips scroll; the sheet does not move.
C5. [phone][needs: touch] At half height, scroll the list down more than ~48 px → the sheet opens to full by itself. After pulling it back to half with the list still scrolled, it does not spring open again until scrolled further down.
C6. [phone] Focus the search box → the sheet opens to full so results show above the keyboard.
C7. [phone][needs: touch] Pull the sheet down while the keyboard is up, or touch the result list → the search box loses focus (keyboard closes).
C8. [phone landscape, e.g. 640x360] → the list is a panel on the left ~54 % of the width, no handle, the whole panel (search + chips + cards) scrolls as one; the map keeps the right side; dragging the header does nothing.
C9. [desktop >= 768] → the list is a left sidebar; no handle; map on the right.
C10. [desktop >= 1024] Sidebar fold handle (`.sidebar-toggle`, aria-label "Collapse sidebar" / "Expand sidebar") → collapses the sidebar to a narrow rail (shell class `is-collapsed`): tab labels hidden, each tab button gets a `title` tooltip; press again to expand. Not present below 1024 px.
C11. List header (`.place-list__header h2`) → "N places" ("1 place" singular); the count is in an `aria-live=polite` region and updates with every search / chip / area change.
C12. With no chip and no search and > 1 result → header hint "Nearest the map centre" (`.place-list__hint`).
C13. Any chip or search on, with results → the hint is replaced by a "Clear (n)" button (`.place-list__clear-inline`; n = chips + 1 if search text). Press → all chips and the search are cleared in place (no keyboard pops up); a shared list / journey stays.
C14. Share-this-search icon (`.place-list__share`, aria-label "Share this search") → shown when a search or shareable chip is on and there are results. See K10–K12.
C15. Cards are drawn 40 at a time → at the end a "Show N more" button (`.place-list__more`); it also loads automatically when it scrolls within ~400 px of view; pressing it adds the next 40.
C34. [desktop >= 1024] Sidebar folded to the icon rail, press Discover / Journal / Profile in the rail → the sidebar unfolds and that panel shows (pressing Map, already the current tab, unfolds the list as well).
C35. [phone landscape >= 768 wide, e.g. 844x390] → list beside the map with ONE row of chips that scrolls sideways; the list is tall enough for a card; an opened place takes the full height of the column.
C36. Two skip links at the top of the Map tab: "Skip to the list of places" and "Skip to the tabs" (the second focuses the current tab button).
C16. New search or chip → the list scrolls back to its top and to the first page. Saving a place, the minute tick, or panning the map does NOT reset scroll or page.
C17. Place card (`article.place-card`) content → name (button `.place-card__open-btn`, whole card is its hit area), area (`.place-card__zone`), distance only when located, status line (`.place-card__meta`), claim chips (`.place-card__badges .claim-chip`: icon + label + confidence word), traits as a plain line (`.place-card__traits`, e.g. "Mild taste · Fermented").
C18. Card status wording → "Open · until 9:00 PM", "Open · until 9:00 PM · last order 8:20 PM", "Closes soon" / "Last order soon" (amber, class `is-soon`, within 30 min), "Last order passed · closes …", "On a break · opens 5:00 PM", "Closed · opens tomorrow 11:30 AM" / "opens Mon 11:30 AM", "Closed today", "Open · 24 hours"; green `is-open`, red `is-closed` (`--danger`; orange `is-soon`). Places with no recorded hours say "Hours not recorded". All by Korean time, whatever the device clock. [needs: clock]
C19. Leave the app open across a minute boundary / wake the phone → statuses on cards update on the minute and at once on `visibilitychange`. [needs: clock]
C20. Tap a card → the place opens (full page on phone; docked on desktop).
C21. Card "Read story" (`.place-card__story-btn`, aria-label "Read story: NAME") → the place opens scrolled to "The food story" section.
C22. Card compass button (aria-label "Get directions to NAME") → the place opens scrolled to "Location and directions" with keyboard focus on the first map link (Naver Map).
C23. Card heart (`.icon-btn`, aria-label "Save NAME to journal", `aria-pressed`) → toggles saved; filled heart + class `icon-btn--saved`; toast (see F40–F45); the list does not jump.
C24. With a Sustainability-axis chip on (Sustainability / Zero waste / Local sourcing) → each card also shows the restaurant's own sustainability line (`.place-card__esg`), the matching trait is listed first, and the note "Described by the restaurant and our research; not independently audited." appears above the cards.
C25. Tab bar (`nav.tab-bar`, aria-label "Primary") → 4 buttons Map / Discover / Journal / Profile; active one has class `active` and `aria-current=page`.
C26. Journal tab badge → when >= 1 place is saved, a count bubble (`.tab-count`, "99+" above 99) on the Journal tab, plus a visually hidden " (n)".
C27. Tap Discover / Journal / Profile → URL becomes `/discover`, `/journal`, `/profile`; document title "Food Journeys · K-Food Map" / "Your Food Passport · K-Food Map" / "Profile · K-Food Map"; map title is "K-Food Map · The other side of K-food".
C28. History: Map → Discover → Journal → Profile, then browser Back once → returns to the Map (tab-to-tab replaces; only one entry above the map). Tapping "Map" from a tab also goes back that one entry (no new entry). Tapping the active Map tab does nothing.
C29. Reload on `/journal` (or `/discover`, `/profile`) → the same tab is shown.
C30. Switch tab (keyboard) → focus moves to that screen's heading (`.place-list__header h2` on the map; the panel's `h2` elsewhere), not on first load.
C31. [phone] On a non-map tab → the panel covers the map; the map region is `inert` (Tab never lands in it). [desktop] The map stays visible and usable beside the panel.
C32. Open an unknown path inside the app (e.g. client-side navigation to `/whatever`) → the map screen renders (catch-all route), not a blank page.
C33. Search state survives tab changes → set a search + chips, go to Journal, come back to Map → same search, chips and results.

## D. Search

D1. Search box (`.search-field input[type=search]`, placeholder and aria-label "Search by name or area") → typing filters the list and the map pins after ~120 ms; emptying the box restores everything immediately.
D2. Clear button (`.search-field__clear`, aria-label "Clear the search") → appears whenever there is text; press → text cleared and focus stays in the box.
D3. Press "/" anywhere outside a text field (no modifier), with the search box visible → focus jumps to the search box. Does nothing while typing in another field or while a sheet / phone place page covers the box; works beside a docked place on desktop.
D4. Press Enter / the keyboard's Search key → the box blurs (keyboard closes); nothing else changes. Enter that confirms a Japanese/Chinese IME conversion does NOT blur.
D5. Native suggestions (`datalist#area-suggestions`) → 19 areas (Seoul, Itaewon, Myeongdong, Hongdae, Gangnam, Insadong, Seongsu, Busan, Incheon, Daegu, Daejeon, Gwangju, Ulsan, Jeju, Suwon, Jeonju, Gyeongju, Gangneung, Ansan); in ja / zh-Hans / zh-Hant they are in that script, in ko in Hangul.
D6. Input attributes → `maxLength=80`, autocomplete/autocorrect/spellcheck off, `autocapitalize=none`, `enterkeyhint=search`. Pasting a page of text is cut at 80 chars and never crashes the app.
D7. URL follows the search → `#q=<text>` is written with `replace` (typing does not add history entries); reload restores the search.
D8. Type while a place is open (desktop, docked) → the place closes and the results show.
D9. Name search → "Balwoo", "발우", "osegye" find by English or Korean name; case, hyphens, spaces, accents and full-width letters are ignored ("mapo gu" = "Mapo-gu" = "mapogu", "ｉｔａｅｗｏｎ").
D10. Word-start matching → "Seomyeon" finds places in Seomyeon (Bujeon-dong / Jeonpo-dong) and NOT Wanju's "Iseo-myeon"; "Hongdae" finds Seogyo/Donggyo/Sangsu-dong; "Lotte World" finds Jamsil.
D11. Area search ordering → "Busan" lists Busan places before Seoul's "Busan Jib"; the map goes to Busan. An exact full name typed ("Vegan Kitchen") puts the place of that name first.
D12. Korean / Japanese / Chinese area names → "부산", "釜山", "プサン", "济州岛", "강남구" find the area; a line "Also searched as “Busan”" appears (`.place-list__searched-as`). Dishes too: "ビビンバ", "キンパ", "拌飯", "豆腐", "カレー", "韓屋村" find what "bibimbap", "gimbap", "tofu", "curry", "hanok" find; "キンパ", "紫菜包饭", "김밥", "kimbap", "gimbab", "kimbab" and "gimbap" give the same list; "Stasiun Busan" is Busan Station; "寺院" and "素齋" are temple food.
D13. Korean address words → "용산구", "이태원로" find places by their Korean address (no "also searched as" line with half-romanised text). A township that shares a name is itself: "용산면" and "대전면" find one place each (Yeongdong, Damyang), not Yongsan-gu or Daejeon; "남산면" is Chuncheon's; a 면 / 읍 / 리 no record has ("수원리", "제주읍") and a dish ("두부면") are read as before; "Daejeon" does not find Daejeong-eup on Jeju.
D14. A question typed out → the words of a question are not search terms: "halal near me" = "halal", "best vegan seoul" = "vegan seoul", "where to eat halal in busan" = "halal busan", "ソウルでおすすめのヴィーガンレストラン" and "서울에서 맛있는 비건 식당 어디" = vegan in Seoul, "restoran halal terbaik di Seoul" = halal in Seoul. "Suwon City" = Suwon, "Jeju Island" = Jeju, "Gyeonggi Province" = Gyeonggi, "Jeju City" = 제주시 (the city only); "Incheon City Hall" is still the city hall. "noodles", "burgers", "salads", "sandwiches", "kebabs" = the singular; "korean food" is what says Korean. A place named with such a word is still its one place: "The India", "Royal Restaurant", "Eat Anything", "Yang Good seoul", "Great Himalaya". "fries", "Las Vegas" find nothing (not "fried", not "vegan").
D14. Diet words act like the chip → "halal", "vegan", "할랄", "비건", "ハラール", "清真", "纯素", "helal", "حلال", "muslim", "muslim friendly" return what the corresponding chip returns (not only places with the word in their name).
D15. "pork-free", "no pork", "pork free", "tanpa babi", "돼지고기 없는" → lists places recorded at the pork-free level (which the Halal chip leaves out). "Seoul pork-free" combines area + level.
D16. Type "pork-free" while the Halal chip is on → the Halal chip switches off automatically (pork-free is not halal) and the pork-free places are listed.
D17. Several words are AND-ed → "Busan korean", "itaewon vegan bakery": every word must match (name/area/address/vibe/story; area words only by location or name: "itaewon vegan" does not list a shop that "moved from Itaewon"). One-letter words are ignored ("busan v" while typing).
D18. Filler words → "halal food near Itaewon", "makanan halal dekat Itaewon", "부산 맛집", "首尔 餐厅", "明洞附近美食" behave like the area (+ diet) alone.
D19. Phrase narrowing → "seoul station", "korean bbq": when some (not all) matches contain the words side by side in name/area/address/vibe, only those are listed. With a comma ("Itaewon, Seoul") no narrowing; the part before the comma leads the order.
D20. Station search → "Seoul Station exit 1", "seoul stn", "서울역", "서울역 1번 출구", "江南駅" list the places recorded at "<Area> Station"; if the station is not on record, the area is searched instead; "미역" (seaweed) is not treated as a station.
D21. Station + chips with nothing at the station passing the chips → empty list plus "Nearest places that match, measured from “Seoul Station”:" with up to 6 places within 4 km.
D22. One-letter typo of a long area name (>= 6 letters) with nothing found → "myongdong", "itaewan" are searched as "Myeongdong", "Itaewon" with the "Also searched as" line. Real places one letter off (mangwon, icheon, yangsan) are NOT corrected; never triggered just because chips emptied the list.
D23. Two areas at once → "Haeundae Seomyeon" / "海雲台 西面" lists places in either.
D24. Hangul being typed → an unfinished syllable ("홍ㄷ") is searched as "홍" (no flash of "No places match"); a query of only jamo ("ㅎㄹ") finds nothing rather than everything.
D25. Punctuation-only or emoji-free sign-only query ("(", "-") → treated as empty: all places. Names with punctuation ("A.A.A") still match as typed.
D26. Query containing "certified" / "KMF" / "인증" / "認証" → the halal caveat note is shown above the results even with the Halal chip off.
D27. Search with chips that leaves < 3 results → under the cards a block "Nearest places that match, measured from “<area>”:" (up to 3; reach 40–90 km for an area, 5 km around results → then titled "Also close to these:") with rows (name, area · "X away, in a straight line", claim chips, open status); each row opens the place. Not shown with Saved or a shared list.
D28. With "Open now"/"Open at…" on, the nearest block lists only open places, those closing soon last.

D30. "open now" typed into the search ("halal open now", "이태원 지금 영업", "営業中", "buka sekarang") → a button "Show places open now" (in the empty state, or under the count when the words found something); pressing it turns the Open now chip on and takes the words out of the box (`#q=halal&f=Open+now`). Not offered when the chip is already on.

## E. Filters (chip row, Open now, Open at…, Saved)

E1. Chip row (`.chip-row`, horizontally scrollable) order → Vegan, Fully vegan, Halal | Open now, Open at…, Saved | Sustainability, Zero waste, Local sourcing | Mild taste, Fermented. Groups have aria-labels ("Dietary filters", "Open now and saved places", "Sustainability filters", "Dining filters"). Each chip is a button with `aria-pressed`; active class `.chip.active`.
E2. Once at least one place is saved → the "Saved (n)" chip (`.chip--saved`) moves to the FRONT of the row and shows the count; with nothing saved it reads "Saved" and sits after "Open at…".
E3. Tap a chip far along the row → it scrolls into view (smooth; instant with reduced motion). Load a link with a far chip on (`/#f=Fermented`) → the row is pre-scrolled so the active chip is visible.
E4. Chips combine with AND → Vegan + Mild taste shows only places matching both; the count drops accordingly. Tap again to turn off.
E5. Vegan → places with "Fully vegan" or "Vegan options" (known records only; unknown never matches). Note above list (when any listed place is "options" and neither Halal nor Fully vegan is on): "Includes places with vegan options on a mixed menu…".
E6. Fully vegan → only kitchens recorded all-vegan; note "Kitchens recorded as all-vegan. Each mark says how sure that is…".
E7. Halal → places "Halal certified" or "Halal-friendly" (pork-free excluded). Note (while no listed place is certified): "None of these places has a halal certificate that we have seen…". Under it a button "See pork-free places (not halal)" (`.place-list__porkfree`). With nothing found on a phone, the sheet opens full so that "No places match" and the nearest places are in view (once; it can be folded again).
E8. Press "See pork-free places (not halal)" → the Halal chip turns off and the search becomes "<current search> pork-free" if that finds something locally, otherwise "pork-free" — by the word of the language ("tanpa babi", "돼지고기 없음", "豚肉不使用", "不含猪肉", "不含豬肉").
E9. Vegan + Halal together → note first: "Showing places with both a vegan claim … and a halal-friendly claim — not places that are vegan and halal…".
E10. Sustainability → matches places with Zero-waste OR Local Sourcing (the one OR group). Zero waste / Local sourcing narrow within it; Mild taste, Fermented are plain trait filters.
E11. Open now → only places open AND still taking orders at this minute in Korea; places with no recorded hours are left out. Note (`role=status`): "Open now, by Korean time. N more places match but have no recorded hours, so they are not shown." or "…Hours can change; call ahead for a long trip." when N = 0. The list re-filters every minute. [needs: clock]
E12. With E11 and N > 0 → button "Also show N with no recorded hours" (`.place-list__note-btn`); press → those places are added (their cards say "Hours not recorded"), note becomes "Also shown: N with no recorded hours. Check before you go.", button becomes "Hide the N with no recorded hours". Turning the chip off resets this.
E13. Open at… → chip turns on, its label becomes "Open <Day> <time>" (e.g. "Open Tue 12:00 PM"), `aria-expanded=true`, and a row (`#plan-row`, group label "Open at…") appears with a Day select, a Time select and "Korean time". [phone] the sheet opens to full; turning the chip off returns it to half.
E14. Default planned time → before 11:00 KST: today 12:00 PM; 11:00–16:59 KST: today 7:00 PM; from 17:00 KST: tomorrow 12:00 PM. [needs: clock]
E15. Day select → 7 options starting today in Korea: "Today (Tue)", "Tomorrow (Wed)", then weekday names. Time select → 48 half-hour options; for today, times already more than 30 min past are disabled. Switching back to today with a past time jumps to the next half hour.
E16. Open now and Open at… are mutually exclusive → turning one on turns the other off.
E17. With Open at… on → cards prefix the status with the plan ("Tue 12:00 PM: Open · until …"); a closed day reads "Closed"/day-off word and the next opening names the weekday; the note reads "Open Tue 12:00 PM, by Korean time; the cards show that time. …"; unknown-hours toggle works as in E12.
E18. Leave Open at… on with today's time until it passes by 30 min → the time moves on to the next half hour by itself; the list is NOT scrolled back to the top for this. [needs: clock]
E19. Saved → only the visitor's saved places (visited ones included); the map frames them all; "Search this area" is not offered.
E20. Saved with nothing saved → empty state "No saved places yet" + "You have not saved a place yet. Tap the heart on a place to keep it here and in your Journal." + "Clear search and filters".
E21. Toggle any chip while a place is open → the place closes and the list shows.
E22. URL follows the chips → `#f=Vegan,Halal` (ids: Vegan, Fully vegan, Halal, Open now, Open at, Sustainability, Zero-waste, Local Sourcing, Mild Taste, Fermented); with Open at also `&at=<day 0-6>-<minutes>` (e.g. `at=2-720`). "Saved" and the shared list are never written to the hash.
E23. Reload with chips/search on (on the map, a tab, or a place page) → the same chips, search and planned time are restored.
E24. Open `/#f=Open%20at&at=0-1140` on a phone → Open at… on for Sun 7:00 PM and the sheet starts fully open.
E25. Malformed hash → unknown chip ids are dropped; `at` must be day 0–6 and minutes < 1440 in steps of 30 or it is ignored; `q` is cut to 80 chars; both "Open now" and "Open at" in `f` → Open at is dropped.
E26. Edit the hash by hand in the address bar (or Back/Forward to an entry with another hash) → the view updates to that search / chips / time; a shared list in force is kept, and so is "Saved" when the address was edited to the same view; an entry gone back to that names another view drops "Saved". Closing a place or a sheet is not a Back: the view on screen stays and is written to the entry landed on (chips cleared beside a docked place stay cleared).

## F. Place detail (`/place/:id`)

### Opening, closing, layout
F1. [phone] Open from a list card → full-height modal sheet (`.detail-sheet[role=dialog][aria-modal=true]`, aria-label = name) with backdrop (`.detail-backdrop`), grabber bar, X button (`.detail-close`, aria-label "Close") and a bottom bar; the map and list behind are `inert`.
F2. [phone] Bottom bar (`.detail-bar`) → Close (X), "Naver Map" link, "Kakao Map" link, heart Save button (`.detail-bar__save`, `aria-pressed`); stays visible while scrolling. At <= 340 px the map buttons show text without icons.
F3. [phone] Peek (opened from a pin) → height matches the half-height list; has a top button `.detail-expand` (aria-label "Show the full page"); not modal (no backdrop, map live, list inert).
F4. [phone] Peek → full page when: pressing `.detail-expand`, scrolling the content down (> 4 px), mouse wheel down, or pulling the sheet up [needs: touch]; rotating to landscape also makes it full and it stays full.
F5. [phone][needs: touch] Pull the sheet down from the top of its content → it follows the finger; released past ~110 px it slides away and closes; short of that it springs back. Not when scrolled down, with two fingers, or under the large-name overlay.
F6. [desktop 768–1199] → docked panel in the list's column, as wide as the list (380 px up to 1023, 420 px from 1024), under the search box and the chips; it covers the list, not the map (`.detail-sheet--docked`, plus `--below-search` on the Map tab so search/chips stay usable); no backdrop, no bottom bar, not `aria-modal`; the map, the search box and the chips remain interactive. While it is there, what it covers is `inert` (the list and the tab bar on the Map tab — the search box and chips stay in use; the whole panel on another tab; the whole column when the window is 500 px tall or less) and the two skip links are not offered.
F7. [desktop >= 1200] → three columns: list (420 px), place panel (400 px, left: 420 px), map. With the sidebar collapsed the panel sits at left 64 px.
F8. Close by X, backdrop tap (phone), bottom-bar X, or Escape → returns to the list/tab it was opened from; URL back to `/` (+ `?list=…` when a list is in force) or the tab path, hash kept.
F9. Browser/Android Back with a place open (opened in-app) → closes it and does not reopen it on a second Back; Forward reopens.
F10. Open a second place from the list while one is open (desktop) → it REPLACES the first: Close or Back returns straight to the list.
F11. Open a place via "Also nearby" → a NEW history step: Back returns to the previous place (at the scroll position it was left at); Close (X) returns to the list in one press, skipping the chain.
F12. Direct link / reload on `/place/<id>` then Close → goes to the map (`/`, replace) with the current tab behind; never leaves the site or does nothing.
F13. Unknown, withdrawn or quarantined id (`/place/nope`) → redirected to `/` and the list shows the note "That place isn't on the map any more, or the link is wrong…" (only while no search/chip is on).
F14. Document title while open → "<Name> · K-Food Map"; restored on close.
F15. Focus → on open, focus moves into the sheet; on close it returns to the element that opened it (card button, journey stop, stamp) on every tab (a saved row or a stamp in the Journal, a journey stop in Discover, a row in Profile — found again by its kind and words when the tab was drawn anew); if it is gone, to the place's own card, then the list (`#place-list`). A box for typing that merely was the last thing focused is not given focus. After "Next stop" / the previous stop inside a journey, closing returns focus to the stop now shown (not the one that opened the sheet) — on a phone and beside the map from 1200 px alike. Test with a focused window: a headless page fires no focus events unless focus is emulated.
F16. Scroll memory → opening a different place starts at its top; coming BACK to a place (Back from nearby place or from /cards) restores where it was scrolled.
F17. Late details do not shove content → on a slow connection, scroll the page before menu/transit/phone arrive: what was at the top of the view stays put when they are inserted. [needs: throttling]

### Header and dietary claims
F18. Header → place name as H2 (Korean part wrapped in `lang="ko"`; in Korean UI the Korean name alone), meta line: area · "X from you" (only when located) · open status word in bold (`is-open` / `is-soon` / `is-closed`).
F19. Claim buttons (`ul.fact-row[aria-label="Dietary and dining facts"] button.claim-fact`) → each shows icon, label ("Fully vegan", "Vegan options", "Halal certified", "Halal-friendly", "Pork-free"), confidence word ("Confirmed", "Reported", "Our reading", "Community-checked") and "Why?"; styled by tone (`claim--…`). Pork-free has no crescent. (No live place is at "Community-checked" or "Halal certified" at present.) An open halal-friendly claim also says what the label means ("‘Halal-friendly’ is what a source reports; it is not a halal certificate.") above the line about alcohol.
F20. Tap a claim → `aria-expanded=true` and the explanation `#claim-explain-vegan|halal` opens, in this order: "<label> · <level>"; "Source: <source> (<site host>) · last checked <date>" (with "Open the source" when the record has the page's address); the research note; for halal-friendly, the sentence saying what the word means here; the line about alcohol when recorded. Tap again or another claim → closes / switches (one open at a time).
F21. Long research note → clamped to ~6 lines with a "Read the full note" button (`.claim-explain__more`, `aria-expanded`) → "Show less".
F22. URLs inside a note → rendered as links named by host (new tab), trailing punctuation outside the link.
F23. Halal claim explanation → also shows "Whether alcohol is sold is not part of this label…".
F24. A known "no" → "No vegan dishes" / "Not halal" appear as claim buttons without a diet icon and are tappable for their source.
F25. A diet with no claim → a plain grey chip "Vegan: not known" / "Halal: not known" (`.detail-otherdiet`).
F26. Traits line (`.detail-traits`) → "Mild taste · Fermented · Zero waste · Locally sourced" with small icons; not chips.
F27. Caveat box (`.diet-note`) → title + body by the weakest confidence on the place: "Checked against a primary source." / "Reported, not confirmed." / "Our reading, not a stated fact." / "No dietary information yet."; the caveat sentence hides while a claim explanation is open; the box with "Ask in Korean" and the certificate line stays.
F28. "Ask in Korean: cards to show staff" link (`.diet-note__ask`) → opens `/cards?card=muslim` for a halal-only place, otherwise `?card=vegan`; closing the cards returns to this place at the same scroll position.
F29. Place with a claimed certificate → line "Certification claimed: <body> — we have not seen the certificate." (or "… — <note>").

### Practical rows
F30. Hours row → status + detail, then "Today: <hours>" (each time range wraps as a unit); unknown → "Opening hours unknown — check before you go".
F31. Device clock not on Korean time (change OS time zone) → extra line "Korean time — it is <time> there now". Not shown on a KST device, nor on one with the same offset (Tokyo). Open / closed and "Today" stay Korea's. (`tz: "America/New_York"` in a `shot.mjs` step sets the device's zone.)
F32. With "Open at…" on → a second labelled row "<Day time>: Open/Closed · …" under the now-status.
F33. "Hours for the week" (`details.week-hours`) → opens a Mon–Sun list; today is marked (`.is-today`); lunch/dinner on separate lines with "(last order …)"; a day off reads "Closed"; an unrecorded day reads "Not recorded"; opening it scrolls it into view. Only for places with a weekly schedule.
F34. "Report incorrect info" link under the week hours (`.detail-report--hours`; the general link lower down has the same words) → `/submit?place=<id>` with topic "Opening hours" preselected. The topic travels in the navigation state: `/submit?place=<id>` opened directly has none. A draft is kept only once something is typed — opened from the hours link and closed untouched, the general link opens with "Choose one".
F35. Transit row (after full record loads) → "<Station> <Line>, exit N · M min walk"; when > 15 min adds " — a bus or taxi may be easier"; Korean UI shows Korean station/line names.
F36. Phone row → link "Call 02-…" with `href="tel:+82…"` (leading 0 replaced by +82).
F37. Links row → "Website" and/or "Instagram" open in a new tab.
F38. Loading line (`.detail-loading [role=status]`) → "Loading menu, transit and contact details…" while `/place-data/<id>.json` is fetched; disappears when loaded; never shown when offline.
F39. Full record fails (block `/place-data/*` or 10 s stall) → "Could not load the menu, transit and contact details." + "Try again" button; pressing retries (button stays, dimmed/`aria-disabled` while asking); on success focus moves to the sheet; when the connection returns (`online` event) it retries by itself. The rest of the page (claims, address, hours, story) still works. [needs: network control]

### Save / Been here / Share and toasts
F40. "Save" button (`.action-btn`, `aria-pressed`) → becomes "Saved" with filled heart; toast "Saved to your Journal. It opens offline too." (3 s). The heart on the card, the bottom bar and the Journal count update. The toast is DRAWN on top (check `document.elementFromPoint` at its centre, or a screenshot — it once sat under every other layer): above the bottom bar on a phone, over the map from 768 px (clear of the list, and of a docked place from 1200 px).
F41. Unsave a saved (not visited) place → toast "Removed from your Journal." with "Undo" (`.toast__undo`), visible 10 s and held while hovered/focused; Undo restores the save with its original saved date and says "Saved to your Journal…".
F42. Remove several saved places quickly (Journal X buttons) then Undo → ALL removed while the toast was up come back.
F43. "Been here" (`aria-pressed`) on an unsaved place → saves AND marks visited in one tap; toast "Marked as visited. It is stamped in your Journal." with Undo; Undo puts it back exactly as before (unsaved if it was unsaved) and says "Visit removed.". Once visited, the button reads "Visited" (ko 다녀왔어요, ja 訪問済み, id Dikunjungi).
F44. "Been here" again on a visited place → confirm dialog "Remove this visit? Its date and Journal seal will go with it." (Cancel / Remove) → on Remove toast "Visit removed."; on Cancel nothing changes.
F45. Unsave a VISITED place (heart) → confirm dialog "Remove this place from your passport? Its visit and seal will be removed too."; on Remove toast "Removed from your Journal." with NO Undo.
F46. Toast region (`.toast-region[role=status][aria-live=polite]`) → one toast at a time; on a phone with a place open it has class `toast--over-place` (clear of the bottom bar).
F47. "Share" → with Web Share: native sheet with title = name, text "Name — claims with confidence — area", URL = `origin/place/<id>` (no `#…`); button shows "Shared!" 2.5 s; dismissing the sheet changes nothing. Without Web Share: link copied, button shows "Link copied". If neither works: a `prompt` with the URL. [needs: share API for the first branch]

### Menu, directions, address
F48. "Signature menu" section (only when the record has a menu) → rows of dish name (Korean in `lang=ko`), a small gloss under names (reader's language, when available), price formatted "14,000 KRW" (bare numbers get thousands separators; "unknown" → "Price not listed"; ko/ja/zh show 원 / ウォン / 韩元 / 韓元 and "약/約" for "~"). (No live price carries "~" at present; Indonesian writes "36.000 won".)
F49. Menu notes → "Not every dish here is vegan: this place offers vegan options." (vegan = options) and "Dish names and prices are the restaurant's own, unverified, and may have changed." (menu not confirmed).
F50. "Location and directions" → place name in bold, note about Naver/Kakao/Google, three links (`.detail-directions a`): Naver Map (`https://map.naver.com/p/directions/-/<x>,<y>,<name>/-/transit`), Kakao Map (`https://map.kakao.com/link/to/<name>,<lat>,<lng>`), Google Maps (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`), all `target=_blank`, destination only (routing starts from the phone's location).
F51. Address row → address + "Copy" button (aria-label "Copy: <address>") → clipboard gets the address, button reads "Copied!" for 2 s. Area-level addresses append " — area only".
F52. Non-Korean UI → extra row "Address in Korean" with its own Copy. Korean UI → the Korean address is the main address with the romanised one below.
F53. "Name in Korean" row (places with a Korean name) → Copy button + "Show large" (`aria-haspopup=dialog`).
F54. "Show large" → full-screen overlay (`button.staff-large`, portal on body) with the Korean name auto-sized as large as fits (max 200 px, min 34 px; long names break evenly), the Korean address, the phone number, and "Tap to close"; the app behind is inert; the screen is kept awake (Wake Lock) while open.
F55. Close the large name → tap anywhere, Escape, or browser Back: ONLY the overlay closes (the place stays open); focus returns to "Show large"; Tab does not leave the overlay. Rotating re-fits the text.
F56. "Report incorrect info" link at the end of the section → `/submit?place=<id>` (no topic preselected).
F57. Offline with a place open → above the map links: "You are offline: the map apps and links below need a connection." [needs: offline]

### Nearby, story, provenance, journey
F58. "Also nearby" → up to 3 other places within 0.8 km (straight line), nearest first; each row: name, "X away, in a straight line", open status (for the planned time when Open at… is on, prefixed with the weekday), claim chips; tap → opens that place (F11).
F59. With a diet chip on (Vegan / Fully vegan / Halal) → nearby lists only places matching those chips and says "Only places that match your diet filters."; search text and Open now do not narrow it.
F60. "The food story" → story paragraph; optional timeline (year + event); "Did you know?" callout; then "General dining tips" list (by the place's category). Section title has a Korean gloss "· 이야기" except in Korean UI.
F61. Opened as a journey stop (from Discover, or from the map/list while a journey is shown) → nav above the name (`nav.journey-nav`): "Stop 2 of 3 · <journey title>", a "Stop 1" button (previous), and "Next stop: <name>" + "X away, in a straight line", or "Last stop of this journey" at the end. Buttons switch the page to that stop (replacing; Close returns to where the journey was opened).
F62. Footer "About this information" → the Confirmed / Reported / Our reading / Not known sentence, then: Location = coordinate source (+ " · address is area-level"), Dietary = sources with site hosts (or "Not recorded"), Last checked = date ("…" while loading, "—" if loading failed, "Never" if none). The date row is labelled "Page last checked" (the latest check of any fact on the page; each claim's own date is in its "Why?" panel). Under the box, "Something wrong?" is followed by the "Report incorrect info" link itself (`.detail-report--end`).
F63. Escape precedence on a place → a confirm dialog answers first; else the large name closes; else the gallery; else the place.
F64. Photo hero / gallery (`.place-image--hero`, `.gallery-overlay`) → only for places with a real photo (none today): tapping the hero opens a full-screen gallery; closes by X, backdrop or Escape. Without a photo there is no hero band. (Not testable until a record has `photo`.)
F65. The line under the name (area · distance · open or closed) wraps without a dot left at the end or the start of a line (360 px, Larger text; a long area such as "Chinatown, Jemulpo-gu, Incheon").
F66. In Korean a menu line written "Seon Course (선식)" leads with the Korean and keeps the English: "선식 (Seon Course)" (only where the bracket is all Korean; any other line is shown as the record has it). Other languages show the record's line.
F67. [desktop 1024–1199] A place open, then the list folded to the rail → the place takes the whole height of the column (no empty band where the search box was).
F68. In a language other than English, on a slow line (`throttle: true`, read the text every 300 ms from the first second) → the "Why?" note, the certification line, the story, the timeline, Discover's story excerpts and a card's sustainability line show "…" until their translation arrives, then the translation — never the English first. With the translation's file blocked (`block: ["*story-ja-*"]`, `["*notes-ja-*"]`) the English shows, with the "in English" note where there is one.
F69. The words in brackets after an area ("(near Busan Station)", "(opposite Haeundae Beach)", "(east coast)") are in the reader's language in ja / zh / id ("(Busan Station 付近)", "(dekat Busan Station)"); the landmark's own name keeps the record's spelling; Korean shows its Korean area line instead.
F70. A Korean name of one long word (`/place/surinnal-jokbal-jangchung`, 17 letters without a space) at 320 / 360 px, normal and Larger → wraps inside the sheet (no sideways scroll, nothing past the right edge); Korean elsewhere still breaks between words, not inside them.
F71. [desktop >= 768] A place opened by its own link (`/place/<id>`, no search in the address) at 768, 1024, 1280, 1920 px and on a phone on its side (844x390) → its pin stands in the middle of the visible map (clear of the docked place) and the place is the first card of the list beside it, its neighbours after it. With a search in the address the map frames the search as before.

## G. Explore tab (Discover, `/discover`)

G1. Header → bowl icon, H2 "Food Journeys", subtitle, and a link-button "Korean cards to show staff" (`.discover-cards-link`) → opens `/cards`; closing returns to Discover.
G2. "Browse by area" (`.browse-areas`) → two rows, Vegan and Halal, each a horizontally scrollable list of up to 12 areas with at least 3 places, most first, each "Area <count>" (names in Korean in ko; in Japanese or Chinese script in ja, zh-Hans, zh-Hant; romanised in en and id). The row of a diet whose chip is on comes first.
G3. Tap an area link (e.g. Halal → Busan) → the Map tab opens with search "Busan", only the Halal chip on, in area-only mode (places IN Busan; Seoul's "Busan Jib" is excluded); URL `/#q=Busan&a=1&f=Halal` (the name as shown: `/#q=ソウル&a=1&f=Vegan`, `/#q=서울&a=1&f=Vegan`); the count equals the number on the link; the map frames them.
G4. Area link `href` → `/find/<diet>-<area>` (e.g. `/find/halal-busan`): opening it in a new tab loads the prerendered guide URL which the app turns into the same map view.
G5. Edit the search text after G3 → area-only mode is dropped (`a=1` leaves the hash) and normal search applies.
G6. Journey cards (`article.journey-card`) → 7 journeys (Itaewon, Jongno & Insadong temple food, Myeongdong halal-friendly, Jeonju, Busan, Jeju, Ansan Wongok-dong), each with title, description, a "N stops" toggle, a claims summary and a map button. A journey with a quarantined/missing stop is not shown at all.
G7. "N stops" toggle (`.journey-card__toggle`, `aria-expanded`, aria-label "<title>: N stops") → [phone] folded by default, [>= 768] open by default; tapping the title or description also toggles (not when selecting text or double-clicking).
G8. Stop rows (`button.journey-stop`) → number, name, area, "X from stop n, in a straight line" (from the 2nd stop), open status now (or "Hours not recorded"), claim chips with confidence.
G9. "Closed today: n of m stops" line → appears on a journey when any stop has today recorded as a day off. [needs: clock]
G10. Claims summary → "Dietary claims across these stops: 2 reported, 1 our reading." (Korean: "확인됨 1건, 알려짐 2건" style; ja/zh use "、").
G11. Tap a stop → the place opens with the journey nav (F61); Close/Back returns to Discover with the same journeys open and the same scroll position.
G12. "Show these stops on the map" (`.journey-card__map`) → Map tab at `/?list=<ids>&journey=<id>`: ONLY the stops are on the map as numbered circles (`.k-stop`), the map frames them, the sheet is at half height, any previous search/chips are set aside.
G13. In journey view the list → a note "<Journey title> — N stops." (`.shared-list-note`), cards in journey order each prefixed with its stop number (`.place-card__stop`), "Save all" and "Show all places" buttons; [phone] the "N places" header row is hidden (`.place-list.is-shared`); [desktop] header hint "In the order of the journey".
G14. Open a stop from the map or list in journey view → it opens with the journey nav and its numbered pin enlarges.
G15. "Show all places" in journey view → the journey is closed, URL becomes `/`, and the search + chips that were on BEFORE the journey are restored (e.g. the diet chosen in the prologue).
G16. Browser Back from the journey map → returns to Discover. Back undoes the step: when Discover had been reached from the Map tab, pressing Map then shows the view from before the journey (Forward brings the journey back); when Discover was the first page of the visit, the Map tab still shows the journey (K8) and "Show all places" returns the earlier view.
G17. "Food stories" section → H2 + subtitle; 4 story cards (Balwoo, Gamloheon Jeonju, Osegyehyang, Vegenarang Gwangalli; a missing one is dropped) with "Story" label, name, the story's first sentence and "Read story" → opens the place scrolled to its story.
G18. Non-English UI before translated stories have loaded → note "Stories, menus and place descriptions are in English."; once loaded the first sentences are in the UI language.
G19. Discover remembers for the visit → vertical scroll, which journeys are open, and the sideways scroll of each area row are restored when coming back from the map, a place or another tab.

## H. Journal (`/journal`)

H1. Passport cover → H2 "Your Food Passport" and three stats: Visited, To visit (saved, not visited), Area/Areas (distinct areas among visited).
H2. Empty state (nothing saved) → grey seal 여권, "Your passport is empty", body text, CTA "Find a place on the map" (`.journal-empty__cta`) → goes to the Map tab; "What it'll look like" with 3 sample stamps tagged "Sample" (tappable: open that place); 3 numbered steps.
H3. Save one place → it appears under "Saved for Later" as a row (`li.saved-item button.saved-row`): name, "area · saved <date>", open status, claim chips, chevron; tap → opens the place over the Journal (Close returns to Journal).
H4. Row remove button (`.saved-row__remove`, aria-label "Remove: NAME") → unsaves with the same toast + Undo as F41; keyboard focus moves to the next row's remove button (or previous, or the panel); after Undo focus returns to the Journal panel.
H5. Saved places across regions → grouped by region with headings "Seoul · 3", "Busan · 1", … (largest first; unreadable region → "Other"); a single region shows one plain list. Inside a group, oldest saved first.
H6. "Share this list" (`.journal-share`) → shares/copies `origin/?list=<saved-not-visited ids>` with text "My K-Food Map list: name, name, … (, … after 8)"; when copied the button reads "Link copied" 2.5 s; total failure → `prompt` with the URL.
H7. "See them on the map (N)" (`.journal-copy`; N = all saved incl. visited) → Map tab with ONLY the Saved chip on (search and other chips cleared), map framing all of them; browser Back returns to the Journal.
H8. "Copy the list as text (names in Korean, addresses)" → clipboard gets, per place: "Name · 한국어 이름", the Korean address where the record has one, the address as recorded, `origin/place/<id>`, blank line between places; button reads "List copied" 2.5 s; if the clipboard is refused a `prompt` shows the text.
H9. Offline note under the buttons → "Saved places open without a connection — their pages are kept on this device. The map background still needs one."
H10. Mark a saved place "Been here" → it moves to "Visited Places" as a stamp (`button.stamp`): cinnabar seal with the first Hangul word of its Korean name (방문 if none), name, area, "Visited <date>"; tap → opens the place. Stats update.
H11. With "Open at…" on (set on the map) → saved rows show the status for the planned time, prefixed "<Day time>:".
H12. Badges section → "Badges" + "N Earned"; "First Taste" (첫맛) earned after any visit; "Plant Based" (채식) earned after visiting a "Fully vegan" place; locked badges are grey and say how to earn them ("Mark any place “Been here”." …).
H13. Journal scroll position → restored when returning from the map, a place or another tab during the visit.
H14. Saved data persists → reload / reopen the browser: saved and visited places are still there (localStorage `kfm-bookmarks`); with storage refused they last for the visit only and nothing crashes.
H15. A saved place that later becomes quarantined/removed → silently absent from the Journal lists and from the map.
H16. Session-ended notice → when a sign-in ended by itself (H/I20), the empty Journal shows "⚠️ Your sign-in ended — sign in again to restore your saved places" above the empty state. [needs: sign-in]

## I. Profile, language, text size, account (`/profile`)

I1. Header → H2 "Profile", subtitle "Your passport, language, and how this map works."
I2. Settings rows (`.settings-list .settings-item`) in order → Language (value = current language's own name), Text size, Korean cards to show staff, [Add to Home Screen — only when installable or on iOS], Suggest a restaurant, About K-Food Map, Privacy Policy.
I3. Language row → opens the language sheet (`.language-picker[role=dialog][aria-modal]`, title "Choose a language") via a portal above the tab bar; the panel behind is inert.
I4. Language sheet → 6 options in their own names with own `lang`; the current one has `active` + `aria-pressed=true` and receives focus; a note "Translations are new and may have mistakes…".
I5. Choose a language → option shows " …" and `aria-busy` while its strings load (others `aria-disabled`); on success the sheet closes, the whole UI switches, `<html lang>` changes, and `kfm-language` is stored (reload keeps it).
I6. Choose a language while offline / chunk blocked → after up to 10 s an alert "Could not load that language. Check your connection and try again."; the UI stays in the previous language; if the chunk arrives late after all, the language switches and the sheet closes. [needs: network control] Pressed again after it failed, the choice is kept and the page loads anew (a browser never asks twice for a file that failed).
I7. Close the language sheet → X button, tap on the dim overlay, Escape, or browser Back (Back closes only the sheet, staying on Profile); focus returns to the Language row.
I8. Text size (`.text-size`, 3 "A" buttons named Normal / Large / Larger by hidden text, no `title`; `aria-pressed`) → sets `html[data-text=large|larger]` (none for Normal): text in the list, place pages, tab panels, Journal, language sheet and confirm dialogs grows (x1.15 / x1.3); the map and the bars' heights keep their size (the tab labels and chips grow with the text — chips 14 / 15 / 16 px — and the map buttons of the bottom bar at Larger); stored in `kfm-text-size` and applied before first paint on reload.
I9. At Larger on 360x640 → no clipped or overlapping text in cards, chips, place page, bottom bar, Journal rows, Profile rows (visual check). A seal's name in the Journal stays on one line ("Gonghwachun" at 360 px, Larger) — check with a real visit (mark a place "Been here"), not only the sample seals of the empty Journal.
I10. "Korean cards to show staff" → opens `/cards` (Close returns to Profile).
I11. "Suggest a restaurant" → opens `/submit` (new-place form; Close returns to Profile).
I12. "About K-Food Map" → the Prologue as a dialog (`.prologue-layout[role=dialog][aria-modal]`): title, count, legend; NO language row and NO diet chooser; button reads "Close"; closes by the button, Escape or browser Back; focus returns to the About row; the diet chips on the map are unchanged.
I13. "Privacy Policy" → opens `/privacy` (see N/Q items P-privacy below: Q1–Q6).
I14. Passport card (`.profile-custody`) signed out → eyebrow "Passport", title "On this device only", hint "Sign in to carry these to your other devices."; stats button "<n> To visit · <m> Visited" (`.profile-custody__stats`) → switches to the Journal tab; counts equal the Journal's.
I15. "Sign in with Google" button (`.profile-custody__cta`) → shown only when the backend reports Google sign-in is enabled (asked once online, retried once after 8 s and on reconnect) or after a session ended; never shown in a build without Supabase config; hidden while signed in.
I16. Press "Sign in with Google" → full-page redirect to Google; after consent the browser returns to the SAME path it left (e.g. `/profile` or `/place/<id>`), signed in. [needs: sign-in]
I17. Signed in → card title "Carried to your account" + the account e-mail; an "Account" section appears with "Sign out" (value "Clears this device") and "Delete my saved places" (danger style). [needs: sign-in]
I18. Places saved BEFORE signing in → kept and merged with the account's (union; per place the later change wins; on a tie saved beats unsaved). [needs: sign-in]
I19. Sync → a save/unsave/visit is sent ~1 s after the tap (only changed entries); on a second device signed into the same account the change appears after its next load/reconnect; an unsave on one device is NOT resurrected by the other. [needs: sign-in][needs: 2nd device]
I20. Sync failure (block the Supabase REST calls) → notice "Couldn't sync — your records are safe on this device" (`.profile-notice--warn`, `role=status`); local saves still work; retried (pull: 2 s, 8 s, 30 s; push: three more tries) and again on reconnect; the notice clears after a success. [needs: sign-in][needs: network control]
I21. Sign out → row shows "Sign out …" (`aria-busy`) while unsent changes are pushed; then the device's saved places are cleared (Journal empty, hearts off), the card returns to "On this device only"; NO "sign-in ended" notice. Signing in again restores them from the account. [needs: sign-in]
I22. Sign out with changes that cannot be sent (offline / sync never succeeded) → confirm dialog "Some saved places may not have reached your account yet. Signing out now removes them from this device." (Cancel / Sign out); Cancel keeps everything. [needs: sign-in][needs: offline]
I23. "Delete my saved places" → confirm dialog with the long text "This deletes your saved, visited and unsaved-place records from your account, and clears this device. Another device where you are still signed in can upload what it still holds…" (Cancel / Delete my saved places); on confirm the account rows are deleted and the device cleared; still signed in; new saves sync again. If the delete request fails → the device is NOT cleared and the sync-failed notice shows. [needs: sign-in]
I24. Session ends by itself (token revoked/expired, or sign-out in another tab) → this tab clears its saved places and shows "Your sign-in ended — sign in again to restore your saved places" in Profile (and in the empty Journal); the notice survives a reload; the sign-in button is offered even if the readiness probe fails; signing in clears the notice. [needs: sign-in]
I25. Cancel at Google's consent screen (return with `?error=access_denied`) or sign-in chunk fails to load → notice "Sign-in didn't finish. Your saved places are still on this device — try again when you're ready."; saved places untouched. [needs: sign-in]
I26. Sign in as account B on a device that holds account A's passport → the device is cleared first; B sees only B's places (A's are not donated to B). [needs: sign-in, 2 accounts]
I27. Signed out → no passport network requests are made at all (only the one anonymous "is Google enabled" probe). Check in DevTools Network.
I28. iOS (Safari, not installed) → "Add to Home Screen" row toggles a help line "Tap the Share button, then “Add to Home Screen”…" (see M9).

## J. Korean cards for staff (`/cards`)

J1. Entry points → Discover link, Profile row, a place's "Ask in Korean" link, the empty-search ingredient hint, a direct URL, the installed app's shortcut. All open the same sheet (`.detail-sheet[role=dialog][aria-label="Korean cards to show staff"]`, content `.staff-cards`) over the current screen.
J2. Card tabs (`.staff-cards__tabs`, group "Choose a card") → chips "I am vegan" / "I am Muslim" with `aria-pressed`; switching changes the statement, the questions and the word list, and the URL becomes `/cards?card=vegan|muslim` (replace, no new history entry).
J3. Initial card → `?card=` in the URL wins; otherwise "muslim" when the Halal chip is on without Vegan/Fully vegan; otherwise vegan. From a place: the card matching that place's claims.
J4. "Show this to staff" section → the Korean statement (4 lines, `lang=ko`, `.staff-card__paper`) with a "Show large" button ABOVE it; at 360x640 the button and the first three lines are on the first screen (the fourth line of the vegan card is cut by the fold).
J5. "What it says" (`details.staff-card__meaning`, open by default) → the exact meaning of each line in the UI language. Hidden entirely in Korean UI.
J6. "Show large" button or a tap on the card paper → full-screen overlay (`button.staff-large`) with the Korean lines sized as large as fits (22–120 px), "Tap to close"; app behind inert; screen kept awake; rotation re-fits.
J7. "Questions to ask" → 10 questions on the vegan card (honey among them), 9 on the Muslim card, each a button with the meaning (UI language), the Korean, and the romanisation; tap → that one question large, with its meaning in small text under the Korean (no meaning in Korean UI).
J8. "What staff may answer" → 9 answers (네, 아니요, 들어가요, 안 들어가요, 빼 드릴게요, 안 돼요, 잘 모르겠어요, 있어요, 없어요) with romanisation and meaning; hint "If the answer is unsure, treat the dish as one you cannot eat."
J9. "Words to look for" → 11 words per card: 9 common (액젓 … 굴소스, 젤라틴), plus egg and dairy words only on the vegan card, cooking-wine and 청주 only on the Muslim card.
J10. Closing the large view → tap, Escape, or Back: only the large view closes; focus returns to the button/question that opened it; Tab stays on the overlay.
J11. Closing the sheet → X (`.detail-close`), backdrop, or Escape (when no large view): returns to the opener (place at the same scroll, Discover, Profile, list) via history back; opened by direct URL → goes to the map / current tab.
J12. Document title "Korean cards to show staff · K-Food Map" while open; restored after.
J13. Works offline once the app has loaded (all content is in the bundle); the closing note says so. [needs: offline]
J14. Reload on `/cards?card=muslim` → the Muslim card is shown again.

## K. Sharing and deep links

K1. `/#q=Itaewon` → map opens with that search; `/#f=Halal` → chip on; `/#q=Busan&f=Vegan,Open%20now` → both; see E22–E26 for validation.
K2. `/#q=Busan&a=1&f=Halal` → area-only mode: only places located in Busan.
K3. `/find/vegan-seoul` (pattern `/find/(vegan|halal)[-area]`) → app opens the map with that chip and area (area-only) and REPLACES the URL with `/#q=Seoul&a=1&f=Vegan`; `/find/halal` → `/#f=Halal`. Prologue skipped.
K4. `/?list=balwoo,eid,plant-cafe` → the map shows only those places (fit to view), list note "3 places from a shared list." with "Save all" and "Show all places"; other pins hidden.
K5. Shared-list validation → unknown / malformed / quarantined ids and duplicates are dropped, order kept, at most 60 ids; if none is valid it is treated as no list (normal map; prologue not skipped).
K6. "Save all" → every place of the list not yet saved is saved in one go; the button is replaced by "All saved to your Journal"; already-saved-all lists show that text from the start.
K7. "Show all places" → list filter closed, URL becomes `/`.
K8. With a shared list or journey in force, open a place and close it / toggle a chip / go to another tab and back to Map → the list is still in force (`?list=…` kept in the map's address); reload keeps it.
K9. `/?list=…&journey=<id>` → as G12–G13 (numbered stops, journey order). An unknown journey id → treated as a plain shared list.
K10. Share this search (list header icon) → URL `origin/#q=…&f=…[&at=…][&a=1]`; never includes "Saved" or the shared list. Share text lists the chip names and the search ("Halal · Open Tue 7:00 PM · Busan").
K11. K10 without Web Share → link copied; the icon is replaced by "Link copied" for 2.5 s (aria-label too). Total failure → `prompt("Share this search", url)`.
K12. Open the copied link in a fresh browser → the same search, chips and planned time; after the Prologue on a first visit to `/`.
K13. `/place/<id>` shared link → opens that place directly (prologue skipped); no "from map centre" distance is shown; Close goes to the map.
K14. Reload on `/place/<id>#q=…&f=…` reached from the app → the place reopens over the same tab with the same search/chips behind it.
K15. `/cards?card=muslim`, `/submit`, `/submit?place=<id>`, `/privacy`, `/discover`, `/journal`, `/profile` → each loads directly to that screen (after the Prologue on a first visit).
K16. Clipboard fallback → in a context where `navigator.clipboard` is refused (in-app browser, http), Copy buttons still work through the legacy copy path, or leave the text visible / in a prompt. [needs: in-app browser]

## L. Languages (en, ja, zh-Hans, zh-Hant, id, ko)

L1. First visit, no stored choice → language follows the browser: ja*, ko*, id*/"in" → those; zh-TW / zh-HK / zh-MO / zh-Hant → Traditional; other zh → Simplified; en* → English; anything else (incl. Malay) → English. Not stored until chosen (keeps following the browser).
L2. Chosen language persists across reloads (`kfm-language`); an invalid stored value falls back to detection.
L3. Switch to each of the 5 other languages → every UI string changes: tab bar, chips, search placeholder, list count/notes, empty states, place page headings/buttons, toasts, confirm dialogs, Discover, Journal, Profile, cards meanings, submit form, map buttons and messages, banners. No raw keys (e.g. `list.placeCount`) visible anywhere.
L4. `<html lang>` equals the language; Korean fragments inside other languages carry `lang="ko"`; untranslated English content carries `lang="en"`.
L5. Hours format per language → en "7:30 PM"; ja and zh 24-hour "19:30" (several ranges joined by 、, last order in （ ）); id 24-hour with a dot "19.30"; ko "오후 7:30", noon "낮 12:00", closing at midnight "자정". Before the day's first opening the status word is "영업 전" / "開店前" / "尚未營業" / "Belum buka" (English says "Closed").
L6. Dates per language → saved / visited in the Journal: en "5 Oct 2026" (en-GB, short month); a place's "Last checked" and its evidence lines: "5 October 2026" (long month); ja/zh/ko/id in their own format.
L7. Korean UI specifics → place names show the Korean name (branch words translated: "미스터케밥 이태원"); areas show the Korean city + district; Discover area links in Hangul; the main address is the Korean one; station/line names in Korean; no Korean gloss beside section headings; cards hide the meaning lines.
L8. Stories in the UI language → a place's "The food story" (and the sustainability line on cards, Discover story snippets) is shown translated once the language's story file has loaded; until then, or if it fails, the English text shows with the note "Stories, menus and place descriptions are in English." (loaded lazily; prefetched ~6 s after start when online; retried on reconnect).
L9. "Why?" research notes in the UI language → shown translated when available; if the record was corrected after translation (length check mismatch) the English note is shown instead (stale-translation fallback). Certification line and timeline follow the same rule.
L10. Menu gloss → under dish names a short explanation in the UI language where one exists (English UI gets glosses for Korean-only names; Korean UI for English-only names).
L11. Journey titles/descriptions, "Did you know?" and dining tips → translated with the UI.
L12. Privacy policy in ja / zh / id → the translation is shown first with a note that English and Korean are authoritative (see Q3).
L13. Long strings at 360 px in every language → chips, buttons, bottom bar, notes and the tab bar do not overflow or overlap (visual pass per language; Indonesian and Japanese are the longest).
L14. Searching in the UI language → the chip words typed in that language (D14) and localized suggestions (D5) work.
L15. Two language choices in quick succession on the welcome screen → the last one wins (a slow first chunk does not override it). In Profile's language sheet the other rows are `aria-disabled` while one is loading, so a second press there is ignored.

L16. The page translated by the browser (Chrome's "Translate this page", for a reader of Thai, Vietnamese, Arabic, Russian…; imitated by `scripts/regress` step `page-translated`) → nothing crashes: a place opened and a place near it pressed, saving, chips, tabs all work; counts and "Clear (n)" follow what is on; closing a sheet puts focus back on what opened it. Left as written (`translate="no"`): Korean to read or show (staff cards, Korean name and address, Hangul in menus and notes, seals), place names, addresses, romanised readings, the names of the languages. A diet word typed in such a language (халяль, हलाल, веган, วีแกน, vegano, نباتي…) finds what the chip finds (D14).

## M. PWA, offline, install, updates

M1. Web manifest (`/manifest.webmanifest`) → name/short_name "K-Food Map", `display: standalone`, `start_url: /`, `scope: /`, theme `#FFFFFF`, background `#F7F7F8`, icons favicon.svg, 180/192/512 PNG and a maskable 512; shortcuts "Korean cards to show staff" (`/cards`) and "Saved places" (`/journal`).
M2. Service worker registers (`/sw.js`, autoUpdate) → after one online visit, go offline and reload `/` → the app opens fully (shell, all place data, list, search, filters, Journal, cards). [needs: offline]
M3. Offline banner → while offline a band "Offline — showing saved data" (`.offline-banner[role=status]`) shows on every tab and over sheets; the layout steps down (`.app-shell.has-band`); it disappears when back online.
M4. Offline map → tiles already viewed (within 14 days, max 400) still draw; unseen areas are grey; pins, clusters and the list still work. [needs: offline]
M5. Offline place page → a place opened online before, or any SAVED place (its full record is prefetched in idle time), shows menu/transit/phone offline; a never-fetched place shows the bundled parts (claims, hours, address, story) without the loading line and with the offline note over the map links. [needs: offline]
M6. Offline deep links → `/place/<id>`, `/journal`, `/cards` etc. load from the service worker's navigation fallback. [needs: offline]
M7. Offline submit → the form shows "You're offline. Your text stays here while this page is open — send it when you're back online." and Send is disabled; typed text is kept; coming back online enables Send. [needs: offline]
M8. Install (Chrome/Edge/Android) → when the browser fired `beforeinstallprompt`, Profile shows "Add to Home Screen" ("Opens like an app, from your home screen"); pressing it shows the browser's install prompt once; after install or dismissal the row disappears. No install banner is ever shown over the map. [needs: installable browser]
M9. iOS Safari → the row toggles the help text "Tap the Share button, then “Add to Home Screen”…" (`.profile-notice`). [needs: iOS]
M10. Running installed (standalone) → the row is not shown; the app opens without browser chrome; safe-area insets are respected (tab bar, bottom bar, banners clear the home indicator / notch). [needs: installed app]
M11. Long-press the installed icon → shortcuts open `/cards` and `/journal`. [needs: installed app, Android]
M12. New deploy while the page is open and UNTOUCHED → the page reloads itself once into the new version. [needs: deploy]
M13. New deploy while the page has been interacted with → a band button "An update is ready — tap to refresh" (`.update-banner`) appears; tapping reloads. It is NOT shown while `/submit` is open (typed text is never thrown away); with offline + update both showing the shell has class `has-bands-2`. [needs: deploy]
M14. First-ever install of the service worker → no reload and no update band.
M15. Caches created → `kfm-tiles-v2`, `kfm-place-data` (network-first, 3 s), `kfm-stories` (stories/notes/menu chunks), `kfm-fonts`, `kfm-auth-chunk`; the old `kfm-tiles` cache is deleted on start. Check in DevTools → Application.
M16. Fonts → text renders in the system face first and switches to Pretendard when its stylesheet arrives; a failed font load never blocks or breaks the app.

## N. Static pages, SEO, prerender (view-source / JS disabled / crawler)

N1. `/` source → title "K-Food Map · The other side of K-food", meta description, Open Graph (type, title, description, image `/og/fallback.png` 1200x630, url, site_name, locale), `twitter:card=summary_large_image`, canonical, `color-scheme: only light`, `format-detection: telephone=no`, viewport with `viewport-fit=cover`.
N2. `/` with JS off → under the loading block a nav "Browse by area" with links "Vegan food in Korea", "Halal food in Korea" and the top 8 areas of each.
N3. `/place/<id>` source (every active place) → own `<title>` "<Name> · K-Food Map", description "<claims with confidence> · <area>. <vibe>" (<= 158 chars), og:title/description/url, og:image by illustration (`/og/<name>.png`), canonical, JSON-LD `Restaurant` (name, url, address, geo; no dietary claim).
N4. `/place/<id>` with JS off → readable static body: link home, H1 name, area, claims with confidence, vibe, address, Korean address (`lang=ko`), the confidence legend, links to the area guides the place belongs to; the page scrolls.
N5. `/place/<unknown>` on the live site → served the app shell (Vercel rewrite) and the app shows the missing-place note (F13). Quarantined places have no page and are not in the sitemap.
N6. `/find/<diet>-<area>` (e.g. `/find/halal-busan`; one per diet+area with >= 3 places) with JS off → H1 "<Diet> food in <Area>", count sentence with the legend, halal caveat on halal guides, a green button "Open these on the map" (→ `/#q=<Area>&a=1&f=<Chip>`), the list of places as links to `/place/<id>` each with "area · claim (confidence)", "<Diet> food in Korea" and "Other areas" links; JSON-LD `ItemList`; own title/description/canonical.
N7. `/find/vegan` and `/find/halal` hubs with JS off → H1 "<Diet> food in Korea", total count, button "Open all of them on the map" (→ `/#f=<Chip>`), list of area guides with counts.
N8. With JS on, any `/find/...` URL → the static list is replaced by the app on the equivalent map view (K3).
N9. `/cards` with JS off → static page with both Korean statements ("If you are vegan", "If you are Muslim"); title "Korean cards to show restaurant staff — vegan and Muslim travellers · K-Food Map"; indexable.
N10. `/discover` → own title "Food journeys and stories · K-Food Map" and description; indexable. `/journal` ("Your food passport"), `/profile` ("Profile"), `/submit` ("Suggest a restaurant") → `<meta name="robots" content="noindex">`. `/privacy` → title "Privacy Policy · K-Food Map", indexable.
N11. `/sitemap.xml` → lists `/`, `/discover`, `/cards`, both hubs, every area guide and every active place page; no journal/profile/submit/privacy; no quarantined place.
N12. `/robots.txt` → `User-agent: *`, `Allow: /`, `Sitemap: https://kfoodmap.vercel.app/sitemap.xml`.
N13. `/assets/*` responses → `Cache-Control: public, max-age=31536000, immutable`.
N14. Link preview (KakaoTalk / Facebook / X debugger) for a place URL and a guide URL → shows that page's own title, description and image. [needs: external tool]

## O. Accessibility and keyboard

O1. Skip link → first Tab on the map screen reveals "Skip to the list of places" (`a.skip-link[href="#place-list"]`); activating it moves to the list; the second Tab reveals "Skip to the tabs" (`a.skip-link--tabs[href="#tabs"]`, focus on the current tab button). Neither is present when a modal/peek place is open, when a place is docked at 768–1199 px, or on other tabs.
O2. One `<h1>` per screen ("K-Food Map", visually hidden on the app); panels use `h2`, sections `h3`.
O3. Visible focus → every interactive control shows a focus ring with keyboard focus (`:focus-visible`): chips, cards, hearts, claim buttons, map buttons, tab bar, sheet handle, rows, links, selects, dialog buttons.
O4. Keyboard-only path: search → chips → list cards (open, story, save, directions) → tab bar works without touching the map; map markers are skipped.
O5. Modal sheets (phone place page, cards, submit, privacy, language sheet, About, confirm, large Korean text) → focus moves in on open, the content behind is `inert` (Tab and screen-reader swipe cannot reach it), Escape closes the top-most layer only, focus returns to the opener on close. The staff cards opened from a place's "Ask in Korean" link return focus to that link. The Suggest / Report form returns focus to its opener too (the Profile row, the empty-search link, the place's own report link). After the welcome screen focus is on the page's `<h1>`.
O6. Confirm dialog (`.confirm[role=alertdialog][aria-modal]`, message `#confirm-message`) → opens with focus on "Cancel"; Escape, a tap on the overlay, or browser Back = Cancel; the confirm button carries the action name ("Remove", "Sign out", "Delete my saved places"); focus returns to the asking control.
O7. Live regions → result count (`aria-live=polite`), toasts (`role=status`, held while focused/hovered), locate status, Open-now/Open-at notes, shared-list note, offline band, detail loading line, language loading (`role=status`), language failure and submit failure (`role=alert`).
O8. Toggle buttons expose state → chips, hearts, Save / Been here, card tabs, text-size buttons, prologue buttons (`aria-pressed`); claim "Why?", notes toggle, journey stops, Open at… (`aria-expanded`); tab bar (`aria-current=page`).
O9. Notes fold [phone] → the notes above the cards are clamped (2 lines; 1 line on a short phone, only the first note shown — the halal certificate note always keeps 2 lines, in body colour) and open on tapping a note or the toggle button (`.place-list__notes-toggle`, aria-label "Show or hide the notes", `aria-expanded`); with the Halal chip turned on and viewport height > 700 px they start open. [desktop] notes are shown in full, no toggle.
O10. Non-drag alternatives → sheet handle button for the sheet heights; +/− buttons for pinch zoom; "Show the full page" button for the peek pull; X buttons for pull-to-close.
O11. Reduced motion (`prefers-reduced-motion: reduce`) → no sheet slide transition, no map fly animation, chips scroll into view instantly.
O12. Screen reader names → pins/clusters have `title`/`alt`; journey stop numbers are read as "Stop 1: Name"; card buttons are described by area, status and claims (`aria-describedby`); icon-only buttons all have aria-labels; decorative seals/icons are `aria-hidden`. Every icon (`Icons.jsx`, the tab bar, the sidebar toggle) is `aria-hidden`.
O13. Touch targets → interactive controls are at least ~44 px (32 px for map dots/clusters) at 360x640; nothing interactive sits under the tab bar or the bottom bar.
O14. 320 px wide and 640x360 landscape → no horizontal page scroll; all primary actions reachable.
O15. Zoom / text scaling → browser zoom 200 % and Text size "Larger" keep content readable and scrollable (no clipped dialogs).
O16. Forced dark mode → the page stays light (`color-scheme: only light`): pins and brand colours are not inverted.

## P. Error and empty states

P1. Search with no match, no chips (e.g. "zzzz") → empty block (`.place-list__empty`): pin icon, "No places match", criteria line "“zzzz”", "Clear search and filters" button, "Not on the map? Suggest it" button, hint "Try a different name or area." (The hint line is hidden on a short phone — up to 767 px wide and 720 px tall.)
P2. "Not on the map? Suggest it" → opens `/submit` with the typed text prefilled as the restaurant name; closing returns to the map with the search intact.
P3. Search + chips with no match → criteria line "Halal + “xyz”" (Open at shown as "Open Tue 7:00 PM"), "Clear the search, keep the filters" (keeps chips), "“xyz” finds N without the filters." when the text alone finds something, "Clear search and filters", hint "Try removing a filter or searching a different name or area."; plus the nearest block when available (D27). (The hint line is hidden on a short phone — up to 767 px wide and 720 px tall.)
P4. "Clear search and filters" → everything cleared (also a shared list: URL becomes `/`); focus goes to the search box on mouse/keyboard devices, to the list on touch devices (no keyboard pops up).
P5. Ingredient/allergen search with nothing found ("peanut", "gluten", "allergy", "알레르기", "五辛", "ナッツ") → hint "The map does not check ingredients or allergens place by place…" with a link "Korean cards to show staff" → `/cards`. "ドーナッツ"/"ココナッツ" do not trigger it. The same hint stands above the results when such a search does find places ("gluten free" 37, "dairy free" 14: found by a word in a place's notes, not checked dish by dish); also for "celiac", "lactose", "nuts", "egg free". And for a search that asks by leaving something out ("no fish sauce", "not spicy", "sugar free", "alcohol"): the words are found one by one in the notes, so the list can hold a place whose note says the opposite. Not for "no pork" / "pork-free" (a level the records carry).
P6. Chips only with no match (e.g. Fully vegan + Halal + Fermented) → "No places match", criteria "A + B + C", "Clear search and filters", hint about removing a filter. (The hint line is hidden on a short phone — up to 767 px wide and 720 px tall.)
P7. Missing place (F13) → note in the list; it does not block using the map.
P8. Map crash → in place of the map: "The map could not be drawn. The list below still works." with a "Try the map again" button (`.map-error`); list, search, places, Journal keep working. (Hard to trigger; verify by code or by forcing a Leaflet error.)
P9. App crash → full-screen "Something went wrong on this screen." (`main.app-error [role=alert]`) with a focused "Reload" button and a "K-Food Map" link to `/`.
P10. Place details fail to load → F39. Language fails to load → I6. Sign-in / sync failures → I20, I25. Submit failure → Q-submit items (Q15). Locate failures → B38–B40. Startup failure → A3.
P11. Empty Journal → H2. Saved filter with nothing saved → E20. Open now at a time when nothing is open in the searched area → empty state with the criteria line and, with a search, the nearest open places.
P12. Storage unavailable (blocked cookies / private mode) → app opens; saves, language and text size work for the visit; no white screen.
P13. Old browsers (iOS 15, Chrome 100) → app renders (polyfills for `Object.hasOwn` / `.at`; CSS built for those targets). [needs: old device/emulator]
P14. Printed, or saved as PDF from the browser's print (check with print emulation: `print: true` in a `shot.mjs` step) → what is being read comes out as a plain page of its full length: an open place (no map, no bottom bar, no copy / map buttons), the staff cards, or else the list, Discover or the Journal. Nothing is cut off at the height of the screen. The week's hours print unfolded; the card chooser, "Show these stops on the map", "Read story", Profile's settings and sign-in are left out.
P15. Windows high-contrast themes (`media: {"forced-colors": "active"}` in a step) → text and outlines stay readable; the map buttons of a place have an outline; pins keep their colours.
P16. An address that is nothing here (`/nope`, `/find/nope`, `/journal/x`), opened with no service worker (a first visit) → status 404 and the site's own page (`public/404.html`): logo, "This page is not on K-Food Map.", "Open the map" (to `/`) and the two guide links, in the reader's language (stored choice, else the browser's). With the service worker (any later visit) the app answers, shows the map and the address becomes `/` (the view in the fragment is kept). `/place/<unknown id>` is not this page: the app opens with the "no longer on the map" note (F-section).

P17. A browser that refuses storage (Safari with all cookies blocked; regress step `storage-blocked`) → no crash anywhere; the welcome screen shows on every load and the language follows the browser; a save works for the visit and its toast says so ("Saved for now. This browser is not storing it, so it will be gone when you close the page.") instead of promising it opens offline.

P18. A quick double tap (two presses at one spot within half a second; regress step `double-tap`) → the second press counts only on the same control (zoom, a chip on and off, "Next stop"). On a card it does not reach the place that opens (no accidental "Call", Save or unfolded hours); on the list's handle it does not open a card; a confirm dialog is not confirmed by the tap that raised it. Keyboard presses are never dropped.

P19. Very narrow screens (240–319 px: a folding phone's cover screen, a page zoomed to 150%) → no sideways scroll on any screen; the place's two map buttons keep their words inside (on two lines). At any width a clock time ("11:00 AM", "오전 10:30"), a walk ("7 min walk"), a distance ("300 m") and "Line 2" do not split across lines; a phone number stays whole; a place's Website and Instagram links each keep to one line.

P20. The large Korean card ("Show large", a question tapped in `/cards`) → the text is as big as fits with every word whole (no "들어가나" / "요?"), at 320×568, sideways and at the largest text size.

P21. Coming back to where one was (regress step `list-returns`) → the list keeps its opened count and scroll through a place opened and closed (X or Back) and through a look at another tab; Discover and the Journal keep their scroll and open journey; a place keeps its scroll after a nearby place and Back. A new filter or search starts the list at the top. A reload keeps the address's view (filters, search, the open place and its journey).

P22. A device in another time zone (`tz: America/Los_Angeles`, `Pacific/Auckland`) → a record's "last checked" date is the day in the record (17 July 2026 for `kampungku`'s claim), not the day before or after. `[needs: clock]`

P23. Old iPhones (iOS 15.0–16.3) → no shipped file contains a look-behind regex (`(?<=`, `(?<!`): `bash scripts/gates.sh` fails if one does.

## Q. Other: Privacy sheet, Suggest / Report form, misc

### Privacy (`/privacy`)
Q1. Open from Profile → sheet (`.detail-sheet[aria-label="Privacy Policy"]`, content `.privacy-content`); title "Privacy Policy · K-Food Map"; close by X, backdrop or Escape → back to Profile with focus on the Privacy row; direct URL → Close goes to the map.
Q2. English UI → English policy open (title, effective date, sections, contact e-mail as `mailto:` link or a "pending" line); Korean folded under `<details>` "한국어 전문". Korean UI → Korean open, "English (full text)" folded.
Q3. ja / zh-Hans / zh-Hant / id UI → the translated policy is shown first (with its translation note); BOTH English and Korean are folded under their names. If the translation cannot be loaded → the note "This policy is written in English and Korean." and the English text open.
Q4. Inline code marks in the policy (the one storage key the policy names, `kfm-auth-code-verifier`) are rendered as `<code>`.
Q5. The submit form's "How we handle what you send" link opens `/privacy` in a NEW tab (typed text in the form is not lost).
Q6. Policy content matches behaviour: location never stored or sent; search/filter kept in the URL fragment only; saved places local unless signed in. (Content check against Q/B/I items.)

### Suggest a restaurant / Report incorrect info (`/submit`, `/submit?place=<id>`)
Q7. New suggestion (Profile row, or empty search) → sheet titled "Suggest a restaurant" with intro, fields: Restaurant name (`#submit-name`), Where is it? (optional) (`#submit-location_hint`), What does it offer? (`#submit-topic`: Vegan / Halal / Something else), What do you know about it? (`#submit-message`), Link (optional) (`#submit-source_url`), Email (optional) (`#submit-contact_email`), privacy link, Send. Document title "Suggest a restaurant · K-Food Map".
Q8. Name autocomplete → after >= 2 characters and a 300 ms pause, up to 5 Kakao suggestions (`ul#submit-name-list[role=listbox]`, each name + address · category) from `GET /api/place-search?q=`; ArrowDown/ArrowUp move the highlight (`aria-activedescendant`), Enter picks it, mouse/touch picks, Escape closes ONLY the list (a second Escape closes the sheet), blur closes it, refocus reopens it. Any API failure simply shows no suggestions. [needs: network; server key configured]
Q9. Pick a suggestion → name filled, the location field filled with its address if empty, and a line "Address from Kakao Map: <address>. We check it ourselves before anything appears on the map." with a "Clear" button (clears the pick; suggestions resume). Editing the name also drops the pick.
Q10. Enter in a single-line field moves to the next field instead of submitting (name → location → topic; link → e-mail); IME-confirm Enter is ignored.
Q11. Correction (`/submit?place=<id>` from a place) → title "Report incorrect info", intro "Something wrong about <name>? Tell us what you saw."; NO name/location fields; topic list has all six (Vegan, Halal, Opening hours, Closed or moved, Address or location, Something else); label "What did you see?"; from the hours link the topic is preset to "Opening hours".
Q12. `/submit?place=<unknown or quarantined id>` → falls back to the new-suggestion form.
Q13. Validation on Send → missing name / message: "Required"; no topic: "Choose a topic"; bad link: "Use a link starting with http:// or https://" (a bare host like `instagram.com/x` is accepted and gets `https://`); bad e-mail: "Enter a valid email address"; too long: "Too long — N characters at most" (name 120, location 200, message 2000, link 500, e-mail 200). Focus and scroll go to the FIRST invalid field; fields get `aria-invalid` and their error via `aria-describedby`; an error disappears as soon as that field is edited.
Q14. Valid Send → button reads "Sending…" and is disabled; on success the form is replaced by "Thanks — we check every submission against sources before anything appears on the map." (focused, `role=status`) and a "Close" button. Nothing appears on the map as a result. [needs: network; creates a real lead row — use clearly marked test text]
Q15. Send fails (server error or 15 s stall) → alert "Couldn't send. Your text stays here while this page is open — please try again."; the text is kept; Send works again. [needs: network control]
Q16. Draft kept for the visit → type a message, close the sheet (or switch tab), reopen the same form → the text is still there (per place for corrections); after a successful send the draft is gone; a full reload clears it.
Q17. Honeypot → the hidden "Leave this empty" field is not reachable by Tab or screen reader; if filled (by script) the form shows the success screen and sends nothing.
Q18. Build without Supabase config → the sheet shows only "Submissions aren't enabled in this build." (not the case on the live site unless misconfigured).
Q19. Close → from inside the app: back to where it was opened (place, Profile, map with search intact); by direct URL: a correction closes to its place page, a new suggestion to the map. Escape and backdrop close too.
Q20. `/api/place-search` contract → non-GET 405; `q` shorter than 2 → 400 `tooShort`; longer than 50 → 400 `tooLong`; > 30 requests/min from one IP → 429; upstream failure → 502; success → `{results:[{id,name,address,lat,lng,category}]}` (max 5) with `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`; the Kakao key never reaches the browser. The browser receives `public, max-age=0, must-revalidate`; `s-maxage` is consumed by the CDN (`X-Vercel-Cache: HIT` on a repeat).

### Misc
Q21. Distance formatting → under ~1 km in metres rounded to 50 m (minimum "50 m"), 1–10 km with one decimal ("2.4 km"), above that whole km ("12 km").
Q22. Overnight hours → a place open "6:00 PM – 2:00 AM" is "Open" at 1 AM KST (yesterday's slot) and its detail does not say it closed at midnight; a 24-hour place reads "Open · 24 hours" and its week list "24 hours". [needs: clock or a known record]
Q23. Break time → between lunch and dinner slots (gap <= 5 h) the status is "On a break · opens <time>", not "Closed". "Closes soon"/"Last order soon" before a break add "· reopens <time>". [needs: clock]
Q24. Past last order but before closing → status "Last order passed · closes <time>" (amber) and the place is EXCLUDED by "Open now". [needs: clock]
Q25. A weekday missing from a record → no status that day ("Hours not recorded" on cards; "Not recorded" in the week list); the app never guesses "Closed".
Q26. Tab/visibility → returning to the tab after a long pause updates statuses and re-evaluates wide/phone layout (a docked place does not stay 180 px wide on a phone-sized window).
Q27. Rapid interactions → tapping two tabs quickly, or two chips quickly, ends in the state of the last tap (no chip silently undone, no stuck history entries).
Q28. Typing in the search does not lag the map → letters appear immediately; markers/list follow ~120 ms after the last keystroke.
Q29. Privacy of state → search text and chips live only in the URL fragment (never sent to the server); "Saved" is never in a shareable URL; the place share link carries no fragment.
