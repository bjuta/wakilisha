-- Permanent verifier for Phase 8B.4 Candidate C.
-- Proves exact-version Playlist review projection through canonical Messages
-- while Playlist review mutation authority remains public.review_playlist(...).

begin;

do $verify$
declare
  v_current_participation_definition text;
  v_user_participation_definition text;
  v_reference_definition text;
  v_projection_definition text;
  v_review_definition text;
  v_projection_columns text[] := array[
    'resource_id',
    'resource_version_id',
    'playlist_id',
    'title',
    'slug',
    'version_number',
    'version_kind',
    'playlist_status',
    'authority_revision',
    'current_submitted_version_id',
    'is_current_submitted',
    'can_participate_review',
    'can_manage_review',
    'allowed_review_actions'
  ];
  v_column text;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260907142000'
      and name = 'phase_8b4_playlist_messages'
  ) then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: Candidate C migration is missing';
  end if;

  if to_regprocedure(
       'editorial.user_can_participate_playlist_review_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_participate_playlist_review(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_message_playlist_review_projection_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: Candidate C function set is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row
      on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'messaging'
      and table_row.relname = 'message_resource_references'
      and trigger_row.tgname = 'message_resource_references_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: exact Message Resource references are not immutable';
  end if;

  if has_table_privilege(
       'authenticated',
       'messaging.message_resource_references',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'anon',
       'messaging.message_resource_references',
       'SELECT,INSERT,UPDATE,DELETE'
     )
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: browser direct Resource-reference table authority drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_message_playlist_review_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.get_message_playlist_review_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_message_playlist_review_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: Playlist Message projection privilege boundary drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'editorial.user_can_participate_playlist_review_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.user_can_participate_playlist_review_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: internal user-id participation helper leaked to browser roles';
  end if;

  v_current_participation_definition := pg_get_functiondef(
    'editorial.current_user_can_participate_playlist_review(uuid)'::regprocedure
  );
  v_user_participation_definition := pg_get_functiondef(
    'editorial.user_can_participate_playlist_review_v1(uuid,uuid)'::regprocedure
  );
  v_reference_definition := pg_get_functiondef(
    'messaging.can_user_reference_resource(uuid,uuid,uuid)'::regprocedure
  );
  v_projection_definition := pg_get_functiondef(
    'public.get_message_playlist_review_projection_v1(uuid,uuid)'::regprocedure
  );
  v_review_definition := pg_get_functiondef(
    'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  );

  if position(
       'user_can_participate_playlist_review_v1' in
       v_current_participation_definition
     ) = 0
     or position('auth.uid()' in v_current_participation_definition) = 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: current-user Playlist participation does not delegate to the shared user-id rule';
  end if;

  if position('edit_others_playlists' in v_user_participation_definition) = 0
     or position('edit_own_playlists' in v_user_participation_definition) = 0
     or position('view_review_queue' in v_user_participation_definition) = 0
     or position('manage_review_queue' in v_user_participation_definition) = 0
     or position('administrator' in v_user_participation_definition) = 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: user-id Playlist participation semantics are incomplete';
  end if;

  if position('resource_kind = ''playlist''' in v_reference_definition) = 0
     or position('p_resource_version_id is not null' in v_reference_definition) = 0
     or position('user_can_participate_playlist_review_v1' in v_reference_definition) = 0
     or position('resource_versions' in v_reference_definition) = 0
     or position('view_field_intake' in v_reference_definition) = 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: Messages Resource permission lost Playlist exact-version or Candidate B Field authority';
  end if;

  foreach v_column in array v_projection_columns
  loop
    if position(quote_literal(v_column) in v_projection_definition) = 0 then
      raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: projection field % is missing', v_column;
    end if;
  end loop;

  if position('playlist_versions' in v_projection_definition) = 0
     or position('playlist_resources' in v_projection_definition) = 0
     or position('current_submitted_version_id' in v_projection_definition) = 0
     or position('ready_for_review' in v_projection_definition) = 0
     or position('start_review' in v_projection_definition) = 0
     or position('in_review' in v_projection_definition) = 0
     or position('request_changes' in v_projection_definition) = 0
     or position('approve' in v_projection_definition) = 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: exact Playlist projection/action policy is incomplete';
  end if;

  if position('wk_playlist_items' in v_projection_definition) > 0
     or position('registry_' in v_projection_definition) > 0
     or position('media.' in v_projection_definition) > 0
     or position('discovery' in lower(v_projection_definition)) > 0
     or position('publish_playlist' in lower(v_projection_definition)) > 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: Messages projection widened into Playlist internals or publication authority';
  end if;

  if position('expected_authority_revision' in v_review_definition) = 0
     or position('submitted_version_changed' in v_review_definition) = 0
     or position('begin_authenticated_resource_command' in v_review_definition) = 0
     or position('playlist.review.decide' in v_review_definition) = 0
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: canonical Playlist review stale/idempotency authority regressed';
  end if;

  if to_regprocedure('messages.approve_resource(uuid,uuid)') is not null
     or to_regprocedure('messages.request_resource_changes(uuid,uuid,text)') is not null
     or to_regprocedure('messages.review_playlist(uuid,uuid,text)') is not null
     or to_regprocedure('messages.perform_workflow_action(uuid,text,jsonb)') is not null
  then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: competing Messages-owned workflow mutation authority exists';
  end if;

  if (select audience_mode from messaging.runtime_policy where singleton) <> 'internal' then
    raise exception 'PHASE_8B4_PLAYLIST_MESSAGES_FAIL: global Messages audience broadened';
  end if;

  raise notice 'PHASE_8B4_PLAYLIST_MESSAGES_VERIFIER_PASS';
end
$verify$;

rollback;
