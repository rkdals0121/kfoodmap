import { useCallback, useEffect, useRef, useState } from 'react';
import { authClientNeededNow, authRefusedInUrl, authReturnInUrl, createAuthClient, googleEnabled } from '../data/auth.js';
import { supabaseConfig } from '../data/leads.js';
import {
  clearLocalPassport,
  deleteAllPassport,
  loadPassportOwner,
  loadSessionEnded,
  mergePassport,
  passportBelongsTo,
  pullPassport,
  pushPassport,
  savePassportOwner,
  saveSessionEnded,
} from '../data/passport.js';

// Sync is strictly additive to the local passport: localStorage is written
// first and is never rolled back by a failed request. Signed out, this hook
// makes no network call at all — the passport endpoints are only touched
// with a user token, and `googleEnabled` is the only anonymous request,
// made once to decide whether a sign-in row can exist.
const PUSH_DEBOUNCE_MS = 1000;

// A pull that fails leaves `pushedRef` null, and a null `pushedRef` closes
// the push gate for the rest of the session: nothing re-triggers a reconcile
// until the account changes, `navigator.onLine` flips, or the page reloads.
// `navigator.onLine` is exactly the signal that does not notice a hotel
// captive portal, which is this app's target environment — so one 500, or
// one portal answering the pull with its own login page, would silence sync
// entirely. Bounded on purpose: the initial attempt plus three retries —
// four pulls total — over ~40 seconds, then stop.
// A device that is still broken after that will reconcile on the next
// reconnect or reload, and a retry loop that never gives up is a battery
// drain and a request storm on a server that is already unwell.
const RETRY_DELAYS_MS = [2000, 8000, 30000];

// Content identity, not array identity. The debounced push has to recognise
// the list a reconcile just committed, and reconcile commits it through a
// functional updater whose result it never holds by reference — so "have we
// already sent this?" can only be asked about the contents.
export function passportSignature(entries) {
  return JSON.stringify(
    [...entries]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(e => [e.id, e.savedAt, e.visitedAt, e.updatedAt]),
  );
}

// The entries a push actually has to send: those whose serialised form is
// not already in what `pushedRef` records as delivered.
//
// This is the client half of the stale-write fix. PostgREST's upsert is
// unconditional last-writer-wins on the whole row, so sending the entire
// local list makes every heart tap a re-assertion of every other place the
// list holds — including places another device changed since this tab last
// reconciled. One tap on the laptop would then overwrite the phone's
// tombstone with this morning's save, permanently undoing an unsave. A
// locally-changed entry always carries a fresh `Date.now()`, so an entry
// freshly added to this diff cannot overwrite anything at push time — but a
// FAILED push leaves it in the diff, unpushed, riding along with whatever
// local change comes next. By the time that next push goes out, another
// device may have written a newer value in between: laptop saves at 10:00,
// the push fails; phone tombstones the same place at 11:00 and that push
// succeeds; laptop taps something unrelated at 12:00 and re-sends its stale
// 10:00 save alongside it. This diff does not — cannot — see that the 10:00
// entry is now stale; it only knows it was never confirmed delivered. The
// `passports_keep_latest` trigger (supabase/passports.sql) is what catches
// that case: it is the only defence for a failed-then-retried push, not a
// backstop behind one this diff already provides.
//
// The signature is JSON of sorted [id, savedAt, visitedAt, updatedAt]
// tuples, which parses straight back into what was delivered — the diff
// needs no second bookkeeping structure to drift out of step with the gate.
// An unparseable or absent signature means "nothing is known to be
// delivered", which sends everything: the same list today's code sends, so
// the fallback is never worse than the behaviour it replaces.
export function passportDelta(entries, pushedSignature) {
  const delivered = new Map();
  try {
    const parsed = JSON.parse(pushedSignature);
    if (Array.isArray(parsed)) {
      for (const tuple of parsed) delivered.set(tuple[0], JSON.stringify(tuple));
    }
  } catch {
    // Nothing delivered, so nothing is filtered out below.
  }
  return entries.filter(
    e => delivered.get(e.id) !== JSON.stringify([e.id, e.savedAt, e.visitedAt, e.updatedAt]),
  );
}

