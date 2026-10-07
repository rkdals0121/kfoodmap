// A label and what it names, or a word and a note in brackets, put
// together in code ("Copy: <address>", "Saved (3)"): with the marks of
// the language being read. Japanese and Chinese take the full-width
// colon and brackets and no space; the locale files already write them
// so inside their own sentences.
import i18next from 'i18next';

const wide = () => /^(ja|zh)/.test(i18next.language ?? '');
export const colon = (label, value) => (wide() ? `${label}：${value}` : `${label}: ${value}`);
export const paren = (label, note) => (wide() ? `${label}（${note}）` : `${label} (${note})`);
// Between the items of a short list ("11:30 – 15:00, 18:00 – 20:20") and
// between two sentences set side by side.
export const listComma = () => (wide() ? '、' : ', ');
export const sentenceGap = () => (wide() ? '' : ' ');
