-- WAKILISHA Charts reset — 04 OPTIONAL: take the legacy playlist-built charts offline
--
-- Not part of the WK100 teardown. Decide separately.
-- Reversible: rows are kept, only status changes. Public pages read status='published' only,
-- so these Editions disappear from /charts while staying in the database.
--
-- To undo: update public.wk_chart_editions_v2 set status = 'published'
--          where status = 'archived_2026_11_17_reset';

begin;

-- Preview what will be hidden.
select program_id, count(*) as published_editions, min(edition_date), max(edition_date)
from public.wk_chart_editions_v2
where status = 'published'
  and program_id in ('top100', 'toprnb')   -- edit this list deliberately
group by program_id;

update public.wk_chart_editions_v2
   set status = 'archived_2026_11_17_reset'
 where status = 'published'
   and program_id in ('top100', 'toprnb');  -- same list as above

commit;
