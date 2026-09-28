// Cross-device passport sync (docs/superpowers/specs/2026-09-19-passport-sync-design.md).
//
//   node --env-file=.env.local scripts/passport.mjs verify-rls
//   node --env-file=.env.local scripts/passport.mjs sync-e2e
//   node --env-file=.env.local scripts/passport.mjs delete-user <email>
//
// This script never reads .env.local itself — the caller passes it via
// --env-file, and this file only ever touches process.env.
import { authHeaders, parseSupabaseUrl } from '../src/data/leads.js';
import { deleteAllPassport, mergePassport, pullPassport, pushPassport } from '../src/data/passport.js';

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set. Run with --env-file=.env.local (see .env.example).`);
    process.exit(2);
  }
  return value;
}

// Runs before any fetch on every call, so exiting here is always pre-network.
function baseUrl() {
  const raw = env('VITE_SUPABASE_URL');
  const url = parseSupabaseUrl(raw);
  if (!url) {
    console.error(`VITE_SUPABASE_URL is not a valid http(s) URL: "${raw}"`);
    process.exit(2);
  }
  return url;
}

// Request made as the anon key or the service key — no signed-in user.
function rest(path, key, init = {}) {
  const base = baseUrl();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(key), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

// Request made as a signed-in person: apikey is always the project's anon
// key (that's what identifies the project), Authorization carries the
// person's own access token (that's what auth.uid() reads in RLS).
function restAsUser(path, accessToken, anonKey, init = {}) {
  const base = baseUrl();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// Create a throwaway confirmed user and return { id, accessToken }.
async function makeTestUser(base, serviceKey, anonKey, email, password) {
  const created = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders(serviceKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`admin create failed: ${created.status}`);
  const { id } = await created.json();
  const signedIn = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { ...authHeaders(anonKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!signedIn.ok) throw new Error(`password sign-in failed: ${signedIn.status}`);
  const { access_token: accessToken } = await signedIn.json();
  return { id, accessToken };
}

async function deleteTestUser(base, serviceKey, id) {
  return fetch(`${base}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(serviceKey),
  });
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

// Parses a PostgREST error body without throwing on a non-JSON or
// already-consumed response. A rejected request is only proof of the
// *right* rejection if we look at why, not just its status class — see
// the callers below for the specific codes this checks for and their
// source.
async function errorBody(response) {
  try {
    const body = await response.json();
    return { code: body?.code ?? null, message: body?.message ?? '' };
  } catch {
    return { code: null, message: '' };
  }
}

