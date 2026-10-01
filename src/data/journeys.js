// Food Journeys — editorial theme curation over restaurants already on the map.
// GROWTH-PLAN Stage 2 item 3: "테마 큐레이션이지 경로 계산이 아님" (theme
// curation, not route calculation — Nearby Route already handles getting
// between stops). A journey creates no new facts about any restaurant; it
// only groups existing `restaurants.js` entries (at whatever confidence
// their records hold — Discover prints that per journey) under an
// editorial title and description, the same way `story`/`vibe` are
// editorial prose without a `fact()` wrapper.
//
// Descriptions may say only what the stops' own records say — a dietary
// level exactly as recorded (halal-friendly, never "halal-certified" unless
// a certificate was sighted), a cuisine the record names. If a stop is ever
// quarantined, TabPanel drops the whole journey.
//
// `stopIds` order is the suggested visiting order, not a computed route.

export const journeys = [
  {
    id: 'itaewon-dietary-diversity',
    title: 'Itaewon: A Half-Day of Dietary Diversity',
    description:
      'Three Itaewon restaurants for three different diets — halal-friendly Korean home cooking beside the Seoul Central Mosque, a vegan café and bakery, and plant-based versions of butcher-shop dishes — all within one neighbourhood.',
    stopIds: ['eid', 'plant-cafe', 'monks-butcher'],
  },
  {
    id: 'jongno-temple-food',
    title: 'Jongno & Insadong: Korean Temple Food',
    description:
      'Three kitchens a short walk apart in central Seoul, two of them cooking in the Buddhist temple-food tradition — no meat, no fish, and none of the five pungent vegetables either. One is reported as fully vegan; for the two temple kitchens, fully vegan is our reading of the tradition, not something they state.',
    stopIds: ['balwoo', 'sanchon', 'osegyehyang'],
  },
  {
    id: 'myeongdong-halal-korean',
    title: 'Myeongdong: Korean Food, Halal-Friendly',
    description:
      'Korean barbecue, set-course hanjeongsik and Korean fried chicken within a few streets of each other, each recorded on this map as halal-friendly. None has a current halal certificate on record — Busan Jib’s KMF certificates expired in April 2026 — so ask staff about the meat before ordering.',
    stopIds: ['halal-busan-jib', 'myeongdongjeong', 'myeongdong-chaeum', 'bsj-chicken-wok-myeongdong'],
  },
  {
    id: 'jeonju-plant-based',
    title: 'Jeonju Beyond Bibimbap',
    description:
      'Two kitchens and a café in Jeonju reported as fully vegan, finishing with bibimbap at a Hanok Village house reported to offer vegan options. Check each stop\'s hours before you set out.',
    stopIds: ['gamloheon-jeonju', 'loving-hut-seosin-jeonju', 'present-vegan-cafe-jeonju', 'pungnamjeong-jeonju'],
  },
  {
    id: 'busan-vegan-korean',
    title: 'Busan: Vegan Korean Cooking',
    description:
      'Temple food near Gwangalli beach and Korean home cooking in Seo-gu and Buk-gu — three kitchens reported as fully vegan, not yet confirmed. They are far apart; take one a day.',
    stopIds: ['vegenarang-gwangalli', 'soban-vegan-dongdaesin', 'pyeonhan-jipbap-mandeok'],
  },
  {
    id: 'jeju-halal-friendly',
    title: 'Jeju: Halal-Friendly Tables',
    description:
      'Samgyetang and snow crab from two Korean restaurants the press reports as holding an Indonesian halal certificate (not sighted by us), then Yemeni and Indian cooking in Jeju City. All four are recorded as halal-friendly; there is no rail on the island.',
    stopIds: ['biwon-samgyetang-jeju', 'crab-story-jeju-airport', 'asalam-jeju', 'bagdad-jeju'],
  },
  {
    id: 'ansan-wongok-muslim-friendly',
    title: 'Ansan Wongok-dong: A Multicultural Street',
    description:
      'Uzbek, Indonesian and Nepali-Indian kitchens on Ansan\'s multicultural street, each listed in the Gyeonggi Tourism Organization\'s Muslim-friendly restaurant dataset. Some serve alcohol, and none has a sighted certificate — each stop\'s page says what is known.',
    stopIds: ['hursheda-samarkand-ansan', 'royal-restaurant-ansan', 'kantipur-ansan'],
  },
];
