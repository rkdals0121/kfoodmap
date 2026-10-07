import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { noteShard } from '../data/note-shard';

// The research notes under "Why?" in the language of the interface
// (data/notes/notes-<lang>-<n>.js). Sixteen files per language: a place page
// fetches the one its place is in. Null until it has arrived, and in a
// language with no translation: the record's own English shows.
const FILES = import.meta.glob('../data/notes/notes-*.js');

const cache = new Map();
const pending = new Set();
// Files that have arrived or failed: nothing more is coming for them now.
const settled = new Set();
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function load(key) {
  const file = FILES[`../data/notes/notes-${key}.js`];
  if (!file || cache.has(key) || pending.has(key)) return;
  pending.add(key);
  file()
    .then((m) => { cache.set(key, m.NOTES); })
    // Offline with the file not yet stored: asked again when back online.
    .catch(() => {})
    .finally(() => { pending.delete(key); settled.add(key); listeners.forEach(fn => fn()); });
}

export function useNotes(placeId) {
  const { i18n } = useTranslation();
  const key = placeId ? `${i18n.language}-${noteShard(placeId)}` : null;
  const notes = useSyncExternalStore(subscribe, () => (key && cache.get(key)?.[placeId]) || null, () => null);
  useEffect(() => {
    if (!key) return undefined;
    load(key);
    const again = () => load(key);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [key]);
  return notes;
}

// Whether the notes for this place in this language are still on their
// way. While they are, a line that would show the record's English and
// then change under the reader's eyes can hold back instead.
export function useNotesWaiting(placeId) {
  const { i18n } = useTranslation();
  const key = placeId ? `${i18n.language}-${noteShard(placeId)}` : null;
  return useSyncExternalStore(subscribe, () => Boolean(key && FILES[`../data/notes/notes-${key}.js`] && !settled.has(key)), () => false);
}