// Where the OAuth round trip comes back to. `window.location.origin` drops
// the page: someone who signs in from `/place/gonghwachun` lands on the map
// and has to find the place again.
//
// Path only — the query string and the hash are deliberately left off.
// auth-js appends its own parameters to this URL (`?code=…` for PKCE, and
// `#error=…` when the provider refuses), so a URL that already carries a
// query or a fragment comes back either mangled or with the app's own
// parameters silently outranked by the auth ones. The path is the part
// worth keeping, and it is the part that survives the append cleanly.
//
// Supabase's redirect allow-list must permit these paths — a wildcard such
// as `https://<site>/**` — or the provider returns to the site root anyway.
export function signInReturnTo(location = window.location) {
  return `${location.origin}${location.pathname}`;
}

// Pull, then merge the remote rows into whatever state actually holds.
//
// `isCurrent()` is the whole safety story of this function. Every await is a
// window in which the user can sign out, switch account, or confirm "delete
// my saved places" — and this continuation is holding rows that were true
// before that happened. Writing them back would resurrect records the user
// was told could not come back, or push one person's passport into the next
// person's account on a shared device. So the generation is checked after
// the pull and before anything is written anywhere.
//
// It deliberately does NOT push. React runs a functional updater during the
// next render, not at the call, so nothing here can know the merged list —
// and a merge computed from a snapshot instead would be exactly the stale
// value the updater exists to avoid. Both sides are brought level by the
// debounced push instead: `onRemote` reports what the server currently
// holds, and the push effect sends the committed list whenever it differs.
//
// Extracted from the hook and given an injectable `fetchImpl` so the
// staleness guard and the merge are testable without a React renderer.
export async function reconcilePassport({ config, session, setEntries, isCurrent, onRemote, fetchImpl }) {
  if (!config || !session) return { ok: false, reason: 'no-session' };

  const pulled = await pullPassport(config, session.access_token, fetchImpl);
  if (!pulled.ok) return { ok: false, reason: 'pull-failed' };
  if (!isCurrent()) return { ok: false, reason: 'stale' };

  // Reported before the commit so the push effect, which re-runs the moment
  // the commit lands, already knows what the server has.
  onRemote?.(pulled.entries);

  // A functional updater, not a plain value: a merge computed from a snapshot
  // would land after any updater queued by a heart tap in the same frame and
  // silently overwrite it — losing the tap from state, from localStorage and
  // from the server at once.
  setEntries(prev => mergePassport(prev, pulled.entries));
  return { ok: true, reason: 'merged' };
}

