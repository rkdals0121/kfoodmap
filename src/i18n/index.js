// Side-effect module: initializes the i18next singleton so any caller of
// i18next.t() gets real strings, whether it's a React component (via
// useTranslation()) or a plain Node script like scripts/check-data.mjs
// (via src/data/verification.js importing this file directly -- see that
// file's own comment).
//
// English is bundled into the JS: it is the fallback, the language of every
// Node script, and what a first paint can always show. The other languages
// are separate chunks, fetched only when chosen (or detected), so an
// English reader never downloads them. scripts/tests/locales.test.mjs holds
// each of them to English's keys, placeholders and tags.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';

// `name` is the language's own name and is never translated: a picker has
// to be readable by someone who cannot read the current language.
// `dates` is the Intl locale for dates; `html` the <html lang> value.
export const LANGUAGES = [
  { code: 'en', name: 'English', dates: 'en-GB', html: 'en' },
  { code: 'ja', name: '日本語', dates: 'ja-JP', html: 'ja', load: () => import('./locales/ja.js') },
  { code: 'zh-Hans', name: '简体中文', dates: 'zh-CN', html: 'zh-Hans', load: () => import('./locales/zh-Hans.js') },
  { code: 'id', name: 'Bahasa Indonesia', dates: 'id-ID', html: 'id', load: () => import('./locales/id.js') },
];
const byCode = (code) => LANGUAGES.find(l => l.code === code);

export const LANGUAGE_STORAGE_KEY = 'kfm-language';

// The Node scripts that reach this module (check-data, prerender-places,
// via src/data/verification.js) have no localStorage -- guard, don't
// assume a browser. An unrecognised stored value (stale key, hand-edited)
// falls back rather than selecting a language that isn't registered.
function storedLanguage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored && byCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * The browser's preferred language, if it is one we have. Chinese maps to
 * Simplified whatever the region: there is no Traditional file yet, and
 * Simplified is closer for a Traditional reader than English is. Malay is
 * left on English rather than given Indonesian — close, but not the same
 * language, and not ours to choose for the reader.
 */
export function detectLanguage(preferred) {
  for (const tag of preferred ?? []) {
    const t = String(tag).toLowerCase();
    if (t === 'ja' || t.startsWith('ja-')) return 'ja';
    if (t === 'zh' || t.startsWith('zh-')) return 'zh-Hans';
    if (t === 'id' || t.startsWith('id-') || t === 'in') return 'id';
    if (t === 'en' || t.startsWith('en-')) return 'en';
  }
  return 'en';
}

i18next.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes -- avoid double-escaping
  },
});

/**
 * Switch language: fetch its strings if needed, then change. A failed fetch
 * (offline, a stale tab after a deploy) leaves the app in the language it
 * was in rather than half-switched. Resolves to the language now in use.
 */
export async function setLanguage(code, { remember = true } = {}) {
  const lang = byCode(code) ?? byCode('en');
  try {
    if (lang.load && !i18next.hasResourceBundle(lang.code, 'translation')) {
      const mod = await lang.load();
      i18next.addResourceBundle(lang.code, 'translation', mod.default, true, true);
    }
    await i18next.changeLanguage(lang.code);
  } catch {
    return i18next.language;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang.html;
  if (remember && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lang.code); } catch { /* private mode */ }
  }
  return lang.code;
}

/**
 * The language to start in: the one chosen before, else the browser's.
 * Browser only — Node scripts stay in English. A detected language is not
 * written to storage, so it keeps following the browser until the reader
 * chooses one in Profile.
 */
export function startLanguage() {
  if (typeof window === 'undefined') return Promise.resolve('en');
  const stored = storedLanguage();
  const code = stored ?? detectLanguage(navigator.languages ?? [navigator.language]);
  return code === 'en' ? Promise.resolve('en') : setLanguage(code, { remember: false });
}

export const dateLocale = (code) => byCode(code)?.dates ?? 'en-GB';
