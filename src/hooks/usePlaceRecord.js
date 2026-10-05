import { useCallback, useEffect, useState } from 'react';

// Fetches one place's full record from /place-data/<id>.json — the fields
// the bundle leaves out (evidence text, menus, transit, phone, links,
// timeline; see scripts/lib/client-data.mjs). `full` is null until it lands;
// if the fetch fails (offline before the place was ever opened, a stalled
// connection, a captive portal answering with its own page) `failed` is set
// and `retry` asks again. The detail view meanwhile renders from the bundled
// record, which has every badge, the address, the hours and the story, and
// simply omits the sections it lacks.
const cache = new Map();    // id → full record
const inFlight = new Map(); // id → promise, so two opens share one request

// A connection that stalls gives no answer at all; without a limit the
// "Loading…" line stayed for good.
const TIMEOUT_MS = 10000;

function load(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (!inFlight.has(id)) {
    inFlight.set(id, (async () => {
      const abort = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = abort ? setTimeout(() => abort.abort(), TIMEOUT_MS) : null;
      try {
        const res = await fetch(`/place-data/${encodeURIComponent(id)}.json`, abort ? { signal: abort.signal } : undefined);
        if (!res.ok) throw new Error(`place-data ${id}: ${res.status}`);
        const full = await res.json();
        if (full?.id !== id) throw new Error(`place-data ${id}: wrong record`);
        cache.set(id, full);
        return full;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })().finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

export default function usePlaceRecord(place) {
  const id = place?.id;
  const [full, setFull] = useState(() => (id ? cache.get(id) ?? null : null));
  // The id it failed for: the sheet is reused from place to place, and the
  // next one opened with the last one's "could not load".
  const [failedId, setFailedId] = useState(null);
  const failed = failedId !== null && failedId === id;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setFull(cache.get(id) ?? null);
    setFailedId(null);
    load(id).then(r => { if (live) setFull(r); }).catch(() => { if (live) setFailedId(id); });
    return () => { live = false; };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  // The connection coming back asks again by itself.
  useEffect(() => {
    if (!failed) return undefined;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failed, retry]);

  // A record already fetched is returned at once, not a render later: a
  // page come back to is restored to a scroll position, and without its
  // menu and transit the page was too short to hold it.
  return { full: full?.id === id ? full : (id && cache.get(id)) || null, failed, retry };
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
