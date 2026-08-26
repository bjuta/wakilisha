-- Permanent read-only verifier for Phase 6A M1.
--
-- This script performs no inserts, updates, deletes, DDL, or fixture creation.

do $verify_phase_6a_m1_audio_identity_working_versions$
declare
  v_kind_count integer;
  v_capability_count integer;
  v_command_count integer;
  v_bad_role_grants integer;
  v_bad_bindings integer;
  v_bad_resource_pointers integer;
  v_audio_rls_count integer;
  v_public_audio_table_grants integer;
  v_binding_definition text;
  v_immutable_trigger_count integer;
begin
  if to_regnamespace('audio') is null then
    raise exception
      'FAIL: audio schema is missing';
  end if;

  if to_regclass('audio.shows') is null
     or to_regclass('audio.seasons') is null
     or to_regclass('audio.publications') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('editorial.audio_show_resources') is null
     or to_regclass('editorial.audio_season_resources') is null
     or to_regclass('editorial.audio_publication_resources') is null
  then
    raise exception
      'FAIL: one or more Audio M1 canonical tables are missing';
  end if;

  select count(*)
  into v_kind_count
  from editorial.resource_kinds
  where kind in (
    'audio_show',
    'audio_season',
    'audio_episode',
    'standalone_audio'
  )
    and enabled;

  if v_kind_count <> 4 then
    raise exception
      'FAIL: expected 4 enabled Audio Resource kinds, found %',
      v_kind_count;
  end if;

  select count(*)
  into v_capability_count
  from public.capability_definitions
  where capability_key in (
    'view_audio',
    'edit_own_audio',
    'edit_others_audio',
    'publish_audio',
    'delete_audio'
  )
    and domain = 'content';

  if v_capability_count <> 5 then
    raise exception
      'FAIL: expected 5 Audio capabilities, found %',
      v_capability_count;
  end if;

  with expected(role_key, capability_key) as (
    values
      ('administrator', 'view_audio'),
      ('editor', 'view_audio'),
      ('reviewer', 'view_audio'),
      ('administrator', 'edit_own_audio'),
      ('editor', 'edit_own_audio'),
      ('author', 'edit_own_audio'),
      ('writer', 'edit_own_audio'),
      ('administrator', 'edit_others_audio'),
      ('editor', 'edit_others_audio'),
      ('administrator', 'publish_audio'),
      ('editor', 'publish_audio'),
      ('administrator', 'delete_audio'),
      ('editor', 'delete_audio')
  )
  select count(*)
  into v_bad_role_grants
  from expected
  where not exists (
    select 1
    from public.role_capabilities grant_row
    where grant_row.role_key = expected.role_key
      and grant_row.capability_key =
            expected.capability_key
  );

  if v_bad_role_grants <> 0 then
    raise exception
      'FAIL: % expected Audio role grants are missing',
      v_bad_role_grants;
  end if;

  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'audio.show.create',
    'audio.show.metadata.update',
    'audio.season.create',
    'audio.season.metadata.update',
    'audio.publication.create',
    'audio.publication.metadata.update',
    'audio.publication.version.snapshot_working'
  )
    and enabled;

  if v_command_count <> 7 then
    raise exception
      'FAIL: expected 7 enabled Audio M1 command types, found %',
      v_command_count;
  end if;

  if to_regprocedure(
       'public.create_audio_show(text,text,text,text,text,jsonb,uuid)'
     ) is null
     or to_regprocedure(
       'public.update_audio_show_metadata(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_audio_season(uuid,integer,text,text,text,jsonb,uuid)'
     ) is null
     or to_regprocedure(
       'public.update_audio_season_metadata(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)'
     ) is null
     or to_regprocedure(
       'public.update_audio_publication_metadata(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: one or more Audio M1 governed RPCs are missing';
  end if;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if position(
       'when ''audio_show'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''audio_season'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''audio_episode'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''standalone_audio'''
       in v_binding_definition
     ) = 0
  then
    raise exception
      'FAIL: Resource binding integrity does not understand every Audio kind';
  end if;

  select count(*)
  into v_bad_bindings
  from (
    select resource.id
    from editorial.resources resource
    left join editorial.audio_show_resources binding
      on binding.resource_id = resource.id
     and binding.resource_kind = 'audio_show'
    where resource.resource_kind = 'audio_show'
      and binding.resource_id is null

    union all

    select resource.id
    from editorial.resources resource
    left join editorial.audio_season_resources binding
      on binding.resource_id = resource.id
     and binding.resource_kind = 'audio_season'
    where resource.resource_kind = 'audio_season'
      and binding.resource_id is null

    union all

    select resource.id
    from editorial.resources resource
    left join editorial.audio_publication_resources binding
      on binding.resource_id = resource.id
     and binding.resource_kind =
           resource.resource_kind
    where resource.resource_kind in (
      'audio_episode',
      'standalone_audio'
    )
      and binding.resource_id is null
  ) bad_binding;

  if v_bad_bindings <> 0 then
    raise exception
      'FAIL: % Audio Resources are missing typed bindings',
      v_bad_bindings;
  end if;

  if exists (
    select 1
    from editorial.audio_show_resources binding
    join audio.shows show_row
      on show_row.id = binding.show_id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where binding.resource_id <> binding.show_id
       or resource.resource_kind <> 'audio_show'
  )
  then
    raise exception
      'FAIL: Audio Show typed identity is inconsistent';
  end if;

  if exists (
    select 1
    from editorial.audio_season_resources binding
    join audio.seasons season_row
      on season_row.id = binding.season_id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where binding.resource_id <> binding.season_id
       or resource.resource_kind <> 'audio_season'
  )
  then
    raise exception
      'FAIL: Audio Season typed identity is inconsistent';
  end if;

  if exists (
    select 1
    from editorial.audio_publication_resources binding
    join audio.publications publication
      on publication.id = binding.publication_id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where binding.resource_id <>
            binding.publication_id
       or resource.resource_kind <>
          case publication.publication_kind
            when 'episode'
              then 'audio_episode'
            when 'standalone'
              then 'standalone_audio'
          end
  )
  then
    raise exception
      'FAIL: Audio publication typed identity is inconsistent';
  end if;

  select count(*)
  into v_bad_resource_pointers
  from (
    select resource.id
    from editorial.resources resource
    left join editorial.audio_publication_resources binding
      on binding.resource_id = resource.id
    where resource.resource_kind in (
      'audio_episode',
      'standalone_audio'
    )
      and (
        binding.resource_id is null
        or (
          resource.current_working_version_id,
          resource.current_submitted_version_id,
          resource.current_approved_version_id,
          resource.current_published_version_id
        ) is distinct from (
          binding.current_working_version_id,
          binding.current_submitted_version_id,
          binding.current_approved_version_id,
          binding.current_published_version_id
        )
      )

    union all

    select resource.id
    from editorial.resources resource
    where resource.resource_kind in (
      'audio_show',
      'audio_season'
    )
      and (
        resource.current_working_version_id is not null
        or resource.current_submitted_version_id is not null
        or resource.current_approved_version_id is not null
        or resource.current_published_version_id is not null
      )
  ) bad_pointer;

  if v_bad_resource_pointers <> 0 then
    raise exception
      'FAIL: % Audio Resource lifecycle pointer compatibility mismatch(es)',
      v_bad_resource_pointers;
  end if;

  if exists (
    select 1
    from editorial.audio_publication_resources binding
    join audio.publication_versions version
      on version.id =
           binding.current_working_version_id
    where version.version_kind <> 'working'
       or version.resource_id <>
            binding.resource_id
       or version.publication_id <>
            binding.publication_id
  )
  then
    raise exception
      'FAIL: current Audio working-version pointers are inconsistent';
  end if;

  select count(*)
  into v_immutable_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid =
        'audio.publication_versions'::regclass
    and trigger_row.tgname =
        'audio_publication_versions_immutable'
    and not trigger_row.tgisinternal;

  if v_immutable_trigger_count <> 1 then
    raise exception
      'FAIL: Audio publication version immutability trigger is missing';
  end if;

  select count(*)
  into v_audio_rls_count
  from pg_class table_row
  join pg_namespace schema_row
    on schema_row.oid =
       table_row.relnamespace
  where schema_row.nspname = 'audio'
    and table_row.relname in (
      'shows',
      'seasons',
      'publications',
      'publication_versions'
    )
    and table_row.relrowsecurity;

  if v_audio_rls_count <> 4 then
    raise exception
      'FAIL: expected RLS on all 4 Audio domain tables, found %',
      v_audio_rls_count;
  end if;

  select count(*)
  into v_public_audio_table_grants
  from information_schema.table_privileges privilege
  where privilege.table_schema = 'audio'
    and privilege.grantee in (
      'PUBLIC',
      'anon',
      'authenticated'
    );

  if v_public_audio_table_grants <> 0 then
    raise exception
      'FAIL: direct public/authenticated Audio table grants remain';
  end if;

  raise notice
    'PASS: Phase 6A M1 Audio identity, typed Resource bindings, capability authority, governed commands, immutable working versions, and Article-pointer separation verified.';
end;
$verify_phase_6a_m1_audio_identity_working_versions$;

