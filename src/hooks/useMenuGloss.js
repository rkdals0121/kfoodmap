import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

// What each menu item is, in the reader's language (data/menu-<lang>.js):
// a few words under the name as the restaurant writes it. Most names are
// Korean, so there is an English file too — for the names that carry no
// English of their own, and a Korean one for the few recorded in English
// alone. Null until the file has
// arrived; the name alone shows meanwhile.
const LOADERS = {
  en: () => import('../data/menu-en.js'),
  // Korean: only for the names recorded in English alone.
  ko: () => import('../data/menu-ko.js'),
  ja: () => import('../data/menu-ja.js'),
  'zh-Hans': () => import('../data/menu-zh-Hans.js'),
  'zh-Hant': () => import('../data/menu-zh-Hant.js'),
  id: () => import('../data/menu-id.js'),
};
const cache = new Map();
const pending = new Set();
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function load(lang) {
  if (!LOADERS[lang] || cache.has(lang) || pending.has(lang)) return;
  pending.add(lang);
  LOADERS[lang]()
    .then((m) => { cache.set(lang, m.MENU); })
    // Offline with the file not yet stored: asked again when back online.
    .catch(() => {})
    .finally(() => { pending.delete(lang); listeners.forEach(fn => fn()); });
}

// `wanted`: only a place page that shows a menu asks for the file.
export function useMenuGloss(wanted) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const glosses = useSyncExternalStore(subscribe, () => cache.get(lang) ?? null, () => null);
  useEffect(() => {
    if (!wanted) return undefined;
    load(lang);
    const again = () => load(lang);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [lang, wanted]);
  return glosses;
}
