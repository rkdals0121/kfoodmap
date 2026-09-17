-- K-Food Map submission queue. Paste into the Supabase SQL editor once;
-- re-running is safe. See docs/superpowers/specs/2026-09-17-ugc-intake-design.md.
--
-- A lead is not a fact: nothing reads this table into the app's data.

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('new', 'correction')),
  place_id        text check (place_id is null or char_length(place_id) <= 64),
  name            text not null check (char_length(name) between 1 and 120),
  location_hint   text check (location_hint is null or char_length(location_hint) <= 200),
  topic           text not null check (topic in ('vegan', 'halal', 'hours', 'closed', 'address', 'other')),
  message         text not null check (char_length(message) between 1 and 2000),
  source_url      text check (source_url is null or char_length(source_url) <= 500),
  contact_email   text check (contact_email is null or char_length(contact_email) <= 200),
  lang            text not null default 'en' check (char_length(lang) <= 16),
  status          text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'deferred')),
  resolution_note text,
  resolved_at     timestamptz,
  constraint correction_names_a_place check (kind <> 'correction' or place_id is not null)
);

alter table public.leads enable row level security;

-- The public (anon) key may insert the submission columns and nothing
-- else: no select (other people's emails), no update, no delete, and no
-- way to set status or resolution fields even on its own new row.
revoke all on public.leads from anon, authenticated;
grant insert (kind, place_id, name, location_hint, topic, message, source_url, contact_email, lang)
  on public.leads to anon;

-- Newer Supabase projects don't always auto-grant a fresh table to
-- service_role, and scripts/leads.mjs (list/resolve/verify-rls) depends on
-- this key having full access — make the grant explicit.
grant select, insert, update, delete on public.leads to service_role;

drop policy if exists leads_anon_insert on public.leads;
create policy leads_anon_insert on public.leads
  for insert to anon
  with check (status = 'open' and resolution_note is null and resolved_at is null);