// Proves the "own rows only" table works by trying every way to break it,
// against the live table — the same standard as leads.mjs's verify-rls.
// Leaves no rows and no test users behind.
// `--prove-can-fail` runs the same rules with an over-privileged key in
// place of user A's token. A suite that still passes under a wrong
// identity proves nothing, and until now the only way to establish that
// was to edit this file by hand — which the next person will not do.
// Under the flag the verdict inverts: failures are the expected result,
// and a clean run is the alarm.
async function verifyRls(args = []) {
  const proving = args.includes('--prove-can-fail');
  // Read every env var up front so a missing one exits before the
  // try/finally even opens — process.exit() skips finally, so failing
  // inside it could otherwise leave a self-test user behind unnoticed.
  const base = baseUrl();
  const anon = env('VITE_SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');

  const suffix = randomSuffix();
  const password = `Rls-Test-${randomSuffix()}!${randomSuffix()}`;
  const emailA = `rls-a-${suffix}@kfoodmap-rls-test.invalid`;
  const emailB = `rls-b-${suffix}@kfoodmap-rls-test.invalid`;
  const placeA = `rls-test-a-${suffix}`;
  const placeB = `rls-test-b-${suffix}`;
  const placeForged = `rls-test-forged-${suffix}`;
  const placeConstraint = `rls-test-constraint-${suffix}`;

  const results = [];
  const check = (rule, pass, detail) => results.push({ rule, pass, detail });

  let userA = null;
  let userB = null;

  try {
    userA = await makeTestUser(base, service, anon, emailA, password);
    userB = await makeTestUser(base, service, anon, emailB, password);

    // Substituted after the users exist, so every rule below still runs
    // against a real row and a real account — only the identity
    // presented to PostgREST is wrong.
    if (proving) userA.accessToken = service;

    // Seed B's own row first, as B, so the "A can't see/touch B" rules
    // below have something real to fail against.
    const seedB = await restAsUser('passports', userB.accessToken, anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userB.id, place_id: placeB, saved_at: new Date().toISOString() }),
    });
    if (seedB.status !== 201) throw new Error(`seeding B's row failed: HTTP ${seedB.status}`);

    // Rule 1: A inserting A's own row succeeds.
    const insertA = await restAsUser('passports', userA.accessToken, anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userA.id, place_id: placeA, saved_at: new Date().toISOString() }),
    });
    check('A inserting A\'s own row succeeds', insertA.status === 201, `HTTP ${insertA.status}`);

    // Rules 2 & 3: A sees A's row, does not see B's row.
    const readA = await restAsUser('passports?select=user_id,place_id', userA.accessToken, anon);
    const readABody = readA.ok ? await readA.json() : [];
    const seesOwn = readABody.some(r => r.user_id === userA.id && r.place_id === placeA);
    check('A reading passports sees A\'s row', readA.status === 200 && seesOwn, `HTTP ${readA.status}, ${readABody.length} row(s)`);
    const seesB = readABody.some(r => r.user_id === userB.id);
    check('A reading passports does not see B\'s row', readA.status === 200 && !seesB, `HTTP ${readA.status}, ${readABody.length} row(s)`);

    // Rule 4: A inserting a row with user_id = B is denied.
    const forgedInsert = await restAsUser('passports', userA.accessToken, anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userB.id, place_id: placeForged, saved_at: new Date().toISOString() }),
    });
    const forgedInsertError = await errorBody(forgedInsert);
    // Postgres raises SQLSTATE 42501 ("new row violates row-level security
    // policy") for a failed `with check`; PostgREST maps that to HTTP 403
    // with body.code "42501" (postgrest.org error-handling reference: class
    // 42 → 403, insufficient_privilege). A bare 401/403 would also match a
    // bad test-user token, which proves nothing about RLS — so this checks
    // the code, not just the status class. If the first real run shows a
    // different body.code for this case, that value is what belongs here,
    // not a widened status check.
    check('A inserting a row with user_id = B is denied by RLS (42501)',
      forgedInsert.status === 403 && forgedInsertError.code === '42501',
      `HTTP ${forgedInsert.status} code=${forgedInsertError.code ?? 'none'} ${forgedInsertError.message}`);

    // Rule 5: A updating B's row affects 0 rows; B's row unchanged when re-read as B.
    const updateB = await restAsUser(`passports?user_id=eq.${userB.id}&place_id=eq.${placeB}`, userA.accessToken, anon, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ saved_at: null }),
    });
    const updateBBody = updateB.ok ? await updateB.json() : [];
    const rereadB = await restAsUser(`passports?user_id=eq.${userB.id}&place_id=eq.${placeB}&select=saved_at`, userB.accessToken, anon);
    const rereadBBody = rereadB.ok ? await rereadB.json() : [];
    const bUnchanged = rereadBBody.length === 1 && rereadBBody[0].saved_at !== null;
    // The status check is what makes this rule mean something. Without it a
    // PATCH that failed for an unrelated reason — an expired token, a 404
    // because the table is missing — leaves updateBBody empty, reads as
    // "0 rows affected", and passes while proving nothing about RLS. An
    // executed-but-filtered UPDATE is a 200 with an empty representation;
    // that, and only that, is the shape RLS produces here.
    check('A updating B\'s row is executed, affects 0 rows, and B\'s row is unchanged',
      updateB.status === 200 && updateBBody.length === 0 && bUnchanged,
      `PATCH HTTP ${updateB.status} affected ${updateBBody.length}, B's saved_at now ${rereadBBody[0]?.saved_at ?? 'missing'}`);

    // Rule 6: A deleting B's row affects 0 rows; B's row still exists.
    const deleteB = await restAsUser(`passports?user_id=eq.${userB.id}&place_id=eq.${placeB}`, userA.accessToken, anon, {
      method: 'DELETE', headers: { Prefer: 'return=representation' },
    });
    const deleteBBody = deleteB.ok ? await deleteB.json() : [];
    const stillThere = await restAsUser(`passports?user_id=eq.${userB.id}&place_id=eq.${placeB}&select=place_id`, userB.accessToken, anon);
    const stillThereBody = stillThere.ok ? await stillThere.json() : [];
    // Same discriminator as rule 5: a 200 with an empty representation is an
    // executed DELETE that matched nothing, which is RLS filtering the row
    // out. A 401 also produces an empty body and would otherwise pass.
    check('A deleting B\'s row is executed, affects 0 rows, and B\'s row still exists',
      deleteB.status === 200 && deleteBBody.length === 0 && stillThereBody.length === 1,
      `DELETE HTTP ${deleteB.status} affected ${deleteBBody.length}, B still has ${stillThereBody.length} row(s)`);

    // Rule 7: A moving its own row to user_id = B is denied.
    const moveOwn = await restAsUser(`passports?user_id=eq.${userA.id}&place_id=eq.${placeA}`, userA.accessToken, anon, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userB.id }),
    });
    const moveOwnError = await errorBody(moveOwn);
    // Same signal as rule 4: an RLS `with check` failure on the update
    // policy is SQLSTATE 42501 → HTTP 403, body.code "42501". See that
    // rule's comment for the source and for what to do if this differs on
    // the first real run.
    check('A moving its own row to user_id = B is denied by RLS (42501)',
      moveOwn.status === 403 && moveOwnError.code === '42501',
      `HTTP ${moveOwn.status} code=${moveOwnError.code ?? 'none'} ${moveOwnError.message}`);

    // Rule 8: the anon key with no user JWT reads zero rows.
    const anonRead = await rest('passports?select=*', anon);
    let anonReadPass;
    let anonReadDetail;
    if (anonRead.ok) {
      const anonReadBody = await anonRead.json();
      anonReadPass = Array.isArray(anonReadBody) && anonReadBody.length === 0;
      anonReadDetail = `HTTP ${anonRead.status}, ${anonReadBody.length} row(s)`;
    } else {
      // `revoke all ... from anon` makes this a permission denial — SQLSTATE
      // 42501, which PostgREST reports as 401 with that code in the body.
      // Asserting the code stops a 401 from an unrelated cause, such as a
      // missing table or a malformed request, from reading as proof.
      const anonReadError = await errorBody(anonRead);
      anonReadPass = (anonRead.status === 401 || anonRead.status === 403) && anonReadError.code === '42501';
      anonReadDetail = `HTTP ${anonRead.status} code=${anonReadError.code ?? 'none'} ${anonReadError.message}`;
    }
    check('anon key with no user JWT reads zero rows', anonReadPass, anonReadDetail);

    // Rule 9: the anon key with no user JWT cannot insert.
    const anonInsert = await rest('passports', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userA.id, place_id: `rls-test-anon-${suffix}`, saved_at: new Date().toISOString() }),
    });
    const anonInsertError = await errorBody(anonInsert);
    check('anon key with no user JWT cannot insert',
      (anonInsert.status === 401 || anonInsert.status === 403) && anonInsertError.code === '42501',
      `HTTP ${anonInsert.status} code=${anonInsertError.code ?? 'none'} ${anonInsertError.message}`);

    // Rule 10: visited_at set with saved_at null is rejected by the table constraint.
    const badInsert = await restAsUser('passports', userA.accessToken, anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userA.id, place_id: placeConstraint, saved_at: null, visited_at: new Date().toISOString() }),
    });
    const badInsertError = await errorBody(badInsert);
    // Postgres raises SQLSTATE 23514 (check_violation) for a failed CHECK
    // constraint; PostgREST maps that to HTTP 400 with body.code "23514"
    // (postgrest.org error-handling reference: class 23,
    // integrity_constraint_violation, → 400). Any 4xx/5xx would also match
    // an unrelated auth or server error, which would prove nothing about
    // visit_implies_save specifically — so this checks the code (and falls
    // back to the constraint name appearing in the message, in case a
    // Supabase version surfaces this under a different code) rather than
    // the status class. If the first real run disagrees, that observed
    // code/message is what belongs here.
    const constraintRejected = badInsert.status === 400
      && (badInsertError.code === '23514' || badInsertError.message.includes('visit_implies_save'));
    check('visited_at set with saved_at null is rejected by the visit_implies_save check constraint',
      constraintRejected,
      `HTTP ${badInsert.status} code=${badInsertError.code ?? 'none'} ${badInsertError.message}`);

    // Rules 11-13 exercise what production actually sends. Every write from
    // the app is an upsert (`Prefer: resolution=merge-duplicates`), never the
    // plain insert rules 1 and 4 test: on an existing row that request takes
    // the ON CONFLICT DO UPDATE path, so the insert `with check` AND the
    // update policy have to hold on one and the same request. A table that
    // passed rules 1-10 and failed these would reject every real save.
    const upsert = (accessToken, rows) => restAsUser('passports', accessToken, anon, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });

    // Rule 11: A upserting over A's own existing row succeeds.
    const upsertAt = new Date().toISOString();
    const upsertOwn = await upsert(userA.accessToken, [
      { user_id: userA.id, place_id: placeA, saved_at: upsertAt, visited_at: null, updated_at: upsertAt },
    ]);
    check('A upserting over A\'s own existing row succeeds (insert with check + update policy, one request)',
      upsertOwn.ok, `HTTP ${upsertOwn.status}`);

    // Rule 12: A upserting under B's user_id is denied, and B's row is
    // untouched. Checked both ways round on purpose: an upsert that were
    // merely filtered to zero rows would report a cheerful 201 while having
    // done nothing, which looks identical to a denial from the status alone.
    const upsertForged = await upsert(userA.accessToken, [
      { user_id: userB.id, place_id: placeB, saved_at: null, visited_at: null, updated_at: new Date().toISOString() },
    ]);
    const upsertForgedError = await errorBody(upsertForged);
    const bAfterForged = await restAsUser(`passports?user_id=eq.${userB.id}&place_id=eq.${placeB}&select=saved_at`, userB.accessToken, anon);
    const bAfterForgedBody = bAfterForged.ok ? await bAfterForged.json() : [];
    const bStillSaved = bAfterForgedBody.length === 1 && bAfterForgedBody[0].saved_at !== null;
    // Same signal as rules 4 and 7 — an RLS failure on either half of the
    // upsert is SQLSTATE 42501 → HTTP 403, body.code "42501". If the first
    // real run reports a different code for the ON CONFLICT DO UPDATE half
    // specifically, that observed value is what belongs here; the "B's row
    // is unchanged" half of this check holds regardless of the code.
    check('A upserting under B\'s user_id is denied by RLS (42501) and B\'s row is unchanged',
      upsertForged.status === 403 && upsertForgedError.code === '42501' && bStillSaved,
      `HTTP ${upsertForged.status} code=${upsertForgedError.code ?? 'none'} B's saved_at now ${bAfterForgedBody[0]?.saved_at ?? 'missing'}`);

    // Rule 13: the regression test for the stale-write Critical. PostgREST's
    // upsert is unconditional last-writer-wins on the whole row, so without
    // the passports_keep_latest trigger a device pushing a list from this
    // morning silently overwrites a tombstone written this afternoon and the
    // unsaved place comes back. The trigger is the server-side half of
    // mergePassport (supabase/passports.sql). A stale write must be accepted
    // as a request and ignored as a write — so this asserts on the STORED
    // row, not on the status.
    const staleAt = new Date(Date.parse(upsertAt) - 60_000).toISOString();
    const staleUpsert = await upsert(userA.accessToken, [
      { user_id: userA.id, place_id: placeA, saved_at: null, visited_at: null, updated_at: staleAt },
    ]);
    const afterStale = await restAsUser(`passports?user_id=eq.${userA.id}&place_id=eq.${placeA}&select=saved_at,updated_at`, userA.accessToken, anon);
    const afterStaleBody = afterStale.ok ? await afterStale.json() : [];
    const rowHeld = afterStaleBody.length === 1
      && afterStaleBody[0].saved_at !== null
      && Date.parse(afterStaleBody[0].updated_at) === Date.parse(upsertAt);
    check('a stale upsert (older updated_at) does not overwrite the stored row — passports_keep_latest holds',
      staleUpsert.ok && rowHeld,
      `HTTP ${staleUpsert.status}, stored saved_at ${afterStaleBody[0]?.saved_at ?? 'missing'} updated_at ${afterStaleBody[0]?.updated_at ?? 'missing'} (expected ${upsertAt})`);
  } finally {
    // Deletes cascade the passport rows via `on delete cascade`, so no
    // separate row cleanup is needed.
    if (userA) {
      const cleanupA = await deleteTestUser(base, service, userA.id);
      check('test user A cleaned up', cleanupA.ok, `HTTP ${cleanupA.status}`);
    }
    if (userB) {
      const cleanupB = await deleteTestUser(base, service, userB.id);
      check('test user B cleaned up', cleanupB.ok, `HTTP ${cleanupB.status}`);
    }
  }

  for (const { rule, pass, detail } of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${rule}  (${detail})`);
  const failed = results.filter(r => !r.pass).length;
  if (proving) {
    console.log(
      failed
        ? `\nCHECK IS FALSIFIABLE: ${failed} of ${results.length} rule(s) failed under a substituted key, as they must.`
        : `\nALARM: every rule passed while presenting the wrong identity. `
          + `The suite cannot fail, so a green run proves nothing about RLS.`,
    );
    process.exitCode = failed ? 0 : 1;
    return;
  }
  console.log(failed ? `\n${failed} rule(s) failed.` : `\nAll ${results.length} rules hold.`);
  // Not process.exit(): fetch/undici keep-alive handles are still closing at
  // this point, and calling process.exit() synchronously right after
  // network I/O crashes Node on Windows (libuv assertion in src/win/async.c).
  // Setting exitCode and letting the event loop drain naturally is safe.
  process.exitCode = failed ? 1 : 0;
}

// Task 6 Step 3b: proves pushPassport/pullPassport/mergePassport against the
// live `public.passports` table with a real JWT, without waiting on Google
// OAuth — the same throwaway-user trick verifyRls uses. This is deliberately
// a script, not a committed test: it needs the service key to create and
// delete the test user, and it makes real network calls against the
// operator's project rather than a fake. Requires `public.passports` to
// exist (supabase/passports.sql run) and VITE_SUPABASE_ANON_KEY set — until
// then this fails fast rather than fabricating a result.
async function syncE2e() {
  const base = baseUrl();
  const anonKey = env('VITE_SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const config = { url: base, anonKey };

  const suffix = randomSuffix();
  const password = `Sync-Test-${randomSuffix()}!${randomSuffix()}`;
  const email = `sync-e2e-${suffix}@kfoodmap-rls-test.invalid`;
  const placeSaved = `sync-e2e-saved-${suffix}`;
  const placeTombstone = `sync-e2e-tombstone-${suffix}`;

  const results = [];
  const check = (step, pass, detail) => results.push({ step, pass, detail });

  let user = null;
  try {
    user = await makeTestUser(base, service, anonKey, email, password);

    const now = Date.now();
    const pushed = [
      { id: placeSaved, savedAt: now - 60_000, visitedAt: null, updatedAt: now - 60_000 },
      { id: placeTombstone, savedAt: null, visitedAt: null, updatedAt: now - 30_000 },
    ];
    const pushResult = await pushPassport(pushed, config, user.accessToken, user.id);
    check('push two entries (one saved, one tombstone)', pushResult.ok, `HTTP ${pushResult.status}`);

    const pulled = await pullPassport(config, user.accessToken);
    const pulledIds = pulled.entries.map(e => e.id).sort();
    check('pull returns both rows', pulled.ok && pulledIds.length === 2
      && pulledIds.includes(placeSaved) && pulledIds.includes(placeTombstone),
      `ok=${pulled.ok} ids=${JSON.stringify(pulledIds)}`);
    const pulledTombstone = pulled.entries.find(e => e.id === placeTombstone);
    check('the tombstone crosses the wire as savedAt: null, not a missing row',
      pulledTombstone !== undefined && pulledTombstone.savedAt === null,
      `entry=${JSON.stringify(pulledTombstone)}`);

    // A divergent local list: placeSaved has an OLDER local write (remote
    // should win), placeTombstone has a NEWER local write that re-saves the
    // place (local should win over the remote tombstone), and placeLocalOnly
    // exists only locally (must survive the merge untouched).
    const placeLocalOnly = `sync-e2e-local-only-${suffix}`;
    const local = [
      { id: placeSaved, savedAt: now - 120_000, visitedAt: null, updatedAt: now - 120_000 },
      { id: placeTombstone, savedAt: now - 10_000, visitedAt: null, updatedAt: now - 10_000 },
      { id: placeLocalOnly, savedAt: now - 5_000, visitedAt: null, updatedAt: now - 5_000 },
    ];
    const merged = mergePassport(local, pulled.entries);
    const byId = Object.fromEntries(merged.map(e => [e.id, e]));
    check('merge: remote (newer) wins for placeSaved',
      byId[placeSaved]?.updatedAt === pushed[0].updatedAt,
      `got ${JSON.stringify(byId[placeSaved])}`);
    check('merge: local (newer) re-save wins over the remote tombstone for placeTombstone',
      byId[placeTombstone]?.savedAt === local[1].savedAt,
      `got ${JSON.stringify(byId[placeTombstone])}`);
    check('merge: placeLocalOnly survives untouched',
      byId[placeLocalOnly]?.savedAt === local[2].savedAt,
      `got ${JSON.stringify(byId[placeLocalOnly])}`);

    const deleteResult = await deleteAllPassport(config, user.accessToken, user.id);
    check('delete-all removes the rows', deleteResult.ok, `HTTP ${deleteResult.status}`);
    const afterDelete = await pullPassport(config, user.accessToken);
    check('pull after delete-all is empty', afterDelete.ok && afterDelete.entries.length === 0,
      `ok=${afterDelete.ok} entries=${afterDelete.entries.length}`);
  } finally {
    if (user) {
      const cleanup = await deleteTestUser(base, service, user.id);
      check('test user cleaned up', cleanup.ok, `HTTP ${cleanup.status}`);
    }
  }

  for (const { step, pass, detail } of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${step}  (${detail})`);
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n${failed} step(s) failed.` : `\nAll ${results.length} steps hold.`);
  // See verifyRls's identical comment: no process.exit() here either.
  process.exitCode = failed ? 1 : 0;
}

// Deletes a person's auth user, which cascades their passport rows via
// `on delete cascade`. Refuses without an explicit email — there is no
// "delete whoever" default worth having.
async function deleteUser(args) {
  const [email] = args;
  if (!email) {
    console.error('Usage: node --env-file=.env.local scripts/passport.mjs delete-user <email>');
    process.exit(2);
  }
  const base = baseUrl();
  const service = env('SUPABASE_SERVICE_ROLE_KEY');

  const lookup = await fetch(`${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: authHeaders(service),
  });
  if (!lookup.ok) {
    console.error(`Could not look up "${email}": HTTP ${lookup.status}`);
    process.exitCode = 1;
    return;
  }
  const body = await lookup.json();
  const users = Array.isArray(body) ? body : (body.users ?? []);
  const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) {
    console.error(`No user found for "${email}".`);
    process.exitCode = 1;
    return;
  }

  const deleted = await deleteTestUser(base, service, match.id);
  if (!deleted.ok) {
    console.error(`Could not delete "${email}": HTTP ${deleted.status}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Deleted ${email} (${match.id}) and their passport rows.`);
}

const commands = { 'verify-rls': verifyRls, 'sync-e2e': syncE2e, 'delete-user': deleteUser };

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.error(`Usage: node --env-file=.env.local scripts/passport.mjs <${Object.keys(commands).join('|')}>`);
  console.error('       verify-rls [--prove-can-fail]   run the rules with a wrong identity; failures are then the expected result');
  process.exit(2);
}
await commands[command](args);
