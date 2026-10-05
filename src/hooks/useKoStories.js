import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// The places' stories in Korean (data/story-ko.js), fetched the first time
// the interface is in Korean and kept for the visit. Null in any other
// language and until it has arrived: the English text shows meanwhile.
let cache = null;
let pending = null;

export function useKoStories() {
  const { i18n } = useTranslation();
  const on = i18n.language === 'ko';
  const [stories, setStories] = useState(cache);
  useEffect(() => {
    if (!on || cache) return undefined;
    let live = true;
    pending ??= import('../data/story-ko.js')
      .then((m) => { cache = m.STORY_KO; return cache; })
      // Offline with the file not yet stored: asked again next time.
      .catch(() => { pending = null; return null; });
    pending.then((found) => { if (live && found) setStories(found); });
    return () => { live = false; };
  }, [on]);
  return on ? (stories ?? cache) : null;
}
