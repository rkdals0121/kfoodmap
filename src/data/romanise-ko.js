// A Korean word in the letters the records use for it: the Revised
// Romanization, with the sound changes it writes out (신림 is "Sillim", 종로
// "Jongno", 독립 "Dongnip"). The records hold a neighbourhood as it stands in
// the English address, "Ikseon-dong"; a reader of Korean types 익선동, and the
// Korean address on file is the road-name one, which names no neighbourhood.
// Only a search aid: a word this spells otherwise than the record does is
// simply not found, as before. (Checked against the road names the two
// address forms share: scripts/tests/romanise-ko.test.mjs.)

const LEAD = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWEL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// A final consonant: how it sounds when the syllable ends there, and what
// (if anything) it hands to a following vowel.
const TAIL = [
  null,
  ['k', 'g'], ['k', 'kk'], ['k', 's', 'k'], ['n', 'n'], ['n', 'j', 'n'], ['n', 'n'], ['t', 'd'],
  ['l', 'r'], ['k', 'g', 'l'], ['m', 'm', 'l'], ['l', 'b', 'l'], ['l', 's', 'l'], ['l', 't', 'l'], ['p', 'p', 'l'], ['l', 'r'],
  ['m', 'm'], ['p', 'b'], ['p', 's', 'p'], ['t', 's'], ['t', 'ss'], ['ng', null], ['t', 'j'], ['t', 'ch'],
  ['k', 'k'], ['t', 't'], ['p', 'p'], ['t', ''],
];

/** "익선" → "ikseon"; null for anything that is not all Hangul syllables. */
export function romaniseKorean(word) {
  const text = String(word ?? '');
  if (!/^[가-힣]+$/.test(text)) return null;
  const parts = [...text].map((ch) => {
    const code = ch.charCodeAt(0) - 0xAC00;
    return { lead: Math.floor(code / 588), vowel: Math.floor((code % 588) / 28), tail: code % 28 };
  });
  let out = '';
  for (let i = 0; i < parts.length; i += 1) {
    const { lead, vowel, tail } = parts[i];
    const before = i > 0 ? parts[i - 1].tail : 0;
    const closed = before ? TAIL[before][0] : '';
    let head = LEAD[lead];
    // After a consonant, ㄹ is said as ㄴ (종로 "Jongno") — or as the second
    // l of "ll" after ㄴ and ㄹ, which the syllable before has written.
    if (lead === 5 && closed) head = closed === 'l' || closed === 'n' ? 'l' : 'n';
    else if (lead === 2 && closed === 'l') head = 'l';
    out += head + VOWEL[vowel];
    if (!tail) continue;
    const next = parts[i + 1];
    const [sound, carried, left] = TAIL[tail];
    if (!next) { out += sound; continue; }
    if (next.lead === 11) {
      // Before a vowel the consonant is carried over (연음: 낙원 "Nagwon").
      out += carried === null ? sound : (left ?? '') + carried;
      continue;
    }
    const nasal = next.lead === 2 || next.lead === 6 || next.lead === 5;
    if (next.lead === 5 && (sound === 'n' || sound === 'l')) out += 'l';
    else if (nasal && sound === 'k') out += 'ng';
    else if (nasal && sound === 't') out += 'n';
    else if (nasal && sound === 'p') out += 'm';
    else out += sound;
  }
  return out;
}
