// Korean food culture content, shared by category (restaurant.category).
// Written for curious first-time visitors: one hook that sparks curiosity,
// then short practical dining tips. Individual restaurants can override by
// adding `didYouKnow` / `diningTips` fields to their own data entry.
//
// The text lives in the locale files (cultureText.<category>), so it
// follows the chosen language; this file keeps the categories and the
// fallback. A place's own override is written in English and shown as is.
import i18next from 'i18next';
import '../i18n/index.js';

export const CULTURE_CATEGORIES = [
  'temple',
  'korean-chinese',
  'vegan-dining',
  'halal-korean',
  'world-halal',
  'zero-waste',
  'brunch-bakery',
  'local-seasonal',
];

const FALLBACK = 'local-seasonal';

export function getCulture(place) {
  const category = CULTURE_CATEGORIES.includes(place.category) ? place.category : FALLBACK;
  const tips = i18next.t(`cultureText.${category}.tips`, { returnObjects: true });
  return {
    didYouKnow: place.didYouKnow ?? i18next.t(`cultureText.${category}.didYouKnow`),
    diningTips: place.diningTips ?? (Array.isArray(tips) ? tips : []),
  };
}
