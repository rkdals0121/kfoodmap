import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// The places' stories in the language of the interface (data/story-*.js),
// fetched the first time that language is used and kept for the visit.
// Null in English — the records' own text — and until the file has
// arrived: the English shows meanwhile.
const LOADERS = {
  ko: () => import('../data/story-ko.js'),
  ja: () => import('../data/story-ja.js'),
  'zh-Hans': () => import('../data/story-zh-Hans.js'),
  'zh-Hant': () => import('../data/story-zh-Hant.js'),
  id: () => import('../data/story-id.js'),
};
const cache = new Map();
const pending = new Map();

export function useStories() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const [, arrived] = useState(0);
  useEffect(() => {
    if (!LOADERS[lang] || cache.has(lang)) return undefined;
    let live = true;
    if (!pending.has(lang)) {
      pending.set(lang, LOADERS[lang]()
        .then((m) => { cache.set(lang, m.STORIES); return true; })
        // Offline with the file not yet stored: asked again next time.
        .catch(() => { pending.delete(lang); return false; }));
    }
    pending.get(lang).then((ok) => { if (live && ok) arrived(n => n + 1); });
    return () => { live = false; };
  }, [lang]);
  return cache.get(lang) ?? null;
}
