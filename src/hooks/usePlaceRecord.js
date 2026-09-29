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
