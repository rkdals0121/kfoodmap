// Pure helpers for api/place-search.js — no I/O, so they can be tested
// without a server. Kakao's request shape (host, path, header, size 1-15)
// is from its current Local API docs, checked 2026-09-18.

export const MIN_QUERY = 2;
export const MAX_QUERY = 50;
export const RESULT_LIMIT = 5;

export function validateQuery(raw) {
  const query = typeof raw === 'string' ? raw.trim() : '';
  if (query.length < MIN_QUERY) return { ok: false, code: 'tooShort' };
  if (query.length > MAX_QUERY) return { ok: false, code: 'tooLong' };
  return { ok: true, query };
}

export function kakaoSearchUrl(query) {
  const params = new URLSearchParams({ query, size: String(RESULT_LIMIT) });
  return `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
}

// Only the fields the lead needs. Kakao also returns phone and place_url;
// those are not ours to collect on a submitter's behalf, so they stop here.
// A document without a usable id, name or coordinate pair is dropped rather
// than passed on half-formed — the form treats an empty list as "no
// suggestions", which is already a supported state.
export function mapKakaoDocuments(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  return documents
    .map(doc => {
      const lat = Number.parseFloat(doc?.y);
      const lng = Number.parseFloat(doc?.x);
      return {
        id: typeof doc?.id === 'string' ? doc.id : '',
        name: typeof doc?.place_name === 'string' ? doc.place_name : '',
        address: doc?.road_address_name || doc?.address_name || '',
        lat, lng,
        category: typeof doc?.category_name === 'string' ? doc.category_name : '',
      };
    })
    .filter(row => row.id && row.name && Number.isFinite(row.lat) && Number.isFinite(row.lng))
    .slice(0, RESULT_LIMIT);
}
