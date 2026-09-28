-- K-Food Map cross-device passport. Paste into the Supabase SQL editor
-- once; re-running is safe. See
-- docs/superpowers/specs/2026-09-19-passport-sync-design.md.
--
-- One row per (person, place). saved_at is null for a place the person
-- unsaved: the row is a tombstone, and it exists so that a delete made on
-- one device is not resurrected by another device that still remembers the
-- place as saved.

create table if not exists public.passports (
  user_id    uuid not null references auth.users on delete cascade,
  place_id   text not null check (char_length(place_id) between 1 and 64),
  saved_at   timestamptz,
  visited_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id),
  constraint visit_implies_save check (visited_at is null or saved_at is not null)
);

alter table public.passports enable row level security;

revoke all on public.passports from anon, authenticated;
grant select, insert, update, delete on public.passports to authenticated;
grant select, insert, update, delete on public.passports to service_role;

-- A signed-in person reads and writes their own rows and no one else's.
-- The `with check` clauses are what stop a row being written under, or
-- moved to, another user_id.
drop policy if exists passports_own_select on public.passports;
create policy passports_own_select on public.passports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists passports_own_insert on public.passports;
create policy passports_own_insert on public.passports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists passports_own_update on public.passports;
create policy passports_own_update on public.passports
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists passports_own_delete on public.passports;
create policy passports_own_delete on public.passports
  for delete to authenticated using (auth.uid() = user_id);

-- The server-side half of mergePassport (src/data/passport.js). PostgREST's
-- upsert (`Prefer: resolution=merge-duplicates`) is unconditional
-- last-writer-wins on the whole row — it never consults updated_at — so
-- without this trigger a device holding a list from this morning can
-- overwrite a tombstone another device wrote this afternoon, and a place the
-- person unsaved comes back. The merge rule has to live on both sides.
--
-- These two implementations are one decision written twice and MUST change
-- together, but they are not byte-identical: older updated_at always loses,
-- on both sides, and both single out the tombstone-vs-save tie (an equal
-- timestamp is not evidence that the person meant to delete, so the save
-- wins). Where they differ is every OTHER tie — two saves, or two
-- tombstones, at the same updated_at. mergePassport keeps whichever side it
-- read first (the client's local rows precede the remote ones in the array
-- it folds over); this trigger always keeps the incoming NEW row over the
-- stored OLD one. That difference is unreachable in practice: every local
-- write stamps `Date.now()`, so two rows sharing an updated_at are the same
-- write arriving twice, not two different ones racing — there is no tie
-- this function and mergePassport could ever be asked to break differently.
-- If that ever stops being true (a batch import, a clock-based write with
-- coarser resolution), the two rules need reconciling before this comment
-- can claim it again. If mergePassport's rule ever moves, this function
-- moves with it in the same commit.
--
-- Returning OLD from a BEFORE UPDATE trigger keeps the stored row exactly as
-- it was while still answering the request successfully — the stale writer is
-- ignored, not told it failed, which is the right outcome for a device that
-- is merely behind.
create or replace function public.passports_keep_latest() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then return old; end if;
  if new.updated_at = old.updated_at and new.saved_at is null and old.saved_at is not null then return old; end if;
  return new;
end $$;

-- Dropped first so re-running this file is safe, like everything above it.
-- (`create or replace function` is itself idempotent here: the signature —
-- no arguments, returns trigger — never changes, so the replace always
-- succeeds and the trigger keeps pointing at it.)
drop trigger if exists passports_keep_latest on public.passports;
create trigger passports_keep_latest before update on public.passports
  for each row execute function public.passports_keep_latest();
