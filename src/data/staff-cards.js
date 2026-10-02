// Cards a visitor shows to restaurant staff, in Korean.
//
// The map tells people "Reported, not confirmed — ask staff before you
// order". This is the asking: most staff do not read English, "vegan" and
// "halal" are not everyday words in a Korean kitchen, and the things that
// matter (anchovy stock, fish sauce, cooking wine) are in the broth and the
// seasoning, not on the menu. Comparable tools: Equal Eats' printed cards,
// and the phrase lists travellers pass around in blog posts (research
// 2026-10-02).
//
// Editorial content, like culture.js — not a fact() about any place. The
// Korean is written by the project, and any change to it should be read by
// a Korean speaker before it ships; `key` names the line's meaning in the locale files (cardText.*) — what the Korean says, not a looser paraphrase, in the reader's own language, so the
// visitor knows exactly what they are showing. `roman` follows the Revised
// Romanization, for saying a line aloud.
//
// Rules for this file:
//  - A card states the visitor's own diet. It never says what a restaurant
//    serves, and never uses "safe".
//  - Polite register throughout (합쇼체 / 해요체): the reader is a stranger
//    doing the visitor a favour.
//  - No religious ruling: the Muslim card asks about pork, alcohol and halal
//    meat, and leaves seafood and everything else to the visitor.

export const STAFF_CARDS = [
  {
    id: 'vegan',
    labelKey: 'cards.veganLabel',
    statement: [
      { ko: '안녕하세요. 저는 비건(완전 채식)입니다.', roman: 'Annyeonghaseyo. Jeoneun bigeon (wanjeon chaesik) imnida.', key: 'veganS1' },
      { ko: '고기, 생선, 해산물, 달걀, 우유·유제품, 꿀을 먹지 않습니다.', roman: 'Gogi, saengseon, haesanmul, dalgyal, uyu·yujepum, kkureul meokji anseumnida.', key: 'veganS2' },
      { ko: '육수나 양념에 들어간 것도 먹지 않습니다. (예: 멸치 육수, 액젓, 새우젓)', roman: 'Yuksuna yangnyeome deureogan geotdo meokji anseumnida. (ye: myeolchi yuksu, aekjeot, saeujeot)', key: 'veganS3' },
      { ko: '제가 먹을 수 있는 메뉴가 있을까요?', roman: 'Jega meogeul su inneun menyuga isseulkkayo?', key: 'veganS4' },
    ],
    questions: [
      { ko: '이 음식에 고기나 해산물이 들어가나요?', roman: 'I eumsige gogina haesanmuri deureoganayo?', key: 'veganQ1' },
      { ko: '육수는 무엇으로 만드나요? (멸치, 고기, 가쓰오부시)', roman: 'Yuksuneun mueoseuro mandeunayo? (myeolchi, gogi, gasseuobusi)', key: 'veganQ2' },
      { ko: '김치에 액젓이나 새우젓이 들어가나요?', roman: 'Gimchie aekjeosina saeujeosi deureoganayo?', key: 'veganQ3' },
      { ko: '달걀이나 우유, 버터, 치즈가 들어가나요?', roman: 'Dalgyarina uyu, beoteo, chijeuga deureoganayo?', key: 'veganQ4' },
      { ko: '굴소스나 다시다(쇠고기 조미료)를 쓰나요?', roman: 'Gulsoseuna dasida (soegogi jomiryo) reul sseunayo?', key: 'veganQ5' },
      { ko: '고기와 달걀을 빼고 만들어 주실 수 있나요?', roman: 'Gogiwa dalgyareul ppaego mandeureo jusil su innayo?', key: 'veganQ6' },
    ],
  },
  {
    id: 'muslim',
    labelKey: 'cards.muslimLabel',
    statement: [
      { ko: '안녕하세요. 저는 무슬림입니다.', roman: 'Annyeonghaseyo. Jeoneun museullimimnida.', key: 'muslimS1' },
      { ko: '종교적인 이유로 돼지고기와 술을 먹지 않습니다.', roman: 'Jonggyojeogin iyuro dwaejigogiwa sureul meokji anseumnida.', key: 'muslimS2' },
      { ko: '햄, 베이컨, 소시지, 돼지기름, 돼지 육수도 먹지 않습니다.', roman: 'Haem, beikeon, sosiji, dwaejigireum, dwaeji yuksudo meokji anseumnida.', key: 'muslimS3' },
      { ko: '제가 먹을 수 있는 메뉴가 있을까요?', roman: 'Jega meogeul su inneun menyuga isseulkkayo?', key: 'muslimS4' },
    ],
    questions: [
      { ko: '이 음식에 돼지고기가 들어가나요? (햄, 베이컨, 소시지 포함)', roman: 'I eumsige dwaejigogiga deureoganayo? (haem, beikeon, sosiji poham)', key: 'muslimQ1' },
      { ko: '돼지 육수나 돼지기름을 쓰나요?', roman: 'Dwaeji yuksuna dwaejigireumeul sseunayo?', key: 'muslimQ2' },
      { ko: '요리에 술이 들어가나요? (맛술, 미림, 청주)', roman: 'Yorie suri deureoganayo? (matsul, mirim, cheongju)', key: 'muslimQ3' },
      { ko: '이 고기는 할랄 고기인가요?', roman: 'I gogineun hallal gogiingayo?', key: 'muslimQ4' },
      { ko: '할랄 인증서를 볼 수 있을까요?', roman: 'Hallal injeungseoreul bol su isseulkkayo?', key: 'muslimQ5' },
      { ko: '고기 없이 해산물이나 채소로 만든 메뉴가 있나요?', roman: 'Gogi eopsi haesanmurina chaesoro mandeun menyuga innayo?', key: 'muslimQ6' },
      { ko: '여기서 술을 판매하나요?', roman: 'Yeogiseo sureul panmaehanayo?', key: 'muslimQ7' },
    ],
  },
];

