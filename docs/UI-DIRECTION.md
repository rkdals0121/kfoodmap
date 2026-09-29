# UI direction (2026-09-29)

Research: `.superpowers/ui-direction/REFERENCES.md` (28 ideas, sources) and
`AUDIT.md`. This page is the decision; it governs UI work until changed.

## Concept

A **field reference, not a food magazine.** A visitor on a Korean street,
tired, one thumb, patchy data, needs three answers at a glance: *can I eat
here, how sure are you, how do I get there.* The app should feel like a calm
civic instrument (a good transit or government service), and its public-
diplomacy job is to be the most honest source a visitor meets in Korea.

## Principles

1. **Every dietary statement is a claim with a strength.** One vocabulary,
   everywhere: *Confirmed · Reported · Our reading · Not known*. Enum names
   (supported, inferred) stay in code.
2. **A missing label never reads as yes.** Unknown is shown, in words.
3. **Provenance sits next to the claim**, one tap away — never only in a
   hover tooltip or a footer.
4. **Checked is a date, not a seal.** "Last checked 17 July 2026", never
   "verified" unless it was confirmed.
5. **Colour never carries meaning alone.** Status and confidence always have
   words; confidence uses fill style (solid / outline / dashed), never a
   traffic light.
6. **Decision data first, story second.** Name → open status → dietary facts →
   hours / transit → hand-off to Naver / Kakao (the maps visitors are told to
   use in Korea) → menu → story.
7. **Reachable and focusable.** 44px targets on primary actions, visible
   focus, reduced motion respected, nothing sticky hiding focus.
8. **Plain words.** No marketing voice in trust copy.

## Signature

The **claim mark**: the dietary chip rendered by confidence — solid for
Confirmed, outline for Reported, dashed outline for Our reading — with the
word beside it. The same mark on list cards, detail, and anywhere a dietary
claim appears. It is the one visual element the app is remembered by, and it
*is* the product's promise. Everything around it stays quiet.

## Avoid

Checkmarks or shields on unconfirmed claims; traffic-light confidence; star
ratings or popularity cues; tooltip-only explanations; Korean motifs as
wallpaper (at most one restrained motif, in the Passport); frosted glass over
the map; new features in the name of design (roadmap is frozen).
