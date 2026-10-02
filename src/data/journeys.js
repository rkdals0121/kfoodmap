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

import i18next from 'i18next';
import '../i18n/index.js';

// The titles and descriptions live in the locale files (journeyText.<id>),
// so they follow the chosen language; `title` and `description` read them
// at call time. Under Node (tests, check-data) that is English.
const journey = (id, stopIds) => ({
  id,
  stopIds,
  get title() { return i18next.t(`journeyText.${id}.title`); },
  get description() { return i18next.t(`journeyText.${id}.description`); },
});

export const journeys = [
  journey('itaewon-dietary-diversity', ['eid', 'plant-cafe', 'monks-butcher']),
  journey('jongno-temple-food', ['balwoo', 'sanchon', 'osegyehyang']),
  journey('myeongdong-halal-korean', ['halal-busan-jib', 'myeongdongjeong', 'myeongdong-chaeum', 'bsj-chicken-wok-myeongdong']),
  journey('jeonju-plant-based', ['gamloheon-jeonju', 'loving-hut-seosin-jeonju', 'present-vegan-cafe-jeonju', 'pungnamjeong-jeonju']),
  journey('busan-vegan-korean', ['vegenarang-gwangalli', 'soban-vegan-dongdaesin', 'pyeonhan-jipbap-mandeok']),
  journey('jeju-halal-friendly', ['biwon-samgyetang-jeju', 'crab-story-jeju-airport', 'asalam-jeju', 'bagdad-jeju']),
  journey('ansan-wongok-muslim-friendly', ['hursheda-samarkand-ansan', 'royal-restaurant-ansan', 'kantipur-ansan']),
];
