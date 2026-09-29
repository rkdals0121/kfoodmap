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

export function matchesSearch(r, query) {
  const q = squash(query ?? '');
  if (q === '') return true;
  const fields = [r.name, r.vibe, r.zone, r.address?.value];
  if (fields.some(f => typeof f === 'string' && squash(f).includes(q))) return true;
  // Several words ("Busan korean", "itaewon vegan bakery"): every word must
  // appear somewhere in the place's name, area, address or story.
  const words = String(query).trim().split(/\s+/).map(squash).filter(w => w.length >= 2);
  if (words.length < 2) return false;
  const haystack = squash([...fields, r.story].filter(f => typeof f === 'string').join(' '));
  return words.every(w => haystack.includes(w));
}
