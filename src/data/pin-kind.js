import { isKnown, VEGAN, HALAL } from './verification.js';

// What a map pin says about a place, by shape rather than colour: 'vegan'
// (fully vegan or vegan options), 'halal' (certified or friendly), 'both',
// or 'other'. Pork-free is not halal, so it never counts as halal here.
export function pinKind(r) {
  const v = r.dietary?.vegan;
  const h = r.dietary?.halal;
  const vegan = isKnown(v) && (v.value === VEGAN.FULL || v.value === VEGAN.OPTIONS);
  const halal = isKnown(h) && (h.value === HALAL.CERTIFIED || h.value === HALAL.FRIENDLY);
  return vegan && halal ? 'both' : vegan ? 'vegan' : halal ? 'halal' : 'other';
}
