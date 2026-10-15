-- CLI-minted on the owner Mac, Supabase CLI 2.107.0, 14 October 2026.
-- Forward-only DB02 observation receipts and authenticated case time-box.
-- No new review decisions, queues, Registry mutations, or table grants.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $wk_229_preflight$
declare n integer; head text; v_gateway text;
begin
 select count(*),max(version) into n,head from supabase_migrations.schema_migrations;
 if n<>228 or head<>'20261014094213'
  or to_regclass('mizizi_private.case_observations') is not null
  or to_regprocedure('public.admin_mizizi_done_for_now_case_v1(uuid,integer,text,timestamp with time zone)') is not null
  or to_regprocedure('mizizi_private.assert_headquarters_operator_v1(text)') is null
  or (select count(*) from mizizi_private.workspaces where workspace_key='wakilisha-internal' and status='active')<>1
 then raise exception 'STOP_229_MIGRATION_BASE_OR_AUTHORITY_COLLISION'; end if;
 v_gateway:=pg_get_functiondef('mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)'::regprocedure);
 if position('v_review.review_key <> ''mizizi:'' || v_fp' in v_gateway)=0
  or position('Completed case requires separately authorized reopening' in v_gateway)=0
  or position('observation_recorded' in v_gateway)=0
 then raise exception 'STOP_229_ORIGINAL_CASE_GATEWAY_CONTRACT_DRIFT'; end if;
end $wk_229_preflight$;

create table mizizi_private.case_observations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 case_id uuid not null,
 review_item_id uuid not null references public.registry_review_items(id)
  on update restrict on delete restrict,
 case_revision integer not null,
 previous_case_revision integer,
 observation_fingerprint text not null,
 previous_observation_fingerprint text,
 original_review_key text not null,
 source_finding_sha256 text not null,
 policy_ruleset_version text not null,
 recorded_at timestamptz not null default clock_timestamp(),
 constraint wk_case_observations_case_fk foreign key(workspace_id,case_id)
  references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
 constraint wk_case_observations_revision_unique unique(case_id,case_revision),
 constraint wk_case_observations_revision_valid check(case_revision>=1 and (
  (previous_case_revision is null and previous_observation_fingerprint is null)
  or (previous_case_revision=case_revision-1 and previous_observation_fingerprint is not null))),
 constraint wk_case_observations_digest_valid check (
  observation_fingerprint ~ '^[0-9a-f]{64}$'
  and (previous_observation_fingerprint is null or previous_observation_fingerprint ~ '^[0-9a-f]{64}$')
  and (previous_observation_fingerprint is null or previous_observation_fingerprint<>observation_fingerprint)
  and source_finding_sha256 ~ '^[0-9a-f]{64}$'
  and original_review_key ~ '^mizizi:[0-9a-f]{64}$'),
 constraint wk_case_observations_ruleset_valid check (
  policy_ruleset_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$')
);
create index wk_case_observations_timeline
 on mizizi_private.case_observations(workspace_id,case_id,case_revision desc);
alter table mizizi_private.case_observations enable row level security;
alter table mizizi_private.case_observations force row level security;
revoke all on table mizizi_private.case_observations
 from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.block_case_observation_mutation_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $wk_immutable$
begin
 raise exception 'Case observation receipts are append-only' using errcode='23514';
 return null;
end;
$wk_immutable$;
revoke all on function mizizi_private.block_case_observation_mutation_v1()
 from public,anon,authenticated,service_role,mizizi_executor;
create trigger wk_case_observations_immutable
 before update or delete on mizizi_private.case_observations
 for each row execute function mizizi_private.block_case_observation_mutation_v1();

