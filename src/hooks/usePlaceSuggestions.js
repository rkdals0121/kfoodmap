import { useState, useEffect } from 'react';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

// Suggestions are a convenience: every failure path here ends in an empty
// list, never an error the submitter has to deal with. The request is
// debounced and the previous one aborted, so typing fast costs one call.
export function usePlaceSuggestions(query, enabled) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const text = query.trim();
    if (!enabled || text.length < MIN_QUERY) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/place-search?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const body = response.ok ? await response.json() : null;
        setResults(Array.isArray(body?.results) ? body.results : []);
      } catch {
        // An aborted fetch (a newer keystroke superseding this one) lands
        // here too — checking the signal keeps "don't write a stale
        // result" a local, explicit invariant instead of one that happens
        // to hold only because of timing between this catch and the next
        // effect run.
        if (controller.signal.aborted) return;
        setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, enabled]);

  return { results };
}
