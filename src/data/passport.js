// The passport: which places a person saved, and which they have been to.
//
// savedAt === null is a TOMBSTONE, not "missing". It is the only reason a
// delete made on one device survives contact with another device that
// still remembers the place as saved. Drop tombstones and deletions come
// back — the failure this shape exists to prevent.
//
// updatedAt === 0 means "we do not know when this happened" — the shape
// written before sync existed. It loses every merge against a real
// timestamp, which is the honest outcome rather than a coin flip.
import { authHeaders } from './leads.js';

export const PASSPORT_KEY = 'kfm-bookmarks';

// Who the passport on this device belongs to. Stored beside the passport
// rather than inside it so `kfm-bookmarks` keeps the shape — and the legacy
// migrations — it already has. Absent means anonymous: either a passport
// built while signed out, or one written before this key existed.
export const PASSPORT_OWNER_KEY = 'kfm-passport-owner';

export function normalizeEntry(raw) {
  if (typeof raw === 'string') return { id: raw, savedAt: 0, visitedAt: null, updatedAt: 0 };
  if (!raw || typeof raw.id !== 'string') return null;
  const savedAt = raw.savedAt === null ? null : (raw.savedAt ?? 0);
  const visitedAt = savedAt === null ? null : (raw.visitedAt ?? null);
  const updatedAt = raw.updatedAt ?? (savedAt ?? 0);
  return { id: raw.id, savedAt, visitedAt, updatedAt };
}