create or replace function mizizi_private.admit_review_case_gateway_v1(
  p_workspace_id uuid,
  p_ruleset_version text,
  p_finding jsonb
)
returns table (
  review_item_id uuid,
  headquarters_case_id uuid,
  headquarters_case_revision integer,
  receipt_link_id uuid,
  outcome text
)
language plpgsql
security definer
set search_path = pg_catalog
as $gateway$
declare
  v_entity_type text;
  v_entity_id_text text;
  v_entity_id uuid;
  v_rule_id text;
  v_rule_version text;
  v_field text;
  v_fp text;
  v_disposition text;
  v_current text;
  v_proposed text;
  v_reason text;
  v_severity text;
  v_confidence numeric;
  v_evidence jsonb;
  v_family text;
  v_claim_key text;
  v_case_key text;
  v_workspace_id uuid;
  v_review_id uuid;
  v_case_id uuid;
  v_case_revision integer;
  v_prior_fp text;
  v_previous_revision integer;
  v_state text;
  v_case_subject_type text;
  v_case_subject_id uuid;
  v_case_family text;
  v_case_claim text;
  v_receipt_id uuid;
  v_receipt_fp text;
  v_existing_receipt_fp text;
  v_status text := 'created';
  v_review public.registry_review_items%rowtype;
