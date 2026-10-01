// Korean food culture content, shared by category (restaurant.category).
// Written for curious first-time visitors: one hook that sparks curiosity,
// then short practical dining tips. Individual restaurants can override by
// adding `didYouKnow` / `diningTips` fields to their own data entry.

export const cultureByCategory = {
  temple: {
    didYouKnow:
      "Korean temple cuisine bans garlic, onions, chives, leeks and green onions — the 'five pungent vegetables' — because monks believe they stir up strong emotions. Every deep flavor you taste here comes from fermentation and slow patience instead.",
    diningTips: [
      'Eat like a monk: finishing everything in your bowl is the point — the practice called 발우공양 (balwoo gongyang) leaves not a single grain of rice behind.',
      'Taste the small dishes one by one. Each banchan is seasoned to be eaten with rice, not on its own.',
      'Meals here are quiet and unhurried — locals treat them as meditation, not just lunch.',
    ],
  },
  'korean-chinese': {
    didYouKnow:
      "Jajangmyeon was born in Incheon's Chinatown around 1905, invented by Chinese dockworkers far from home. Today Koreans eat millions of bowls a day — and it is still the traditional 'moving day' meal, delivered to your new apartment floor.",
    diningTips: [
      'Mix the black bean sauce into the noodles thoroughly before your first bite — and eat fast, before the noodles swell.',
      'The yellow pickled radish (danmuji) on the side is there to cut the richness. Alternate bites.',
      "Slurping is perfectly polite here — it cools the noodles and signals you're enjoying them.",
    ],
  },
  'vegan-dining': {
    didYouKnow:
      "Korea's plant-based scene is powered by a very old idea: 나물 (namul), the art of seasoning wild greens. Long before 'vegan' was a word, a proper Korean table was already built around dozens of vegetable dishes.",
    diningTips: [
      "Say it when you order: '저는 비건이에요' (jeoneun bigeon-ieyo — \"I'm vegan\") is the simplest way to flag it.",
      'In Korean cooking the usual hidden animal ingredients are fish sauce (액젓), anchovy stock (멸치 육수) and egg in batters — worth asking about wherever a place offers vegan options rather than an all-vegan menu.',
    ],
  },
  'halal-korean': {
    didYouKnow:
      "Seoul's halal Korean food scene grew up on Usadan-ro, the sloped street beside the Seoul Central Mosque — a neighborhood that has welcomed Muslim traders and travelers since the 1970s. Outside it, halal Korean food is still rare, which is why this map also marks Korean places that are pork-free.",
    diningTips: [
      'Read the label: "pork-free" means no pork on the menu, not halal-slaughtered meat or a halal kitchen.',
      'Bulgogi and samgyetang are the gentlest introductions to Korean flavors — deeply savory, no spice shock.',
      'Korean dining is communal: dishes land in the middle of the table and everyone shares.',
      'If formal certification matters to you, ask to see the certificate and check who issued it and when it expires — certificates lapse, and a sign on the wall can outlive one.',
    ],
  },
  'world-halal': {
    didYouKnow:
      "Korea's halal-friendly kitchens are mostly Indian, Nepali, Turkish, Uzbek, Indonesian and Middle Eastern, clustered around mosques, universities and multicultural neighbourhoods such as Itaewon and Ansan's Wongok-dong. Each badge on this map says how far that place's halal status has been checked — ask staff when it says not certified.",
    diningTips: [
      'Portions are made for sharing — order a few dishes for the table, Korean style.',
      'Many shops serve Korean-style pickles alongside curry and kebab — a small local fusion habit worth trying.',
    ],
  },
  'zero-waste': {
    didYouKnow:
      'Korea recycles about 95% of its food waste by law — every household separates it into dedicated bins. Zero-waste cafes take the next step: nothing disposable crosses the counter in the first place.',
    diningTips: [
      'Bring your own tumbler or container — most zero-waste shops offer a small discount for it.',
      'Root-to-leaf cooking means unfamiliar parts of vegetables may appear on your plate. Trust the kitchen.',
    ],
  },
  'brunch-bakery': {
    didYouKnow:
      "Seoul has one of the highest cafe densities on earth, and the weekend brunch is closer to a ritual than a meal. Korea's version leans on seasonal vegetables and slow baking rather than heavy sauces.",
    diningTips: [
      'Cafes are lingering spaces in Korea — one drink comfortably buys you the seat for the afternoon.',
      'Ask what was baked today; small-batch bakeries sell out of their best items before noon.',
    ],
  },
  'local-seasonal': {
    didYouKnow:
      "Korean cooking follows 제철 (jecheol) — 'the season's turn.' Menus quietly change as ingredients come into season, which is why locals ask 'what's good today?' instead of reading the menu.",
    diningTips: [
      'Ask what is seasonal — the best dish is often not on the printed menu.',
    ],
  },
};

export function getCulture(place) {
  const base = cultureByCategory[place.category] ?? cultureByCategory['local-seasonal'];
  return {
    didYouKnow: place.didYouKnow ?? base.didYouKnow,
    diningTips: place.diningTips ?? base.diningTips,
  };
}
