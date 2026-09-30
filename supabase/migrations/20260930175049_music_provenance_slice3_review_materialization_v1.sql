-- WAKILISHA Music Provenance Slice 3A.
-- Materialize bounded MIZIZI provenance exceptions into the existing Registry
-- review queue. This migration adds no canonical contribution mutation path,
-- no standing MIZIZI authority, and no second review store.
--
-- Generated migration identity:
-- 20260930175049_music_provenance_slice3_review_materialization_v1.sql

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice3-review-materialization-v1',
    0
  )
);

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260930091613'
      and name='music_provenance_slice2_attestation_history_trigger_privilege_fix'
  ) then
    raise exception
      'STOP: accepted Music Provenance Slice 2 authority is required';
  end if;

  if to_regclass(
       'platform_private.registry_contribution_attestations'
     ) is null
     or to_regclass(
       'platform_private.registry_contribution_attestation_state_events'
     ) is null
     or to_regclass(
       'platform_private.registry_evidence_assertions'
     ) is null
     or to_regclass(
       'public.registry_track_contributions'
     ) is null
     or to_regclass(
       'public.registry_work_contributions'
     ) is null
     or to_regclass(
       'public.registry_review_items'
     ) is null
     or to_regprocedure(
       'platform_private.registry_contribution_attestation_current_state_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.finding_fingerprint_v1(text,text,text,text,text,text,text)'
     ) is null
     or to_regprocedure(
       'mizizi_private.assert_executor_v1()'
     ) is null
  then
    raise exception
      'STOP: accepted provenance, review, or MIZIZI executor authority is incomplete';
  end if;

  if to_regprocedure(
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.music_provenance_contribution_review_context_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_get_music_provenance_contribution_review_context_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)'
     ) is not null
  then
    raise exception
      'STOP: Music Provenance Slice 3 review authority already exists; audit before reapplying';
  end if;

  if to_regprocedure(
       'public.admin_admit_registry_track_contribution_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_work_contribution_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted human provenance contribution admission authority is required';
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
      'STOP: exact Stage C MIZIZI executor binding is required';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception
      'STOP: Slice 3A opens only from zero standing MIZIZI authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where status='active'
      and expires_at>now()
  ) then
    raise exception
      'STOP: Slice 3A opens only from zero active exact Registry grants';
  end if;
end
$preflight$;

