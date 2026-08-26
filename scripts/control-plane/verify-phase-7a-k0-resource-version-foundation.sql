-- Permanent read-only verifier for Phase 7A K0 Resource Version foundation.

begin;

set local transaction read only;
set local statement_timeout = '120s';

DO $verify_phase_7a_k0$
declare
  v_count bigint;
  v_function_def text;
begin
  if to_regclass('editorial.resource_version_types') is null
     or to_regclass('editorial.resource_version_type_kinds') is null
     or to_regclass('editorial.resource_versions') is null
  then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version authority tables are incomplete';
  end if;

  if not exists (
    select 1
    from editorial.resource_version_types
    where version_type = 'article_version'
      and source_table_schema = 'editorial'
      and source_table_name = 'article_versions'
      and enabled
  )
     or not exists (
       select 1
       from editorial.resource_version_types
       where version_type = 'playlist_version'
         and source_table_schema = 'editorial'
         and source_table_name = 'playlist_versions'
         and enabled
     )
     or not exists (
       select 1
       from editorial.resource_version_types
       where version_type = 'audio_publication_version'
         and source_table_schema = 'audio'
         and source_table_name = 'publication_versions'
         and enabled
     )
  then
    raise exception
      'PHASE_7A_K0_FAIL: required version-type vocabulary is incomplete';
  end if;

  if not exists (
    select 1
    from editorial.resource_version_type_kinds
    where version_type = 'article_version'
      and resource_kind = 'article'
  )
     or not exists (
       select 1
       from editorial.resource_version_type_kinds
       where version_type = 'playlist_version'
         and resource_kind = 'playlist'
     )
     or not exists (
       select 1
       from editorial.resource_version_type_kinds
       where version_type = 'audio_publication_version'
         and resource_kind = 'audio_episode'
     )
     or not exists (
       select 1
       from editorial.resource_version_type_kinds
       where version_type = 'audio_publication_version'
         and resource_kind = 'standalone_audio'
     )
  then
    raise exception
      'PHASE_7A_K0_FAIL: required version-type to Resource-kind mapping is incomplete';
  end if;

  select count(*)
  into v_count
  from editorial.article_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.resource_kind = 'article'
   and global_version.version_type = 'article_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Article version(s) lack exact Resource Version identity',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.playlist_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.resource_kind = 'playlist'
   and global_version.version_type = 'playlist_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Playlist version(s) lack exact Resource Version identity',
      v_count;
  end if;

  select count(*)
  into v_count
  from audio.publication_versions typed
  join editorial.resources resource_row
    on resource_row.id = typed.resource_id
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.resource_kind = resource_row.resource_kind
   and global_version.version_type = 'audio_publication_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Audio publication version(s) lack exact Resource Version identity',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.resource_versions global_version
  left join editorial.article_versions typed
    on typed.id = global_version.id
   and typed.resource_id = global_version.resource_id
  where global_version.version_type = 'article_version'
    and typed.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Article Resource Version envelope(s) lack typed Article authority',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.resource_versions global_version
  left join editorial.playlist_versions typed
    on typed.id = global_version.id
   and typed.resource_id = global_version.resource_id
  where global_version.version_type = 'playlist_version'
    and typed.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Playlist Resource Version envelope(s) lack typed Playlist authority',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.resource_versions global_version
  left join audio.publication_versions typed
    on typed.id = global_version.id
   and typed.resource_id = global_version.resource_id
  where global_version.version_type = 'audio_publication_version'
    and typed.id is null;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K0_FAIL: % Audio Resource Version envelope(s) lack typed Audio authority',
      v_count;
  end if;

  if exists (
    select 1
    from editorial.resource_versions version_row
    join editorial.resources resource_row
      on resource_row.id = version_row.resource_id
    where version_row.resource_kind <> resource_row.resource_kind
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version Resource-kind mismatch exists';
  end if;

  if exists (
    select 1
    from editorial.resource_versions version_row
    left join editorial.resource_version_type_kinds mapping
      on mapping.version_type = version_row.version_type
     and mapping.resource_kind = version_row.resource_kind
    where mapping.version_type is null
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version uses an unregistered version-type/kind pair';
  end if;

  if exists (
    select 1
    from editorial.resource_versions version_row
    where version_row.content_fingerprint !~ '^[0-9a-f]{64}$'
       or version_row.version_number < 1
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: invalid immutable Resource Version envelope exists';
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    join pg_class referenced_table
      on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_namespace
      on referenced_namespace.oid = referenced_table.relnamespace
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'editorial'
      and table_row.relname = 'resource_versions'
      and referenced_namespace.nspname = 'auth'
      and referenced_table.relname = 'users'
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: immutable Resource Version authority has a mutable Auth foreign key';
  end if;

  select count(*)
  into v_count
  from pg_trigger trigger_row
  join pg_class table_row
    on table_row.oid = trigger_row.tgrelid
  join pg_namespace namespace_row
    on namespace_row.oid = table_row.relnamespace
  where not trigger_row.tgisinternal
    and (
      (
        namespace_row.nspname = 'editorial'
        and table_row.relname = 'article_versions'
        and trigger_row.tgname = 'article_versions_register_resource_version'
      )
      or (
        namespace_row.nspname = 'editorial'
        and table_row.relname = 'playlist_versions'
        and trigger_row.tgname = 'playlist_versions_register_resource_version'
      )
      or (
        namespace_row.nspname = 'audio'
        and table_row.relname = 'publication_versions'
        and trigger_row.tgname = 'audio_publication_versions_register_resource_version'
      )
      or (
        namespace_row.nspname = 'editorial'
        and table_row.relname = 'resource_versions'
        and trigger_row.tgname = 'resource_versions_immutable'
      )
    );

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K0_FAIL: expected 4 Resource Version registration/immutability triggers, found %',
      v_count;
  end if;

  if to_regprocedure(
       'editorial.register_resource_version(uuid,uuid,text,text,bigint,text,uuid,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'editorial.register_typed_resource_version()'
     ) is null
     or to_regprocedure(
       'editorial.reject_resource_version_mutation()'
     ) is null
  then
    raise exception
      'PHASE_7A_K0_FAIL: required Resource Version helper functions are incomplete';
  end if;

  select pg_get_functiondef(
    'editorial.register_resource_version(uuid,uuid,text,text,bigint,text,uuid,timestamp with time zone)'::regprocedure
  )
  into v_function_def;

  if position('SECURITY DEFINER' in upper(v_function_def)) = 0
     or position('source_table_schema' in v_function_def) = 0
     or position('content_fingerprint' in v_function_def) = 0
     or position('on conflict (id) do nothing' in lower(v_function_def)) = 0
  then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version registration contract drifted';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'resource_version_types',
        'resource_version_type_kinds',
        'resource_versions'
      )
      and grant_row.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: browser/service role has direct Resource Version table grant';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges privilege_row
    where privilege_row.routine_schema = 'editorial'
      and privilege_row.routine_name in (
        'register_resource_version',
        'register_typed_resource_version',
        'reject_resource_version_mutation'
      )
      and privilege_row.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
      and privilege_row.privilege_type = 'EXECUTE'
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version internal helper execution leaked';
  end if;

  if exists (
    select 1
    from pg_class table_row
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and table_row.relname in (
        'resource_version_types',
        'resource_version_type_kinds',
        'resource_versions'
      )
      and not table_row.relrowsecurity
  ) then
    raise exception
      'PHASE_7A_K0_FAIL: Resource Version authority table lacks RLS defense in depth';
  end if;
end;
$verify_phase_7a_k0$;

select
  'PHASE_7A_K0_RESOURCE_VERSION_FOUNDATION_PASS' as marker,
  (select count(*) from editorial.resource_versions) as resource_version_count,
  (select count(*) from editorial.resource_version_types where enabled) as enabled_version_type_count;

rollback;
