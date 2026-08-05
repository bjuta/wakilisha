with active_legacy_assets as (
  select distinct on (usage_row.asset_id)
    usage_row.asset_id,
    compatibility_row.url
      as compatibility_url,
    compatibility_row.metadata
      as compatibility_metadata,
    bridge_row.legacy_snapshot ->> 'url'
      as legacy_snapshot_url
  from media.usage_links usage_row
  join public.registry_media_assets
    compatibility_row
    on compatibility_row.id =
      usage_row.asset_id
  join media.legacy_asset_links bridge_row
    on bridge_row.asset_id =
      usage_row.asset_id
  where usage_row.usage_state = 'active'
    and usage_row.resolution_mode =
      'legacy_snapshot'
  order by
    usage_row.asset_id,
    usage_row.created_at,
    usage_row.id
),
input_sets as (
  select
    array_agg(
      asset_row.asset_id
      order by asset_row.asset_id
    ) as asset_ids,
    array_agg(
      asset_row.compatibility_url
      order by asset_row.asset_id
    ) as urls,
    count(*) as distinct_asset_count
  from active_legacy_assets asset_row
),
id_results as (
  select result_row.*
  from input_sets input_row
  cross join lateral
    public.resolve_legacy_media_asset_lite_batch(
      input_row.asset_ids,
      null
    ) result_row
),
url_results as (
  select result_row.*
  from input_sets input_row
  cross join lateral
    public.resolve_legacy_media_asset_lite_batch(
      null,
      input_row.urls
    ) result_row
),
invalid_url_results as (
  select result_row.*
  from public.resolve_legacy_media_asset_lite_batch(
    null,
    array[
      'https://invalid.wakilisha.example/phase4a-m5b-not-found'
    ]::text[]
  ) result_row
)
select jsonb_build_object(
  'verification',
    case
      when (
        select count(*)
        from media.usage_links
        where usage_state = 'active'
          and resolution_mode =
            'legacy_snapshot'
      ) = 985
       and (
         select count(*)
         from id_results
       ) = (
         select distinct_asset_count
         from input_sets
       )
       and (
         select count(*)
         from url_results
       ) = (
         select distinct_asset_count
         from input_sets
       )
       and not exists (
         (
           select id
           from id_results
           except
           select id
           from url_results
         )
         union all
         (
           select id
           from url_results
           except
           select id
           from id_results
         )
       )
       and not exists (
         select 1
         from id_results result_row
         join active_legacy_assets asset_row
           on asset_row.asset_id =
             result_row.id
         join media.usage_links usage_row
           on usage_row.id =
             result_row.usage_link_id
         where result_row.requested_asset_id
                 is distinct from result_row.id
            or result_row.requested_url
                 is not null
            or result_row.resolved_mode <>
                 'legacy_snapshot'
            or usage_row.usage_state <>
                 'active'
            or usage_row.resolution_mode <>
                 'legacy_snapshot'
            or btrim(result_row.url)
                 is distinct from
                   btrim(
                     asset_row.legacy_snapshot_url
                   )
            or btrim(result_row.url)
                 is distinct from
                   btrim(
                     asset_row.compatibility_url
                   )
            or result_row.metadata
                 is distinct from
                   asset_row.compatibility_metadata
       )
       and not exists (
         select 1
         from url_results result_row
         join active_legacy_assets asset_row
           on asset_row.asset_id =
             result_row.id
         where result_row.requested_asset_id
                 is not null
            or btrim(result_row.requested_url)
                 is distinct from
                   btrim(
                     asset_row.compatibility_url
                   )
            or btrim(result_row.url)
                 is distinct from
                   btrim(
                     asset_row.legacy_snapshot_url
                   )
       )
       and (
         select count(*)
         from invalid_url_results
       ) = 0
       and (
         select count(*)
         from media.usage_links
         where usage_state = 'archived'
       ) = 2
       and (
         select count(*)
         from media.events
       ) = 3147
       and (
         select count(*)
         from media.file_objects
       ) = 0
       and (
         select count(*)
         from media.asset_revisions
       ) = 0
       and (
         select count(*)
         from media.variants
       ) = 0
       and (
         select count(*)
         from media.variant_selections
       ) = 0
       and (
         select md5(
           string_agg(
             to_jsonb(asset_row)::text,
             E'\n'
             order by asset_row.id::text
           )
         )
         from public.registry_media_assets
           asset_row
       ) =
         'f32e074f96b01549b5e597ad8b5f4324'
       and (
         select md5(
           coalesce(
             string_agg(
               concat_ws(
                 '|',
                 source_namespace.nspname,
                 source_table.relname,
                 constraint_row.conname,
                 pg_get_constraintdef(
                   constraint_row.oid,
                   true
                 )
               ),
               E'\n'
               order by
                 source_namespace.nspname,
                 source_table.relname,
                 constraint_row.conname
             ),
             ''
           )
         )
         from pg_constraint constraint_row
         join pg_class source_table
           on source_table.oid =
             constraint_row.conrelid
         join pg_namespace source_namespace
           on source_namespace.oid =
             source_table.relnamespace
         join pg_class referenced_table
           on referenced_table.oid =
             constraint_row.confrelid
         join pg_namespace referenced_namespace
           on referenced_namespace.oid =
             referenced_table.relnamespace
         where constraint_row.contype = 'f'
           and source_namespace.nspname <>
             'media'
           and referenced_namespace.nspname =
             'public'
           and referenced_table.relname =
             'registry_media_assets'
       ) =
         '54274ae6a613d38c257c543ccf7050cc'
        then 'PASS'
      else 'FAIL'
    end,
  'active_legacy_usage_count',
    (
      select count(*)
      from media.usage_links
      where usage_state = 'active'
        and resolution_mode =
          'legacy_snapshot'
    ),
  'distinct_active_legacy_asset_count',
    (
      select distinct_asset_count
      from input_sets
    ),
  'id_lookup_result_count',
    (select count(*) from id_results),
  'url_lookup_result_count',
    (select count(*) from url_results),
  'asset_set_parity',
    case
      when not exists (
        (
          select id
          from id_results
          except
          select id
          from url_results
        )
        union all
        (
          select id
          from url_results
          except
          select id
          from id_results
        )
      )
        then 'PASS'
      else 'FAIL'
    end,
  'legacy_url_parity_count',
    (
      select count(*)
      from id_results result_row
      join active_legacy_assets asset_row
        on asset_row.asset_id =
          result_row.id
      where btrim(result_row.url)
        is not distinct from
          btrim(asset_row.legacy_snapshot_url)
    ),
  'compatibility_url_parity_count',
    (
      select count(*)
      from id_results result_row
      join active_legacy_assets asset_row
        on asset_row.asset_id =
          result_row.id
      where btrim(result_row.url)
        is not distinct from
          btrim(asset_row.compatibility_url)
    ),
  'metadata_parity_count',
    (
      select count(*)
      from id_results result_row
      join active_legacy_assets asset_row
        on asset_row.asset_id =
          result_row.id
      where result_row.metadata
        is not distinct from
          asset_row.compatibility_metadata
    ),
  'invalid_url_result_count',
    (select count(*) from invalid_url_results),
  'anonymous_adapter_grant_count',
    case
      when has_function_privilege(
        'anon',
        'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])',
        'EXECUTE'
      )
        then 1
      else 0
    end,
  'compatibility_asset_fingerprint',
    (
      select md5(
        string_agg(
          to_jsonb(asset_row)::text,
          E'\n'
          order by asset_row.id::text
        )
      )
      from public.registry_media_assets
        asset_row
    ),
  'compatibility_fk_fingerprint',
    (
      select md5(
        coalesce(
          string_agg(
            concat_ws(
              '|',
              source_namespace.nspname,
              source_table.relname,
              constraint_row.conname,
              pg_get_constraintdef(
                constraint_row.oid,
                true
              )
            ),
            E'\n'
            order by
              source_namespace.nspname,
              source_table.relname,
              constraint_row.conname
          ),
          ''
        )
      )
      from pg_constraint constraint_row
      join pg_class source_table
        on source_table.oid =
          constraint_row.conrelid
      join pg_namespace source_namespace
        on source_namespace.oid =
          source_table.relnamespace
      join pg_class referenced_table
        on referenced_table.oid =
          constraint_row.confrelid
      join pg_namespace referenced_namespace
        on referenced_namespace.oid =
          referenced_table.relnamespace
      where constraint_row.contype = 'f'
        and source_namespace.nspname <> 'media'
        and referenced_namespace.nspname = 'public'
        and referenced_table.relname =
          'registry_media_assets'
    )
) as phase_4a_m5b_legacy_media_read_adapter;
