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