create function mizizi_private.music_provenance_scan_v1(
  p_since timestamptz,
  p_cursor_created_at timestamptz,
  p_cursor_id text,
  p_shard_count integer,
  p_shard_index integer,
  p_take integer
)
returns table (
  "attestationId" text,
  "subjectType" text,
  "subjectId" text,
  "evidenceAssertionId" text,
  "elicitationMethod" text,
  "latestState" text,
  "evidenceSubjectType" text,
  "evidenceSubjectId" text,
  "evidenceClaimKey" text,
  "canonicalContributionCount" integer,
  "canonicalContributionStatus" text,
  "createdAt" text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,mizizi_private
as $function$
begin
  perform mizizi_private.assert_executor_v1();

  if p_shard_count is null
     or p_shard_count<1
     or p_shard_index is null
     or p_shard_index<0
     or p_shard_index>=p_shard_count
     or p_take is null
     or p_take<1
     or p_take>5000
     or (
       nullif(btrim(coalesce(p_cursor_id,'')),'') is not null
       and p_cursor_id !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     )
  then
    raise exception using errcode='22023',
      message='Invalid bounded Music Provenance scan request.';
  end if;

  return query
  select
    attestation.id::text,
    case
      when attestation.track_id is not null then 'track'
      else 'work'
    end::text,
    coalesce(attestation.track_id,attestation.work_id)::text,
    attestation.evidence_assertion_id::text,
    attestation.elicitation_method,
    coalesce(latest_state.state,''),
    evidence.subject_type,
    evidence.subject_id::text,
    evidence.claim_key,
    case
      when attestation.track_id is not null
        then coalesce(track_history.contribution_count,0)
      else coalesce(work_history.contribution_count,0)
    end::integer,
    case
      when attestation.track_id is not null
        then track_history.latest_status
      else work_history.latest_status
    end,
    attestation.created_at::text
  from platform_private.registry_contribution_attestations attestation
  join platform_private.registry_evidence_assertions evidence
    on evidence.id=attestation.evidence_assertion_id
  left join lateral (
    select event.state
    from platform_private.registry_contribution_attestation_state_events event
    where event.attestation_id=attestation.id
    order by event.event_sequence desc
    limit 1
  ) latest_state on true
  left join lateral (
    select
      count(*)::integer as contribution_count,
      (
        array_agg(
          contribution.status
          order by contribution.created_at desc,contribution.id desc
        )
      )[1] as latest_status
    from public.registry_track_contributions contribution
    where attestation.track_id is not null
      and contribution.evidence_assertion_id=
          attestation.evidence_assertion_id
  ) track_history on true
  left join lateral (
    select
      count(*)::integer as contribution_count,
      (
        array_agg(
          contribution.status
          order by contribution.created_at desc,contribution.id desc
        )
      )[1] as latest_status
    from public.registry_work_contributions contribution
    where attestation.work_id is not null
      and contribution.evidence_assertion_id=
          attestation.evidence_assertion_id
  ) work_history on true
  where (
      p_since is null
      or attestation.created_at>=p_since
    )
    and (
      p_cursor_created_at is null
      or attestation.created_at>p_cursor_created_at
      or (
        attestation.created_at=p_cursor_created_at
        and attestation.id::text>coalesce(p_cursor_id,'')
      )
    )
    and mod(
      hashtextextended(attestation.id::text,0)::numeric+
        9223372036854775808,
      p_shard_count::numeric
    )=p_shard_index::numeric
  order by attestation.created_at,attestation.id
  limit p_take;
end
$function$;

revoke all on function
  mizizi_private.music_provenance_scan_v1(
    timestamptz,timestamptz,text,integer,integer,integer
  )
from public,anon,authenticated,service_role;

grant execute on function
  mizizi_private.music_provenance_scan_v1(
    timestamptz,timestamptz,text,integer,integer,integer
  )
to mizizi_executor;

create function mizizi_private.queue_music_provenance_review_v1(
  p_entity_type text,
  p_entity_id text,
  p_fingerprint text,
  p_rule_id text,
  p_rule_version text,
  p_field_name text,
  p_current_value text,
  p_proposed_value text,
  p_confidence numeric,
  p_severity text,
  p_reason text,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,mizizi_private
as $function$
declare
  v_review_id uuid;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_subject_type text;
  v_subject_id uuid;
  v_latest_state text;
  v_contribution_count integer:=0;
  v_latest_contribution_status text;
  v_expected_fingerprint text;
  v_expected_current text;
  v_expected_proposed text;
  v_expected_field text;
  v_expected_severity text;
  v_title text;
  v_summary text;
  v_priority text;
  v_admissible boolean:=false;
begin
  perform mizizi_private.assert_executor_v1();

  if p_entity_type<>'contribution_attestation'
     or p_entity_id !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_rule_version<>'1.0.0'
     or p_confidence<>1
     or p_rule_id not in (
       'provenance_attestation_evidence_binding_drift',
       'provenance_attestation_multiple_canonical_rows',
       'provenance_admissible_attestation_pending_review',
       'provenance_attestation_noncurrent_canonical_history'
     )
     or nullif(btrim(coalesce(p_reason,'')),'') is null
     or octet_length(p_reason)>2000
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb))<>'object'
     or octet_length(coalesce(p_evidence,'{}'::jsonb)::text)>16384
  then
    raise exception using errcode='22023',
      message='Invalid bounded Music Provenance review payload.';
  end if;

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=p_entity_id::uuid;

  if not found then
    raise exception using errcode='40001',
      message='Contribution attestation no longer exists.';
  end if;

  if v_attestation.track_id is not null
     and v_attestation.work_id is null
  then
    v_subject_type:='track';
    v_subject_id:=v_attestation.track_id;
  elsif v_attestation.work_id is not null
        and v_attestation.track_id is null
  then
    v_subject_type:='work';
    v_subject_id:=v_attestation.work_id;
  else
    raise exception using errcode='23514',
      message='Contribution attestation subject authority is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_attestation.evidence_assertion_id;

  if not found then
    raise exception using errcode='23503',
      message='Contribution attestation lost its evidence assertion.';
  end if;

  v_latest_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      v_attestation.id
    );

  if v_subject_type='track' then
    select
      count(*)::integer,
      (
        array_agg(
          contribution.status
          order by
            contribution.created_at desc,
            contribution.id desc
        )
      )[1]
    into
      v_contribution_count,
      v_latest_contribution_status
    from public.registry_track_contributions contribution
    where contribution.evidence_assertion_id=v_evidence.id;
  else
    select
      count(*)::integer,
      (
        array_agg(
          contribution.status
          order by
            contribution.created_at desc,
            contribution.id desc
        )
      )[1]
    into
      v_contribution_count,
      v_latest_contribution_status
    from public.registry_work_contributions contribution
    where contribution.evidence_assertion_id=v_evidence.id;
  end if;

  if p_evidence->>'evidenceAssertionId' is distinct from v_evidence.id::text
     or p_evidence->>'subjectType' is distinct from v_subject_type
     or p_evidence->>'subjectId' is distinct from v_subject_id::text
     or p_evidence->>'latestState'
          is distinct from coalesce(v_latest_state,'')
  then
    raise exception using errcode='40001',
      message='Music Provenance finding evidence changed since analysis.';
  end if;

  v_admissible:=
    v_latest_state in ('corroborated','confirmed')
    and (
      v_attestation.elicitation_method<>'self_claim'
      or v_latest_state='confirmed'
    );

  case p_rule_id
    when 'provenance_attestation_evidence_binding_drift' then
      if v_evidence.subject_type=v_subject_type
         and v_evidence.subject_id=v_subject_id
         and v_evidence.claim_key='registry.contribution.attestation'
      then
        raise exception using errcode='40001',
          message='Contribution evidence binding drift is no longer live.';
      end if;

      v_expected_field:='evidence_binding';
      v_expected_current:=
        v_evidence.subject_type||':'||
        v_evidence.subject_id::text||':'||
        v_evidence.claim_key;
      v_expected_proposed:=
        v_subject_type||':'||
        v_subject_id::text||':'||
        'registry.contribution.attestation';
      v_expected_severity:='high';
      v_title:='Contribution Evidence Needs Review';
      v_summary:=
        'The evidence linked to this contribution no longer matches its Track or Work.';

    when 'provenance_attestation_multiple_canonical_rows' then
      if not v_admissible
         or v_contribution_count<=1
      then
        raise exception using errcode='40001',
          message='Multiple canonical contribution history is no longer live.';
      end if;

      v_expected_field:='canonical_contribution_count';
      v_expected_current:=v_contribution_count::text;
      v_expected_proposed:='single_canonical_history';
      v_expected_severity:='high';
      v_title:='Contribution History Needs Review';
      v_summary:=
        'The same evidence is linked to more than one canonical contribution.';

    when 'provenance_admissible_attestation_pending_review' then
      if not v_admissible
         or v_contribution_count<>0
      then
        raise exception using errcode='40001',
          message='Pending contribution review is no longer live.';
      end if;

      v_expected_field:='canonical_contribution';
      v_expected_current:='none';
      v_expected_proposed:='human_review_required';
      v_expected_severity:='medium';
      v_title:='Contribution Ready for Review';
      v_summary:=
        'This confirmed contribution has no canonical Registry record yet.';

    when 'provenance_attestation_noncurrent_canonical_history' then
      if not v_admissible
         or v_contribution_count<>1
         or v_latest_contribution_status='verified'
      then
        raise exception using errcode='40001',
          message='Non-current canonical contribution history is no longer live.';
      end if;

      v_expected_field:='canonical_contribution';
      v_expected_current:=
        coalesce(v_latest_contribution_status,'unknown');
      v_expected_proposed:='new_reviewed_attestation_required';
      v_expected_severity:='high';
      v_title:='Fresh Contribution Evidence Needed';
      v_summary:=
        'This contribution has older Registry history and needs a new reviewed attestation.';
  end case;

  if p_field_name is distinct from v_expected_field
     or p_current_value is distinct from v_expected_current
     or p_proposed_value is distinct from v_expected_proposed
     or p_severity is distinct from v_expected_severity
  then
    raise exception using errcode='40001',
      message='Music Provenance finding changed since analysis.';
  end if;

  v_expected_fingerprint:=
    mizizi_private.finding_fingerprint_v1(
      p_rule_id,
      p_rule_version,
      p_entity_type,
      p_entity_id,
      p_field_name,
      p_current_value,
      p_proposed_value
    );

  if v_expected_fingerprint<>p_fingerprint then
    raise exception using errcode='42501',
      message='Music Provenance review fingerprint is not deterministic.';
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status<>'resolved'
    and review.entity_type='contribution_attestation'
    and review.source_id=v_attestation.id::text
    and review.source_payload->>'ruleId'=p_rule_id
    and review.source_payload->>'ruleVersion'=p_rule_version
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    return v_review_id;
  end if;

  v_priority:=
    case
      when p_severity='high' then 'high'
      else 'normal'
    end;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:'||p_fingerprint,
    'contribution_attestation',
    v_attestation.id,
    'mizizi_data_hygiene',
    v_priority,
    'open',
    v_title,
    v_summary,
    'registry_contribution_attestations',
    v_attestation.id::text,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId',p_rule_id,
      'ruleVersion',p_rule_version,
      'fieldName',p_field_name,
      'currentValue',p_current_value,
      'confidence',p_confidence,
      'severity',p_severity,
      'reasonCode',p_reason,
      'attestationId',v_attestation.id,
      'subjectType',v_subject_type,
      'subjectId',v_subject_id,
      'evidenceAssertionId',v_evidence.id,
      'attestationState',v_latest_state,
      'elicitationMethod',v_attestation.elicitation_method,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    ),
    jsonb_build_object(
      'proposedValue',p_proposed_value,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select review.id
    into v_review_id
    from public.registry_review_items review
    where review.review_key='mizizi:'||p_fingerprint;
  end if;

  if v_review_id is null then
    raise exception using errcode='23505',
      message='Music Provenance review identity conflicts with existing authority.';
  end if;

  return v_review_id;
end
$function$;

revoke all on function
  mizizi_private.queue_music_provenance_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
from public,anon,authenticated,service_role;

grant execute on function
  mizizi_private.queue_music_provenance_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
to mizizi_executor;

create function
platform_private.music_provenance_contribution_review_context_v1(
  p_review_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth
as $function$
declare
  v_review public.registry_review_items%rowtype;
  v_attestation platform_private.registry_contribution_attestations%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_attestation_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_subject_title text;
  v_latest_state text;
  v_admissible boolean:=false;
  v_binding_matches boolean:=false;
  v_contribution_count integer:=0;
  v_latest_contribution_status text;
  v_contributions jsonb:='[]'::jsonb;
  v_rule_id text;
  v_rule_version text;
  v_expected_field text;
  v_expected_current text;
  v_expected_proposed text;
  v_context_fingerprint text;
begin
  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='contribution_attestation'
    and review.status='open';

  if not found then
    raise exception using errcode='42501',
      message='Review is not an open Music Provenance contribution review.';
  end if;

  v_rule_id:=v_review.source_payload->>'ruleId';
  v_rule_version:=v_review.source_payload->>'ruleVersion';

  if v_rule_version<>'1.0.0'
     or v_rule_id not in (
       'provenance_attestation_evidence_binding_drift',
       'provenance_attestation_multiple_canonical_rows',
       'provenance_admissible_attestation_pending_review',
       'provenance_attestation_noncurrent_canonical_history'
     )
  then
    raise exception using errcode='42501',
      message='Review is outside the Music Provenance Slice 3 contribution boundary.';
  end if;

  begin
    v_attestation_id:=nullif(btrim(v_review.source_id),'')::uuid;
  exception
    when others then
      raise exception using errcode='23514',
        message='Review source_id is not a contribution attestation UUID.';
  end;

  select attestation.*
  into v_attestation
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=v_attestation_id;

  if not found then
    raise exception using errcode='40001',
      message='Contribution attestation no longer exists.';
  end if;

  if v_attestation.track_id is not null
     and v_attestation.work_id is null
  then
    v_subject_type:='track';
    v_subject_id:=v_attestation.track_id;
    select track.title
    into v_subject_title
    from public.registry_tracks track
    where track.id=v_subject_id;
  elsif v_attestation.work_id is not null
        and v_attestation.track_id is null
  then
    v_subject_type:='work';
    v_subject_id:=v_attestation.work_id;
    select work.title
    into v_subject_title
    from public.registry_works work
    where work.id=v_subject_id;
  else
    raise exception using errcode='23514',
      message='Contribution attestation subject authority is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_attestation.evidence_assertion_id;

  if not found then
    raise exception using errcode='23503',
      message='Contribution attestation lost its evidence assertion.';
  end if;

  v_latest_state:=
    platform_private.registry_contribution_attestation_current_state_v1(
      v_attestation.id
    );

  v_admissible:=
    v_latest_state in ('corroborated','confirmed')
    and (
      v_attestation.elicitation_method<>'self_claim'
      or v_latest_state='confirmed'
    );

  v_binding_matches:=
    v_evidence.subject_type=v_subject_type
    and v_evidence.subject_id=v_subject_id
    and v_evidence.claim_key='registry.contribution.attestation';

  if v_subject_type='track' then
    select
      count(*)::integer,
      (
        array_agg(
          contribution.status
          order by contribution.created_at desc,contribution.id desc
        )
      )[1],
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',contribution.id,
            'status',contribution.status,
            'evidenceAssertionId',contribution.evidence_assertion_id,
            'createdAt',contribution.created_at
          )
          order by contribution.created_at desc,contribution.id desc
        ),
        '[]'::jsonb
      )
    into
      v_contribution_count,
      v_latest_contribution_status,
      v_contributions
    from public.registry_track_contributions contribution
    where contribution.evidence_assertion_id=v_evidence.id;
  else
    select
      count(*)::integer,
      (
        array_agg(
          contribution.status
          order by contribution.created_at desc,contribution.id desc
        )
      )[1],
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',contribution.id,
            'status',contribution.status,
            'evidenceAssertionId',contribution.evidence_assertion_id,
            'createdAt',contribution.created_at
          )
          order by contribution.created_at desc,contribution.id desc
        ),
        '[]'::jsonb
      )
    into
      v_contribution_count,
      v_latest_contribution_status,
      v_contributions
    from public.registry_work_contributions contribution
    where contribution.evidence_assertion_id=v_evidence.id;
  end if;

  case v_rule_id
    when 'provenance_attestation_evidence_binding_drift' then
      if v_binding_matches then
        raise exception using errcode='40001',
          message='Contribution evidence binding drift is no longer live.';
      end if;
      v_expected_field:='evidence_binding';
      v_expected_current:=
        v_evidence.subject_type||':'||
        v_evidence.subject_id::text||':'||
        v_evidence.claim_key;
      v_expected_proposed:=
        v_subject_type||':'||
        v_subject_id::text||':'||
        'registry.contribution.attestation';

    when 'provenance_attestation_multiple_canonical_rows' then
      if not v_binding_matches
         or not v_admissible
         or v_contribution_count<=1
      then
        raise exception using errcode='40001',
          message='Multiple canonical contribution history is no longer live.';
      end if;
      v_expected_field:='canonical_contribution_count';
      v_expected_current:=v_contribution_count::text;
      v_expected_proposed:='single_canonical_history';

    when 'provenance_admissible_attestation_pending_review' then
      if not v_binding_matches
         or not v_admissible
         or v_contribution_count<>0
      then
        raise exception using errcode='40001',
          message='Pending contribution review is no longer live.';
      end if;
      v_expected_field:='canonical_contribution';
      v_expected_current:='none';
      v_expected_proposed:='human_review_required';

    when 'provenance_attestation_noncurrent_canonical_history' then
      if not v_binding_matches
         or not v_admissible
         or v_contribution_count<>1
         or v_latest_contribution_status='verified'
      then
        raise exception using errcode='40001',
          message='Non-current canonical contribution history is no longer live.';
      end if;
      v_expected_field:='canonical_contribution';
      v_expected_current:=coalesce(v_latest_contribution_status,'unknown');
      v_expected_proposed:='new_reviewed_attestation_required';
  end case;

  if v_review.source_payload->>'fieldName' is distinct from v_expected_field
     or v_review.source_payload->>'currentValue' is distinct from v_expected_current
     or v_review.candidate_payload->>'proposedValue' is distinct from v_expected_proposed
     or v_review.source_payload->>'attestationId' is distinct from v_attestation.id::text
     or v_review.source_payload->>'subjectType' is distinct from v_subject_type
     or v_review.source_payload->>'subjectId' is distinct from v_subject_id::text
     or v_review.source_payload->>'evidenceAssertionId' is distinct from v_evidence.id::text
     or v_review.source_payload->>'attestationState' is distinct from coalesce(v_latest_state,'')
  then
    raise exception using errcode='40001',
      message='Music Provenance review context changed after MIZIZI materialization.';
  end if;

  v_context_fingerprint:=
    md5(
      jsonb_build_object(
        'reviewId',v_review.id,
        'reviewUpdatedAt',v_review.updated_at,
        'attestationId',v_attestation.id,
        'attestationState',v_latest_state,
        'evidenceAssertionId',v_evidence.id,
        'evidenceFingerprint',v_evidence.assertion_fingerprint,
        'evidenceBindingMatches',v_binding_matches,
        'canonicalContributionCount',v_contribution_count,
        'latestCanonicalStatus',v_latest_contribution_status,
        'ruleId',v_rule_id,
        'ruleVersion',v_rule_version
      )::text
    );

  return jsonb_build_object(
    'reviewId',v_review.id,
    'reviewStatus',v_review.status,
    'reviewUpdatedAt',v_review.updated_at,
    'ruleId',v_rule_id,
    'ruleVersion',v_rule_version,
    'contextFingerprint',v_context_fingerprint,
    'attestationId',v_attestation.id,
    'attestationState',v_latest_state,
    'elicitationMethod',v_attestation.elicitation_method,
    'subjectType',v_subject_type,
    'subjectId',v_subject_id,
    'subjectTitle',coalesce(v_subject_title,''),
    'roleKey',v_attestation.role_key,
    'instrumentKey',v_attestation.instrument_key,
    'detailText',v_attestation.detail_text,
    'creditedAs',v_attestation.credited_as,
    'proposedPersonResourceId',v_attestation.proposed_person_resource_id,
    'proposedOrganizationResourceId',v_attestation.proposed_organization_resource_id,
    'proposedArtistId',v_attestation.proposed_artist_id,
    'evidenceAssertionId',v_evidence.id,
    'evidenceFingerprint',v_evidence.assertion_fingerprint,
    'evidenceTrustClass',v_evidence.trust_class,
    'evidenceBinding',jsonb_build_object(
      'subjectType',v_evidence.subject_type,
      'subjectId',v_evidence.subject_id,
      'claimKey',v_evidence.claim_key,
      'matchesAttestationSubject',v_binding_matches
    ),
    'canonicalContributionCount',v_contribution_count,
    'latestCanonicalStatus',v_latest_contribution_status,
    'canonicalContributions',v_contributions,
    'canAdmit',
      v_rule_id='provenance_admissible_attestation_pending_review'
      and v_binding_matches
      and v_admissible
      and v_contribution_count=0,
    'existingDecision',(
      select jsonb_build_object(
        'id',decision.id,
        'decisionType',decision.decision_type,
        'afterPayload',decision.after_payload,
        'notes',decision.decision_notes,
        'status',decision.status,
        'createdAt',decision.created_at
      )
      from public.registry_canonicalization_decisions decision
      where decision.review_item_id=v_review.id
        and decision.metadata->>'programmeKey'=
          'music_provenance_contribution_review_v1'
        and decision.status='recorded'
      order by decision.created_at desc,decision.id desc
      limit 1
    )
  );
