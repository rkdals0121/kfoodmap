import { useEffect, useMemo, useState } from 'react';
import { pairEvidence } from '../data/evidence-pairing';

// Fetches one place's full record (with the evidence text the bundle leaves
// out — scripts/lib/client-data.mjs) and returns a WeakMap from each of the
// place's bundled facts to its evidence. Empty until the fetch lands, and
// empty for good if it fails (offline before the place was ever opened, or a
// captive portal answering with its own page): the detail view then shows the
// generic explanation for each badge instead, which is what it showed before
// any evidence existed.
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

export default function usePlaceEvidence(place) {
  const [full, setFull] = useState(() => (place ? cache.get(place.id) ?? null : null));
  const id = place?.id;

  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setFull(cache.get(id) ?? null);
    load(id).then(r => { if (live) setFull(r); }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  return useMemo(() => pairEvidence(place, full), [place, full]);
}
