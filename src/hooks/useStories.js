import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

// The places' stories in the language of the interface (data/story-*.js),
// fetched the first time that language needs them and kept for the visit.
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
const pending = new Set();
// Asked for and answered, one way or the other.
const settled = new Set();
// Everything showing a story hears of an arrival, whichever of them asked.
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function loadStories(lang) {
  if (!LOADERS[lang] || cache.has(lang) || pending.has(lang)) return;
  pending.add(lang);
  LOADERS[lang]()
    .then((m) => { cache.set(lang, m.STORIES); })
    // Offline with the file not yet stored: asked again when back online.
    .catch(() => {})
    .finally(() => { pending.delete(lang); settled.add(lang); listeners.forEach(fn => fn()); });
}

// `wanted` false: read what is already here without asking for the file (a
// list card only shows its line under a sustainability chip).
export function useStories(wanted = true) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const stories = useSyncExternalStore(subscribe, () => cache.get(lang) ?? null, () => null);
  useEffect(() => {
    if (!wanted) return undefined;
    loadStories(lang);
    const again = () => loadStories(lang);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [lang, wanted]);
  return stories;
}

// True while this language's stories are still on their way: a story can
// then hold back, instead of showing the record's English and changing
// under the reader's eyes a moment later. False in English, once the file
// is in, and once it has failed (the English shows then).
export function useStoriesWaiting() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useSyncExternalStore(subscribe, () => Boolean(LOADERS[lang] && !cache.has(lang) && !settled.has(lang)), () => false);
}