// What staff are likely to answer, so the visitor can read the reply.
export const STAFF_ANSWERS = [
  { ko: '네', roman: 'ne', key: 'answer1' },
  { ko: '아니요', roman: 'aniyo', key: 'answer2' },
  { ko: '들어가요', roman: 'deureogayo', key: 'answer3' },
  { ko: '안 들어가요', roman: 'an deureogayo', key: 'answer4' },
  { ko: '빼 드릴게요', roman: 'ppae deurilgeyo', key: 'answer5' },
  { ko: '안 돼요', roman: 'an dwaeyo', key: 'answer6' },
  { ko: '잘 모르겠어요', roman: 'jal moreugesseoyo', key: 'answer7' },
];

// Words to look for on a menu or a packet. "Usually" is the honest word: a
// kitchen can leave any of these out, and only the kitchen knows.
export const MENU_WORDS = [
  { ko: '액젓', roman: 'aekjeot', key: 'word1' },
  { ko: '새우젓', roman: 'saeujeot', key: 'word2' },
  { ko: '젓갈', roman: 'jeotgal', key: 'word3' },
  { ko: '멸치 육수', roman: 'myeolchi yuksu', key: 'word4' },
  { ko: '사골', roman: 'sagol', key: 'word5' },
  { ko: '돼지고기', roman: 'dwaejigogi', key: 'word6' },
  { ko: '돼지기름', roman: 'dwaejigireum', key: 'word7' },
  { ko: '굴소스', roman: 'gulsoseu', key: 'word8' },
  { ko: '달걀 / 계란', roman: 'dalgyal / gyeran', key: 'word9' },
  { ko: '우유 / 버터 / 치즈', roman: 'uyu / beoteo / chijeu', key: 'word10' },
  { ko: '맛술 / 미림', roman: 'matsul / mirim', key: 'word11' },
  { ko: '청주', roman: 'cheongju', key: 'word12' },
  { ko: '젤라틴', roman: 'jellatin', key: 'word13' },
];

export const cardById = (id) => STAFF_CARDS.find(c => c.id === id) ?? STAFF_CARDS[0];

/** Which card a place's own claims point to: halal claim only → the Muslim card. */
export function cardForPlace(place) {
  const known = (f) => f && f.confidence !== 'unknown' && f.value != null;
  const vegan = known(place?.dietary?.vegan) && place.dietary.vegan.value !== 'none';
  const halal = known(place?.dietary?.halal) && place.dietary.halal.value !== 'none';
  return halal && !vegan ? 'muslim' : 'vegan';
}