begin
  -- Do not broaden the approved executor login or give case table DML rights.
  perform mizizi_private.assert_executor_v1();
  if session_user <> 'mizizi_executor' then
    raise exception using errcode='42501', message='Approved narrow MIZIZI executor session required';
  end if;
  if jsonb_typeof(p_finding) <> 'object'
     or octet_length(p_finding::text) > 16384
     or p_ruleset_version is null
     or p_ruleset_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception using errcode='22023',message='Invalid bounded MIZIZI case request';
  end if;

  v_entity_type := p_finding->>'entityType';
  v_entity_id_text := p_finding->>'entityId';
  v_rule_id := p_finding->>'ruleId';
  v_rule_version := p_finding->>'ruleVersion';
  v_field := p_finding->>'fieldName';
  v_fp := p_finding->>'fingerprint';
  v_disposition := p_finding->>'disposition';
  v_current := p_finding->>'currentValue';
  v_proposed := p_finding->>'proposedValue';
  v_reason := p_finding->>'reason';
  v_severity := p_finding->>'severity';
  v_evidence := p_finding->'evidence';

  if v_disposition <> 'review'
     or v_entity_type not in ('track','release')
     or v_entity_id_text is null
     or v_entity_id_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     or v_rule_id !~ '^[a-z][a-z0-9_]{2,79}$'
     or v_field !~ '^[a-z][a-z0-9_]{2,79}$'
     or v_fp !~ '^[0-9a-f]{64}$'
     or v_rule_version is null
     or length(v_rule_version) > 64
     or v_severity <> 'high'
     or v_reason is null
     or octet_length(v_reason) > 2000
     or jsonb_typeof(v_evidence) <> 'object'
  then
    raise exception using errcode='22023',message='Finding outside bounded MIZIZI review-case lane';
  end if;
  if (p_finding->>'confidence') !~ '^(0(\.[0-9]+)?|1(\.0+)?)$' then
    raise exception using errcode='22023',message='Invalid finding confidence';
  end if;
  v_confidence := (p_finding->>'confidence')::numeric;
  v_entity_id := v_entity_id_text::uuid;
  v_entity_id_text := v_entity_id::text;

  -- Exactly the historical approved lanes. Unknown rules cannot enter the new case ledger.
  if v_entity_type = 'track' and v_rule_id = 'track_slug_identity_noise'
       and v_rule_version in ('1.1.0','1.2.0') then
    v_family := 'track_identity_metadata_review_v1';
  elsif v_entity_type = 'release' and v_rule_id = 'release_slug_provider_packaging'
       and v_rule_version = '1.2.0' then
    v_family := 'release_identity_metadata_review_v1';
  elsif v_entity_type = 'track' and v_rule_id = 'track_slug_credit_evidence_gap'
       and v_rule_version = '1.3.0' then
    v_family := 'track_identity_metadata_review_v1';
  elsif v_entity_type = 'track' and v_rule_id = 'track_recording_identity_conflict'
       and v_rule_version = '1.3.0' then
    v_family := 'recording_identity_review_v1';
  else
    raise exception using errcode='22023',message='Rule/version has no approved review-case authority';
  end if;
  v_claim_key := 'mizizi.' || v_rule_id || '.' || v_field;
  if length(v_claim_key) > 200 then
    raise exception using errcode='22023',message='Claim key exceeds bounded case contract';
  end if;

  select w.id into strict v_workspace_id
  from mizizi_private.workspaces w
  where w.workspace_key = 'wakilisha-internal'
    and w.workspace_kind = 'internal'
    and w.status = 'active';

  if p_workspace_id is distinct from v_workspace_id then
    raise exception using errcode='42501',message='MIZIZI review-case workspace not authorized';
  end if;

  v_case_key := 'mizizi:case:v1:' || encode(
    extensions.digest(
      '[' || to_json(v_entity_type)::text || ',' || to_json(v_entity_id_text)::text ||
      ',' || to_json(v_family)::text || ',' || to_json(v_claim_key)::text || ']',
      'sha256'
    ),'hex'
  );

  -- The current Registry broker validates live subject state/evidence and may
  -- reject stale or previously finalized review work. It stays authoritative.
  if v_rule_version = '1.3.0' then
    v_review_id := mizizi_private.queue_public_music_identity_review_v1(
      v_entity_type,v_entity_id_text,v_fp,v_rule_id,v_rule_version,v_field,
      v_current,v_proposed,v_confidence,v_severity,v_reason,v_evidence);
  else
    v_review_id := mizizi_private.queue_registry_review_v1(
      v_entity_type,v_entity_id_text,v_fp,v_rule_id,v_rule_version,v_field,
      v_current,v_proposed,v_confidence,v_severity,v_reason,v_evidence);
  end if;

  select review.* into strict v_review
  from public.registry_review_items review
  where review.id = v_review_id
  for share;
  if v_review.review_type <> 'mizizi_data_hygiene'
     or v_review.status <> 'open'
     or v_review.entity_type <> v_entity_type
     or v_review.entity_id is distinct from v_entity_id
     or v_review.source_id is distinct from v_entity_id_text
     or v_review.source_payload->>'fieldName' is distinct from v_field
     or v_review.source_payload->>'ruleId' is distinct from v_rule_id
     or v_review.source_payload->>'ruleVersion' is distinct from v_rule_version
  then
    raise exception using errcode='23514',message='Existing Registry review no longer matches its accepted case subject';
  end if;

  -- Reuse an original human review for changed observations ONLY when
  -- that exact review was already linked to this subject-bound case.
  if v_review.review_key <> 'mizizi:' || v_fp and not exists (
    select 1 from mizizi_private.cases established
    join mizizi_private.case_receipt_links link
      on link.workspace_id=established.workspace_id and link.case_id=established.id
    where established.workspace_id=v_workspace_id and established.case_key=v_case_key
      and established.subject_type=v_entity_type and established.subject_id=v_entity_id
      and established.claim_family_key=v_family and established.claim_key=v_claim_key
      and link.relation_type='review_item' and link.authority_schema='public'
      and link.authority_object_type='registry_review_items'
      and link.authority_id=v_review.id
      and v_review.review_key ~ '^mizizi:[0-9a-f]{64}$'
  ) then
    raise exception using errcode='23514',
      message='Changed finding cannot detach its original human review receipt';
  end if;

  insert into mizizi_private.cases (
    workspace_id,case_key,subject_type,subject_id,claim_family_key,claim_key,
    last_observation_fingerprint,policy_ruleset_version,transition_actor_key,transition_reason
  ) values (
    v_workspace_id,v_case_key,v_entity_type,v_entity_id,v_family,v_claim_key,
    v_fp,p_ruleset_version,'system:mizizi',
    'Accepted MIZIZI review observation awaiting governed case triage.'
  ) on conflict (workspace_id,case_key) do nothing
  returning id, revision into v_case_id,v_case_revision;

  if v_case_id is null then
    select c.id,c.revision,c.case_state,c.last_observation_fingerprint,
      c.subject_type,c.subject_id,c.claim_family_key,c.claim_key
    into strict v_case_id,v_case_revision,v_state,v_prior_fp,
      v_case_subject_type,v_case_subject_id,v_case_family,v_case_claim
    from mizizi_private.cases c
    where c.workspace_id = v_workspace_id and c.case_key = v_case_key
    for update;
    if v_case_subject_type is distinct from v_entity_type
       or v_case_subject_id is distinct from v_entity_id
       or v_case_family is distinct from v_family
       or v_case_claim is distinct from v_claim_key then
      raise exception using errcode='23514', message='Existing case identity binding drift';
    end if;
    if v_state in ('resolved','closed','done_for_now') then
      raise exception using errcode='23514', message='Completed case requires separately authorized reopening';
    end if;
    if v_prior_fp is distinct from v_fp then
      v_previous_revision := v_case_revision;
      update mizizi_private.cases c
        set revision=c.revision+1,
            last_observation_fingerprint=v_fp,
            policy_ruleset_version=p_ruleset_version,
            transition_actor_key='system:mizizi',
            transition_reason='Updated observation from accepted MIZIZI Registry review broker.',
            updated_at=clock_timestamp()
      where c.id=v_case_id and c.revision=v_case_revision
      returning c.revision into strict v_case_revision;
      v_status := 'observation_recorded';
    else
      v_status := 'unchanged';
    end if;
  end if;

  v_receipt_fp := encode(
    extensions.digest(
      '[' || to_json(v_review.id::text)::text || ',' || to_json(v_review.review_key)::text ||
      ',' || to_json(v_review.review_type)::text || ',' || to_json(v_review.entity_type)::text ||
      ',' || to_json(v_entity_id_text)::text || ',' || to_json(v_rule_id)::text ||
      ',' || to_json(v_rule_version)::text || ']',
      'sha256'
    ),'hex'
  );
  insert into mizizi_private.case_receipt_links (
    workspace_id,case_id,relation_type,authority_schema,authority_object_type,
    authority_id,authority_fingerprint,linked_by_actor_key,link_reason
  ) values (
    v_workspace_id,v_case_id,'review_item','public','registry_review_items',
    v_review_id,v_receipt_fp,'system:mizizi',
    'Existing Registry human review linked to governed MIZIZI case.'
  ) on conflict (case_id,relation_type,authority_schema,authority_object_type,authority_id)
    do nothing returning id into v_receipt_id;

  if v_receipt_id is null then
    select r.id,r.authority_fingerprint into strict v_receipt_id,v_existing_receipt_fp
    from mizizi_private.case_receipt_links r
    where r.case_id = v_case_id and r.relation_type='review_item'
      and r.authority_schema='public' and r.authority_object_type='registry_review_items'
      and r.authority_id=v_review_id;
    if v_existing_receipt_fp is distinct from v_receipt_fp then
      raise exception using errcode='23514',message='Existing immutable review receipt fingerprint drift';
    end if;
  end if;

  -- Append only a digest, never edit the original human review or its link.
  if v_status in ('created','observation_recorded') then
    insert into mizizi_private.case_observations (
      workspace_id,case_id,review_item_id,case_revision,previous_case_revision,
      observation_fingerprint,previous_observation_fingerprint,original_review_key,
      source_finding_sha256,policy_ruleset_version
    ) values (
      v_workspace_id,v_case_id,v_review_id,v_case_revision,v_previous_revision,
      v_fp,v_prior_fp,v_review.review_key,
      encode(extensions.digest(convert_to(p_finding::text,'UTF8'),'sha256'),'hex'),
      p_ruleset_version
    );
  end if;

  return query select v_review_id,v_case_id,v_case_revision,v_receipt_id,v_status;
