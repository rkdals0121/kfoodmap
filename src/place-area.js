// Where a place is, in one short line, in the language of the interface:
// the record's own area ("Itaewon, Seoul"), or in Korean the city and
// district of its Korean address ("서울 용산구") when it has one.
import i18next from 'i18next';
import { koArea } from './data/address-ko';

export const placeArea = (place) => (i18next.language === 'ko' ? koArea(place) : null) ?? place.zone;
