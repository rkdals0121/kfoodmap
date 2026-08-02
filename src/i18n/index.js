// Side-effect-only module: initializes the i18next singleton so any
// caller of i18next.t() gets real strings, whether it's a React
// component (via useTranslation()) or a plain Node script like
// scripts/check-data.mjs (via src/data/verification.js importing this
// file directly -- see that file's own comment).
//
// resources are bundled into the JS, not fetched -- no separate network
// request, no interaction with the service worker's precache manifest.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';

const resources = {
  en: { translation: en },
};

export const LANGUAGE_STORAGE_KEY = 'kfm-language';

// The Node scripts that reach this module (check-data, prerender-places,
// via src/data/verification.js) have no localStorage -- guard, don't
// assume a browser. An unrecognised stored value (stale key, hand-edited)
// falls back rather than selecting a language that isn't registered.
function storedLanguage() {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && Object.hasOwn(resources, stored) ? stored : null;
}

i18next.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes -- avoid double-escaping
  },
});
