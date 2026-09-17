// Review queue for user submissions (docs/superpowers/specs/2026-09-17-ugc-intake-design.md).
//
//   node --env-file=.env.local scripts/leads.mjs list
//   node --env-file=.env.local scripts/leads.mjs resolve <id> <accepted|rejected|deferred> --note "<why>"
//   node --env-file=.env.local scripts/leads.mjs verify-rls
//
// "accepted" means worth running the Phase 3 verification on — not
// published. Leads are leads, not facts: nothing here writes to restaurants.js.
import { authHeaders, buildLead, parseSupabaseUrl } from '../src/data/leads.js';
import { restaurants } from '../src/data/restaurants.js';
import { formatLead, parseResolveArgs } from './lib/leads-format.mjs';

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

function rest(path, key, init = {}) {
  const base = baseUrl();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(key), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

// Proves the public key can do exactly one thing, against the live table —
// the same standard as the evidence rules: each proven to hold by trying
// to break it, not assumed. Leaves no rows behind.
async function verifyRls() {
  // Read every env var up front so a missing one exits before the try/finally
  // even opens — process.exit() skips finally, so failing inside it could
  // otherwise leave a self-test row behind unnoticed.
  env('VITE_SUPABASE_URL'); // rest() re-reads this per call; read here so a missing var exits first
  const anon = env('VITE_SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const marker = `rls-self-test ${new Date().toISOString()}`;
  const { row } = buildLead({ name: 'RLS self-test', topic: 'other', message: marker });
  const results = [];
  const check = (rule, pass, detail) => results.push({ rule, pass, detail });
  const byMessage = (message) => `leads?message=eq.${encodeURIComponent(message)}`;
  const rowsAsService = async (message, select = 'id,status') =>
    (await rest(`${byMessage(message)}&select=${select}`, service)).json();

  try {
    const insert = await rest('leads', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    check('anon can insert a well-formed lead', insert.status === 201, `HTTP ${insert.status}`);

    const read = await rest('leads?select=*', anon);
    let detail;
    let pass;

    if (read.ok) {
      const readBody = await read.json();
      pass = read.status === 200 && Array.isArray(readBody) && readBody.length === 0;
      detail = `HTTP ${read.status}, ${readBody.length} row(s)`;
    } else {
      let code = '';
      try {
        const errorBody = await read.json();
        if (errorBody?.code) code = ` ${errorBody.code}`;
      } catch {}
      pass = read.status === 401 || read.status === 403;
      detail = `HTTP ${read.status}${code}`;
    }
    check('anon cannot read leads', pass, detail);

    const forgedMessage = `${marker} forged`;
    const forged = await rest('leads', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...row, message: forgedMessage, status: 'accepted' }),
    });
    check('anon cannot insert a pre-resolved lead', forged.status >= 400, `HTTP ${forged.status}`);

    const forgedNoteMessage = `${marker} forged-note`;
    const forgedNote = await rest('leads', anon, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ...row, message: forgedNoteMessage, resolution_note: 'fake note', resolved_at: new Date().toISOString(),
      }),
    });
    check('anon cannot insert a lead carrying resolution_note/resolved_at', forgedNote.status >= 400, `HTTP ${forgedNote.status}`);

    const update = await rest(byMessage(marker), anon, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted' }),
    });
    const afterUpdate = await rowsAsService(marker);
    check('anon cannot change a status', afterUpdate.length === 1 && afterUpdate[0].status === 'open',
      `HTTP ${update.status}, status now ${afterUpdate[0]?.status}`);

    const messageUpdate = await rest(byMessage(marker), anon, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ message: `${marker} tampered` }),
    });
    const afterMessageUpdate = await rowsAsService(marker, 'id,message');
    check('anon cannot change the message', afterMessageUpdate.length === 1 && afterMessageUpdate[0].message === marker,
      `HTTP ${messageUpdate.status}, message now "${afterMessageUpdate[0]?.message}"`);

    const del = await rest(byMessage(marker), anon, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    const afterDelete = await rowsAsService(marker);
    check('anon cannot delete', afterDelete.length === 1, `HTTP ${del.status}, ${afterDelete.length} row(s) remain`);

    const forgedRows = await rowsAsService(forgedMessage);
    const forgedNoteRows = await rowsAsService(forgedNoteMessage);
    check('no forged row exists', forgedRows.length === 0 && forgedNoteRows.length === 0,
      `${forgedRows.length + forgedNoteRows.length} forged row(s)`);
  } finally {
    const cleanup = await rest(`leads?message=like.${encodeURIComponent(`${marker}*`)}`, service, { method: 'DELETE' });
    check('self-test rows cleaned up', cleanup.ok, `HTTP ${cleanup.status}`);
  }

  for (const { rule, pass, detail } of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${rule}  (${detail})`);
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n${failed} rule(s) failed.` : `\nAll ${results.length} rules hold.`);
  // Not process.exit(): fetch/undici keep-alive handles are still closing at
  // this point, and calling process.exit() synchronously right after
  // network I/O crashes Node on Windows (libuv assertion in src/win/async.c).
  // Setting exitCode and letting the event loop drain naturally is safe.
  process.exitCode = failed ? 1 : 0;
}

async function list() {
  const response = await rest('leads?status=eq.open&order=created_at.asc&select=*', env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!response.ok) {
    console.error(`Could not read leads: HTTP ${response.status} ${await response.text()}`);
    // process.exitCode, not process.exit(): this runs after a fetch, and
    // process.exit() right after network I/O crashes Node on Windows.
    process.exitCode = 1;
    return;
  }
  const leads = await response.json();
  const byId = Object.fromEntries(restaurants.map(r => [r.id, r]));
  for (const lead of leads) console.log(`${formatLead(lead, byId)}\n`);
  console.log(`${leads.length} open lead(s).`);
}

async function resolve(args) {
  const parsed = parseResolveArgs(args);
  if (!parsed.ok) {
    for (const error of parsed.errors) console.error(error);
    process.exit(2);
  }
  const response = await rest(
    `leads?id=eq.${encodeURIComponent(parsed.id)}&status=eq.open`,
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: parsed.status, resolution_note: parsed.note, resolved_at: new Date().toISOString() }),
    },
  );
  const rows = response.ok ? await response.json() : [];
  if (rows.length !== 1) {
    console.error(`No open lead ${parsed.id} (HTTP ${response.status}). Already resolved, or a typo?`);
    // process.exitCode, not process.exit(): this runs after a fetch, and
    // process.exit() right after network I/O crashes Node on Windows.
    process.exitCode = 1;
    return;
  }
  console.log(`${parsed.id} → ${parsed.status}: ${parsed.note}`);
}

const commands = { list, resolve, 'verify-rls': verifyRls };

const [command, ...args] = process.argv.slice(2);
if (!commands[command]) {
  console.error(`Usage: node --env-file=.env.local scripts/leads.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
await commands[command](args);
