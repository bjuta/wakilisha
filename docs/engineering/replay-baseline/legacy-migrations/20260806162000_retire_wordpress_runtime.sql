-- Retire the completed WordPress import and promotion runtime.
--
-- This migration does not rewrite applied migration history, delete canonical
-- WAKILISHA content, remove registered Media, or drop historical provenance
-- columns. Source-schema neutralization follows only after a data-preservation
-- proof.

do $wordpress_runtime_preflight$
declare
  function_contract record;
  actual_md5 text;
begin
  if to_regclass(
    'wakilisha_raw.wk_wordpress_items'
  ) is null then
    raise exception
      'STOP: wakilisha_raw.wk_wordpress_items is missing';
  end if;

  if (
    select count(*)
    from wakilisha_raw.wk_wordpress_items
  ) <> 0 then
    raise exception
      'STOP: WordPress raw item table is not empty';
  end if;

  for function_contract in
    select *
    from (
      values
        ('public.finalize_wp_staging(uuid)', '359e4c635e5318782617619f9f32f756'),
        ('public.promote_manual_wkcharts_artist_genre_relationships()', '75f70cef2f2e725e34a1fb3b6ed39554'),
        ('public.promote_ready_artist_relationships()', 'c6531f41df33e05fd5088b4e6c64a916'),
        ('public.promote_ready_chart_entry_links()', '5f53b636f861a21cb5791bb9ac023f1a'),
        ('public.promote_ready_wkcharts_artist_genre_relationships()', '175ba8727d0bcfe39bd90e9d66cd61c8'),
        ('public.promote_ready_wkcharts_entity_relationships()', 'b15531d9d85de55ec8d0d8d3a04527cb'),
        ('public.promote_ready_wkcharts_release_chart_entry_relationships()', '1081994e64699629828ecf923a2739cf'),
        ('public.promote_ready_wkcharts_track_chart_entry_relationships()', '1d27047b9b276952e72cab11e06538ba'),
        ('public.promote_ready_wkcharts_track_release_relationships()', '352141de3972f1578c7e7033435d0276'),
        ('public.promote_ready_wp_relationships_safe()', '55e7db81fbaa0dde312326010f384383'),
        ('public.promote_slug_repaired_chart_entry_links()', '51558a0abe48e7f38919732d6ef97d30'),
        ('public.promote_wp_relationships_article_genre_holds()', 'e238b98e5ab2e6f73d127a04cdd97a06')
    ) as expected_function(
      identity,
      source_md5
    )
  loop
    if to_regprocedure(
      function_contract.identity
    ) is null then
      raise exception
        'STOP: Expected function is missing: %',
        function_contract.identity;
    end if;

    select md5(procedure_row.prosrc)
    into actual_md5
    from pg_proc procedure_row
    where procedure_row.oid =
      to_regprocedure(
        function_contract.identity
      );

    if actual_md5 <>
      function_contract.source_md5
    then
      raise exception
        'STOP: Function body changed for %',
        function_contract.identity;
    end if;
  end loop;
end;
$wordpress_runtime_preflight$;

revoke all on function public.finalize_wp_staging(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.promote_manual_wkcharts_artist_genre_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_artist_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_chart_entry_links()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wkcharts_artist_genre_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wkcharts_entity_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wkcharts_release_chart_entry_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wkcharts_track_chart_entry_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wkcharts_track_release_relationships()
from public, anon, authenticated, service_role;
revoke all on function public.promote_ready_wp_relationships_safe()
from public, anon, authenticated, service_role;
revoke all on function public.promote_slug_repaired_chart_entry_links()
from public, anon, authenticated, service_role;
revoke all on function public.promote_wp_relationships_article_genre_holds()
from public, anon, authenticated, service_role;

drop function public.finalize_wp_staging(uuid);
drop function public.promote_manual_wkcharts_artist_genre_relationships();
drop function public.promote_ready_artist_relationships();
drop function public.promote_ready_chart_entry_links();
drop function public.promote_ready_wkcharts_artist_genre_relationships();
drop function public.promote_ready_wkcharts_entity_relationships();
drop function public.promote_ready_wkcharts_release_chart_entry_relationships();
drop function public.promote_ready_wkcharts_track_chart_entry_relationships();
drop function public.promote_ready_wkcharts_track_release_relationships();
drop function public.promote_ready_wp_relationships_safe();
drop function public.promote_slug_repaired_chart_entry_links();
drop function public.promote_wp_relationships_article_genre_holds();

drop table wakilisha_raw.wk_wordpress_items;
