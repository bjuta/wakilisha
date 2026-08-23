do $verify$
declare
  v_expected_terms bigint;
  v_actual_terms bigint;
  v_bad_grants bigint;
  v_missing_metadata bigint;
  v_invalid_identity bigint;
  v_playlist_helper_mismatches bigint;
  v_audio_helper_mismatches bigint;
  v_playlist_fingerprint text;
  v_audio_fingerprint text;
  v_discovery_fragment text;
  v_save_definition text;
  v_playlist_successor_copy text;
begin
  if to_regclass('editorial.resource_version_editorial_metadata') is null
     or to_regclass('editorial.resource_version_taxonomy_terms') is null
  then
    raise exception 'Rich editorial M1 tables are missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'registry_taxonomy_terms'
      and indexname = 'registry_taxonomy_terms_taxonomy_slug_unique_idx'
      and indexdef like '%(taxonomy, slug)%'
  ) then
    raise exception 'Taxonomy identity is not unique by taxonomy and slug';
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'registry_taxonomy_terms'
      and indexdef like '%UNIQUE INDEX% (slug)%'
  ) then
    raise exception 'Legacy global taxonomy slug uniqueness remains';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and tablename = 'resource_version_taxonomy_terms'
      and indexname = 'resource_version_taxonomy_terms_taxonomy_term_idx'
      and indexdef like '%(taxonomy_term_id)%'
  ) then
    raise exception 'Version-bound taxonomy term foreign key is not indexed';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'editorial'
      and c.relname = 'resource_version_editorial_metadata'
      and c.relrowsecurity
  ) or not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'editorial'
      and c.relname = 'resource_version_taxonomy_terms'
      and c.relrowsecurity
  ) then
    raise exception 'Rich editorial M1 tables must have RLS enabled';
  end if;

  select count(*) into v_bad_grants
  from information_schema.table_privileges privilege
  where privilege.table_schema = 'editorial'
    and privilege.table_name in (
      'resource_version_editorial_metadata',
      'resource_version_taxonomy_terms'
    )
    and privilege.grantee in ('anon','authenticated');

  if v_bad_grants <> 0 then
    raise exception 'Direct Data API grants exist on rich editorial M1 tables';
  end if;

  if to_regprocedure('public.get_resource_version_editorial_metadata(text,uuid)') is null
     or to_regprocedure('public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)') is null
     or to_regprocedure('editorial.discovery_fingerprint_fragment(jsonb)') is null
     or to_regprocedure('editorial.playlist_version_content_fingerprint_with_discovery(uuid,jsonb)') is null
     or to_regprocedure('audio.publication_version_content_fingerprint_with_discovery(uuid,jsonb)') is null
     or to_regprocedure('editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)') is null
  then
    raise exception 'Rich editorial M1 function authority is incomplete';
  end if;

  if has_function_privilege('anon', 'public.get_resource_version_editorial_metadata(text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)', 'EXECUTE')
  then
    raise exception 'Anonymous execution exists on rich editorial M1 RPCs';
  end if;

  if not has_function_privilege('authenticated', 'public.get_resource_version_editorial_metadata(text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)', 'EXECUTE')
  then
    raise exception 'Authenticated execution is missing on rich editorial M1 RPCs';
  end if;

  if has_function_privilege('authenticated', 'editorial.assert_resource_version_editorial_identity()', 'EXECUTE')
     or has_function_privilege('anon', 'editorial.assert_resource_version_editorial_identity()', 'EXECUTE')
     or has_function_privilege('authenticated', 'editorial.materialize_resource_version_editorial_metadata()', 'EXECUTE')
     or has_function_privilege('anon', 'editorial.materialize_resource_version_editorial_metadata()', 'EXECUTE')
     or has_function_privilege('authenticated', 'editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)', 'EXECUTE')
  then
    raise exception 'Internal rich editorial functions are directly executable by browser roles';
  end if;

  if not exists (
    select 1 from platform_private.command_types
    where command_type = 'editorial.discovery.save'
      and enabled
  ) then
    raise exception 'Rich editorial Discovery command type is missing or disabled';
  end if;

  select count(*) into v_missing_metadata
  from (
    select 'article_version'::text as target_version_type, id as target_version_id
    from editorial.article_versions
    union all
    select 'playlist_version', id from editorial.playlist_versions
    union all
    select 'audio_publication_version', id from audio.publication_versions
  ) version
  left join editorial.resource_version_editorial_metadata metadata
    on metadata.target_version_type = version.target_version_type
   and metadata.target_version_id = version.target_version_id
  where metadata.target_version_id is null;

  if v_missing_metadata <> 0 then
    raise exception 'One or more supported versions have no shared editorial metadata row';
  end if;

  select sum(jsonb_array_length(category_snapshot) + jsonb_array_length(tag_snapshot))
  into v_expected_terms
  from editorial.article_versions;

  select count(*) into v_actual_terms
  from editorial.resource_version_taxonomy_terms
  where target_version_type = 'article_version';

  if coalesce(v_expected_terms, 0) <> v_actual_terms then
    raise exception 'Article taxonomy backfill is not meaning-stable';
  end if;

  select count(*) into v_invalid_identity
  from editorial.resource_version_editorial_metadata metadata
  left join lateral editorial.resolve_resource_version_identity(
    metadata.target_version_type,
    metadata.target_version_id
  ) identity on true
  where identity.resource_id is null
     or identity.resource_id is distinct from metadata.resource_id
     or identity.resource_kind is distinct from metadata.resource_kind;

  if v_invalid_identity <> 0 then
    raise exception 'Shared editorial metadata contains invalid version identity';
  end if;

  if exists (
    select 1
    from editorial.resource_version_taxonomy_terms attachment
    join public.registry_taxonomy_terms term
      on term.id = attachment.taxonomy_term_id
    where attachment.taxonomy is distinct from term.taxonomy
       or nullif(btrim(attachment.term_slug_snapshot), '') is null
       or nullif(btrim(attachment.term_name_snapshot), '') is null
  ) then
    raise exception 'Version-bound taxonomy snapshots are incomplete or mismatched';
  end if;

  select count(*) into v_playlist_helper_mismatches
  from editorial.playlist_versions version
  where version.content_fingerprint is distinct from
    editorial.playlist_version_content_fingerprint_with_discovery(
      version.id,
      editorial.resource_version_discovery_content_json(
        'playlist_version',
        version.id
      )
    );

  if v_playlist_helper_mismatches <> 0 then
    raise exception 'One or more Playlist version fingerprints do not match frozen content plus Discovery';
  end if;

  select count(*) into v_audio_helper_mismatches
  from editorial.audio_publication_resources binding
  join audio.publications publication
    on publication.id = binding.publication_id
  join audio.publication_versions version
    on version.id = binding.current_working_version_id
   and version.resource_id = binding.resource_id
  where publication.status in ('draft','changes_requested')
    and version.version_kind = 'working'
    and version.source_authority_revision = publication.authority_revision
    and version.content_fingerprint is distinct from
      audio.publication_version_content_fingerprint_with_discovery(
        version.id,
        editorial.resource_version_discovery_content_json(
          'audio_publication_version',
          version.id
        )
      );

  if v_audio_helper_mismatches <> 0 then
    raise exception 'Current editable Audio working fingerprint does not match frozen content plus Discovery';
  end if;

  select pg_get_functiondef('editorial.discovery_fingerprint_fragment(jsonb)'::regprocedure)
  into v_discovery_fragment;

  if position('then ''{}''::jsonb' in lower(v_discovery_fragment)) = 0
     or position('jsonb_build_object(''discovery''' in lower(v_discovery_fragment)) = 0
  then
    raise exception 'Empty Discovery no longer preserves legacy fingerprint meaning';
  end if;

  select pg_get_functiondef('editorial.playlist_current_content_fingerprint(uuid)'::regprocedure)
  into v_playlist_fingerprint;
  select pg_get_functiondef('audio.publication_content_fingerprint(uuid)'::regprocedure)
  into v_audio_fingerprint;

  if position('discovery_fingerprint_fragment' in v_playlist_fingerprint) = 0
     or position('resource_version_discovery_content_json' in v_playlist_fingerprint) = 0
  then
    raise exception 'Playlist fingerprint does not include shared Discovery';
  end if;

  if position('discovery_fingerprint_fragment' in v_audio_fingerprint) = 0
     or position('resource_version_discovery_content_json' in v_audio_fingerprint) = 0
  then
    raise exception 'Audio fingerprint does not include shared Discovery';
  end if;

  select pg_get_functiondef(
    'editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)'::regprocedure
  ) into v_playlist_successor_copy;

  if position('v_source.version_kind <> ''working''' in v_playlist_successor_copy) = 0
     or position('v_target.version_kind <> ''working''' in v_playlist_successor_copy) = 0
     or position('current_working_version_id = p_source_working_version_id' in v_playlist_successor_copy) = 0
     or position('playlist_version_content_fingerprint_with_discovery' in v_playlist_successor_copy) = 0
  then
    raise exception 'Playlist working-successor Trust copy is not narrowly guarded';
  end if;

  select pg_get_functiondef(
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
  ) into v_save_definition;

  if position('current_working_version_id' in v_save_definition) = 0
     or position('metadata_revision' in v_save_definition) = 0
     or position('current_user_can_edit_playlist' in v_save_definition) = 0
     or position('current_user_can_edit_audio' in v_save_definition) = 0
     or position('v_identity.version_kind <> ''working''' in v_save_definition) = 0
     or position(('insert ' || 'into editorial.playlist_versions') in lower(v_save_definition)) = 0
     or position(('insert ' || 'into audio.publication_versions') in lower(v_save_definition)) = 0
     or position('copy_playlist_working_trust_to_working_successor' in v_save_definition) = 0
     or position('copy_audio_version_trust_to_version' in v_save_definition) = 0
     or position('set current_working_version_id = v_new_version_id' in v_save_definition) = 0
  then
    raise exception 'Rich editorial save RPC is missing successor-version governance';
  end if;

  if position(('update ' || 'editorial.playlist_versions') in lower(v_save_definition)) > 0
     or position(('update ' || 'audio.publication_versions') in lower(v_save_definition)) > 0
  then
    raise exception 'Rich editorial save RPC attempts to mutate immutable version rows';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where not trigger_row.tgisinternal
      and namespace_row.nspname = 'editorial'
      and table_row.relname = 'article_versions'
      and trigger_row.tgname = 'article_version_editorial_metadata_materialize'
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where not trigger_row.tgisinternal
      and namespace_row.nspname = 'editorial'
      and table_row.relname = 'playlist_versions'
      and trigger_row.tgname = 'playlist_version_editorial_metadata_materialize'
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where not trigger_row.tgisinternal
      and namespace_row.nspname = 'audio'
      and table_row.relname = 'publication_versions'
      and trigger_row.tgname = 'audio_version_editorial_metadata_materialize'
  ) then
    raise exception 'One or more version materialization triggers are missing';
  end if;
end;
$verify$;

select 'RICH_EDITORIAL_CANONICAL_PRIMITIVES_M1_PASS' as result;
