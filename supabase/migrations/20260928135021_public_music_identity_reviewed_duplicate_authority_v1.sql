do $preflight$
declare
  v_hash text;
begin
  if to_regprocedure(
       'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])'
     ) is null
  then
    raise exception 'Track duplicate repair preview authority is missing';
  end if;

  if to_regprocedure(
       'platform_private.admin_preview_registry_track_duplicate_repair_base_v1(uuid,uuid[])'
     ) is not null
  then
    raise exception 'Reviewed duplicate preview base already exists; audit before reapplying';
  end if;

  select encode(extensions.digest(p.prosrc,'sha256'),'hex')
  into v_hash
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='admin_preview_registry_track_duplicate_repair'
    and pg_get_function_identity_arguments(p.oid)=
      'p_canonical_track_id uuid, p_duplicate_track_ids uuid[]';

  if v_hash is distinct from
     '7a3ff9db9a2160dcbc45bc81ae3d3b554aab081888b09866e59ea498e3c3e761'
  then
    raise exception 'Track duplicate repair preview body drifted before reviewed-authority convergence';
  end if;
end
$preflight$;

alter function public.admin_preview_registry_track_duplicate_repair(
  uuid,uuid[]
)
set schema platform_private;

alter function platform_private.admin_preview_registry_track_duplicate_repair(
  uuid,uuid[]
)
rename to admin_preview_registry_track_duplicate_repair_base_v1;

revoke all on function
  platform_private.admin_preview_registry_track_duplicate_repair_base_v1(
    uuid,uuid[]
  )
from public, anon, authenticated, service_role;

create function public.admin_preview_registry_track_duplicate_repair(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_duplicate_ids uuid[];
  v_preview jsonb;
  v_reviewed_match_count integer:=0;
  v_duplicate_count integer:=0;
  v_other_blockers jsonb:='[]'::jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception 'insufficient_privilege';
  end if;

  v_duplicate_ids:=array(
    select distinct item
    from unnest(coalesce(p_duplicate_track_ids,'{}'::uuid[])) item
    where item is not null
      and item<>p_canonical_track_id
    order by item
  );

  v_duplicate_count:=coalesce(cardinality(v_duplicate_ids),0);

  v_preview:=
    platform_private.admin_preview_registry_track_duplicate_repair_base_v1(
      p_canonical_track_id,
      v_duplicate_ids
    );

  if v_duplicate_count=0 then
    return v_preview;
  end if;

  select count(*)::integer
  into v_reviewed_match_count
  from unnest(v_duplicate_ids) duplicate_id
  where exists (
    select 1
    from public.registry_canonicalization_decisions decision
    join public.registry_review_items slug_review
      on slug_review.id=decision.review_item_id
    join public.registry_review_items identity_review
      on identity_review.id::text=
           decision.before_payload->>'relatedRecordingIdentityReviewId'
    where decision.entity_type='track'
      and decision.entity_id=duplicate_id
      and decision.decision_type='public_music_identity_true_duplicate'
      and decision.status='recorded'
      and decision.decided_by is not null
      and decision.metadata->>'programmeKey'=
          'public_music_identity_track_actual_zero_v1'
      and decision.metadata->>'programmeIssue'='1094'
      and decision.metadata->>'decisionStage'='human_review_recorded'
      and coalesce(decision.metadata->>'reviewResolved','false')='false'
      and decision.after_payload->>'canonicalTrackId'=
          p_canonical_track_id::text
      and decision.before_payload->>'trackStateFingerprint'=
          platform_private.registry_subject_state_fingerprint(
            'track',
            duplicate_id
          )
      and slug_review.review_type='mizizi_data_hygiene'
      and slug_review.entity_type='track'
      and slug_review.status='open'
      and slug_review.source_id=duplicate_id::text
      and (
        (
          slug_review.source_payload->>'ruleId'='track_slug_identity_noise'
          and slug_review.source_payload->>'ruleVersion'='1.1.0'
        )
        or
        (
          slug_review.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
          and slug_review.source_payload->>'ruleVersion'='1.3.0'
        )
      )
      and identity_review.review_type='mizizi_data_hygiene'
      and identity_review.entity_type='track'
      and identity_review.status='open'
      and identity_review.source_id=duplicate_id::text
      and identity_review.source_payload->>'ruleId'=
          'track_recording_identity_conflict'
      and identity_review.source_payload->>'ruleVersion'='1.3.0'
      and exists (
        select 1
        from jsonb_array_elements(
          coalesce(
            identity_review.source_payload#>'{evidence,peers}',
            '[]'::jsonb
          )
        ) peer
        where peer->>'id'=p_canonical_track_id::text
      )
  );

  v_preview:=jsonb_set(
    v_preview,
    '{counts,reviewedHumanDecisionMatches}',
    to_jsonb(v_reviewed_match_count),
    true
  );

  if v_reviewed_match_count<>v_duplicate_count then
    return v_preview;
  end if;

  select coalesce(jsonb_agg(value),'[]'::jsonb)
  into v_other_blockers
  from jsonb_array_elements(
    coalesce(v_preview->'blockers','[]'::jsonb)
  ) blocker(value)
  where blocker.value<>to_jsonb('not_enough_identity_evidence'::text);

  if jsonb_array_length(v_other_blockers)>0 then
    return v_preview;
  end if;

  v_preview:=jsonb_set(
    v_preview,
    '{confidenceBucket}',
    to_jsonb('high'::text),
    false
  );

  v_preview:=jsonb_set(
    v_preview,
    '{blockers}',
    '[]'::jsonb,
    false
  );

  v_preview:=jsonb_set(
    v_preview,
    '{reviewedAuthority}',
    jsonb_build_object(
      'programmeKey','public_music_identity_track_actual_zero_v1',
      'programmeIssue',1094,
      'decisionType','public_music_identity_true_duplicate',
      'coverage','all_duplicate_targets'
    ),
    true
  );

  return v_preview;
end
$$;

revoke all on function
  public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])
from public, anon, service_role;

grant execute on function
  public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])
to authenticated;

comment on function
  public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])
is
  'Governed Track duplicate preview. Preserves the mature machine-evidence classifier and additionally accepts an exact current #1094 reviewed true-duplicate decision for every duplicate target when the canonical Track is the recorded recording-identity peer.';

do $proof$
declare
  v_base_hash text;
  v_wrapper text;
begin
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
    raise exception 'Mature Track duplicate preview body was not preserved byte-for-byte';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])'::regprocedure
  ))
  into v_wrapper;

  if position(
       'admin_preview_registry_track_duplicate_repair_base_v1' in v_wrapper
     )=0
     or position('public_music_identity_true_duplicate' in v_wrapper)=0
     or position(
          'public_music_identity_track_actual_zero_v1' in v_wrapper
        )=0
     or position('trackstatefingerprint' in v_wrapper)=0
     or position('track_recording_identity_conflict' in v_wrapper)=0
     or position('reviewedhumandecisionmatches' in v_wrapper)=0
  then
    raise exception 'Reviewed duplicate preview wrapper lost required #1094 authority bindings';
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
    raise exception 'Reviewed duplicate preview public execution grants drifted';
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
$proof$;
