// A lead is a user submission waiting for a person to verify it — never a
// fact. Nothing in this module (or anywhere) writes a lead into
// restaurants.js; accepted leads go through the Phase 3 verification by
// hand. Shared by the /submit form and scripts/leads.mjs.
import { isQuarantined } from './verification.js';

export const LEAD_TOPICS = ['vegan', 'halal', 'hours', 'closed', 'address', 'other'];

// Mirrors the CHECK constraints in supabase/leads.sql. The database is the
// real limit; these exist so the form can say which field is wrong.
export const LEAD_LIMITS = {
  name: 120,
  location_hint: 200,
  message: 2000,
  source_url: 500,
  contact_email: 200,
};

export const SELECTION_LIMITS = { kakao_place_id: 40, kakao_address: 200 };

const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

// Quarantined places are excluded from every discovery surface (§2.14); a
// correction form for one would be another such surface.
export function resolvePlace(placeId, restaurants) {
  if (!placeId) return null;
  const place = restaurants.find(r => r.id === placeId);
  return place && !isQuarantined(place) ? place : null;
}

// Number(...) coerces '', ' ', null, [] and true to a "valid" finite number
// (0, 0, 0, 0, 1) — that would let a missing coordinate through as a
// real-looking point in the Gulf of Guinea. This function only guards the
// two shapes worth distinguishing: a value already typed as a number (our
// own JSON parse, or a caller passing one through) is returned as-is —
// toCoord does not itself re-check that it's finite or in range, that's
// normalizeSelection's Number.isFinite() + lat/lng bounds check below — and
// a string counts only if it is *entirely* numeric, the shape Kakao's API
// actually sends. Everything else, including a partially-numeric string
// (a shape Kakao has never sent; this field is always the submitter's pick,
// labelled unverified either way), is NaN and gets dropped downstream.
function toCoord(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
  }
  return NaN;
}

// A picked suggestion is data from Kakao by way of the browser, so it is
// checked the same way a typed field is: anything malformed or out of
// range is dropped entirely rather than sent half-valid. Dropping it costs
// the reviewer a lookup; sending a bad coordinate costs them trust in the
// whole column.
function normalizeSelection(selection) {
  const empty = { kakao_place_id: null, kakao_address: null, kakao_lat: null, kakao_lng: null };
  if (!selection) return empty;
  // clean() assumes a string-ish input and throws on a number/array/object;
  // a suggestion is never allowed to crash the form, so non-strings are
  // simply treated as missing rather than passed to clean().
  const id = typeof selection.id === 'string' ? clean(selection.id) : null;
  const address = typeof selection.address === 'string' ? clean(selection.address) : null;
  const lat = toCoord(selection.lat);
  const lng = toCoord(selection.lng);
  const ok = id && id.length <= SELECTION_LIMITS.kakao_place_id
    && (!address || address.length <= SELECTION_LIMITS.kakao_address)
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  return ok ? { kakao_place_id: id, kakao_address: address, kakao_lat: lat, kakao_lng: lng } : empty;
}

export function buildLead(form, { place = null, lang = 'en', selection = null } = {}) {
  if (clean(form.website)) return { ok: false, spam: true, errors: {} };

  const picked = place ? normalizeSelection(null) : normalizeSelection(selection);

  const row = {
    kind: place ? 'correction' : 'new',
    place_id: place ? place.id : null,
    name: place ? place.name : clean(form.name),
    location_hint: place ? null : (clean(form.locationHint) ?? picked.kakao_address),
    topic: form.topic,
    message: clean(form.message),
    source_url: clean(form.sourceUrl),
    contact_email: clean(form.contactEmail),
    lang,
    ...picked,
  };

  const errors = {};
  if (!row.name) errors.name = { code: 'required' };
  if (!LEAD_TOPICS.includes(row.topic)) errors.topic = { code: 'invalidTopic' };
  if (!row.message) errors.message = { code: 'required' };
  if (row.source_url && !URL_PATTERN.test(row.source_url)) errors.source_url = { code: 'invalidUrl' };
  if (row.contact_email && !EMAIL_PATTERN.test(row.contact_email)) errors.contact_email = { code: 'invalidEmail' };
  for (const [column, max] of Object.entries(LEAD_LIMITS)) {
    if (!errors[column] && row[column] && row[column].length > max) errors[column] = { code: 'tooLong', max };
  }

  return Object.keys(errors).length > 0 ? { ok: false, spam: false, errors } : { ok: true, row };
}

// Supabase's dashboard shows the "API URL" as https://<ref>.supabase.co/rest/v1/
// — people paste that whole thing, not just the origin. Normalize to the
// origin alone so callers can always append /rest/v1/... themselves without
// doubling the path. Returns null for anything that isn't a parseable
// http(s) URL (scripts/leads.mjs and the form both treat that as "not
// configured").
export function parseSupabaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
}

// Absent in forks and env-less previews; the form says so instead of
// failing on send.
export function supabaseConfig(env) {
  const rawUrl = env?.VITE_SUPABASE_URL?.trim();
  const anonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) return null;
  const url = parseSupabaseUrl(rawUrl);
  return url ? { url, anonKey } : null;
}

// Supabase's legacy keys are JWTs and are also sent as a Bearer token. The
// newer sb_publishable_/sb_secret_ keys are not JWTs and are rejected in
// Authorization, so they go in apikey only.
export function authHeaders(key) {
  return key.startsWith('eyJ')
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}

export async function submitLead(row, { url, anonKey }, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...authHeaders(anonKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    return response.status === 201 ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
