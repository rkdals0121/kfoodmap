// Filter-chip vocabulary shared by App.jsx (which applies it against
// restaurants.js) and the test suite (which checks it against
// src/i18n/labels.js). A single source of truth so a chip id added or
// renamed on one side is caught rather than silently matching nothing.
//
// Not restaurant data, and not part of the trust model in src/data/ (see
// verification.js's header) — just the chip vocabulary shared by the app
// and its test. Lives outside src/data/ on purpose.
//
// Dietary chips are answered by the structured dietary record (never a tag
// string); the rest are descriptive traits.
import { matchesDietary } from './data/verification.js';

export const DIETARY_CHIPS = ['Vegan', 'Halal'];

// A group chip matches *any* trait in its set, which is the one place chips
// are not AND-ed. Sustainability exists because its two members are narrow
// enough that selecting both returns nothing — the group is the way to browse
// the axis, the members are still there to narrow within it.
export const TRAIT_GROUPS = {
  Sustainability: ['Zero-waste', 'Local Sourcing'],
};

// Free-text search over what a traveller would type: the place's name
// (English and the Korean in brackets), its vibe line, its neighbourhood,
// and its street address — so "Gangnam", "Mapo-gu" or "Busan" find the
// places there even when the neighbourhood label names a smaller area.
// Hyphens and spaces are ignored on both sides, so "mapo gu", "mapogu" and
// "Mapo-gu" all match.
const squash = (s) => s.toLowerCase().replace(/[\s-]+/g, '');

// Typing a diet word finds what its chip finds. Most visitors type "halal"
// rather than tap the chip, and the word alone matched only places with it
// in their name: 41 against the chip's 152 (critique 3, 2026-10-01).
const DIET_WORDS = { halal: 'Halal', vegan: 'Vegan' };
const dietWordMatch = (r, w) => DIET_WORDS[w] !== undefined && matchesDietary(r, DIET_WORDS[w]);

export function matchesSearch(r, query) {
  const q = squash(query ?? '');
  if (q === '') return true;
  if (dietWordMatch(r, q)) return true;
  // The halal level is searchable too, so "pork-free" finds every pork-free
  // place (the Halal filter leaves them out: pork-free is not halal).
  const halal = r.dietary?.halal;
  const fields = [r.name, r.vibe, r.zone, r.address?.value,
    halal && halal.confidence !== 'unknown' ? halal.value : null];
  if (fields.some(f => typeof f === 'string' && squash(f).includes(q))) return true;
  // Several words ("Busan korean", "itaewon vegan bakery"): every word must
  // appear somewhere in the place's name, area, address or story.
  const words = String(query).trim().split(/\s+/).map(squash).filter(w => w.length >= 2);
  if (words.length < 2) return false;
  const haystack = squash([...fields, r.story].filter(f => typeof f === 'string').join(' '));
  return words.every(w => haystack.includes(w) || dietWordMatch(r, w));
}

// Does a search word name this place's area (neighbourhood or address)?
// While searching, these places come first in the list and are where the
// map goes, so "Busan" shows Busan rather than Seoul's "Busan Jib".
export function matchesArea(r, query) {
  const words = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  return words.length > 0
    && words.some(w => `${r.zone} ${r.address?.value ?? ''}`.toLowerCase().includes(w));
}
