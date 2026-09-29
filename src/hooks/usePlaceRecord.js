import { useEffect, useState } from 'react';

// Fetches one place's full record from /place-data/<id>.json — the fields
// the bundle leaves out (evidence text, menus, transit, phone, links,
// timeline; see scripts/lib/client-data.mjs). Returns null until it lands,
// and null for good if the fetch fails (offline before the place was ever
// opened, or a captive portal answering with its own page): the detail view
// then renders from the bundled record, which has every badge, the address,
// the hours and the story, and simply omits the sections it lacks.
const cache = new Map();    // id → full record
const inFlight = new Map(); // id → promise, so two opens share one request

function load(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (!inFlight.has(id)) {
    inFlight.set(id, (async () => {
      const res = await fetch(`/place-data/${encodeURIComponent(id)}.json`);
      if (!res.ok) throw new Error(`place-data ${id}: ${res.status}`);
      const full = await res.json();
      if (full?.id !== id) throw new Error(`place-data ${id}: wrong record`);
      cache.set(id, full);
      return full;
    })().finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

export default function usePlaceRecord(place) {
  const id = place?.id;
  const [full, setFull] = useState(() => (id ? cache.get(id) ?? null : null));

  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setFull(cache.get(id) ?? null);
    load(id).then(r => { if (live) setFull(r); }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  return full?.id === id ? full : null;
}

// Fetch the full records of places someone has saved, so their detail pages
// work offline too: the service worker keeps every /place-data/ response it
// sees (vite.config.js, `kfm-place-data`). Same-origin requests for public
// data — nothing about the person is sent. One at a time, when the browser
// is idle and online, and never twice in a session.
const prefetched = new Set();
export function prefetchPlaceRecords(ids) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const todo = ids.filter(id => !prefetched.has(id) && !cache.has(id));
  if (todo.length === 0) return;
  todo.forEach(id => prefetched.add(id));
  const idle = typeof requestIdleCallback === 'function'
    ? (fn) => requestIdleCallback(fn, { timeout: 5000 })
    : (fn) => setTimeout(fn, 1500);
  const next = () => {
    const id = todo.shift();
    if (!id) return;
    load(id).catch(() => { prefetched.delete(id); }).finally(() => idle(next));
  };
  idle(next);
}
