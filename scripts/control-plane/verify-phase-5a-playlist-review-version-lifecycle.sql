-- Verify Phase 5A Migration 211: Playlist Review and immutable version lifecycle authority.

do $verify_phase_5a_m211$
declare
  v_command_count bigint;
  v_rpc_count bigint;
  v_status_definition text;
  v_submit_definition text;
  v_review_definition text;
  v_snapshot_definition text;
begin
  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.version.snapshot_working',
    'playlist.review.submit',
    'playlist.review.decide'
  )
    and enabled;

  if v_command_count <> 3 then
    raise exception
      'FAIL: Expected 3 enabled Playlist Review command types, found %',
      v_command_count;
  end if;

  select count(*)
  into v_rpc_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid =
      procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'snapshot_playlist_working_version',
      'submit_playlist_for_review',
      'review_playlist'
    );

  if v_rpc_count <> 3 then
    raise exception
      'FAIL: Expected 3 Playlist Review/version RPCs, found %',
      v_rpc_count;
  end if;

  select pg_get_constraintdef(
    constraint_row.oid
  )
  into v_status_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid =
          'public.wk_playlists'::regclass
    and constraint_row.conname =
          'wk_playlists_status_check';

  if position(
       'ready_for_review'
       in v_status_definition
     ) = 0
     or position(
       'in_review'
       in v_status_definition
     ) = 0
     or position(
       'changes_requested'
       in v_status_definition
     ) = 0
     or position(
       'scheduled'
       in v_status_definition
     ) = 0
     or position(
       'archived'
       in v_status_definition
     ) = 0
  then
    raise exception
      'FAIL: Canonical Playlist lifecycle vocabulary is incomplete';
  end if;

  if to_regclass(
       'editorial.playlist_review_events'
     ) is null
  then
    raise exception
      'FAIL: Typed Playlist Review event ledger is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'editorial'
      and tablename =
            'playlist_review_events'
      and policyname =
            'playlist_review_events_participant_read'
  ) then
    raise exception
      'FAIL: Playlist Review event read policy is missing';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_participate_playlist_review(uuid)'
     ) is null
     or position(
       'manage_review_queue'
       in pg_get_functiondef(
         'editorial.current_user_can_participate_playlist_review(uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Playlist Review does not reuse shared Review capabilities';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
            'editorial.playlist_versions'::regclass
      and tgname =
            'playlist_versions_immutable'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid =
            'editorial.playlist_version_items'::regclass
      and tgname =
            'playlist_version_items_immutable'
      and not tgisinternal
  ) then
    raise exception
      'FAIL: Playlist immutable version protection is incomplete';
  end if;

  select pg_get_functiondef(
    'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure
  )
  into v_snapshot_definition;

  if position(
       'reused_existing_snapshot'
       in v_snapshot_definition
     ) = 0
     or position(
       'playlist_current_content_fingerprint'
       in v_snapshot_definition
     ) = 0
  then
    raise exception
      'FAIL: Working snapshot reuse contract is incomplete';
  end if;

  select pg_get_functiondef(
    'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_submit_definition;

  if position(
       'playlist_working_trust_stale'
       in v_submit_definition
     ) = 0
     or position(
       'copy_playlist_working_trust_to_version'
       in v_submit_definition
     ) = 0
     or position(
       'playlist_empty'
       in v_submit_definition
     ) = 0
     or position(
       'current_submitted_version_id'
       in v_submit_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist submission snapshot/Trust contract is incomplete';
  end if;

  select pg_get_functiondef(
    'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_review_definition;

  if position(
       'manage_review_queue'
       in v_review_definition
     ) = 0
     or position(
       'submitted_version_changed'
       in v_review_definition
     ) = 0
     or position(
       'request_changes'
       in v_review_definition
     ) = 0
     or position(
       'copy_playlist_version_snapshot'
       in v_review_definition
     ) = 0
     or position(
       'current_approved_version_id'
       in v_review_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist Review decision contract is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'playlist_versions'
      and column_name = 'cover_asset_revision_id'
  )
     or position(
       'cover_asset_revision_id'
       in pg_get_functiondef(
         'editorial.insert_playlist_current_snapshot(uuid,bigint,text,text,uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Playlist snapshot does not freeze exact cover Media identity';
  end if;

  if position(
       'insert into media.usage_links'
       in lower(
         pg_get_functiondef(
           'editorial.insert_playlist_current_snapshot(uuid,bigint,text,text,uuid)'::regprocedure
         )
       )
     ) > 0
     or position(
       'insert into media.usage_links'
       in lower(
         pg_get_functiondef(
           'editorial.copy_playlist_version_snapshot(uuid,uuid)'::regprocedure
         )
       )
     ) > 0
  then
    raise exception
      'FAIL: Playlist Review snapshot bypasses Media write authority';
  end if;

  if to_regprocedure(
       'public.get_playlist_review_workspace(uuid)'
     ) is null
     or position(
       'playlist_version_snapshot_json'
       in pg_get_functiondef(
         'public.get_playlist_review_workspace(uuid)'::regprocedure
       )
     ) = 0
     or position(
       'current_submitted_version_id'
       in pg_get_functiondef(
         'public.get_playlist_review_workspace(uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Exact version-bound Playlist Review workspace is incomplete';
  end if;

  if to_regclass(
       'editorial.playlist_version_trust_revisions'
     ) is null
     or to_regprocedure(
       'public.replace_playlist_version_citations(uuid,uuid,jsonb,bigint,uuid)'
     ) is null
     or to_regprocedure(
       'public.replace_playlist_version_credits(uuid,uuid,jsonb,bigint,uuid)'
     ) is null
  then
    raise exception
      'FAIL: Playlist adapter to Shared Trust is incomplete';
  end if;

  if position(
       'playlist_item'
       in pg_get_functiondef(
         'editorial.assert_resource_version_trust_attachment()'::regprocedure
       )
     ) = 0
     or position(
       'playlist_version'
       in pg_get_functiondef(
         'editorial.assert_resource_version_trust_attachment()'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Shared Trust integrity does not validate Playlist and Playlist-item version targets';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
            'editorial.resource_citations'::regclass
      and tgname =
            'resource_citations_playlist_immutable'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid =
            'editorial.resource_credits'::regclass
      and tgname =
            'resource_credits_playlist_immutable'
      and not tgisinternal
  ) then
    raise exception
      'FAIL: Submitted/approved Playlist Trust immutability guards are missing';
  end if;

  if position(
       'content_fingerprint'
       in pg_get_functiondef(
         'editorial.playlist_working_trust_target(uuid,uuid)'::regprocedure
       )
     ) = 0
     or position(
       'current_working_version_id'
       in pg_get_functiondef(
         'editorial.playlist_working_trust_target(uuid,uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Playlist Trust editing is not bound to the exact current working content';
  end if;

  if position(
       'citations'
       in pg_get_functiondef(
         'editorial.playlist_version_snapshot_json(uuid)'::regprocedure
       )
     ) = 0
     or position(
       'credits'
       in pg_get_functiondef(
         'editorial.playlist_version_snapshot_json(uuid)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Playlist Review snapshot read model omits version-bound Trust';
  end if;

  if to_regprocedure(
       'public.submit_article_for_review(uuid,bigint,text)'
     ) is null
     or to_regclass(
       'editorial.article_review_threads'
     ) is null
     or to_regclass(
       'editorial.source_review_events'
     ) is null
  then
    raise exception
      'FAIL: Existing Article/Source Review authority regressed';
  end if;

  raise notice
    'PASS: Phase 5A Migration 211 Playlist Review/version lifecycle authority verified.';
end;
$verify_phase_5a_m211$;

-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_SEMANTIC_IDEMPOTENCY_VERIFIER_V1
--
-- Working snapshots and Review submissions must bind idempotency to the
-- exact Playlist semantic content. This includes content such as the current
-- cover whose identity can change independently of authority_revision.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text;
  v_calculation_position integer;
  v_command_position integer;
  v_request_fingerprint_position integer;
  v_replay_position integer;
  v_occurrence_count integer;
begin
  foreach v_definition in array array[
    pg_get_functiondef(
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'
        ::regprocedure
    ),
    pg_get_functiondef(
      'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
        ::regprocedure
    )
  ]
  loop
    if v_definition is null then
      raise exception
        'Playlist semantic-idempotency function definition is missing.';
    end if;

    v_calculation_position :=
      strpos(
        v_definition,
        'v_fingerprint :='
      );

    v_command_position :=
      strpos(
        v_definition,
        'begin_authenticated_resource_command'
      );

    v_request_fingerprint_position :=
      strpos(
        v_definition,
        '''content_fingerprint'''
      );

    v_replay_position :=
      strpos(
        v_definition,
        'if v_begin.idempotent_replay then'
      );

    if v_calculation_position = 0
       or v_command_position = 0
       or v_request_fingerprint_position = 0
       or v_replay_position = 0
       or not (
         v_calculation_position
           < v_command_position
         and v_command_position
           < v_request_fingerprint_position
         and v_request_fingerprint_position
           < v_replay_position
       )
    then
      raise exception
        'Playlist command idempotency is not bound to exact semantic content before replay.';
    end if;

    v_occurrence_count :=
      (
        length(v_definition)
        - length(
            replace(
              v_definition,
              'editorial.playlist_current_content_fingerprint(',
              ''
            )
          )
      )
      /
      length(
        'editorial.playlist_current_content_fingerprint('
      );

    if v_occurrence_count <> 1 then
      raise exception
        'Playlist command must calculate current content fingerprint exactly once.';
    end if;
  end loop;

  raise notice
    'PASS: Phase 5A Migration 211 semantic idempotency binds snapshot and submit commands to exact Playlist content.';
end
$$;

-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_PLPGSQL_AMBIGUITY_VERIFIER_V1
--
-- Lifecycle RPCs return a column named playlist_id. SQL predicates inside
-- those PL/pgSQL functions must qualify table columns so playlist_id cannot
-- resolve ambiguously against the RETURNS TABLE output variable.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text;
begin
  foreach v_definition in array array[
    pg_get_functiondef(
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'
        ::regprocedure
    ),
    pg_get_functiondef(
      'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
        ::regprocedure
    ),
    pg_get_functiondef(
      'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'
        ::regprocedure
    )
  ]
  loop
    if v_definition ~*
       'where[[:space:]]+playlist_id[[:space:]]*=[[:space:]]*p_playlist_id'
    then
      raise exception
        'Playlist lifecycle RPC contains an ambiguous unqualified playlist_id predicate.';
    end if;
  end loop;

  raise notice
    'PASS: Phase 5A Migration 211 lifecycle RPCs qualify Playlist table predicates.';
end
$$;

-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_PLAYLIST_BINDING_POINTER_VERIFIER_V1
-- ---------------------------------------------------------------------------

do $$
declare
  v_trigger_definition text;
  v_function_definition text;
begin
  select pg_get_triggerdef(trigger_row.oid, true)
  into v_trigger_definition
  from pg_trigger trigger_row
  where trigger_row.tgrelid =
          'editorial.playlist_resources'::regclass
    and trigger_row.tgname =
          'playlist_resources_prevent_retarget'
    and not trigger_row.tgisinternal;

  if v_trigger_definition is null
     or strpos(
          v_trigger_definition,
          'prevent_playlist_resource_binding_retarget'
        ) = 0
  then
    raise exception
      'Playlist Resource binding does not use the Playlist-specific identity guard.';
  end if;

  v_function_definition :=
    pg_get_functiondef(
      'editorial.prevent_playlist_resource_binding_retarget()'
        ::regprocedure
    );

  if strpos(v_function_definition, 'new.resource_id') = 0
     or strpos(v_function_definition, 'new.resource_kind') = 0
     or strpos(v_function_definition, 'new.playlist_id') = 0
     or strpos(
          v_function_definition,
          'current_working_version_id'
        ) > 0
     or strpos(
          v_function_definition,
          'current_submitted_version_id'
        ) > 0
     or strpos(
          v_function_definition,
          'current_approved_version_id'
        ) > 0
     or strpos(
          v_function_definition,
          'current_published_version_id'
        ) > 0
  then
    raise exception
      'Playlist Resource binding guard does not isolate immutable identity from mutable version pointers.';
  end if;

  raise notice
    'PASS: Phase 5A Migration 211 keeps Playlist binding identity immutable while allowing governed version-pointer changes.';
end
$$;

-- ---------------------------------------------------------------------------
-- PHASE_5A_M211_GOVERNED_IMMUTABLE_PLAYLIST_TRUST_VERIFIER_V2
-- ---------------------------------------------------------------------------

do $$
declare
  v_guard text;
  v_working_copy text;
  v_approved_copy text;
  v_citation_trigger text;
  v_credit_trigger text;
begin
  if to_regclass(
       'platform_private.playlist_trust_copy_authorizations'
     ) is null
  then
    raise exception
      'Playlist Trust copy authorization authority is missing.';
  end if;

  v_guard :=
    pg_get_functiondef(
      'editorial.prevent_immutable_playlist_trust_mutation()'
        ::regprocedure
    );

  if strpos(
       v_guard,
       'wakilisha.playlist_trust_copy_token'
     ) = 0
     or strpos(
       v_guard,
       'source_version_id'
     ) = 0
     or strpos(
       v_guard,
       'backend_pid'
     ) = 0
     or strpos(
       v_guard,
       'transaction_id'
     ) = 0
     or strpos(
       v_guard,
       'resource_citations'
     ) = 0
     or strpos(
       v_guard,
       'resource_credits'
     ) = 0
  then
    raise exception
      'Immutable Playlist Trust guard is not bound to an exact governed copy authorization.';
  end if;

  v_working_copy :=
    pg_get_functiondef(
      'editorial.copy_playlist_working_trust_to_version(uuid,uuid,uuid)'
        ::regprocedure
    );

  v_approved_copy :=
    pg_get_functiondef(
      'editorial.copy_playlist_version_snapshot(uuid,uuid)'
        ::regprocedure
    );

  if strpos(
       v_working_copy,
       'begin_playlist_trust_copy_authorization'
     ) = 0
     or strpos(
       v_working_copy,
       'end_playlist_trust_copy_authorization'
     ) = 0
     or strpos(
       v_approved_copy,
       'begin_playlist_trust_copy_authorization'
     ) = 0
     or strpos(
       v_approved_copy,
       'end_playlist_trust_copy_authorization'
     ) = 0
  then
    raise exception
      'Playlist submit and approval snapshot copy paths are not both governed.';
  end if;

  if has_function_privilege(
       'authenticated',
       'editorial.copy_playlist_working_trust_to_version(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.copy_playlist_version_snapshot(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_playlist_trust_copy_authorization(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Authenticated callers can execute an internal Playlist Trust copy primitive.';
  end if;

  select pg_get_triggerdef(trigger_row.oid, true)
  into v_citation_trigger
  from pg_trigger trigger_row
  where trigger_row.tgrelid =
          'editorial.resource_citations'::regclass
    and trigger_row.tgname =
          'resource_citations_prevent_immutable_playlist_trust'
    and not trigger_row.tgisinternal;

  select pg_get_triggerdef(trigger_row.oid, true)
  into v_credit_trigger
  from pg_trigger trigger_row
  where trigger_row.tgrelid =
          'editorial.resource_credits'::regclass
    and trigger_row.tgname =
          'resource_credits_prevent_immutable_playlist_trust'
    and not trigger_row.tgisinternal;

  if v_citation_trigger is null
     or v_credit_trigger is null
  then
    raise exception
      'Immutable Playlist Trust triggers are incomplete.';
  end if;

  raise notice
    'PASS: Phase 5A Migration 211 allows only exact governed Trust copies into immutable Playlist snapshots.';
end
$$;
