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

// A word joiner (U+2060) follows a closing bracket where a particle comes
// next: shown large, "가" was left alone on a line of its own.
export const STAFF_CARDS = [
  {
    id: 'vegan',
    labelKey: 'cards.veganLabel',
    statement: [
      { ko: '안녕하세요. 저는 비건(완전 채식)⁠입니다.', roman: 'Annyeonghaseyo. Jeoneun bigeon (wanjeon chaesik) imnida.', key: 'veganS1' },
      // "고기" alone leaves the ham in a gimbap and the fish cake in tteokbokki
      // where they are: a kitchen hears whole cuts of meat.
      { ko: '고기(소·돼지·닭, 햄·소시지 포함), 생선, 해산물(어묵·맛살 포함), 달걀, 우유·유제품, 꿀을 먹지 않습니다.', roman: 'Gogi (so·dwaeji·dak, haem·sosiji poham), saengseon, haesanmul (eomuk·matsal poham), dalgyal, uyu·yujepum, kkureul meokji anseumnida.', key: 'veganS2' },
      { ko: '육수나 양념에 동물성 재료가 들어간 음식도 먹지 않습니다. (예: 멸치 육수, 액젓, 새우젓)', roman: 'Yuksuna yangnyeome dongmulseong jaeryoga deureogan eumsikdo meokji anseumnida. (ye: myeolchi yuksu, aekjeot, saeujeot)', key: 'veganS3' },
      { ko: '제가 먹을 수 있는 메뉴가 있을까요?', roman: 'Jega meogeul su inneun menyuga isseulkkayo?', key: 'veganS4' },
    ],
    questions: [
      { ko: '이 음식에 고기나 해산물이 들어가나요?', roman: 'I eumsige gogina haesanmuri deureoganayo?', key: 'veganQ1' },
      { ko: '육수는 무엇으로 만드나요? (멸치, 고기, 가쓰오부시)', roman: 'Yuksuneun mueoseuro mandeunayo? (myeolchi, gogi, gasseuobusi)', key: 'veganQ2' },
      { ko: '김치에 액젓이나 새우젓이 들어가나요?', roman: 'Gimchie aekjeosina saeujeosi deureoganayo?', key: 'veganQ3' },
      { ko: '달걀이나 우유, 버터, 치즈가 들어가나요?', roman: 'Dalgyarina uyu, beoteo, chijeuga deureoganayo?', key: 'veganQ4' },
      // Honey: not animal flesh, so a kitchen that has understood "no meat, no
      // egg, no milk" may still sweeten with it.
      { ko: '꿀이 들어가나요?', roman: 'Kkuri deureoganayo?', key: 'veganQ10' },
      { ko: '굴소스나 다시다(쇠고기 조미료)⁠를 쓰나요?', roman: 'Gulsoseuna dasida (soegogi jomiryo) reul sseunayo?', key: 'veganQ5' },
      { ko: '고기와 달걀을 빼고 만들어 주실 수 있나요?', roman: 'Gogiwa dalgyareul ppaego mandeureo jusil su innayo?', key: 'veganQ6' },
      { ko: '아이가 먹을 수 있는 맵지 않은 메뉴가 있나요?', roman: 'Aiga meogeul su inneun maepji aneun menyuga innayo?', key: 'veganQ7' },
      { ko: '오신채(마늘, 파, 부추, 달래, 양파)⁠가 들어가나요?', roman: 'Osinchae (maneul, pa, buchu, dallae, yangpa) ga deureoganayo?', key: 'vegeQ8' },
      { ko: '견과류(땅콩, 호두, 잣 등)⁠가 들어가나요? 견과류 알레르기가 있습니다.', roman: 'Gyeongwaryu (ttangkong, hodu, jat deung) ga deureoganayo? Gyeongwaryu allereugiga isseumnida.', key: 'veganQ9' },
    ],
  },
  // For someone who eats egg and dairy: the vegan card tells a kitchen they
  // refuse both, and a visitor who is "vegetarian" was left to show a card
  // that is not true of them. Fish stock, fish sauce and salted shrimp are
  // still what a Korean kitchen will not think of as meat or fish.
  {
    id: 'vegetarian',
    labelKey: 'cards.vegetarianLabel',
    statement: [
      { ko: '안녕하세요. 저는 채식주의자입니다.', roman: 'Annyeonghaseyo. Jeoneun chaesikjuuijaimnida.', key: 'vegeS1' },
      { ko: '고기(소·돼지·닭, 햄·소시지 포함), 생선, 해산물(어묵·맛살 포함)⁠을 먹지 않습니다.', roman: 'Gogi (so·dwaeji·dak, haem·sosiji poham), saengseon, haesanmul (eomuk·matsal poham) eul meokji anseumnida.', key: 'vegeS2' },
      { ko: '달걀과 우유·유제품은 먹습니다.', roman: 'Dalgyalgwa uyu·yujepumeun meokseumnida.', key: 'vegeS3' },
      // (Anchovies by name: a Korean kitchen does not think of 멸치 육수 as "fish".)
      { ko: '멸치나 고기, 해물로 낸 육수, 액젓, 새우젓이 들어간 음식도 먹지 않습니다.', roman: 'Myeolchina gogi, haemullo naen yuksu, aekjeot, saeujeosi deureogan eumsikdo meokji anseumnida.', key: 'vegeS4' },
      { ko: '제가 먹을 수 있는 메뉴가 있을까요?', roman: 'Jega meogeul su inneun menyuga isseulkkayo?', key: 'vegeS5' },
    ],
    questions: [
      { ko: '이 음식에 고기나 해산물이 들어가나요?', roman: 'I eumsige gogina haesanmuri deureoganayo?', key: 'vegeQ1' },
      { ko: '육수는 무엇으로 만드나요? (멸치, 고기, 가쓰오부시)', roman: 'Yuksuneun mueoseuro mandeunayo? (myeolchi, gogi, gasseuobusi)', key: 'vegeQ2' },
      { ko: '김치에 액젓이나 새우젓이 들어가나요?', roman: 'Gimchie aekjeosina saeujeosi deureoganayo?', key: 'vegeQ3' },
      { ko: '굴소스나 다시다(쇠고기 조미료)⁠를 쓰나요?', roman: 'Gulsoseuna dasida (soegogi jomiryo) reul sseunayo?', key: 'vegeQ4' },
      { ko: '고기를 빼고 만들어 주실 수 있나요?', roman: 'Gogireul ppaego mandeureo jusil su innayo?', key: 'vegeQ5' },
      // (Asked by many vegetarians from Taiwan and by temple-food eaters, who more
      // often pick this card than the vegan one: the same sentence as there.)
      { ko: '오신채(마늘, 파, 부추, 달래, 양파)⁠가 들어가나요?', roman: 'Osinchae (maneul, pa, buchu, dallae, yangpa) ga deureoganayo?', key: 'veganQ8' },
      // The two every card carries: a child at the table, and nuts.
      { ko: '아이가 먹을 수 있는 맵지 않은 메뉴가 있나요?', roman: 'Aiga meogeul su inneun maepji aneun menyuga innayo?', key: 'vegeQ6' },
      { ko: '견과류(땅콩, 호두, 잣 등)⁠가 들어가나요? 견과류 알레르기가 있습니다.', roman: 'Gyeongwaryu (ttangkong, hodu, jat deung) ga deureoganayo? Gyeongwaryu allereugiga isseumnida.', key: 'vegeQ7' },
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
      { ko: '아이가 먹을 수 있는 맵지 않은 메뉴가 있나요?', roman: 'Aiga meogeul su inneun maepji aneun menyuga innayo?', key: 'muslimQ8' },
      { ko: '견과류(땅콩, 호두, 잣 등)⁠가 들어가나요? 견과류 알레르기가 있습니다.', roman: 'Gyeongwaryu (ttangkong, hodu, jat deung) ga deureoganayo? Gyeongwaryu allereugiga isseumnida.', key: 'muslimQ9' },
    ],
  },
  // For a coeliac, or anyone who cannot eat wheat: "gluten" is not an everyday
  // word in a Korean kitchen, and the wheat that matters is in the soy sauce,
  // the chilli and soybean pastes, the batter, and the oil and water shared
  // with wheat foods (walk-through, 2026-10-14). No disease is named: the
  // card says what the visitor cannot eat.
  {
    id: 'wheat',
    labelKey: 'cards.wheatLabel',
    statement: [
      { ko: '안녕하세요. 저는 건강상의 이유로 글루텐(밀, 보리, 호밀)⁠이 들어간 음식을 먹을 수 없습니다.', roman: 'Annyeonghaseyo. Jeoneun geongangsangui iyuro geulluten (mil, bori, homil) i deureogan eumsigeul meogeul su eopseumnida.', key: 'wheatS1' },
      { ko: '간장, 고추장, 된장, 튀김옷, 부침가루에 든 밀도 먹을 수 없습니다.', roman: 'Ganjang, gochujang, doenjang, twigimot, buchimgarue deun mildo meogeul su eopseumnida.', key: 'wheatS2' },
      { ko: '조금이라도 들어가면 안 되고, 밀가루 음식과 같은 기름이나 물로 조리한 음식도 먹을 수 없습니다.', roman: 'Jogeumirado deureogamyeon an doego, milgaru eumsikgwa gateun gireumina mullo jorihan eumsikdo meogeul su eopseumnida.', key: 'wheatS3' },
      { ko: '제가 먹을 수 있는 메뉴가 있을까요?', roman: 'Jega meogeul su inneun menyuga isseulkkayo?', key: 'wheatS4' },
    ],
    questions: [
      { ko: '이 음식에 밀가루가 들어가나요?', roman: 'I eumsige milgaruga deureoganayo?', key: 'wheatQ1' },
      { ko: '간장, 고추장, 된장을 쓰나요?', roman: 'Ganjang, gochujang, doenjangeul sseunayo?', key: 'wheatQ2' },
      { ko: '튀김옷이나 부침가루를 쓰나요?', roman: 'Twigimosina buchimgarureul sseunayo?', key: 'wheatQ3' },
      { ko: '튀김 기름이나 면 삶는 물을 밀가루 음식과 같이 쓰나요?', roman: 'Twigim gireumina myeon samneun mureul milgaru eumsikgwa gachi sseunayo?', key: 'wheatQ4' },
      { ko: '보리(보리차 포함)⁠가 들어가나요?', roman: 'Bori (boricha poham) ga deureoganayo?', key: 'wheatQ5' },
      { ko: '아이가 먹을 수 있는 맵지 않은 메뉴가 있나요?', roman: 'Aiga meogeul su inneun maepji aneun menyuga innayo?', key: 'wheatQ6' },
      { ko: '견과류(땅콩, 호두, 잣 등)⁠가 들어가나요? 견과류 알레르기가 있습니다.', roman: 'Gyeongwaryu (ttangkong, hodu, jat deung) ga deureoganayo? Gyeongwaryu allereugiga isseumnida.', key: 'wheatQ7' },
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
  // "Is there anything I can eat?" is answered "있어요" or "없어요".
  { ko: '있어요', roman: 'isseoyo', key: 'answer8' },
  { ko: '없어요', roman: 'eopseoyo', key: 'answer9' },
];

// Words to look for on a menu or a packet. "Usually" is the honest word: a
// kitchen can leave any of these out, and only the kitchen knows.
// cards: the cards a word belongs to (a card's extras can add more). Eggs and
// dairy are a vegan's question, the seafood words not a Muslim's (seafood is
// theirs to judge), cooking wine a Muslim's, and none of them the wheat
// card's: on another card they were noise.
export const MENU_WORDS = [
  { ko: '액젓', roman: 'aekjeot', key: 'word1', cards: ['vegan', 'vegetarian'] },
  { ko: '새우젓', roman: 'saeujeot', key: 'word2', cards: ['vegan', 'vegetarian'] },
  { ko: '젓갈', roman: 'jeotgal', key: 'word3', cards: ['vegan', 'vegetarian'] },
  { ko: '멸치 육수', roman: 'myeolchi yuksu', key: 'word4', cards: ['vegan', 'vegetarian'] },
  { ko: '사골', roman: 'sagol', key: 'word5', cards: ['vegan', 'vegetarian', 'muslim'] },
  { ko: '돼지고기', roman: 'dwaejigogi', key: 'word6', cards: ['vegan', 'vegetarian', 'muslim'] },
  { ko: '돼지기름', roman: 'dwaejigireum', key: 'word7', cards: ['vegan', 'vegetarian', 'muslim'] },
  { ko: '굴소스', roman: 'gulsoseu', key: 'word8', cards: ['vegan', 'vegetarian'] },
  { ko: '달걀 / 계란', roman: 'dalgyal / gyeran', key: 'word9', cards: ['vegan'] },
  { ko: '우유 / 버터 / 치즈', roman: 'uyu / beoteo / chijeu', key: 'word10', cards: ['vegan'] },
  { ko: '맛술 / 미림', roman: 'matsul / mirim', key: 'word11', cards: ['muslim'] },
  { ko: '청주', roman: 'cheongju', key: 'word12', cards: ['muslim'] },
  { ko: '젤라틴', roman: 'jellatin', key: 'word13', cards: ['vegan', 'vegetarian', 'muslim'] },
  { ko: '밀가루 / 소맥분', roman: 'milgaru / somaekbun', key: 'word14', cards: ['wheat'] },
  { ko: '간장', roman: 'ganjang', key: 'word15', cards: ['wheat'] },
  { ko: '고추장 / 된장', roman: 'gochujang / doenjang', key: 'word16', cards: ['wheat'] },
  { ko: '부침가루 / 튀김가루', roman: 'buchimgaru / twigimgaru', key: 'word17', cards: ['wheat'] },
  { ko: '보리', roman: 'bori', key: 'word18', cards: ['wheat'] },
];

export const cardById = (id) => STAFF_CARDS.find(c => c.id === id) ?? STAFF_CARDS[0];

// What a card leaves out, added by the visitor. Most vegetarians from India
// eat no egg, and the vegetarian card told staff "I do eat eggs"; a Jain
// visitor, or a temple-food eater, also leaves out the five pungent
// vegetables, and some the root vegetables. Each is a line of the visitor's
// own diet, like the rest of the card: nothing about what a kitchen serves.
//  replace: a line of the card said instead (by key);
//  statement: a line added before the card's last ("Is there a dish I can eat?");
//  questions: asked after the card's first question;
//  words: menu words shown with it.
const wheatLine = (key) => { const c = STAFF_CARDS.find(x => x.id === 'wheat'); return [...c.statement, ...c.questions].find(l => l.key === key); };
export const CARD_EXTRAS = [
  {
    id: 'egg',
    labelKey: 'cards.noEgg',
    cards: ['vegetarian'],
    replace: {
      vegeS3: { ko: '우유·유제품은 먹지만, 달걀은 먹지 않습니다.', roman: 'Uyu·yujepumeun meokjiman, dalgyareun meokji anseumnida.', key: 'vegeS3NoEgg' },
      vegeQ5: { ko: '고기와 달걀을 빼고 만들어 주실 수 있나요?', roman: 'Gogiwa dalgyareul ppaego mandeureo jusil su innayo?', key: 'vegeQ5NoEgg' },
    },
    // Egg hides in batter, bread and sauces (mayonnaise), not only on top.
    questions: [{ ko: '달걀이 들어가나요? (반죽, 빵, 소스 포함)', roman: 'Dalgyari deureoganayo? (banjuk, ppang, soseu poham)', key: 'vegeQ9' }],
    words: ['word9'],
  },
  {
    id: 'pungent',
    labelKey: 'cards.noPungent',
    cards: ['vegan', 'vegetarian'],
    statement: { ko: '오신채(마늘, 파, 부추, 달래, 양파)⁠도 먹지 않습니다.', roman: 'Osinchae (maneul, pa, buchu, dallae, yangpa) do meokji anseumnida.', key: 'extraNoPungent' },
  },
  {
    id: 'wheat',
    labelKey: 'cards.noWheat',
    cards: ['vegan', 'vegetarian', 'muslim'],
    // (With the card's own line on oil and water shared with wheat foods, and its
    // questions on batter, frying oil and noodle water, and barley: added to
    // another card, it said less than the wheat card.)
    statement: [{ ko: '글루텐(밀, 보리, 호밀)⁠이 들어간 음식도 먹을 수 없습니다. 간장, 고추장, 된장에 든 밀도 안 됩니다.', roman: 'Geulluten (mil, bori, homil) i deureogan eumsikdo meogeul su eopseumnida. Ganjang, gochujang, doenjange deun mildo an doemnida.', key: 'extraNoWheat' }, wheatLine('wheatS3')],
    questions: [{ ko: '이 음식에 밀가루나 간장, 고추장, 된장이 들어가나요?', roman: 'I eumsige milgaruna ganjang, gochujang, doenjangi deureoganayo?', key: 'extraQWheat' }, wheatLine('wheatQ3'), wheatLine('wheatQ4'), wheatLine('wheatQ5')],
    words: ['word14', 'word15', 'word16', 'word17', 'word18'],
  },
  {
    id: 'roots',
    labelKey: 'cards.noRoots',
    cards: ['vegan', 'vegetarian'],
    // (Ginger, lotus root and burdock by name: a Korean kitchen does not think of
    // 생강 in kimchi, or 연근 and 우엉 among the side dishes, as root vegetables.)
    statement: { ko: '감자, 고구마, 당근, 무, 생강, 연근, 우엉 같은 뿌리채소도 먹지 않습니다.', roman: 'Gamja, goguma, danggeun, mu, saenggang, yeongeun, ueong gateun ppurichaesodo meokji anseumnida.', key: 'extraNoRoots' },
    questions: [{ ko: '감자, 고구마, 당근, 무, 생강, 연근, 우엉 같은 뿌리채소가 들어가나요?', roman: 'Gamja, goguma, danggeun, mu, saenggang, yeongeun, ueong gateun ppurichaesoga deureoganayo?', key: 'extraQRoots' }],
  },
];

// What a search says the visitor leaves out, for the link to the cards: a
// family who searched "vegetarian no egg" or "jain" gets the card that says
// so. (Jain: no egg, no onion or garlic, no root vegetables.) Not 蛋奶素,
// which is a vegetarian who does eat egg.
const ASKED = {
  egg: /\b(?:no|without|not)\s+eggs?\b|\beggless\b|\beggs?[- ]?free\b|\bjain|(?:달걀|계란)\s*(?:없|빼|안)|无蛋|不吃(?:鸡|雞)?蛋|不含(?:鸡|雞)?蛋|卵(?:なし|抜き|を?食べない)|tanpa telur|\bpure[ -]?veg(?!an)/i,
  // (五辛素 is a label for vegetarian food WITH the five pungent; 含五辛,
  // 오신채 들어간 say they are in it: not these. In Korean, both onion and
  // garlic: "양파 없는" alone does not say no chives.)
  pungent: /\bjain|\bfive pungent|\b(?:no|without)\s+(?:the\s+)?(?:alliums?|osinchae|pungent vegetables)|(?:不吃|不含|不用|不要|[無无]|沒有|没有|去)(?:五辛|五葷)|(?:^|[^含可吃])(?:五辛|五葷)(?![蛋奶]*素)|오신채(?!\s*(?:포함|들어간|들어가는|있는|먹))|(?:양파[\s·,및과와]*마늘|마늘[\s·,및과와]*양파)\s*(?:없|빼|안)|不吃(?:葱|蔥)蒜|tanpa bawang(?!\s+(?:putih|merah|bombay|bombai))/i,
  roots: /\bjain|\broot vegetables?\b|뿌리\s*채소|根菜|根茎|根莖|umbi/i,

  // (Gluten, coeliac, or wheat left out — not every "whole wheat bread".)
  wheat: /gluten|c(?:o)?eliac|\b(?:no|without)\s+wheat|\bwheat[- ]?free|글루텐|셀리악|밀가루\s*(?:없|빼|안)|グルテン|セリアック|小麦(?:粉)?(?:なし|不使用|抜き|アレルギー)|麸质|麩質|tanpa gandum/i,
};
// …and what the search itself read as left out (filters.js leftOutQuery):
// "vegetarian no-egg", "egg and dairy free", "without any wheat".
const FROM_ITEMS = {
  egg: (items) => items.includes('egg'),
  pungent: (items) => items.includes('onion') && items.includes('garlic'),
  roots: () => false,
  wheat: (items) => items.includes('wheat') || items.includes('gluten'),
};
export const extrasAsked = (text, items = []) => Object.keys(ASKED).filter(id => ASKED[id].test(text ?? '') || FROM_ITEMS[id](items));

/** The extras a card offers, from a list of ids (an address's "no=egg,roots"). */
export const extrasFor = (cardId, ids) =>
  CARD_EXTRAS.filter(x => x.cards.includes(cardId) && (ids ?? []).includes(x.id)).map(x => x.id);

/** A card's lines with the extras switched on. */
export function cardLines(card, extras = []) {
  const on = CARD_EXTRAS.filter(x => x.cards.includes(card.id) && extras.includes(x.id));
  const swap = (line) => on.reduce((l, x) => x.replace?.[line.key] ?? l, line);
  const statement = card.statement.map(swap);
  statement.splice(statement.length - 1, 0, ...on.flatMap(x => [].concat(x.statement ?? [])));
  const questions = card.questions.map(swap);
  questions.splice(1, 0, ...on.flatMap(x => x.questions ?? []));
  return { statement, questions, words: new Set(on.flatMap(x => x.words ?? [])) };
}

// The card the visitor last chose, while the app is open (not stored: it is
// gone on a reload). A family who chose "vegetarian, no egg" was sent to the
// Muslim card by every Indian restaurant whose only claim is halal.
let chosen = null;
export const rememberCard = (id, extras) => { chosen = { id, extras }; };
/** The card the visitor chose while the app is open, or null. */
export const chosenCard = () => chosen;

/** The address of the cards from a place: the visitor's own card if they chose one, else the one its claims point to (halal claim only → the Muslim card). */
export function cardLinkForPlace(place) {
  if (chosen) return `/cards?card=${chosen.id}${chosen.extras.length ? `&no=${chosen.extras.join(',')}` : ''}`;
  return `/cards?card=${cardForPlace(place)}`;
}

/** Which card a place's own claims point to: a halal claim → the Muslim card, unless the kitchen is fully vegan. */
// (Vegan options at a halal-friendly kitchen — Bagdad, Bollywood, Asalam — did
// open the vegan card for the Muslim family who came for the halal claim; a
// vegan visitor who chose their card gets theirs.)
export function cardForPlace(place) {
  const known = (f) => f && f.confidence !== 'unknown' && f.value != null;
  const fullyVegan = known(place?.dietary?.vegan) && place.dietary.vegan.value === 'full';
  const halal = known(place?.dietary?.halal) && place.dietary.halal.value !== 'none';
  return halal && !fullyVegan ? 'muslim' : 'vegan';
}
