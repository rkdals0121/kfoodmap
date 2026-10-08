// Where a place is, in one short line, in the language of the interface:
// the record's own area ("Itaewon, Seoul"), or in Korean the city and
// district of its Korean address ("서울 용산구") when it has one.
import i18next from 'i18next';
import { koArea } from './data/address-ko.js';

// "(near Busan Station)", "(by Cheonan Station)", "(Nampo-dong, near Gukje
// Market)": the word for "near" in the reader's language. The landmark
// keeps the spelling of the record — its name in another script would be a
// guess.
const NEAR = /\(((?:[^(),]+, )?)(?:near|by) ((?:the )?[A-Z][^()]*)\)/;
const NEAR_IN = {
  ja: name => `${name} 付近`,
  'zh-Hans': name => `${name} 附近`,
  'zh-Hant': name => `${name} 附近`,
  id: name => `dekat ${name}`,
};
// The few descriptions in plain English, whole (the bracket's own words).
// `$1` is the name the record gives.
const PLAIN = [
  [/^west of the airport$/, { ja: '空港の西側', 'zh-Hans': '机场以西', 'zh-Hant': '機場以西', id: 'sebelah barat bandara' }],
  [/^1100-ro, south of the city$/, { ja: '1100-ro、市街地の南', 'zh-Hans': '1100-ro，市区以南', 'zh-Hant': '1100-ro，市區以南', id: '1100-ro, selatan kota' }],
  [/^near the intercity bus terminal$/, { ja: '市外バスターミナル付近', 'zh-Hans': '长途汽车站附近', 'zh-Hant': '長途客運站附近', id: 'dekat terminal bus antarkota' }],
  [/^east coast$/, { ja: '東海岸', 'zh-Hans': '东海岸', 'zh-Hant': '東海岸', id: 'pantai timur' }],
  [/^west coast$/, { ja: '西海岸', 'zh-Hans': '西海岸', 'zh-Hant': '西海岸', id: 'pantai barat' }],
  [/^(.+) trailhead$/, { ja: '$1 登山口', 'zh-Hans': '$1 登山口', 'zh-Hant': '$1 登山口', id: 'awal jalur pendakian $1' }],
  [/^(.+) art village$/, { ja: '$1 芸術村', 'zh-Hans': '$1 艺术村', 'zh-Hant': '$1 藝術村', id: 'desa seni $1' }],
  [/^at the foot of (.+)$/, { ja: '$1 のふもと', 'zh-Hans': '$1 山脚下', 'zh-Hant': '$1 山腳下', id: 'di kaki $1' }],
  [/^(.+) seafront$/, { ja: '$1 の海沿い', 'zh-Hans': '$1 海滨', 'zh-Hant': '$1 海濱', id: 'tepi laut $1' }],
  [/^(.+) mall$/, { ja: '$1 モール', 'zh-Hans': '$1 商场', 'zh-Hant': '$1 商場', id: 'mal $1' }],
  [/^opposite (.+)$/, { ja: '$1 の向かい', 'zh-Hans': '$1 对面', 'zh-Hant': '$1 對面', id: 'seberang $1' }],
];
export const nearIn = (zone, language) => {
  const say = NEAR_IN[language];
  if (!say || typeof zone !== 'string') return zone;
  const near = zone.replace(NEAR, (whole, before, name) => `(${before}${say(name.replace(/^the /, ''))})`);
  if (near !== zone) return near;
  return zone.replace(/\(([^()]+)\)/, (whole, words) => {
    for (const [shape, said] of PLAIN) if (shape.test(words)) return `(${words.replace(shape, said[language])})`;
    return whole;
  });
};

export const placeArea = (place) => (i18next.language === 'ko' ? koArea(place) : null) ?? nearIn(place.zone, i18next.language);
