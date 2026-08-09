do $verify_phase_5b_public_registry_intake_bridge$
declare
  v_pending_slot text;
  v_artist_role text;
  v_provider_evidence text;
  v_materialize_trigger text;
  v_sync_artist_function text;
  v_base_resolver text;
  v_queue_function text;
begin
  if to_regclass(
       'public.registry_provider_track_suggestions'
     ) is null
     or to_regclass(
       'public.registry_provider_track_suggestion_artists'
     ) is null
     or to_regclass(
       'public.community_contributions'
     ) is null
  then
    raise exception
      'VERIFY: Required Registry or Community table is missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'intake_origin'
      and is_nullable = 'NO'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'source_contribution_id'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'submitted_track_title'
  )
  then
    raise exception
      'VERIFY: M224 Registry intake origin columns are incomplete.';
  end if;

  select pg_get_constraintdef(constraint_info.oid)
  into v_pending_slot
  from pg_constraint constraint_info
  where constraint_info.conrelid =
        'public.registry_provider_track_suggestions'::regclass
    and constraint_info.conname =
        'registry_provider_track_suggestions_pending_slot_check';

  if v_pending_slot is null
     or position(
          'public_contribution'
          in v_pending_slot
        ) = 0
  then
    raise exception
      'VERIFY: Public contributions still require a Playlist slot.';
  end if;

  if exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name =
          'registry_provider_track_suggestions'
      and column_info.column_name in (
        'provider_key',
        'provider_object_id',
        'provider_url',
        'playback_kind'
      )
      and column_info.is_nullable <> 'YES'
  ) then
    raise exception
      'VERIFY: Providerless public Track Intake is blocked by NOT NULL provider fields.';
  end if;

  select pg_get_constraintdef(constraint_info.oid)
  into v_provider_evidence
  from pg_constraint constraint_info
  where constraint_info.conrelid =
        'public.registry_provider_track_suggestions'::regclass
    and constraint_info.conname =
        'registry_provider_track_suggestions_provider_evidence_check';

  if v_provider_evidence is null
     or position(
          'public_contribution'
          in v_provider_evidence
        ) = 0
     or position(
          'provider_key IS NULL'
          in v_provider_evidence
        ) = 0
  then
    raise exception
      'VERIFY: Public intake cannot safely omit provider evidence.';
  end if;

  select pg_get_constraintdef(constraint_info.oid)
  into v_artist_role
  from pg_constraint constraint_info
  where constraint_info.conrelid =
        'public.registry_provider_track_suggestion_artists'::regclass
    and constraint_info.conname =
        'registry_provider_track_suggestion_artists_role_check';

  if v_artist_role is null
     or position(
          'unresolved'
          in v_artist_role
        ) = 0
  then
    raise exception
      'VERIFY: Submitted artist roles cannot remain unresolved for review.';
  end if;

  select pg_get_triggerdef(
    trigger_info.oid,
    true
  )
  into v_materialize_trigger
  from pg_trigger trigger_info
  where trigger_info.tgrelid =
        'public.registry_provider_track_suggestions'::regclass
    and trigger_info.tgname =
        'registry_provider_track_suggestion_materialize_playlist_slot'
    and not trigger_info.tgisinternal;

  if v_materialize_trigger is null
     or position(
          'playlist_editor'
          in v_materialize_trigger
        ) = 0
  then
    raise exception
      'VERIFY: Playlist materialization trigger is not origin-gated.';
  end if;

  v_sync_artist_function :=
    pg_get_functiondef(
      'editorial.sync_playlist_registry_intake_item_artists()'::regprocedure
    );

  if position(
       'public_contribution'
       in v_sync_artist_function
     ) = 0
  then
    raise exception
      'VERIFY: Public artist credit review can still materialize a Playlist item.';
  end if;

  v_base_resolver :=
    pg_get_functiondef(
      'public.admin_resolve_registry_track_intake(uuid,uuid,text)'::regprocedure
    );

  if position(
       'intake_origin'
       in v_base_resolver
     ) = 0
     or position(
          'public_contribution'
          in v_base_resolver
        ) = 0
  then
    raise exception
      'VERIFY: Base Track Intake resolver does not accept public contribution origin.';
  end if;

  v_queue_function :=
    pg_get_functiondef(
      'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'::regprocedure
    );

  if position(
       'source_contribution_id'
       in v_queue_function
     ) = 0
     or position(
          'contribution_payload'
          in v_queue_function
        ) = 0
     or position(
          'submitted_track_title'
          in v_queue_function
        ) = 0
  then
    raise exception
      'VERIFY: Track Intake queue does not expose public contribution review context.';
  end if;

  if to_regprocedure(
       'public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)'
     ) is null
     or not has_function_privilege(
       'authenticated',
       'public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'VERIFY: Registry artist-credit review command grants are wrong.';
  end if;

  if to_regprocedure(
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)'
     ) is null
     or not has_function_privilege(
       'service_role',
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)',
       'EXECUTE'
     )
  then
    raise exception
      'VERIFY: Public missing-track bridge grants are wrong.';
  end if;

  if not exists (
    select 1
    from pg_indexes index_info
    where index_info.schemaname = 'public'
      and index_info.indexname =
          'registry_provider_track_suggestions_source_contribution_uq'
  )
  then
    raise exception
      'VERIFY: One contribution can create more than one Registry suggestion.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_info
    where trigger_info.tgrelid =
          'public.registry_provider_track_suggestions'::regclass
      and trigger_info.tgname =
          'registry_track_intake_sync_public_contribution'
      and not trigger_info.tgisinternal
  )
  then
    raise exception
      'VERIFY: Registry review is not synchronized back to Community contribution state.';
  end if;

  raise notice
    'PASS: Phase 5B M224 public Registry intake bridge is installed.';
end;
$verify_phase_5b_public_registry_intake_bridge$;
