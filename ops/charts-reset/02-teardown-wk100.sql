-- WAKILISHA Charts reset — 02 TEARDOWN: remove WK100 from the database
--
-- Irreversible. Run 01-preflight-readonly.sql first and keep its output.
-- Land this as a migration through the normal promotion path
-- (see docs/engineering/charts-reset-2026-11-17.md), not by hand, so the
-- live schema and migration history stay in agreement.
--
-- Removes:
--   * every WK100 Edition and its entries from the live Chart V2 tables
--   * WK100 triggers, policies and the WK100 unique index on Chart V2 tables
--   * every WK100 table, function and trigger
--     (platform_private.wk100_*, public.wk100_*, public.wk_chart_capture_*,
--      public.wk_chart_weekly_freezes_v1, private.wk_chart_runtime_*,
--      private.wk_chart_capture_*, public.wk_chart_runtime_*)
--   (the wk-chart-raw-evidence-v1 Storage bucket is deleted via Dashboard/API;
--    see step 9)
--
-- Restores:
--   * public.wk_chart_editions_publish_integrity_guard() to its pre-WK100
--     definition (WK100 rewrote it to depend on WK100 tables and to block
--     every top100 publication that did not come through WK100)
--
-- Replaces:
--   * the four WK100 "hide non-published" restrictive policies with
--     programme-neutral equivalents, so no draft Edition of any programme
--     becomes readable by anon when the WK100 versions go
--
-- Keeps (deliberately):
--   * wk_chart_programs_v2 / wk_chart_editions_v2 / wk_chart_entries_v2 and all
--     non-WK100 rows in them (the public /charts pages read these)
--   * the top100 programme row itself and every non-WK100 top100 Edition
--   * wk100_registry_track_provider_links_admin_review_read_v1: despite its
--     name it grants view_registry read on registry_track_provider_links, which
--     Registry admin depends on. Rename later if you like.
--   * the generic chart ingest pipeline objects (chart_ingest_*, chart_research_*,
--     wk_chart_scoring_runs, ...). Those are Tier 2 in the cleanup record.

begin;

-- 0. Stop if this is not the expected database shape.
do $$
begin
  if to_regclass('public.wk_chart_editions_v2') is null
     or to_regclass('public.wk_chart_entries_v2') is null then
    raise exception 'STOP: Chart V2 tables not found';
  end if;
end $$;

-- 1. Restore the shared publish guard to its pre-WK100 definition
--    (20260814202000_wakilisha_production_baseline.sql). Must happen before
--    the WK100 tables it currently references are dropped.
create or replace function public.wk_chart_editions_publish_integrity_guard()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.status = 'published'
     and old.status is distinct from new.status then
    perform public.chart_assert_publishable_edition(new.id);
  end if;

  return new;
end;
$$;

-- 2. Drop WK100 triggers on the live Chart V2 tables (they block deleting
--    WK100 rows and gate top100 promotion on WK100 ledgers).
do $$
declare r record;
begin
  for r in
    select t.tgname, c.relname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('wk_chart_editions_v2', 'wk_chart_entries_v2')
      and t.tgname like 'wk100\_%'
      and not t.tgisinternal
  loop
    execute format('drop trigger %I on public.%I', r.tgname, r.relname);
    raise notice 'dropped trigger % on %', r.tgname, r.relname;
  end loop;
end $$;

-- 3. Delete WK100 Editions and entries from the live tables.
create temporary table _wk100_editions (id text primary key) on commit drop;

do $$
declare src text;
begin
  -- Ledgers may be absent where a WK100 migration only reached Preview.
  foreach src in array array[
    'platform_private.wk100_governed_staged_editions_v1',
    'platform_private.wk100_governed_publications_v1',
    'platform_private.wk100_governed_withdrawals_v1'
  ] loop
    if to_regclass(src) is not null then
      execute format('insert into _wk100_editions select distinct edition_id::text from %s on conflict do nothing', src);
    end if;
  end loop;
  insert into _wk100_editions
    select id from public.wk_chart_editions_v2
    where program_id = 'top100'
      and (edition_label like 'WAKILISHA 100 — %' or id ~ '^wk100-ke-[0-9]{8}$')
  on conflict do nothing;
end $$;

do $$
declare n_entries bigint; n_editions bigint; n_coverage bigint := 0;
begin
  delete from public.wk_chart_entries_v2
   where edition_id in (select id from _wk100_editions);
  get diagnostics n_entries = row_count;

  if to_regclass('public.wk_chart_source_coverage_v2') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'wk_chart_source_coverage_v2'
                   and column_name = 'edition_id') then
    execute 'delete from public.wk_chart_source_coverage_v2 where edition_id::text in (select id from _wk100_editions)';
    get diagnostics n_coverage = row_count;
  end if;

  -- wk100_governed_withdrawals_v1 holds an FK to wk_chart_editions_v2; drop it
  -- before deleting Editions.
  drop table if exists platform_private.wk100_governed_withdrawals_v1;

  delete from public.wk_chart_editions_v2
   where id in (select id from _wk100_editions);
  get diagnostics n_editions = row_count;

  raise notice 'WK100 removed from Chart V2: % editions, % entries, % coverage rows',
    n_editions, n_entries, n_coverage;
