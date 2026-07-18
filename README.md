# K-Food Map

A map-first web app that helps international visitors find Korean restaurants
matching their dietary needs — vegan, halal, mild, fermented, zero-waste,
local sourcing — and understand the food culture behind each place, built so
that every claim it makes is either checked or honestly marked unknown.

## Overview

K-Food Map is part of a **digital public diplomacy** initiative, and that
single fact drives most of the project's design decisions. A restaurant
finder that gets a detail wrong is annoying. A state-adjacent cultural
project that tells a Muslim traveller a restaurant is halal when nobody
checked, or presents a contested commercial claim as national heritage, is a
different category of failure. Restaurant discovery is the entry point;
cultural storytelling — and being trustworthy about it — is the product.

The primary audience is first-time international visitors to Seoul and
Incheon with a dietary constraint and no Korean.

## Features

- **Map** — Leaflet-based discovery view, search, and list
- **Filter** — dietary chips (vegan, halal, mild, fermented, zero-waste, local sourcing)
- **Detail** — practical info, menu, food story, sustainability, dining tips
- **Story** — the cultural narrative behind each restaurant
- **Journal / Passport** — bookmarked places as dated stamps, with a "next stop" suggestion
- **Bookmark** — persisted locally, no account required
- **Responsive** — mobile / tablet / desktop, AA contrast
- **Evidence Layer** — sourced, versioned, tamper-evident provenance for facts
- **Confidence Model** — every field is graded, not just stated
- **Lifecycle** — restaurants that can't be confirmed to exist or to still be open are quarantined out of every discovery surface, not deleted

## Trust Model

This is the part of the project that matters most. Three primitives work
together so that nothing in the UI can claim more certainty than its sourcing
supports:

- **`fact()` / `unknownFact()`** — every field a user might act on is wrapped
  in a fact carrying its own confidence, source, and evidence. The wrapper
  enforces one invariant: a fact with no value is always `unknown`, and an
  `unknown` fact can never carry a value. There is no code path where the UI
  has to guess whether a field is trustworthy.
- **Confidence Model** — `CONFIRMED / SUPPORTED / INFERRED / UNKNOWN`, kept
  orthogonal to *where* a fact came from (`SOURCE`) and *how* it was checked
  (`METHOD`). A fact can be "community-reported and independently confirmed"
  or "official but stale" — collapsing those into one flattened label would
  lose exactly the distinction a traveller needs.
- **Evidence Layer** — sourced facts pin to versioned, SHA-256-sealed
  evidence records (`Restaurant → Fact → EvidenceRef → EvidenceRecord →
  EvidenceVersion → Source`). A version's confidence is a **ceiling**, not an
  opinion — a fact can never claim more certainty than its strongest evidence
  supports, and that ceiling is enforced mechanically, not by habit.
- **Lifecycle** — separate from field-level confidence: a restaurant can have
  well-sourced facts and still need excluding from the live app, because its
  existence itself is unconfirmed or it has since closed. `ACTIVE` /
  `QUARANTINE` are enforced end-to-end, from data through every discovery
  surface to bookmark navigation.

`unknown` always beats a plausible guess. Nothing is invented to fill a gap —
not a certification, not a price, not a menu item.

## Project Status

| Phase | State |
|---|---|
| 1 — Foundation | ✅ Done |
| 2 — Production Infrastructure | ✅ Done |
| 3 — Production Data | ✅ Done |
| 4 — Final QA | ✅ Done |
| 5 — Version 1.0 | ⏭ Next: Release Candidate |

## Development Roadmap

The repository's `HANDOFF.md` (§10) is the authoritative roadmap; this is a
summary. Six phases, each gating the next:

1. **Foundation** — core UI/UX, discovery, detail, story, journal
2. **Production Infrastructure** — Confidence Model, Evidence Layer, Lifecycle, validation
3. **Production Data** — every active restaurant brought to production quality
4. **Final QA** — one full sweep of every gate before release
5. **Version 1.0** — every visible claim is verified or honestly unknown
6. **Feature Phase 2** — multilingual support, nearby route, passport expansion, and more

**Feature Phase 2 begins only after v1.0 ships.** No new feature work happens
before then.

## Technology

- [Vite](https://vite.dev/) — build tooling and dev server
- [React](https://react.dev/) 19 — UI, `useState` only, no state library
- JavaScript — no TypeScript
- [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/) — the map
- [oxlint](https://oxc.rs/) — linting
- Node.js — authoring-time verification and validation scripts

No backend, no router, no build-time framework beyond Vite. Data is authored
and validated in Node, then ships as static data.

## Development

```bash
npm install
npm run dev
npm run build
```

## Repository Rules

The full rules live in `HANDOFF.md` (§11); in short:

- **Repository First** — the repository is the only authoritative project
  state. A decision that isn't written here isn't real project state.
- **One Production Unit per Commit** — one restaurant, one change, one
  commit. No batching.
- **Evidence before claim** — no fact ships without a source and a method to
  re-check it.
- **No fabricated data** — unknown beats a fabricated certainty, always. A
  disagreement between sources stays unknown; it is never averaged or
  guessed.
- **Architecture Freeze** — the Confidence Model, Evidence Layer, and
  Lifecycle are frozen. New work extends these primitives; it does not
  redesign them.

See `HANDOFF.md` for the full engineering handoff — architecture, data
model, technical debt, known risks, and the next recommended task.
