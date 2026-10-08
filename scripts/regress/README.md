# Flows that broke before, checked by script

`node scripts/regress/run.mjs <base url> [name ...]` runs each file in
`steps/` in headless Chrome (`scripts/translation-review/shot.mjs`) and
prints what the page reported. Counts follow the data; the shape is what
to read. Nothing here sends a form or signs in. Run it against a preview
of `dist` before a deploy that touches start-up, history, focus or the
map, and against the live site after.

| steps | what should come back |
|---|---|
| `first-visit` | the welcome screen's count, then the map with every place and no chip on; `between` false (the map had arrived) |
| `first-visit-slow` | slow line: `prologueAt` well before `mapAt`; `between` is the "Loading the map…" screen; the diet chosen is on when the map opens; `seen` "true" |
| `first-visit-place`, `-guide`, `-shared-list` | no welcome screen (`prologue` false, `welcome` false); the place, the guide's list, the shared list |
| `first-visit-link-with-diet` | a link that names a diet (`#q=Itaewon&f=Halal`) with Vegan picked on the welcome screen: Halal alone is on, the list is not empty |
| `first-visit-link-search-only` | a link with a search and no diet: the diet picked is added |
| `first-visit-bad-list` | `?list=` with no valid id: the welcome screen once, then the map |
| `first-visit-cards` | welcome screen first, then `/cards` |
| `returning` | no welcome screen; hints for the language, App, places, maplib |
| `about-dialog` | Profile → About shows the count |
| `welcome-language` | choosing 한국어 on the welcome screen carries into the map and is stored |
| `back-forward-views` | Back shows the view of the entry gone back to, Forward the next one — four different lines, not the same view four times |
| `own-back-keeps-view` | chips cleared beside a docked place stay cleared when the place is closed with X |
| `open-place-pin` | `/place/x#q=…` that the search leaves out: one active pin, at both sizes |
| `place-link-with-search` | closing the place frames the search (pins in view, the count of the search); a plain place link is unchanged |
| `focus-discover-stop`, `focus-profile-suggest` | `same` true: focus is back on the control pressed |
| `focus-list-journal-links` | `cardBack` true, `rowBack` "saved-row", the suggest link, `back` "detail-report" (the general link, not the hours one); desktop: `cardBack` true and 40 → 80 cards 350 px before the end |
| `docked-place-list-order` | 1280 px: the list while a place is docked is led by the open place (`during` starts with it) and does not reshuffle on close |
| `map-file-blocked` | no crash screen; the slow-connection text with "Try again"; after it the address carries `#f=Halal` |
| `toast-on-top` | saving shows the toast and `onTop` is the toast's own text ("SPAN"), at both sizes — not the map or the place under it: for some days the toasts were drawn beneath everything |
| `sideways-phone-and-rail` | 844×390: the list is some 190 px tall (not a 33 px strip) under one row of chips, and an open place fills the height (`[0,390]`); 1440 px in Japanese: the toast's centre is over the map (about 930) and the last tab ends inside the 420 px column; 1280 px: a tab pressed in the folded rail unfolds it and its panel is there |
| `icons-and-lang` | `<html lang>` is the language; `notHidden` 0 |

A check that reads focus needs a page that believes it has focus:
`shot.mjs` emulates that. A step whose script leaves the app (a
`history.back()` past its first entry) loses its result.
| `touch-sheet` | real finger drags (phone): the list's sheet goes 2, 1, then the chips scroll sideways (`chips` > 0, sheet still 1), 0, and a short quick flick up brings 1; a pin opens the place half way (`peek` true), a pull up makes it full (and scrolls its text: `scrolledBy`), a short pull down leaves it, a long one closes it (`place` "/") |
| `locate` | "My location" answered by the browser itself: inside Korea a dot and "Nearest to you"; a coarse fix the hollow dot and its message; Tokyo "outside Korea", no dot; refused "Location is blocked…" |
| `clock-status` | a fixed clock (Korean time): the kinds of status on the cards at 12:30, 15:30 (breaks), 21:40 (closing soon, in Korean), 00:30 (not yet open, in Japanese); "Open now" re-filters when the clock moves on and the page is shown again; a device in New York gets the "Korean time — it is … there now" line |
| `place-meta-line` | the parts of the line under a place's name and of its traits: `overlap` 0 at three sizes and languages (each part once drew over the end of the one before) |
| `focus-next-stop-and-cards` | after "Next stop" and close, focus is on the stop shown (Stop 3), on a phone and at 1280 px; after the staff cards opened from a place, on the "Ask in Korean" link |
| `keyboard-place` | real key presses (phone): Enter on a card opens the place with focus inside it; forty Tabs later focus is still inside (`inSheet` true); Escape closes it and focus is the card's button again. Desktop: the first eight Tab stops are the two skip links, the map's three buttons, the map, the OpenStreetMap link, the search box |
| `translations-wait` | a Japanese reader's story: "-" (no page yet), "…", then the Japanese — never the English in between; with the story file blocked, the English ("Balwoo Gongyang cooks…") |
| `page-translated` | the page as a browser's "Translate this page" leaves it (each text node swapped for `<font><font>…</font></font>`, new text likewise): a place opened and a place near it pressed — `crash` false, the other place's address; saved, unsaved, closed; two chips — `8 places \| Clear (2)` (it stayed `Clear (1)`); on `/cards` `koreanTranslated` 0 (the Korean to show staff is left as Korean). Before `src/pageTranslator.js` the second press was the error screen |
| `storage-blocked` | a browser that refuses storage (every use of `localStorage` throws: Safari with all cookies blocked, some in-app browsers): the welcome screen, no crash; the map opens, a place is saved and the toast says it is kept for now only (not "It opens offline too"); the Journal shows it for this visit (`journalRows` 1) |
