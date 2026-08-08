-- Verify Phase 5A Migration 209: canonical Playlist command authority.
-- Read-only structural verification after Migration 209 is applied.

do $verify_phase_5a_m209$
declare
  v_command_count bigint;
  v_authenticated_write_grants bigint;
  v_institute_policy_count bigint;
  v_read_policy_count bigint;
  v_rpc_count bigint;
  v_reorder_definition text;
  v_add_definition text;
  v_create_definition text;
begin
  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.create',
    'playlist.metadata.update',
    'playlist.item.add',
    'playlist.item.update',
    'playlist.item.remove',
    'playlist.items.reorder',
    'playlist.item.note.save',
    'playlist.item.match.resolve'
  )
    and enabled;

  if v_command_count <> 8 then
    raise exception
      'FAIL: Expected 8 enabled Playlist command types, found %',
      v_command_count;
  end if;

  if to_regprocedure(
       'platform_private.command_actor_context()'
     ) is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.read_authenticated_resource_command_result(uuid,boolean)'
     ) is null
  then
    raise exception 'FAIL: Reusable authenticated command primitives are incomplete';
  end if;

  select count(*)
  into v_rpc_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'create_playlist',
      'update_playlist_metadata',
      'add_playlist_item',
      'update_playlist_item',
      'save_playlist_item_note',
      'resolve_playlist_item_match',
      'remove_playlist_item',
      'reorder_playlist_items'
    );

  if v_rpc_count <> 8 then
    raise exception
      'FAIL: Expected 8 canonical Playlist RPCs, found %',
      v_rpc_count;
  end if;

  select count(*)
  into v_authenticated_write_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'wk_playlists',
      'wk_playlist_items'
    )
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE'
    );

  if v_authenticated_write_grants <> 0 then
    raise exception 'FAIL: Authenticated direct Playlist write grants remain';
  end if;

  select count(*)
  into v_institute_policy_count
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename in (
      'wk_playlists',
      'wk_playlist_items'
    )
    and policy_row.policyname like '%institute%';

  if v_institute_policy_count <> 0 then
    raise exception 'FAIL: Institute Playlist RLS policies remain';
  end if;

  select count(*)
  into v_read_policy_count
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and (
      (
        policy_row.tablename = 'wk_playlists'
        and policy_row.policyname = 'wk_playlists_authenticated_read'
      )
      or (
        policy_row.tablename = 'wk_playlist_items'
        and policy_row.policyname = 'wk_playlist_items_authenticated_read'
      )
    );

  if v_read_policy_count <> 2 then
    raise exception 'FAIL: Canonical authenticated Playlist read policies are incomplete';
  end if;

  select pg_get_functiondef(
    'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)'::regprocedure
  )
  into v_reorder_definition;

  if position('for update of playlist' in lower(v_reorder_definition)) = 0
     or position('cardinality(p_ordered_item_ids)' in v_reorder_definition) = 0
     or position('with ordinality' in lower(v_reorder_definition)) = 0
     or position('playlist_revision_changed' in v_reorder_definition) = 0
     or position('position = item.position + v_offset' in v_reorder_definition) = 0
  then
    raise exception 'FAIL: Atomic reorder concurrency contract is incomplete';
  end if;

  select pg_get_functiondef(
    'public.add_playlist_item(uuid,bigint,text,uuid,text,text,text,text,text[],text,uuid)'::regprocedure
  )
  into v_add_definition;

  if position('registry_track_provider_links' in v_add_definition) = 0
     or position('playlist_duplicate_item_ids' in v_add_definition) = 0
     or position('playlist_item_resources' in v_add_definition) = 0
     or position('external_only' in v_add_definition) = 0
     or position('needs_review' in v_add_definition) = 0
  then
    raise exception 'FAIL: Playlist item identity/matching contract is incomplete';
  end if;

  select pg_get_functiondef(
    'public.create_playlist(text,text,text,text,text,jsonb,uuid)'::regprocedure
  )
  into v_create_definition;

  if position('source_inquiry_id' in v_create_definition) = 0
     or position('null,' in lower(v_create_definition)) = 0
     or position('playlist.create' in v_create_definition) = 0
  then
    raise exception 'FAIL: Independent Playlist create contract is incomplete';
  end if;

  if position('cover_image_url' in pg_get_functiondef(
       'public.update_playlist_metadata(uuid,bigint,jsonb,text,uuid)'::regprocedure
     )) > 0
  then
    raise exception 'FAIL: Metadata command attempts to make legacy cover_image_url authoritative';
  end if;

  if position(
    'p_request_payload - ''correlation_id'''
    in pg_get_functiondef(
      'platform_private.command_request_fingerprint(text,uuid,jsonb)'::regprocedure
    )
  ) = 0 then
    raise exception 'FAIL: Command idempotency still fingerprints correlation identity';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.create_institute_playlist_draft(uuid,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.create_institute_playlist_draft(uuid,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.create_institute_playlist_draft(uuid,text,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'FAIL: Legacy Institute Playlist writer remains executable';
  end if;

  if position(
       'p_expected_authority_revision is null'
       in pg_get_functiondef(
         'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)'::regprocedure
       )
     ) = 0
     or position(
       'p_expected_authority_revision is null'
       in pg_get_functiondef(
         'public.update_playlist_item(uuid,uuid,bigint,jsonb,text,uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception 'FAIL: Playlist mutation commands do not require expected revision';
  end if;

  if position(
       'Matched Playlist track presentation is owned by Registry.'
       in pg_get_functiondef(
         'public.update_playlist_item(uuid,uuid,bigint,jsonb,text,uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception 'FAIL: Registry-matched Playlist presentation can be manually overridden';
  end if;

  if to_regprocedure('public.submit_article_for_review(uuid,bigint,text)') is null then
    raise exception 'FAIL: Article Review authority regressed';
  end if;

  raise notice
    'PASS: Phase 5A Migration 209 command authority verified. command_types=%, rpcs=%, direct_authenticated_writes=%',
    v_command_count,
    v_rpc_count,
    v_authenticated_write_grants;
end;
$verify_phase_5a_m209$;