end $$;

-- 4. Replace WK100 restrictive read policies with programme-neutral ones.
--    Same role separation as before (no privileged helper on anon).
drop policy if exists wk100_hide_nonpublished_editions_anon_v1 on public.wk_chart_editions_v2;
drop policy if exists wk100_hide_nonpublished_editions_auth_v1 on public.wk_chart_editions_v2;
drop policy if exists wk100_hide_nonpublished_entries_anon_v1 on public.wk_chart_entries_v2;
drop policy if exists wk100_hide_nonpublished_entries_auth_v1 on public.wk_chart_entries_v2;

create policy chart_v2_hide_nonpublished_editions_anon_v1
  on public.wk_chart_editions_v2 as restrictive for select to anon
  using (status = 'published');
create policy chart_v2_hide_nonpublished_editions_auth_v1
  on public.wk_chart_editions_v2 as restrictive for select to authenticated
  using (
    status = 'published'
    or public.current_user_has_capability('view_charts_admin')
    or public.current_user_is_administrator()
  );
create policy chart_v2_hide_nonpublished_entries_anon_v1
  on public.wk_chart_entries_v2 as restrictive for select to anon
  using (
    exists (
      select 1 from public.wk_chart_editions_v2 e
      where e.id = edition_id and e.status = 'published'
    )
  );
create policy chart_v2_hide_nonpublished_entries_auth_v1
  on public.wk_chart_entries_v2 as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.wk_chart_editions_v2 e
      where e.id = edition_id and (
        e.status = 'published'
        or public.current_user_has_capability('view_charts_admin')
        or public.current_user_is_administrator()
      )
    )
  );

-- 5. Drop the WK100 unique index on Chart V2 Editions.
drop index if exists public.wk100_unique_program_edition_date_v1;

-- 6. Drop every WK100 table. CASCADE removes their own triggers, policies,
--    indexes and intra-WK100 foreign keys. Tables are matched by exact
--    prefix in exact schemas only.
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm')
      and (
        (n.nspname = 'platform_private' and c.relname like 'wk100\_%')
        or (n.nspname = 'public' and (
              c.relname like 'wk100\_%'
              or c.relname like 'wk\_chart\_capture\_%'
              or c.relname = 'wk_chart_weekly_freezes_v1'))
        or (n.nspname = 'private' and c.relname like 'wk\_chart\_runtime\_%')
      )
  loop
    execute format('drop table if exists %I.%I cascade', r.nspname, r.relname);
    raise notice 'dropped table %.%', r.nspname, r.relname;
  end loop;
end $$;

-- 7. Drop every WK100 function (all overloads).
do $$
declare r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname in ('public', 'platform_private') and p.proname like 'wk100\_%')
       or (n.nspname in ('public', 'private') and p.proname like 'wk\_chart\_runtime\_%')
       or (n.nspname = 'private' and p.proname like 'wk\_chart\_capture\_%')
  loop
    execute format('drop function if exists %I.%I(%s) cascade', r.nspname, r.proname, r.args);
    raise notice 'dropped function %.%(%)', r.nspname, r.proname, r.args;
  end loop;
end $$;

-- 8. Verify nothing WK100 remains except the deliberately kept Registry policy.
do $$
declare leftovers text;
begin
  select string_agg(x, ', ') into leftovers from (
    select n.nspname || '.' || c.relname as x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p','v','m')
      and (c.relname like 'wk100\_%' or c.relname like 'wk\_chart\_capture\_%'
           or c.relname in ('wk_chart_weekly_freezes_v1','wk_chart_runtime_reservations_v1'))
    union all
    select n.nspname || '.' || p.proname || '()'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname like 'wk100\_%' or p.proname like 'wk\_chart\_runtime\_%'
       or (n.nspname = 'private' and p.proname like 'wk\_chart\_capture\_%')
    union all
    select 'policy ' || policyname from pg_policies
    where policyname like 'wk100\_%'
      and policyname <> 'wk100_registry_track_provider_links_admin_review_read_v1'
    union all
    select 'trigger ' || tgname from pg_trigger where tgname like 'wk100\_%' and not tgisinternal
    union all
    select 'edition ' || id from public.wk_chart_editions_v2
    where id ~ '^wk100-ke-' or edition_label like 'WAKILISHA 100 — %'
  ) s;
  if leftovers is not null then
    raise exception 'STOP: WK100 objects remain: %', leftovers;
  end if;
  if position('wk100' in pg_get_functiondef('public.wk_chart_editions_publish_integrity_guard()'::regprocedure)) > 0 then
    raise exception 'STOP: publish guard still references WK100';
  end if;
end $$;

-- 9. Storage bucket. Supabase blocks direct SQL deletes on storage tables.
--    Delete the bucket in Dashboard → Storage (empty it, then delete it) or via
--    the Storage API. 03-postflight-readonly.sql confirms it is gone.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'wk-chart-raw-evidence-v1') then
    raise notice 'ACTION REQUIRED: delete Storage bucket wk-chart-raw-evidence-v1 via Dashboard/API';
  end if;
end $$;

commit;