end;
$gateway$;

revoke all on function mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)
 to mizizi_executor;

-- A focused review session exit is NOT a durable case transition.
-- This command time-boxes a source-bound in-progress research case only.
create function public.admin_mizizi_done_for_now_case_v1(
 p_case_id uuid,p_expected_revision integer,p_reason text,p_next_action_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $wk_done_for_now$
declare v_actor uuid; v_case mizizi_private.cases%rowtype; v_revision integer;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_case_id is null or p_expected_revision is null or p_expected_revision<1
  or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
  or p_next_action_at is null
  or p_next_action_at<=clock_timestamp()+interval '5 minutes'
  or p_next_action_at>clock_timestamp()+interval '30 days'
 then raise exception 'Invalid bounded case follow-up' using errcode='22023'; end if;
 select c.* into v_case from mizizi_private.cases c
  join mizizi_private.workspaces w on w.id=c.workspace_id
  where c.id=p_case_id and w.workspace_key='wakilisha-internal' and w.status='active'
  for update of c;
 if not found then raise exception 'Case not found in authorized workspace' using errcode='42501'; end if;
 if v_case.revision<>p_expected_revision
 then raise exception 'Stale case revision' using errcode='PT409'; end if;
 if v_case.case_state<>'in_progress' or v_case.current_stage<>'research'
 then raise exception 'Case is not eligible for bounded follow-up' using errcode='55000'; end if;
 if not exists (
  select 1 from mizizi_private.case_receipt_links l
  join public.registry_review_items r on r.id=l.authority_id
  where l.workspace_id=v_case.workspace_id and l.case_id=v_case.id
   and l.relation_type='review_item' and l.authority_schema='public'
   and l.authority_object_type='registry_review_items'
   and r.status='open' and r.review_type='mizizi_data_hygiene'
   and r.entity_type=v_case.subject_type and r.entity_id=v_case.subject_id
 ) then raise exception 'Current source-bound Registry review receipt required'
   using errcode='23514'; end if;
 update mizizi_private.cases c set revision=c.revision+1,
  case_state='done_for_now',next_action_at=p_next_action_at,
  transition_actor_key='user:'||v_actor::text,
  transition_reason=btrim(p_reason)
 where c.id=v_case.id and c.workspace_id=v_case.workspace_id
  and c.revision=p_expected_revision
 returning c.revision into strict v_revision;
 return jsonb_build_object('caseId',v_case.id,'workspaceId',v_case.workspace_id,
  'revision',v_revision,'state','done_for_now',
  'stage',v_case.current_stage,'nextActionAt',p_next_action_at);
end;
$wk_done_for_now$;
revoke all on function public.admin_mizizi_done_for_now_case_v1(uuid,integer,text,timestamptz)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_done_for_now_case_v1(uuid,integer,text,timestamptz)
 to authenticated;

do $wk_229_postflight$
declare v_gateway regprocedure:='mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)'::regprocedure;
 v_operator regprocedure:='public.admin_mizizi_done_for_now_case_v1(uuid,integer,text,timestamp with time zone)'::regprocedure;
begin
 if not exists(select 1 from pg_proc p where p.oid=v_gateway
  and p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=pg_catalog']::text[])
  or not exists(select 1 from pg_proc p where p.oid=v_operator
  and p.prosecdef and p.proowner='postgres'::regrole
  and p.proconfig @> array['search_path=pg_catalog']::text[]
  and pg_get_functiondef(p.oid) like '%PT409%')
  or has_function_privilege('anon',v_gateway,'EXECUTE')
  or has_function_privilege('authenticated',v_gateway,'EXECUTE')
  or has_function_privilege('service_role',v_gateway,'EXECUTE')
  or not has_function_privilege('mizizi_executor',v_gateway,'EXECUTE')
  or has_function_privilege('anon',v_operator,'EXECUTE')
  or has_function_privilege('service_role',v_operator,'EXECUTE')
  or has_function_privilege('mizizi_executor',v_operator,'EXECUTE')
  or not has_function_privilege('authenticated',v_operator,'EXECUTE')
  or has_table_privilege('authenticated','mizizi_private.case_observations','SELECT')
  or has_table_privilege('service_role','mizizi_private.case_observations','SELECT')
  or has_table_privilege('mizizi_executor','mizizi_private.case_observations','INSERT')
 then raise exception 'STOP_229_OBSERVATION_OR_OPERATOR_ACL_DRIFT'; end if;
 raise notice 'WK_229_APPEND_ONLY_OBSERVATION_AND_BOUNDED_DONE_FOR_NOW_SEALED=PASS';
end $wk_229_postflight$;
commit;
