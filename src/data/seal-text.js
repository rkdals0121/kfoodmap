// What a Passport seal (dojang) carries for a place: the first Hangul word
// of its Korean name — "Balwoo Gongyang (발우공양)" → 발우공양, "Bonjuk
// (본죽 송도신도시점)" → 본죽 — laid out the way a seal is cut: up to
// three characters on one line, four as 2×2, five to nine in rows of three.
// A place with no Korean name, or a first word too long to cut, gets its
// initial.
export function sealText(name) {
  const inParens = String(name).match(/\(([^)]*[가-힣][^)]*)\)/);
  const word = inParens
    ? inParens[1].split(/\s+/).map(w => w.replace(/[^가-힣]/g, '')).find(Boolean)
    : null;
  if (word && word.length <= 9) {
    const n = word.length;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    return { chars: [...word], cols };
  }
  const initial = (word ? word[0] : String(name).trim()[0] ?? '?').toUpperCase();
  return { chars: [initial], cols: 1 };
}