export default function usePassportSync({ entries, setEntries, isOnline }) {
  // Read once per mount. The wrapper object is what distinguishes "not read
  // yet" from "read, and there is no config" — supabaseConfig answers null on
  // an unconfigured deploy and null is a legitimate answer.
  const setupRef = useRef(null);
  if (setupRef.current === null) {
    setupRef.current = { config: supabaseConfig(import.meta.env) };
  }
  const { config } = setupRef.current;

  // The auth client is no longer built at mount. `@supabase/auth-js` is ~105
  // kB raw / ~27 kB gzip and almost nobody signs in, so it is imported only
  // when one of the three cases in data/auth.js actually applies. Held in
  // state rather than a ref because the subscribe effect below is keyed on it
  // and has to re-run when it arrives; the ref holds the in-flight import so
  // two callers cannot build two clients on the same storage key.
  const [client, setClient] = useState(null);
  const clientPromiseRef = useRef(null);
  const ensureClient = useCallback(() => {
    if (!config) return Promise.resolve(null);
    if (clientPromiseRef.current === null) {
      const attempt = Promise.resolve(createAuthClient(config))
        .then(next => {
          setClient(next);
          return next;
        })
        // A chunk that will not load must leave the app exactly as it is
        // signed out, not throw out of a click handler. But it must also not
        // leave it that way FOREVER: the failure is cleared from the ref so
        // the next caller retries rather than being handed this same dead
        // promise. Three reachable failures, all inside one page view, and
        // none of them permanent conditions:
        //
        //   offline cold start   the chunk is deliberately not precached
        //                        (vite.config.js), so a signed-in visitor who
        //                        opens the app with no connectivity fails
        //                        here. Caching it forever would mean `userId`
        //                        stays null and sync is dead for the session
        //                        even after the connection comes back.
        //   captive portal       the hotel splash page answers the chunk
        //                        request with its own HTML and the import
        //                        fails on MIME. This file's own comments name
        //                        that network as the target environment.
        //   stale hashed asset   a deploy replaced the file this page's entry
        //                        chunk names; a reload fixes it, but only if
        //                        the ref does not hold the failure.
        //
        // `config` is checked above, so a null resolution here is
        // unambiguously a failure rather than "nothing to build".
        .catch(() => null)
        .then(next => {
          if (next === null && clientPromiseRef.current === attempt) {
            clientPromiseRef.current = null;
          }
          return next;
        });
      clientPromiseRef.current = attempt;
    }
    return clientPromiseRef.current;
  }, [config]);

  // Case 1 (a stored session) and case 3 (a return from Google) both have to
  // be answered on this load without anyone pressing anything. Both are
  // decided from localStorage and the URL, neither of which needs the
  // library. Case 2 is `signIn` below.
  //
  // `isOnline` is in the deps so a reconnect re-asks. It is the only signal
  // this hook has that a failed chunk load might now succeed — and after the
  // retry above cleared the ref, re-running this effect is what actually
  // spends it.
  useEffect(() => {
    if (!config) return;
    if (authClientNeededNow()) ensureClient();
  }, [config, isOnline, ensureClient]);

  const [session, setSession] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [lastSyncFailed, setLastSyncFailed] = useState(false);
  // A sign-in that was started and did not arrive: the chunk would not
  // load, the provider could not be reached, or the person refused at
  // Google's consent screen and was sent back with `error=` in the URL.
  // Seeded from the URL so a refusal is caught on the load it returns on,
  // not only when the button is pressed.
  const [signInFailed, setSignInFailed] = useState(authRefusedInUrl);
  // Whether this load is the return from Google, read before the library
  // tidies the address: if the last step then fails (the connection drops
  // during the exchange) there is no session and no `error=` either, and
  // the person, who believes they signed in, was told nothing.
  const returnedRef = useRef(null);
  if (returnedRef.current === null) {
    try { returnedRef.current = authReturnInUrl(); } catch { returnedRef.current = false; }
  }
  // True from the moment a session ends on its own — an expired or revoked
  // token, or a sign-out in another tab — until the next successful sign-in.
  // The device is cleared on that path (see below), and without this the
  // person sees an empty Journal with no explanation at all.
  //
  // Initialised from localStorage, not `false`: a reload of a device whose
  // token quietly expired sees no transition (previousUserIdRef starts at
  // null, same as userId, so the effect below never fires the `previous !==
  // null` branch that would set this) — only the persisted flag carries the
  // notice across the reload. `setSessionEnded` below is always paired with
  // `saveSessionEnded` so the two never drift apart.
  const [sessionEnded, setSessionEndedState] = useState(loadSessionEnded);
  const setSessionEnded = useCallback((ended) => {
    saveSessionEnded(ended);
    setSessionEndedState(ended);
  }, []);

  // `generationRef` marks the passport this device is currently allowed to
  // write. `pushedRef` holds the contents the server is known to hold, and
  // null means "unknown — nothing may be pushed yet".
  const generationRef = useRef(0);
  const pushedRef = useRef(null);
  const pushTriesRef = useRef(0);
  const [pushRetry, setPushRetry] = useState(0);
  // A connection that has come back gets the three tries again.
  useEffect(() => { if (isOnline) pushTriesRef.current = 0; }, [isOnline]);
  // The latest list, for the sign-out's last push.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const sessionRef = useRef(null);
  // Bumped to ask the reconcile effect to run again for an unchanged account.
  const [syncEpoch, setSyncEpoch] = useState(0);

  // The two refs are always changed together, through this one function.
  // Kept as a single helper rather than three call sites because the last
  // round shipped exactly the bug that separation invites: the generation was
  // bumped on an account change while `pushedRef` still held the previous
  // account's remote signature, which let the push gate pass and upserted one
  // person's rows into another person's account. Whenever what this device
  // may write changes, what the server is known to hold becomes unknown —
  // these are one fact, so they get one function.
  const invalidate = useCallback(() => {
    generationRef.current += 1;
    pushedRef.current = null;
    pushTriesRef.current = 0;
  }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);

  // googleEnabled(null) answers false without a request, so an unconfigured
  // deploy stays entirely offline here.
  // Asked again when the connection returns, and once more a little later:
  // one failed request on a bad link used to leave no sign-in button until
  // the page was reloaded. A "no" is only ever replaced by a "yes".
  useEffect(() => {
    if (!config || !isOnline) return undefined;
    let cancelled = false;
    let timer = null;
    const ask = (again) => googleEnabled(config).then(ready => {
      if (cancelled) return;
      if (ready) setGoogleReady(true);
      else if (again) timer = setTimeout(() => ask(false), 8000);
    });
    ask(true);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [config, isOnline]);

  // onAuthStateChange fires INITIAL_SESSION on subscribe, so a session
  // restored from storage arrives here too — there is no separate getSession.
  // The token comparison matters: GoTrue re-emits on tab visibility and on
  // every hourly refresh, and storing a fresh object each time would re-key
  // every effect below it and start a redundant reconcile.
  useEffect(() => {
    if (!client) return undefined;
    const { data } = client.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !nextSession && returnedRef.current) setSignInFailed(true);
      setSession(prev => (
        prev?.access_token === nextSession?.access_token ? prev : (nextSession ?? null)
      ));
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const userId = session?.user?.id ?? null;

  // Declared above the reconcile and push effects so it runs first, which
  // keeps the invalidation ahead of the work it invalidates. That ordering is
  // belt-and-braces rather than the sole defence: were the effects reordered,
  // the push timer's own generation check would still catch it when it comes
  // due a second later. The ordering makes the window zero instead of 1000 ms.
  //
  // It also decides whether the device's passport belongs to whoever just
  // signed in. Two transitions, two different answers:
  //
  // anonymous -> B   B saved these before signing in. They are B's own, and
  //                  the union merge carries them into the account.
  // A -> B           The passport was left by a different account. Not B's
  //                  data, and merging it would donate A's saved places to B
  //                  — the failure the operator's "sign-out clears this
  //                  device" rule exists to prevent, on exactly the hostel
  //                  machines and borrowed phones that rule is about. The
  //                  device is cleared first and B's remote reconciles onto
  //                  an empty local.
  //
  // This is the ONLY site that asks the question, which is why it has to
  // cover the reload as well as the in-session switch. An expired or revoked
  // refresh token, or a sign-out in another tab, leaves A's passport on disk
  // with no session — so on the next load the switch is invisible in memory
  // and only the persisted owner can tell that the passport is not B's.
  //
  // The owner is the persisted one, falling back to the user id this tab last
  // saw. The fallback covers the window before a session's first successful
  // reconcile, when nothing has been written to disk under that account yet.
  //
  // A -> null is sign-out, handled by clearDevice. The clear is written out
  // here rather than calling clearDevice because this path must not bump
  // syncEpoch: the userId change already schedules the reconcile, and a
  // second trigger would only duplicate the pull.
  const previousUserIdRef = useRef(null);
  const ownerRef = useRef(null);
  // Set by signOut, read and consumed on the very next session-end. Also
  // cleared whenever a session arrives, so a signOut that never produced an
  // auth event (no client, a throw) cannot leave a stale "this was
  // deliberate" behind to swallow a later, real expiry.
  const deliberateSignOutRef = useRef(false);
  useEffect(() => {
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    invalidate();
    if (userId === null) {
      // `previous !== null` means this tab watched a session it had end —
      // a sign-out in another tab, an expired token, a revoked one. They are
      // the same event from here and they get the same answer: a session that
      // ended is a session that ended, and the device does not keep the
      // places either way.
      //
      // Without this, the sign-out in the other tab removes both keys, and
      // then THIS tab writes its still-live entries back on the next heart
      // tap — with no owner key, because nothing writes one while signed out.
      // The passport on disk is then indistinguishable from the upgrade case,
      // and the next person to sign in inherits it.
      //
      // The cost is deliberate: a token that merely expires mid-session wipes
      // this device's passport. Those rows were already reconciled to the
      // account, so signing in again restores them — and the operator chose
      // "signing out clears this device" for the hostel machines and borrowed
      // phones where the alternative leaves one person's places for the next.
      if (previous !== null) {
        clearLocalPassport();
        ownerRef.current = null;
        setEntries([]);
        setLastSyncFailed(false);
        // Said out loud, because the alternative is a Journal that empties
        // itself for no visible reason. It clears on the next successful
        // sign-in (the `setSessionEnded(false)` below), not on a dismissal:
        // the places are missing until the person signs in again, so the
        // sentence stays true for exactly as long as the situation does.
        //
        // An explicit sign-out reaches this same effect — GoTrue emits a
        // null session either way, and from here the two are
        // indistinguishable without being told. `deliberateSignOutRef` is
        // that telling. The person who just pressed Sign out knows why
        // their Journal is empty; the person whose token quietly expired
        // does not, and only the second one gets the sentence.
        if (deliberateSignOutRef.current) deliberateSignOutRef.current = false;
        else setSessionEnded(true);
      }
      // null -> null is a device that never had a session. Untouched: an
      // anonymous passport must still carry into its owner's first account.
      return;
    }
    // A session exists again, so both notices have done their job.
    deliberateSignOutRef.current = false;
    setSessionEnded(false);
    setSignInFailed(false);
    const owner = loadPassportOwner() ?? previous;
    ownerRef.current = owner;
    if (!passportBelongsTo(owner, userId)) {
      clearLocalPassport();
      ownerRef.current = null;
      setEntries([]);
      setLastSyncFailed(false);
    }
  }, [userId, invalidate, setEntries, setSessionEnded]);

  const reconcile = useCallback(async () => {
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    const result = await reconcilePassport({
      config,
      session: sessionRef.current,
      setEntries,
      isCurrent,
      onRemote: remote => { pushedRef.current = passportSignature(remote); },
    });
    if (result.reason === 'no-session' || result.reason === 'stale' || !isCurrent()) return result;
    if (result.reason === 'merged') {
      // The passport on this device is now this account's: it has been merged
      // with that account's rows. Recorded on disk so a reload — where the
      // previous session is only a memory, or not even that — can still tell
      // whose passport this is.
      const owner = sessionRef.current?.user?.id ?? null;
      ownerRef.current = owner;
      savePassportOwner(owner);
    }
    setLastSyncFailed(!result.ok);
    // Returned so the caller can decide whether this is worth retrying. Only
    // 'pull-failed' is: 'stale' and 'no-session' mean the work was correctly
    // abandoned, and repeating either would be a request with no question.
    return result;
  }, [config, setEntries]);

  // Keyed on the user id rather than the session object, so an hourly token
  // refresh does not re-run a full pull/merge/push. Reconcile reads the live
  // session from the ref, so it always uses the current token. A reconnect
  // re-runs the whole reconcile rather than replaying a queue: the merge
  // already resolves whatever happened offline, which is why there is no
  // queue here to get wrong.
  // `syncEpoch` is in the deps so a cleared device re-reconciles on its own.
  // Clearing nulls `pushedRef`, which closes the push gate, and the account
  // has not changed — without this the gate would stay shut for the rest of
  // the session and every save after a delete would silently never leave the
  // device.
  //
  // A failed pull is retried on a bounded backoff rather than left to sit.
  // The cancellation is threefold and deliberate: the cleanup cancels on
  // unmount and on every re-run of this effect (a sign-out, an account
  // change, a reconnect, a syncEpoch bump all re-key it), and the generation
  // check catches a bump that does not re-key it — a delete confirmed while
  // a retry is already sleeping.
  useEffect(() => {
    if (!userId || !isOnline) return undefined;
    const generation = generationRef.current;
    let cancelled = false;
    let timer = null;
    const attempt = async (index) => {
      const result = await reconcile();
      if (cancelled || generationRef.current !== generation) return;
      if (result?.reason !== 'pull-failed' || index >= RETRY_DELAYS_MS.length) return;
      timer = setTimeout(() => { attempt(index + 1); }, RETRY_DELAYS_MS[index]);
    };
    attempt(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, isOnline, syncEpoch, reconcile]);

  // The push half of the reconcile, and the only thing that writes rows to
  // the server. `pushedRef` holds what the server is known to hold — set to
  // the pulled rows by reconcile, and null whenever that is unknown — so a
  // null means no reconcile has succeeded for this generation yet and local
  // must not be blindly upserted over a remote nobody has read.
  useEffect(() => {
    if (!session || !config || !isOnline) return undefined;
    if (pushedRef.current === null) return undefined;
    const signature = passportSignature(entries);
    if (signature === pushedRef.current) return undefined;
    const generation = generationRef.current;
    let retryTimer = null;
    // Set by the cleanup: a push still in flight when this run is replaced
    // must not spend a retry or leave a timer nobody clears.
    let replaced = false;
    const timer = setTimeout(() => {
      // The timer can come due in the middle of `await deleteAllPassport`.
      // Without this check it would POST the rows straight back around the
      // DELETE that was meant to remove them.
      if (generationRef.current !== generation) return;
      // Only what changed. See passportDelta: sending the whole list makes
      // every tap re-assert places this tab has not looked at since its last
      // reconcile, and PostgREST's upsert takes whatever it is told.
      const changed = passportDelta(entries, pushedRef.current);
      if (changed.length === 0) {
        // The signature moved but no entry did — an entry left the list
        // rather than changing. Nothing to send; record the list as
        // delivered so the gate stops re-firing on it.
        pushedRef.current = signature;
        return;
      }
      pushPassport(changed, config, session.access_token, session.user?.id)
        .then(result => {
          if (generationRef.current !== generation) return;
          // Marked delivered only once the server has actually said so. The
          // previous order marked it before the request resolved, so a push
          // that failed left an undelivered list recorded as delivered and
          // the entries in it were never sent again.
          if (result.ok) pushedRef.current = signature;
          setLastSyncFailed(!result.ok);
          // A push that failed on a slow link was not tried again until the
          // next tap or a reload. Three more tries, further apart.
          if (result.ok) { pushTriesRef.current = 0; return; }
          if (replaced) return;
          const delay = RETRY_DELAYS_MS[pushTriesRef.current];
          if (delay === undefined) return;
          pushTriesRef.current += 1;
          retryTimer = setTimeout(() => setPushRetry(n => n + 1), delay);
        });
    }, PUSH_DEBOUNCE_MS);
    return () => { replaced = true; clearTimeout(timer); if (retryTimer) clearTimeout(retryTimer); };
  }, [entries, session, config, isOnline, pushRetry]);

  // Case 2: the visitor presses Sign in. This is the first moment the library
  // is certainly needed, so this is where it is fetched — the press already
  // ends in a full-page redirect, and one chunk ahead of that redirect is
  // invisible next to it.
  //
  // The returned promise never rejects: the caller is a click handler, and a
  // failure to load the chunk or to reach the provider must leave the button
  // doing nothing, which is what a user with no connectivity already expects.
  const signIn = useCallback(() => {
    setSignInFailed(false);
    return ensureClient().then(next => {
      // The chunk did not load. Saying so is the whole point: a button that
      // silently does nothing is indistinguishable from one that was never
      // pressed, and the retry that would fix it is a press away.
      if (!next) {
        setSignInFailed(true);
        return undefined;
      }
      return next.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: signInReturnTo() },
      }).then(result => {
        // On success the browser leaves for Google and nothing here renders
        // again; an error means we are still on the page, saying nothing.
        if (result?.error) setSignInFailed(true);
        return result;
      });
    }).catch(() => { setSignInFailed(true); });
  }, [ensureClient]);

  // Leaves this device clean; the account keeps the records (operator's
  // decision, 2026-09-19). Deleting the records is a separate, explicit act.
  const clearDevice = useCallback(() => {
    invalidate();
    // clearLocalPassport removes the owner key too, so the device never
    // claims an empty passport belongs to the person who just left it.
    clearLocalPassport();
    ownerRef.current = null;
    setEntries([]);
    setLastSyncFailed(false);
    // Reopen the push gate by reconciling again: the account is unchanged, so
    // nothing else would ask for it.
    setSyncEpoch(epoch => epoch + 1);
  }, [invalidate, setEntries]);

  const signOut = useCallback(async ({ confirmLoss } = {}) => {
    // Saves that have not reached the account yet (a failed push, a tap a
    // second ago) are sent first: signing out clears the device, and they
    // were lost for good. If they cannot be sent, the person is asked.
    const active = sessionRef.current;
    const ask = async () => typeof confirmLoss !== 'function' || confirmLoss();
    if (config && active && pushedRef.current !== null) {
      const list = entriesRef.current;
      const changed = passportDelta(list, pushedRef.current);
      if (changed.length > 0) {
        const generation = generationRef.current;
        const sent = await pushPassport(changed, config, active.access_token, active.user?.id);
        // A delete confirmed meanwhile owns the gate: leave it shut.
        if (sent.ok) { if (generationRef.current === generation) pushedRef.current = passportSignature(list); }
        else if (!(await ask())) return;
      }
    } else if (active && entriesRef.current.length > 0) {
      // No sync has succeeded this visit, so nothing may be pushed (the
      // account has not been read) and nothing is known to be there: ask.
      if (!(await ask())) return;
    }
    // Recorded before the session can end, so the auth event that follows is
    // recognised as this deliberate act rather than as an expiry.
    deliberateSignOutRef.current = true;
    // The device is cleared whether or not the server could be reached: the
    // row promises "Clears this device", and a network failure on the way out
    // must not turn that into a button that visibly does nothing.
    try {
      if (client) await client.signOut();
    } catch {
      // The local session is discarded regardless; the token is dead here.
    }
    clearDevice();
  }, [client, clearDevice, config]);

  const deleteRecords = useCallback(async () => {
    const active = sessionRef.current;
    if (!config || !active) return;
    // Invalidated BEFORE the request, not after. The pull of a reconcile
    // started a moment ago is already in flight and must be cancelled now —
    // by the time the DELETE returns it may have resolved and written the
    // rows back. Nulling `pushedRef` in the same breath closes the push gate
    // for the duration: a heart tapped while the DELETE is in flight would
    // otherwise schedule a timer already carrying the bumped generation, so
    // the timer's own check could not catch it, and a DELETE slower than the
    // 1000 ms debounce would see that POST go out around it.
    invalidate();
    const result = await deleteAllPassport(config, active.access_token, active.user?.id);
    if (!result.ok) {
      // The records are still there. Clearing the device here would hide a
      // failure the user was told could not be undone.
      setLastSyncFailed(true);
      // The gate was closed above and the account has not changed, so ask for
      // a reconcile to reopen it rather than leaving the device unable to sync.
      setSyncEpoch(epoch => epoch + 1);
      return;
    }
    clearDevice();
  }, [config, invalidate, clearDevice]);

  return { session, googleReady, signIn, signOut, deleteRecords, lastSyncFailed, sessionEnded, signInFailed };
}
