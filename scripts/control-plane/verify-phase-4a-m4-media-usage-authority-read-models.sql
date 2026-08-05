begin;

set transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4a_m4_production_verifier$
declare
  v_count bigint;
  v_text text;
  v_definition text;
  v_target_definition text;
  v_usage record;
begin
  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
  then
    raise exception
      'STOP: Canonical Media identity baseline changed';
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
  ) <> 0 then
    raise exception
      'STOP: Migration 4 invented file, revision, or variant evidence';
  end if;

  if (select count(*) from media.usage_links) <> 987 then
    raise exception
      'STOP: Expected 987 shadow usage links';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where not media.usage_role_matches_target(
      usage_row.usage_role,
      usage_row.target_authority,
      usage_row.target_kind
    )
  ) then
    raise exception
      'STOP: A shadow usage role does not match its typed target';
  end if;

  for v_usage in
    select usage_row.*
    from media.usage_links usage_row
    order by usage_row.id
  loop
    perform media.validate_usage_target(
      '00000000-0000-4000-8000-000000000001'::uuid,
      v_usage.target_authority,
      v_usage.target_kind,
      v_usage.target_id,
      v_usage.target_version_kind,
      v_usage.target_version_id,
      false,
      v_usage.usage_state = 'active'
    );
  end loop;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.resolution_mode <>
        'legacy_snapshot'
       or usage_row.asset_revision_id is not null
       or usage_row.usage_revision <>
         case
           when usage_row.usage_state = 'active'
             then 1
           when usage_row.usage_state = 'archived'
             then 2
           else -1
         end
       or usage_row.placement_data ->> 'backfill'
          <> 'phase_4a_m4'
  ) then
    raise exception
      'STOP: Shadow usage resolution or revision state is incorrect';
  end if;

  if (
    select count(*)
    from media.usage_links usage_row
    where usage_row.usage_state = 'active'
  ) <> 985
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_state = 'archived'
     ) <> 2
     or exists (
       select 1
       from media.usage_links usage_row
       where usage_row.usage_state = 'detached'
     )
  then
    raise exception
      'STOP: Expected 985 active and 2 archived shadow usages';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.usage_state = 'archived'
      and (
        usage_row.target_authority <> 'registry'
        or usage_row.target_kind <> 'artist'
        or usage_row.usage_role <> 'artist_portrait'
        or usage_row.usage_revision <> 2
        or usage_row.state_reason <>
          'Compatibility target was already archived at Phase 4A Migration 4 backfill'
        or usage_row.state_changed_by is distinct from
          'f4a40000-0000-4000-8000-000000000004'::uuid
        or usage_row.state_changed_at is null
        or usage_row.updated_at is distinct from
          usage_row.state_changed_at
        or (
          usage_row.target_id,
          usage_row.asset_id
        ) not in (
          (
            'd3c7ebee-4354-4df5-b3ee-91998719b7b4'::uuid,
            '7bff42c9-fe93-4568-a4cd-b683fae97418'::uuid
          ),
          (
            'dbc82131-40f6-4e45-8ae5-d08d7b86a0bc'::uuid,
            '8f37b111-60c4-4578-8274-5d73e0a337ca'::uuid
          )
        )
      )
  ) then
    raise exception
      'STOP: Archived shadow usage identity or lifecycle metadata changed';
  end if;

  if (
    select count(*)
    from media.usage_links usage_row
    where usage_row.usage_role = 'guide_hero'
  ) <> 2
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'artist_portrait'
     ) <> 307
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'release_artwork'
     ) <> 170
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'track_artwork'
     ) <> 306
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'article_hero'
     ) <> 202
  then
    raise exception
      'STOP: Shadow usage role counts changed';
  end if;

  if (
    select count(*)
    from media.events event_row
    where event_row.event_type =
      'usage_attached'
  ) <> 987
     or (
       select count(*)
       from media.events event_row
       where event_row.event_type =
         'usage_archived'
     ) <> 2
     or (select count(*) from media.events) <> 3147
  then
    raise exception
      'STOP: Migration 4 event counts changed';
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_text
  from public.registry_media_assets asset_row;

  if v_text <> 'f32e074f96b01549b5e597ad8b5f4324' then
    raise exception
      'STOP: Compatibility asset fingerprint changed: %',
      v_text;
  end if;

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
  into v_text
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_text <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: Compatibility foreign-key fingerprint changed: %',
      v_text;
  end if;

  select count(*)
  into v_count
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'media'
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE'
    );

  if v_count <> 0 then
    raise exception
      'STOP: Authenticated direct Media writes are exposed';
  end if;

  if has_function_privilege(
       'authenticated',
       'media.usage_role_matches_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'media.usage_target_snapshot_is_attachable(jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Internal typed-target helpers are exposed to authenticated users';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.detach_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.archive_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_media_assets_v2(text,text,text,text,integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_media_asset_v2(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Authenticated Migration 4 grants are incomplete';
  end if;

  if not has_function_privilege(
       'anon',
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.detach_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.archive_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Anonymous Migration 4 grants are incorrect';
  end if;

  select pg_get_functiondef(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if to_regprocedure(
       'media.usage_role_matches_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'media.usage_target_snapshot_is_attachable(jsonb)'
     ) is null
     or to_regprocedure(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'
     ) is null
  then
    raise exception
      'STOP: Typed target validator functions are incomplete';
  end if;

  select pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  )
  into v_target_definition;

  if position(
       'public.wk_chart_entries_v2'
       in v_target_definition
     ) > 0
  then
    raise exception
      'STOP: Text-keyed chart compatibility identity entered the typed Media target validator';
  end if;

  if position(
       'media.legacy_asset_links'
       in v_definition
     ) = 0
     or position(
       'media.variant_selections'
       in v_definition
     ) = 0
     or position(
       'public.registry_media_assets'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: Public Media resolver authority is incorrect';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.placement_data ->>
      'compatibility_source_table' =
        'registry_provenance_links'
  ) then
    raise exception
      'STOP: Registry provenance was converted into Media usage';
  end if;
end;
$phase_4a_m4_production_verifier$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_scope',
    'usage_authority_read_models',
  'canonical_asset_count',
    (select count(*) from media.assets),
  'legacy_bridge_count',
    (select count(*) from media.legacy_asset_links),
  'file_object_count',
    (select count(*) from media.file_objects),
  'asset_revision_count',
    (select count(*) from media.asset_revisions),
  'variant_count',
    (select count(*) from media.variants),
  'variant_selection_count',
    (select count(*) from media.variant_selections),
  'shadow_usage_count',
    (select count(*) from media.usage_links),
  'active_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_state = 'active'
    ),
  'archived_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_state = 'archived'
    ),
  'guide_hero_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_role = 'guide_hero'
    ),
  'artist_portrait_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_role =
        'artist_portrait'
    ),
  'release_artwork_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_role =
        'release_artwork'
    ),
  'track_artwork_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_role =
        'track_artwork'
    ),
  'article_hero_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_role =
        'article_hero'
    ),
  'usage_attached_event_count',
    (
      select count(*)
      from media.events event_row
      where event_row.event_type =
        'usage_attached'
    ),
  'usage_archived_event_count',
    (
      select count(*)
      from media.events event_row
      where event_row.event_type =
        'usage_archived'
    ),
  'total_media_event_count',
    (select count(*) from media.events),
  'migration_3_command_count', 9,
  'migration_4_command_count', 3,
  'internal_read_count', 2,
  'public_resolver_count', 1,
  'typed_role_validator_count', 1,
  'target_lifecycle_validator_count', 1,
  'anonymous_resolver_grant_count',
    case
      when has_function_privilege(
        'anon',
        'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
        'EXECUTE'
      )
        then 1
      else 0
    end,
  'anonymous_command_grant_count', 0,
  'authenticated_direct_write_grant_count', 0,
  'compatibility_asset_fingerprint',
    'f32e074f96b01549b5e597ad8b5f4324',
  'compatibility_fk_fingerprint',
    '54274ae6a613d38c257c543ccf7050cc'
) as phase_4a_m4_media_usage_authority_read_models;

rollback;