end
$function$;

revoke all on function
  platform_private.music_provenance_contribution_review_context_v1(uuid)
from public,anon,authenticated,service_role,mizizi_executor;

create function
public.admin_get_music_provenance_contribution_review_context_v1(
  p_review_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth
as $function$
declare
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_review_id is null then
    raise exception using errcode='22023',
      message='Review ID is required.';
  end if;

  return
    platform_private.music_provenance_contribution_review_context_v1(
      p_review_id
    );
end
$function$;

create function
public.admin_record_music_provenance_contribution_review_decision_v1(
  p_review_id uuid,
  p_decision_type text,
  p_decision_payload jsonb,
  p_expected_context_fingerprint text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_review public.registry_review_items%rowtype;
  v_attestation_id uuid;
  v_context jsonb;
  v_context_fingerprint text;
  v_rule_id text;
  v_subject_type text;
  v_decision_type text:=nullif(btrim(coalesce(p_decision_type,'')),'');
  v_payload jsonb:=coalesce(p_decision_payload,'{}'::jsonb);
  v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
  v_existing public.registry_canonicalization_decisions%rowtype;
  v_decision_id uuid;
  v_admission jsonb;
  v_contribution_id uuid;
  v_operation_id uuid;
  v_review_resolved boolean:=false;
  v_canonical_changed boolean:=false;
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_review_id is null
     or v_decision_type is null
     or v_notes is null
     or nullif(
          btrim(coalesce(p_expected_context_fingerprint,'')),
          ''
        ) is null
  then
    raise exception using errcode='22023',
      message='Review ID, decision type, expected context fingerprint, and notes are required.';
  end if;

  if jsonb_typeof(v_payload)<>'object' then
    raise exception using errcode='22023',
      message='Decision payload must be a JSON object.';
  end if;

  if v_decision_type not in (
       'music_provenance_admit_contribution',
       'music_provenance_request_new_attestation',
       'music_provenance_escalate_integrity_conflict',
       'music_provenance_needs_more_evidence'
     )
  then
    raise exception using errcode='22023',
      message='Unsupported Music Provenance contribution decision type.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='contribution_attestation'
    and review.status='open'
  for update;

  if not found then
    raise exception using errcode='42501',
      message='Review is not an open Music Provenance contribution review.';
  end if;

  begin
    v_attestation_id:=nullif(btrim(v_review.source_id),'')::uuid;
  exception
    when others then
      raise exception using errcode='23514',
        message='Review source_id is not a contribution attestation UUID.';
  end;

  perform 1
  from platform_private.registry_contribution_attestations attestation
  where attestation.id=v_attestation_id
  for update;

  if not found then
    raise exception using errcode='40001',
      message='Contribution attestation no longer exists.';
  end if;

  v_context:=
    platform_private.music_provenance_contribution_review_context_v1(
      v_review.id
    );
  v_context_fingerprint:=v_context->>'contextFingerprint';
  v_rule_id:=v_context->>'ruleId';
  v_subject_type:=v_context->>'subjectType';

  if v_context_fingerprint is distinct from
     p_expected_context_fingerprint
  then
    raise exception using errcode='40001',
      message='Contribution review context changed after it was loaded. Reload before deciding.';
  end if;

  if v_decision_type='music_provenance_admit_contribution' then
    if v_rule_id<>'provenance_admissible_attestation_pending_review'
       or coalesce((v_context->>'canAdmit')::boolean,false) is not true
    then
      raise exception using errcode='23514',
        message='Only an admissible pending contribution review can be admitted.';
    end if;
  elsif v_decision_type='music_provenance_request_new_attestation' then
    if v_rule_id<>'provenance_attestation_noncurrent_canonical_history'
    then
      raise exception using errcode='23514',
        message='A new-attestation decision is only valid for non-current canonical history.';
    end if;
  elsif v_decision_type='music_provenance_escalate_integrity_conflict' then
    if v_rule_id not in (
         'provenance_attestation_evidence_binding_drift',
         'provenance_attestation_multiple_canonical_rows'
       )
    then
      raise exception using errcode='23514',
        message='Integrity escalation is only valid for binding drift or multiple canonical rows.';
    end if;
  end if;

  if v_decision_type='music_provenance_admit_contribution' then
    if v_subject_type='track' then
      v_admission:=
        public.admin_admit_registry_track_contribution_v1(
          v_attestation_id
        );
    elsif v_subject_type='work' then
      v_admission:=
        public.admin_admit_registry_work_contribution_v1(
          v_attestation_id
        );
    else
      raise exception using errcode='23514',
        message='Contribution subject type cannot be admitted.';
    end if;

    if coalesce((v_admission#>>'{_authority,verified}')::boolean,false)
         is not true
    then
      raise exception using errcode='23514',
        message='Contribution admission did not return verified authority.';
    end if;

    if v_admission#>>'{_authority,mode}'='already_current' then
      raise exception using errcode='40001',
        message='Canonical contribution changed after review context was loaded. Reload before deciding.';
    end if;

    begin
      v_contribution_id:=(v_admission->>'id')::uuid;
      v_operation_id:=
        nullif(v_admission#>>'{_authority,operation_id}','')::uuid;
    exception
      when others then
        raise exception using errcode='23514',
          message='Verified contribution admission returned malformed authority metadata.';
    end;

    if v_contribution_id is null
       or v_operation_id is null
    then
      raise exception using errcode='23514',
        message='Verified contribution admission is missing canonical identity or operation authority.';
    end if;

    v_review_resolved:=true;
    v_canonical_changed:=true;
  end if;

  select decision.*
  into v_existing
  from public.registry_canonicalization_decisions decision
  where decision.review_item_id=v_review.id
    and decision.metadata->>'programmeKey'=
      'music_provenance_contribution_review_v1'
    and decision.status='recorded'
  order by decision.created_at desc,decision.id desc
  limit 1
  for update;

  if found then
    update public.registry_canonicalization_decisions
    set
      status='superseded',
      metadata=
        coalesce(metadata,'{}'::jsonb)||
        jsonb_build_object(
          'supersededAt',now(),
          'supersededByUserId',v_user_id
        )
    where id=v_existing.id;
  end if;

  insert into public.registry_canonicalization_decisions (
    review_item_id,
    decision_type,
    entity_type,
    entity_id,
    before_payload,
    after_payload,
    decision_notes,
    decided_by,
    status,
    metadata
  )
  values (
    v_review.id,
    v_decision_type,
    'contribution_attestation',
    v_attestation_id,
    jsonb_build_object(
      'reviewStatus',v_review.status,
      'ruleId',v_rule_id,
      'ruleVersion',v_context->>'ruleVersion',
      'contextFingerprint',v_context_fingerprint,
      'attestationState',v_context->>'attestationState',
      'subjectType',v_subject_type,
      'subjectId',v_context->>'subjectId',
      'evidenceAssertionId',v_context->>'evidenceAssertionId',
      'canonicalContributionCount',
        (v_context->>'canonicalContributionCount')::integer
    ),
    v_payload||
      case
        when v_review_resolved then
          jsonb_build_object(
            'canonicalContributionId',v_contribution_id,
            'verifiedOperationId',v_operation_id
          )
        else '{}'::jsonb
      end,
    v_notes,
    v_user_id,
    'recorded',
    jsonb_build_object(
      'programmeKey','music_provenance_contribution_review_v1',
      'programmeIssue',1121,
      'decisionStage',
        case
          when v_review_resolved then 'verified_admission'
          else 'human_review_recorded'
        end,
      'canonicalEntitiesChanged',v_canonical_changed,
      'reviewResolved',v_review_resolved,
      'rightsClaimInferred',false
    )
  )
  returning id into v_decision_id;

  if v_review_resolved then
    update public.registry_review_items
    set
      status='resolved',
      resolution_payload=jsonb_build_object(
        'decisionId',v_decision_id,
        'decisionType',v_decision_type,
        'canonicalContributionId',v_contribution_id,
        'verifiedOperationId',v_operation_id,
        'canonicalEntitiesChanged',true,
        'reviewResolved',true,
        'rightsClaimInferred',false
      ),
      resolved_at=now(),
      updated_at=now()
    where id=v_review.id;
  end if;

  return jsonb_build_object(
    'decisionId',v_decision_id,
    'reviewId',v_review.id,
    'attestationId',v_attestation_id,
    'decisionType',v_decision_type,
    'contextFingerprint',v_context_fingerprint,
    'reviewStatus',
      case when v_review_resolved then 'resolved' else 'open' end,
    'canonicalContributionId',v_contribution_id,
    'verifiedOperationId',v_operation_id,
    'canonicalEntitiesChanged',v_canonical_changed,
    'reviewResolved',v_review_resolved,
    'rightsClaimInferred',false
  );
end
$function$;

revoke all on function
  public.admin_get_music_provenance_contribution_review_context_v1(uuid)
from public,anon,authenticated,service_role,mizizi_executor;

revoke all on function
  public.admin_record_music_provenance_contribution_review_decision_v1(
    uuid,text,jsonb,text,text
  )
from public,anon,authenticated,service_role,mizizi_executor;

grant execute on function
  public.admin_get_music_provenance_contribution_review_context_v1(uuid)
to authenticated;

grant execute on function
  public.admin_record_music_provenance_contribution_review_decision_v1(
    uuid,text,jsonb,text,text
  )
to authenticated;

do $postflight$
begin
  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Music Provenance scan broker EXECUTE authority drifted';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Music Provenance review broker is not executable by mizizi_executor';
  end if;

  if has_function_privilege(
       'anon',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Music Provenance review broker leaked to application roles';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_get_music_provenance_contribution_review_context_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'mizizi_executor',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: typed Music Provenance Admin review RPC authority drifted';
  end if;

  if has_schema_privilege(
       'mizizi_executor',
       'platform_private',
       'USAGE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_contribution_attestations',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_contribution_attestation_state_events',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_contributions',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_work_contributions',
       'SELECT'
     )
  then
    raise exception
      'STOP: Slice 3A leaked direct provenance read authority to mizizi_executor';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_contributions',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_contributions',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_work_contributions',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_work_contributions',
       'UPDATE'
     )
  then
    raise exception
      'STOP: Slice 3A granted direct review or canonical contribution table mutation authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception
      'STOP: Slice 3A left standing MIZIZI capability authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where status='active'
      and expires_at>now()
  ) then
    raise exception
      'STOP: Slice 3A left active exact Registry authority';
  end if;
end
$postflight$;

commit;
