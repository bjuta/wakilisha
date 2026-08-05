with resolved_usage as (
  select
    usage_row.id as usage_link_id,
    usage_row.asset_id,
    usage_row.resolution_mode,
    bridge_row.legacy_snapshot ->> 'url'
      as legacy_snapshot_url,
    compatibility_row.url
      as compatibility_url,
    resolved.logical_asset_id,
    resolved.resolved_mode,
    resolved.resolved_asset_revision_id,
    resolved.resolved_file_object_id,
    resolved.safe_delivery_url
  from media.usage_links usage_row
  join media.legacy_asset_links bridge_row
    on bridge_row.asset_id =
      usage_row.asset_id
  join public.registry_media_assets compatibility_row
    on compatibility_row.id =
      bridge_row.legacy_asset_id
  cross join lateral
    public.resolve_media_asset_delivery(
      usage_row.asset_id,
      usage_row.id,
      null,
      null
    ) resolved
  where usage_row.usage_state = 'active'
),
verification_state as (
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
           from resolved_usage
         ) = 985
         and not exists (
           select 1
           from resolved_usage
           where logical_asset_id <> asset_id
              or resolved_mode <>
                'legacy_snapshot'
              or resolved_asset_revision_id
                   is not null
              or resolved_file_object_id
                   is not null
              or nullif(
                btrim(safe_delivery_url),
                ''
              ) is null
         )
         and (
           select count(*)
           from resolved_usage
           where btrim(safe_delivery_url)
             is not distinct from
               btrim(legacy_snapshot_url)
         ) = 985
         and (
           select count(*)
           from resolved_usage
           where btrim(safe_delivery_url)
             is not distinct from
               btrim(compatibility_url)
         ) = 985
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
    'resolved_count',
      (
        select count(*)
        from resolved_usage
      ),
    'rejected_count',
      985 - (
        select count(*)
        from resolved_usage
      ),
    'legacy_url_parity_count',
      (
        select count(*)
        from resolved_usage
        where btrim(safe_delivery_url)
          is not distinct from
            btrim(legacy_snapshot_url)
      ),
    'compatibility_url_parity_count',
      (
        select count(*)
        from resolved_usage
        where btrim(safe_delivery_url)
          is not distinct from
            btrim(compatibility_url)
      ),
    'legacy_resolution_mode_count',
      (
        select count(*)
        from resolved_usage
        where resolved_mode =
          'legacy_snapshot'
      ),
    'active_usage_count',
      (
        select count(*)
        from media.usage_links
        where usage_state = 'active'
      ),
    'archived_usage_count',
      (
        select count(*)
        from media.usage_links
        where usage_state = 'archived'
      ),
    'media_event_count',
      (select count(*) from media.events),
    'file_object_count',
      (select count(*) from media.file_objects),
    'asset_revision_count',
      (select count(*) from media.asset_revisions),
    'variant_count',
      (select count(*) from media.variants),
    'variant_selection_count',
      (
        select count(*)
        from media.variant_selections
      ),
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
          and source_namespace.nspname <>
            'media'
          and referenced_namespace.nspname =
            'public'
          and referenced_table.relname =
            'registry_media_assets'
      ),
    'anonymous_resolver_grant_count',
      case
        when has_function_privilege(
          'anon',
          'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
          'EXECUTE'
        )
          then 1
        else 0
      end
  ) as result
)
select result as phase_4a_m5a_legacy_compatibility_resolver
from verification_state;
