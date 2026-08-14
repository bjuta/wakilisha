do $m5_verify$
declare
  v_origin_constraint text;
  v_context_constraint text;
  v_event_constraint text;
  v_submit_definition text;
  v_reader_definition text;
  v_record_definition text;
  v_resolver_definition text;
  v_sync_definition text;
begin
  if to_regclass('platform_private.artist_music_submission_validations') is null
     or to_regprocedure('public.record_artist_music_submission_validation(uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamp with time zone)') is null
     or to_regprocedure('public.community_submit_artist_music(uuid,uuid,jsonb,text)') is null
     or to_regprocedure('public.community_get_artist_music_submissions(uuid,integer)') is null
  then
    raise exception 'M5_VERIFY: Artist music submission authority is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'source_playlist_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'M5_VERIFY: Artist intake still depends on Playlist identity';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'review_due_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'M5_VERIFY: review_due_at is missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_origin_constraint
  from pg_constraint
  where conrelid = 'public.registry_provider_track_suggestions'::regclass
    and conname = 'registry_provider_track_suggestions_intake_origin_check';

  select pg_get_constraintdef(oid)
  into v_context_constraint
  from pg_constraint
  where conrelid = 'public.registry_provider_track_suggestions'::regclass
    and conname like 'registry_provider_track_suggestions_artist_submission_context%'
  order by conname
  limit 1;

  select pg_get_constraintdef(oid)
  into v_event_constraint
  from pg_constraint
  where conrelid = 'public.artist_representation_events'::regclass
    and conname = 'artist_representation_events_event_type_check';

  if position('artist_submission' in coalesce(v_origin_constraint, '')) = 0
     or position('review_due_at' in coalesce(v_context_constraint, '')) = 0
     or position('music_submission_created' in coalesce(v_event_constraint, '')) = 0
  then
    raise exception 'M5_VERIFY: Artist intake origin, SLA, or audit event is incomplete';
  end if;

  select pg_get_functiondef(
    'public.record_artist_music_submission_validation(uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamp with time zone)'::regprocedure
  )
  into v_record_definition;

  select pg_get_functiondef(
    'public.community_submit_artist_music(uuid,uuid,jsonb,text)'::regprocedure
  )
  into v_submit_definition;

  select pg_get_functiondef(
    'public.community_get_artist_music_submissions(uuid,integer)'::regprocedure
  )
  into v_reader_definition;

  select pg_get_functiondef(
    'public.admin_resolve_registry_track_intake(uuid,uuid,text)'::regprocedure
  )
  into v_resolver_definition;

  select pg_get_functiondef(
    'editorial.sync_playlist_registry_intake_item_artists()'::regprocedure
  )
  into v_sync_definition;

  if position('can_submit_releases' in v_record_definition) = 0
     or position('can_submit_releases' in v_submit_definition) = 0
     or position('can_submit_releases' in v_reader_definition) = 0
  then
    raise exception 'M5_VERIFY: can_submit_releases is not the sole Artist music authority';
  end if;

  if position('artist_music_submission_review_due_at' in v_submit_definition) = 0
     or position('artist_submission' in v_submit_definition) = 0
     or position('artist_submission' in v_resolver_definition) = 0
     or position('v_intake_origin <> ''playlist_editor''' in v_sync_definition) = 0
  then
    raise exception 'M5_VERIFY: review SLA, Registry resolution, or Playlist synchronization boundary is incomplete';
  end if;

  if v_submit_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.](registry_tracks|registry_releases|registry_artists)'
  then
    raise exception 'M5_VERIFY: Artist submission can write canonical Registry rows';
  end if;

  if has_table_privilege(
       'authenticated',
       'platform_private.artist_music_submission_validations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.artist_music_submission_validations',
       'INSERT'
     )
  then
    raise exception 'M5_VERIFY: private provider validation storage is client-readable';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
      'community_submit_artist_music(uuid,uuid,jsonb,text)'
      and access_class = 'authenticated_command'
  )
     or not exists (
       select 1
       from private.phase_0a_rpc_classification
       where function_signature =
         'community_get_artist_music_submissions(uuid,integer)'
         and access_class = 'authenticated_read'
     )
  then
    raise exception 'M5_VERIFY: M5 RPC classification is incomplete';
  end if;
end;
$m5_verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'intake_table', 'registry_provider_track_suggestions',
  'intake_origin', 'artist_submission',
  'submission_command', 'community_submit_artist_music(uuid,uuid,jsonb,text)',
  'self_reader', 'community_get_artist_music_submissions(uuid,integer)',
  'review_target', '3 business days',
  'provider_validation', 'service-side'
) as m5_artist_music_submission_registry_review;
