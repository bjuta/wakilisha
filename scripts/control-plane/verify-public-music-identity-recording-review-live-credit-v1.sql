\set ON_ERROR_STOP on

do $verify$
declare
  v_broker text;
begin
  select lower(pg_get_functiondef(
    'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  ))
  into v_broker;

  if position('track_recording_identity_conflict' in v_broker)=0
     or position('recording-identity conflict is no longer live.' in v_broker)=0
     or position('wk_1094_synthetic_collision_review_evidence_drift' in v_broker)=0
     or position('target_credit.status = ''active''' in v_broker)=0
     or position('target_credit.status = ''needs_review''' in v_broker)=0
     or position('v_track.status = ''needs_review''' in v_broker)=0
     or position('peer_credit.status = ''active''' in v_broker)=0
  then
    raise exception
      'Recording-review broker lost exact active/needs_review live-credit authority';
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
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Recording-review broker execution grants drifted';
  end if;

  if has_table_privilege(
       'mizizi_executor','public.registry_tracks','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_track_artists','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','INSERT'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','DELETE'
     )
  then
    raise exception
      'Recording-review live-credit repair widened direct mutation authority';
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
      'Recording-review live-credit repair left standing MIZIZI capability';
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
      'Recording-review live-credit repair left active exact authority';
  end if;

  raise notice
    'PUBLIC_MUSIC_IDENTITY_RECORDING_REVIEW_LIVE_CREDIT_V1_PASS';
end
$verify$;
