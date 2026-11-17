-- WAKILISHA Charts reset — 03 POSTFLIGHT (read-only)
-- Run after 02. Every row should read ok = true.

select 'no WK100 tables' as check_name,
       not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where c.relkind in ('r','p','v','m')
                     and (c.relname like 'wk100\_%' or c.relname like 'wk\_chart\_capture\_%'
                          or c.relname in ('wk_chart_weekly_freezes_v1','wk_chart_runtime_reservations_v1'))) as ok
union all
select 'no WK100 functions',
       not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where p.proname like 'wk100\_%' or p.proname like 'wk\_chart\_runtime\_%'
                      or (n.nspname = 'private' and p.proname like 'wk\_chart\_capture\_%'))
union all
select 'no WK100 triggers',
       not exists (select 1 from pg_trigger where tgname like 'wk100\_%' and not tgisinternal)
union all
select 'only the kept Registry policy carries a wk100 name',
       not exists (select 1 from pg_policies where policyname like 'wk100\_%'
                   and policyname <> 'wk100_registry_track_provider_links_admin_review_read_v1')
union all
select 'programme-neutral hide policies present',
       (select count(*) from pg_policies where policyname like 'chart\_v2\_hide\_nonpublished\_%') = 4
union all
select 'no WK100 editions in Chart V2',
       not exists (select 1 from public.wk_chart_editions_v2
                   where id ~ '^wk100-ke-' or edition_label like 'WAKILISHA 100 — %')
union all
select 'publish guard restored (no WK100 reference)',
       position('wk100' in pg_get_functiondef('public.wk_chart_editions_publish_integrity_guard()'::regprocedure)) = 0
union all
select 'raw evidence bucket deleted',
       not exists (select 1 from storage.buckets where id = 'wk-chart-raw-evidence-v1')
union all
select 'top100 programme row still exists',
       exists (select 1 from public.wk_chart_programs_v2 where id = 'top100');

-- Compare with preflight query 2: published counts per programme should be
-- unchanged except for the WK100 Editions listed in preflight query 1.
select program_id, status, count(*) as editions,
       min(edition_date) as first_edition, max(edition_date) as last_edition
from public.wk_chart_editions_v2
group by program_id, status
order by program_id, status;
