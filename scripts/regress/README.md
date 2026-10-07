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
| `docked-place-list-order` | 1280 px: the list while a place is docked stays in the same neighbourhood (`duringHas` true) and does not reshuffle on close |
| `map-file-blocked` | no crash screen; the slow-connection text with "Try again"; after it the address carries `#f=Halal` |
| `icons-and-lang` | `<html lang>` is the language; `notHidden` 0 |

A check that reads focus needs a page that believes it has focus:
`shot.mjs` emulates that. A step whose script leaves the app (a
`history.back()` past its first entry) loses its result.
