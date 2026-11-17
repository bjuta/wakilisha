-- WAKILISHA Charts reset — 01 PREFLIGHT (read-only)
-- Run against Production before the teardown. Changes nothing.
-- Paste the full output into the cleanup record before running 02.

-- 1. What WK100 put into the live public chart tables.
--    (Editions referenced by any WK100 ledger, or labelled by the WK100 publisher.)
with wk100_editions as (
  select edition_id::text as id from platform_private.wk100_governed_staged_editions_v1
  union select edition_id::text from platform_private.wk100_governed_publications_v1
  union select edition_id::text from platform_private.wk100_governed_withdrawals_v1
  union select id from public.wk_chart_editions_v2
        where program_id = 'top100' and edition_label like 'WAKILISHA 100 — %'
)
select e.id, e.program_id, e.edition_label, e.edition_date, e.status,
       (select count(*) from public.wk_chart_entries_v2 x where x.edition_id = e.id) as entries
from public.wk_chart_editions_v2 e
where e.id in (select id from wk100_editions)
order by e.edition_date;

-- 2. Every programme and how many editions each has, by status.
--    top100 = the Kenya Top 100 series (WK100 wrote into this programme).
select program_id, status, count(*) as editions,
       min(edition_date) as first_edition, max(edition_date) as last_edition
from public.wk_chart_editions_v2
group by program_id, status
order by program_id, status;

-- 3. Row counts in every WK100-owned table (what the teardown will delete).
select 'platform_private.' || c.relname as table_name, c.reltuples::bigint as approx_rows
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'wk100\_%'
union all
select n.nspname || '.' || c.relname, c.reltuples::bigint
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and (
  (n.nspname = 'public' and (c.relname like 'wk100\_%' or c.relname like 'wk\_chart\_capture\_%' or c.relname = 'wk_chart_weekly_freezes_v1'))
  or (n.nspname = 'private' and c.relname = 'wk_chart_runtime_reservations_v1'))
order by 1;

-- 4. Raw evidence held in Storage.
select bucket_id, count(*) as objects, pg_size_pretty(sum((metadata->>'size')::bigint)) as total_size
from storage.objects where bucket_id = 'wk-chart-raw-evidence-v1' group by bucket_id;

-- 5. WK100 functions, triggers and policies that will be removed.
select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname in ('public','platform_private') and p.proname like 'wk100\_%')
   or (n.nspname in ('public','private') and p.proname like 'wk\_chart\_runtime\_%')
   or (n.nspname = 'private' and p.proname like 'wk\_chart\_capture\_%')
order by 1;

select event_object_schema || '.' || event_object_table as on_table, trigger_name
from information_schema.triggers
where event_object_table in ('wk_chart_editions_v2','wk_chart_entries_v2') and trigger_name like 'wk100\_%'
group by 1, 2 order by 1, 2;

select schemaname || '.' || tablename as on_table, policyname
from pg_policies where policyname like 'wk100\_%' order by 1, 2;

-- 6. Confirm the shared publish guard currently depends on WK100 tables
--    (the teardown restores its pre-WK100 definition).
select position('wk100_governed_publications_v1' in pg_get_functiondef('public.wk_chart_editions_publish_integrity_guard()'::regprocedure)) > 0
  as publish_guard_depends_on_wk100;

-- 7. Which WK100/chart Edge Functions are deployed is NOT visible from SQL.
--    Check: Supabase Dashboard → Edge Functions (names listed in the cleanup record),
--    and the last 14 days of invocations for each.
