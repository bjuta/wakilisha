\set ON_ERROR_STOP on

do $verify$
declare
  v_base_hash text;
  v_wrapper text;
  v_review_broker text;
  v_decision_authority text;
begin
  if to_regprocedure(
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])'
     ) is null
     or to_regprocedure(
       'platform_private.admin_preview_registry_track_duplicate_repair_base_v1(uuid,uuid[])'
     ) is null
  then
    raise exception 'Reviewed Track duplicate preview authority is incomplete';
  end if;

  select encode(extensions.digest(p.prosrc,'sha256'),'hex')
  into v_base_hash
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='platform_private'
    and p.proname='admin_preview_registry_track_duplicate_repair_base_v1'
    and pg_get_function_identity_arguments(p.oid)=
      'p_canonical_track_id uuid, p_duplicate_track_ids uuid[]';

  if v_base_hash is distinct from
     '7a3ff9db9a2160dcbc45bc81ae3d3b554aab081888b09866e59ea498e3c3e761'
  then
    raise exception 'Mature Track duplicate preview base hash drifted';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])'::regprocedure
  ))
  into v_wrapper;

  select lower(pg_get_functiondef(
    'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  ))
  into v_review_broker;

  select lower(pg_get_functiondef(
    'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)'::regprocedure
  ))
  into v_decision_authority;

  if position(
       'admin_preview_registry_track_duplicate_repair_base_v1' in v_wrapper
     )=0
     or position('public_music_identity_true_duplicate' in v_wrapper)=0
     or position(
          'public_music_identity_track_actual_zero_v1' in v_wrapper
        )=0
     or position('human_review_recorded' in v_wrapper)=0
     or position('trackstatefingerprint' in v_wrapper)=0
     or position('track_recording_identity_conflict' in v_wrapper)=0
     or position('reviewedhumandecisionmatches' in v_wrapper)=0
     or position('not_enough_identity_evidence' in v_wrapper)=0
  then
    raise exception 'Reviewed Track duplicate preview lost exact #1094 authority binding';
  end if;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public|platform_private)[.]'
  then
    raise exception 'Reviewed Track duplicate preview gained mutation authority';
  end if;

  if position('wk_1094_synthetic_collision_review_evidence_drift' in v_review_broker)=0
     or position('track.status=''needs_review''' in v_review_broker)=0
     or position(
          'wk_1094_synthetic_duplicate_decision_review_binding_drift'
          in v_decision_authority
        )=0
     or position('track_recording_identity_conflict' in v_decision_authority)=0
     or position('slug_review.id=identity_review.id' in v_wrapper)=0
  then
    raise exception
      'Reviewed duplicate authority lost the #1094 synthetic-collision review/decision binding';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])',
       'EXECUTE'
     )
  then
    raise exception 'Reviewed Track duplicate preview public grants drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.admin_preview_registry_track_duplicate_repair_base_v1(uuid,uuid[])',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.admin_preview_registry_track_duplicate_repair_base_v1(uuid,uuid[])',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.admin_preview_registry_track_duplicate_repair_base_v1(uuid,uuid[])',
       'EXECUTE'
     )
  then
    raise exception 'Mature Track duplicate preview base leaked private execution';
  end if;
end
$verify$;

\echo PUBLIC_MUSIC_IDENTITY_REVIEWED_DUPLICATE_AUTHORITY_V1_PASS
