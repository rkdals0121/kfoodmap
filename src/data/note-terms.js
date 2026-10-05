// The research notes' own words, said plainly for display. The data is
// untouched: this is applied where a note is shown (RestaurantDetail) and
// before a note is translated, so every language starts from the same text.
const NOTE_TERMS = [
  [/\bHALAL\.CERTIFIED\b/g, '“Halal certified”'],
  [/\bHALAL\.FRIENDLY\b|\bFRIENDLY\b/g, '“Halal-friendly”'],
  [/\bHALAL\.PORK_FREE\b|\bPORK_FREE\b/g, '“Pork-free”'],
  // With its article, so "no halalCertClaim is recorded" stays a sentence.
  [/\b(?:in |an? |no )?halalCertClaim\b/g, (m) => (m.startsWith('no ') ? 'no certification claim' : m.startsWith('in ') ? 'as a certification claim' : 'a certification claim')],
  [/\bCERTIFIED\b/g, '“Halal certified”'],
  [/\bporkFree\b/g, '“Pork-free”'],
  [/\bNONE\b/g, '“none”'],
  [/\bCOMMUNITY\b/g, 'a community source'],
  [/\bVEGAN\.FULL\b|\bFULL\b/g, '“Fully vegan”'],
  [/\bVEGAN\.OPTIONS\b|\bOPTIONS\b/g, '“Vegan options”'],
  [/\bCONFIRMED\b/g, '“Confirmed”'],
  [/\bSUPPORTED\b/g, '“Reported”'],
  [/\bINFERRED\b/g, '“Our reading”'],
  // The notes' workshop words — which tool read a page, which pass of the
  // research, which other record set the rule. Said plainly or left out;
  // what was read and what it said are untouched.
  [/ with curl(?: as raw HTML)?/g, ''],
  [/\bthe [a-z0-9-]+ researcher\b/g, 'an earlier check'],
  [/ \((?:the )?[a-z0-9-]+ precedent\)/g, ''],
  [/\ba batch-?\d+ reading\b/g, 'an earlier reading'],
  [/\(noted in batch \d+\)/g, '(noted earlier)'],
  [/\b(a|A)n earlier batch\b/g, (m, a) => `${a}n earlier check`],
  [/\bReviewer note: /g, 'Note: '],
];
export const plainNote = (text) => NOTE_TERMS.reduce((out, [re, word]) => out.replace(re, word), String(text ?? ''));
