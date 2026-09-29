// Food Journeys — editorial theme curation over already-verified restaurants.
// GROWTH-PLAN Stage 2 item 3: "테마 큐레이션이지 경로 계산이 아님" (theme
// curation, not route calculation — Nearby Route already handles getting
// between stops). A journey creates no new facts about any restaurant; it
// only groups existing, verified `restaurants.js` entries under an
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
      'Three verified Itaewon restaurants, three different dietary needs — halal Korean comfort food near the Seoul Central Mosque, a sunlit vegan cafe, and refined plant-based dining. One neighborhood, no compromises.',
    stopIds: ['eid', 'plant-cafe', 'monks-butcher'],
  },
  {
    id: 'jongno-temple-food',
    title: 'Jongno & Insadong: Korean Temple Food',
    description:
      'Three kitchens a short walk apart in central Seoul that this map records as fully vegan, two of them cooking in the Buddhist temple-food tradition — no meat, no fish, and in temple cooking none of the five pungent vegetables either.',
    stopIds: ['balwoo', 'sanchon', 'osegyehyang'],
  },
  {
    id: 'myeongdong-halal-korean',
    title: 'Myeongdong: Korean Food, Halal-Friendly',
    description:
      'Korean barbecue, set-course hanjeongsik and Korean fried chicken within a few streets of each other, each recorded on this map as halal-friendly. No halal certificate has been sighted for any of them — ask staff about the meat before ordering.',
    stopIds: ['halal-busan-jib', 'myeongdongjeong', 'myeongdong-chaeum', 'bsj-chicken-wok-myeongdong'],
  },
  {
    id: 'jeonju-plant-based',
    title: 'Jeonju Beyond Bibimbap',
    description:
      'Two fully vegan kitchens and a fully vegan café in Jeonju, finishing with bibimbap at a Hanok Village house that offers vegan options. Check each stop\'s hours before you set out.',
    stopIds: ['gamloheon-jeonju', 'loving-hut-seosin-jeonju', 'present-vegan-cafe-jeonju', 'pungnamjeong-jeonju'],
  },
  {
    id: 'busan-vegan-korean',
    title: 'Busan: Fully Vegan Korean Cooking',
    description:
      'Temple food near Gwangalli beach and Korean home cooking in Seo-gu and Buk-gu — three kitchens this map records as fully vegan. They are far apart; take one a day.',
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
