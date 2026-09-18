-- Adds the place a submitter picked from Kakao search to a lead.
-- Additive and safe to re-run. Paste into the Supabase SQL editor once.
-- See docs/superpowers/specs/2026-09-18-submit-autofill-design.md.
--
-- Still a lead, not a fact: this is what the submitter chose, not what we
-- assert. Verification (§2.11) cross-checks it by hand before any of it
-- reaches restaurants.js.

alter table public.leads add column if not exists kakao_place_id text;
alter table public.leads add column if not exists kakao_address  text;
alter table public.leads add column if not exists kakao_lat      double precision;
alter table public.leads add column if not exists kakao_lng      double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_kakao_bounds') then
    alter table public.leads add constraint leads_kakao_bounds check (
      (kakao_place_id is null or char_length(kakao_place_id) <= 40)
      and (kakao_address is null or char_length(kakao_address) <= 200)
      and (kakao_lat is null or (kakao_lat between -90 and 90))
      and (kakao_lng is null or (kakao_lng between -180 and 180))
    );
  end if;
end $$;

-- Extend, don't replace: the anon key may now also insert these four, and
-- still nothing else (status and the resolution fields stay out of reach).
grant insert (kind, place_id, name, location_hint, topic, message, source_url, contact_email, lang,
              kakao_place_id, kakao_address, kakao_lat, kakao_lng)
  on public.leads to anon;