export function loadLocalPassport() {
  try {
    const stored = JSON.parse(localStorage.getItem(PASSPORT_KEY));
    return Array.isArray(stored) ? stored.map(normalizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// A refused write (private mode, storage full) must not break the tap that
// caused it: the place stays saved for this visit, in memory.
export function saveLocalPassport(entries) {
  try {
    localStorage.setItem(PASSPORT_KEY, JSON.stringify(entries));
    keeps = true;
  } catch { keeps = false; /* kept in memory only */ }
}

// Whether this browser keeps what is saved. Where it does not (Safari with
// all cookies blocked, some in-app browsers, storage full) the toast must
// not say "It opens offline too": the place is gone with the page.
// (Known from the last write: the passport is written when the app starts,
// so no key of its own is needed to find out.)
let keeps = true;
export const storageKeeps = () => keeps;

export function clearLocalPassport() {
  try {
    localStorage.removeItem(PASSPORT_KEY);
  // The owner goes with the passport, always. They are one fact — "this
  // device holds X's places" — and a clear that left the owner behind would
  // claim the next person's empty passport belonged to the last person.
    localStorage.removeItem(PASSPORT_OWNER_KEY);
  } catch { /* nothing was stored */ }
}

export function loadPassportOwner() {
  try {
    return localStorage.getItem(PASSPORT_OWNER_KEY);
  } catch {
    return null;
  }
}

// Compared against null explicitly rather than tested for truthiness: an
// empty-string id is not a Supabase user id and cannot occur, but `!userId`
// would quietly delete the key for one, which is the opposite of storing it.
export function savePassportOwner(userId) {
  try {
    if (userId === null || userId === undefined) {
      localStorage.removeItem(PASSPORT_OWNER_KEY);
      return;
    }
    localStorage.setItem(PASSPORT_OWNER_KEY, userId);
  } catch { /* storage refused */ }
}

// The single question "is the passport on this device this person's?", asked
// identically on load and on an in-session account switch. Two places
// answering it separately is the drift that produced the cross-account push
// this guard exists to stop, so there is one answer and both callers use it.
//
// An absent owner is anonymous and merges: that is the operator's union-merge
// decision (someone who saved places before signing in keeps them), and it is
// also every device upgrading to this version, where the key does not exist
// yet. Treating those as "unknown, therefore destroy" would wipe the passport
// of everyone who already had one, to defend against a case that is
// overwhelmingly just a person's own phone.
export function passportBelongsTo(owner, userId) {
  return owner === null || owner === undefined || owner === userId;
}

// Whether a session on this device most recently ended on its own — an
// expired or revoked token, or a sign-out in another tab — rather than
// never having existed or having just been renewed. Persisted so the
// explanation survives a reload: `sessionEnded` is otherwise plain React
// state, and a reload of a device whose token expired minutes ago finds no
// transition to react to (see usePassportSync's userId effect), so without
// this the notice that told the person why their Journal is empty goes
// silent the moment they refresh the page that is showing them the empty
// Journal.
const SESSION_ENDED_KEY = 'kfm-session-ended';

export function loadSessionEnded() {
  try {
    return localStorage.getItem(SESSION_ENDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSessionEnded(ended) {
  try {
    if (ended) localStorage.setItem(SESSION_ENDED_KEY, '1');
    else localStorage.removeItem(SESSION_ENDED_KEY);
  } catch {
    // Best-effort: a device that cannot write localStorage cannot persist
    // the passport either, and this notice is not worth failing louder than
    // that existing limitation.
  }
}

export function savedOnly(entries) {
  return entries.filter(e => e.savedAt !== null);
}

// Per place, the later write wins. On a tie the saved side wins: an equal
// timestamp is not evidence that the person meant to delete.
export function mergePassport(local, remote) {
  const byId = new Map();
  for (const raw of [...local, ...remote]) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    const held = byId.get(entry.id);
    if (!held) { byId.set(entry.id, entry); continue; }
    if (entry.updatedAt > held.updatedAt) { byId.set(entry.id, entry); continue; }
    if (entry.updatedAt === held.updatedAt && held.savedAt === null && entry.savedAt !== null) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}

// `Date.parse` of a malformed timestamp is NaN, not null, and NaN slips
// straight past `??`. Unguarded that is two failures at once: NaN reaches
// `saveLocalPassport`, where `JSON.stringify({ savedAt: NaN })` writes
// `null` — silently turning a saved place into a tombstone on the next load
// — and `new Date(NaN).toISOString()` throws RangeError on the way to the
// server. Anything that is not a finite number is "we do not know", which is
// what `null` already means here.
//
// A string date string is the one case that is NOT "we do not know":
// `Number('2026-01-01')` is NaN (Number does not parse date strings), but
// `Date.parse('2026-01-01')` reads it correctly — and did, before this guard
// existed. `kfm-bookmarks` is plain localStorage JSON, reachable by a
// hand-edit or a future migration that writes ISO strings instead of
// millisecond numbers; without this fallback such an entry's `savedAt`
// becomes null here, turns into a tombstone in `toRow`, and that tombstone
// then merges onto every device — a place the person still has saved,
// silently unsaved everywhere, from a value that was perfectly readable.
// The fallback is string-only and tried only after `Number()` fails, so it
// can never change the answer for an actual number — `Number.isFinite(0)`
// is still `true` and `savedAt: 0` ("saved at an unknown time") still reads
// as epoch, not as this fallback.
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const iso = value => {
  const number = finite(value);
  return number === null ? null : new Date(number).toISOString();
};
const ms = value => (value ? finite(Date.parse(value)) : null);

export function toRow(userId, entry) {
  return {
    user_id: userId,
    place_id: entry.id,
    saved_at: iso(entry.savedAt),
    visited_at: iso(entry.visitedAt),
    // `updated_at` is `not null` in supabase/passports.sql (see the table
    // definition) — unlike saved_at/visited_at, it can never cross the wire
    // as null. `entry.updatedAt ?? 0` only catches a missing field; it lets
    // a NaN or unparseable value straight through to `iso`, which returns
    // null for anything `finite` cannot read. One such row fails the whole
    // batch with a 400, because pushPassport sends the entire delta as one
    // array. Fall back to the epoch specifically for this column — it
    // already means "time unknown" everywhere else `updatedAt` is read.
    updated_at: iso(entry.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function fromRow(row) {
  return normalizeEntry({
    id: row.place_id,
    savedAt: ms(row.saved_at),
    visitedAt: ms(row.visited_at),
    updatedAt: ms(row.updated_at) ?? 0,
  });
}

// The anon key stays in `apikey` (PostgREST needs it to route); the user's
// JWT is the Bearer token, and it is what RLS reads. Sending the anon key
// as Bearer would make every request anonymous and silently return nothing.
function userHeaders(anonKey, accessToken) {
  return { ...authHeaders(anonKey), Authorization: `Bearer ${accessToken}` };
}

// A connection that stalls gives no answer at all: after 10 s the request
// is given up, which every caller already treats as a failure to retry.
const SYNC_TIMEOUT_MS = 10000;
const bounded = (fetchImpl) => async (url, init) => {
  if (typeof AbortController !== 'function') return fetchImpl(url, init);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
};

export async function pullPassport({ url, anonKey }, accessToken, fetchImpl = fetch) {
  try {
    const response = await bounded(fetchImpl)(
      `${url}/rest/v1/passports?select=place_id,saved_at,visited_at,updated_at`,
      { headers: userHeaders(anonKey, accessToken) },
    );
    if (!response.ok) return { ok: false, entries: [] };
    // The limit above ends with the headers; a body that stalls would wait
    // for good, and the sync with it.
    const rows = await Promise.race([
      response.json(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), SYNC_TIMEOUT_MS)),
    ]);
    return { ok: true, entries: rows.map(fromRow).filter(Boolean) };
  } catch {
    return { ok: false, entries: [] };
  }
}

export async function pushPassport(entries, { url, anonKey }, accessToken, userId, fetchImpl = fetch) {
  if (entries.length === 0) return { ok: true, status: 0 };
  try {
    const response = await bounded(fetchImpl)(`${url}/rest/v1/passports`, {
      method: 'POST',
      headers: {
        ...userHeaders(anonKey, accessToken),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(entries.map(e => toRow(userId, e))),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// The filter below is a scope, not the security boundary: RLS on the
// `passports` table restricts every request to rows where user_id matches
// the JWT's auth.uid(), so a malformed or malicious userId cannot reach
// another person's rows. encodeURIComponent just keeps a stray `&` or `%`
// in userId from silently corrupting the query string.
export async function deleteAllPassport({ url, anonKey }, accessToken, userId, fetchImpl = fetch) {
  try {
    const response = await bounded(fetchImpl)(`${url}/rest/v1/passports?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: userHeaders(anonKey, accessToken),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
