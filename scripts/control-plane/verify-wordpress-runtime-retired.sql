do $wordpress_runtime_retired$
declare
  function_identity text;
begin
  if to_regclass(
    'wakilisha_raw.wk_wordpress_items'
  ) is not null then
    raise exception
      'STOP: WordPress raw item table still exists';
  end if;

  foreach function_identity in array array[
    'public.finalize_wp_staging(uuid)',
    'public.promote_manual_wkcharts_artist_genre_relationships()',
    'public.promote_ready_artist_relationships()',
    'public.promote_ready_chart_entry_links()',
    'public.promote_ready_wkcharts_artist_genre_relationships()',
    'public.promote_ready_wkcharts_entity_relationships()',
    'public.promote_ready_wkcharts_release_chart_entry_relationships()',
    'public.promote_ready_wkcharts_track_chart_entry_relationships()',
    'public.promote_ready_wkcharts_track_release_relationships()',
    'public.promote_ready_wp_relationships_safe()',
    'public.promote_slug_repaired_chart_entry_links()',
    'public.promote_wp_relationships_article_genre_holds()'
  ]
  loop
    if to_regprocedure(
      function_identity
    ) is not null then
      raise exception
        'STOP: Retired function still exists: %',
        function_identity;
    end if;
  end loop;

  if (select count(*) from media.assets) <> 1080
     or (
       select count(*)
       from public.registry_media_assets
     ) <> 1080
     or (
       select count(*)
       from media.usage_links
     ) <> 987
     or (
       select count(*)
       from media.file_objects
     ) <> 4
     or (
       select count(*)
       from media.asset_revisions
     ) <> 2
  then
    raise exception
      'STOP: Media acceptance graph changed during retirement';
  end if;
end;
$wordpress_runtime_retired$;

select jsonb_pretty(
  jsonb_build_object(
    'verification',
      'WORDPRESS_RUNTIME_RETIRED_PASS',
    'raw_wordpress_table_exists',
      false,
    'retired_function_count',
      12,
    'canonical_media_assets',
      (select count(*) from media.assets),
    'compatibility_media_assets',
      (
        select count(*)
        from public.registry_media_assets
      ),
    'media_usage_links',
      (select count(*) from media.usage_links),
    'media_file_objects',
      (select count(*) from media.file_objects),
    'media_asset_revisions',
      (select count(*) from media.asset_revisions)
  )
) as wordpress_runtime_retired;
