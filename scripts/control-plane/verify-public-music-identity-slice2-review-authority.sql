-- Public Music Identity Slice 2 bounded MIZIZI review-authority verifier.
-- Read-only. Proves the review broker exists, is narrow, and adds no canonical
-- data or redirect mutation authority.

do $verify$
declare
  v_new_broker text;
  v_legacy_broker text;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260924193138'
      and name='public_music_identity_slice2_review_authority_v1'
  ) then
    raise exception
      'STOP: exact Public Music Identity Slice 2 migration identity is absent';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings
       where actor_key='mizizi'
         and executor_kind='database_role'
         and executor_key='postgres'
         and status='disabled'
     )
  then
    raise exception
      'STOP: Slice 2 changed the accepted MIZIZI executor boundary';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 review broker is not executable by mizizi_executor';
  end if;

  if has_function_privilege(
       'anon',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 review broker is exposed to application roles';
  end if;

  select pg_get_functiondef(
    'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  )
  into v_new_broker;

  if v_new_broker not like '%p_rule_version <> ''1.3.0''%'
     or v_new_broker not like '%track_slug_credit_evidence_gap%'
     or v_new_broker not like '%track_recording_identity_conflict%'
     or v_new_broker not like '%human_review_required%'
     or v_new_broker not like '%Recording-identity conflict is no longer live.%'
  then
    raise exception
      'STOP: Slice 2 broker is not bound to the exact review-only rule grammar';
  end if;

  select pg_get_functiondef(
    'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  )
  into v_legacy_broker;

  if v_legacy_broker not like '%p_rule_version <> ''1.2.0''%'
     or v_legacy_broker not like '%track_slug_identity_noise%'
     or v_legacy_broker not like '%release_slug_provider_packaging%'
  then
    raise exception
      'STOP: accepted MIZIZI 1.2.0 review broker semantics drifted';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_canonical_write_events',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_slug_redirects',
       'INSERT'
     )
  then
    raise exception
      'STOP: Slice 2 introduced direct canonical/review/redirect mutation authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) then
    raise exception
      'STOP: active MIZIZI standing grant exists at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception
      'STOP: active MIZIZI exact grant exists at rest';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_SLICE2_REVIEW_AUTHORITY_PASS'::text
    as status,
  (select count(*) from supabase_migrations.schema_migrations)::int
    as migration_count,
  (select max(version) from supabase_migrations.schema_migrations)
    as migration_head,
  (
    select count(*)::int
    from public.registry_review_items
    where review_type='mizizi_data_hygiene'
      and status='open'
      and source_payload->>'ruleId' in (
        'track_slug_credit_evidence_gap',
        'track_recording_identity_conflict'
      )
  ) as slice2_open_reviews;
