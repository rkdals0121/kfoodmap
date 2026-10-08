// Where a place is, in one short line, in the language of the interface:
// the record's own area ("Itaewon, Seoul"), or in Korean the city and
// district of its Korean address ("서울 용산구") when it has one.
import i18next from 'i18next';
import { koArea } from './data/address-ko.js';

// "(near Busan Station)", "(by Cheonan Station)": the word for "near" in
// the reader's language. The landmark keeps the spelling of the record —
// its name in another script would be a guess — and a description in plain
// English ("near the intercity bus terminal") is left as it is.
const NEAR = /\((?:near|by) ((?:the )?[A-Z][^()]*)\)/;
const NEAR_IN = {
  ja: name => `(${name} 付近)`,
  'zh-Hans': name => `(${name} 附近)`,
  'zh-Hant': name => `(${name} 附近)`,
  id: name => `(dekat ${name})`,
};
export const nearIn = (zone, language) => {
  const say = NEAR_IN[language];
  return say && typeof zone === 'string' ? zone.replace(NEAR, (whole, name) => say(name.replace(/^the /, ''))) : zone;
};

export const placeArea = (place) => (i18next.language === 'ko' ? koArea(place) : null) ?? nearIn(place.zone, i18next.language);
