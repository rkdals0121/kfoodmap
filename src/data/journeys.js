// Food Journeys — editorial theme curation over already-verified restaurants.
// GROWTH-PLAN Stage 2 item 3: "테마 큐레이션이지 경로 계산이 아님" (theme
// curation, not route calculation — Nearby Route already handles getting
// between stops). A journey creates no new facts about any restaurant; it
// only groups existing, verified `restaurants.js` entries under an
// editorial title and description, the same way `story`/`vibe` are
// editorial prose without a `fact()` wrapper.
//
// `stopIds` order is the suggested visiting order, not a computed route.

export const journeys = [
  {
    id: 'itaewon-dietary-diversity',
    title: 'Itaewon: A Half-Day of Dietary Diversity',
    description:
      'Three verified Itaewon restaurants, three different dietary needs — halal Korean comfort food near the Seoul Central Mosque, a sunlit vegan cafe, and refined plant-based dining. One neighborhood, no compromises.',
    stopIds: ['eid', 'plant-cafe', 'monks-butcher'],
  },
];
