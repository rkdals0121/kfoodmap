# Reading the translations against the English

The tools of the 2026-10-07 review (HANDOFF §7 #76), kept as they were
used. They are not part of the build or the tests.

- `rv_build.mjs`, `rvn_build.mjs` — write review files (English beside its
  translation) for stories and for research notes, per language, in
  batches. Run from the repo root with an output folder.
- `BRIEF-*.md` — what a reviewer is asked to do, per kind of text. Each
  reviewer reads every entry of a batch and returns a list of
  find/replace corrections (menu and interface: whole replacement values).
- `rv_apply.py`, `rvn_apply.py`, `rvm_apply.py`, `rvl_apply.mjs` — apply
  those lists to `src/data/story-*.js`, `src/data/notes/`,
  `src/data/menu-*.js` and `src/i18n/locales/`. They refuse a `find` that
  does not occur exactly once, a change to a link or a Hangul quotation,
  a diet word the menu name lacks, or changed `{{…}}` markup. Move applied
  lists away before running again: a correction whose replacement
  contains its own `find` would be applied twice.
- `shot.mjs` — screenshots with headless Chrome over the DevTools
  protocol (sizes, language and a script per step), for looking at
  screens when no browser window is to hand.

`WORK/` in the scripts stands for the folder the review files were in;
set it before use.

Never apply a correction that needs a fact the record does not hold or a
Korean spelling that has to be guessed.
