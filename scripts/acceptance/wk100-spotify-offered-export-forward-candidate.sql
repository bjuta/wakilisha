-- WK100 Spotify offered-chart method forward migration SQL candidate ONLY.
-- Mint exact timestamped active migration filename via Supabase CLI in accepted
-- runtime; never apply this file directly or edit already-applied migration.
-- Method review is not provider source access, collector activation or scoring.
begin;
do $wks_pre$ begin if to_regprocedure('public.wk100_review_source_method_v1(jsonb,integer)') is null or to_regprocedure('public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)') is null then raise exception 'WK100 Spotify baseline unavailable'; end if; end; $wks_pre$;

create or replace function public.wk100_review_source_method_v1(p_payload jsonb,p_expected_decision_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $review$
declare
  v_actor uuid:=auth.uid();
  v_p platform_private.wk100_source_proposals_v1%rowtype;
  v_decision platform_private.wk100_source_method_decisions_v1%rowtype;
  v_latest integer;
  v_state text;
  v_key text;
  v_parser text;
  v_expected_parser text;
  v_keys text[]:=array['sourceKey','providerKey','proposalRevision','decisionState',
    'parserClass','methodClass','nativePeriodAuthority','nativePeriodEvidenceRef',
    'endpointSha256','accessEvidenceSha256','authorizationRef','authorizationExpiresAt',
    'constitutionVersion','reason'];
begin
  if v_actor is null or not public.current_user_has_capability('manage_ingest')
    or not public.current_user_has_capability('manage_charts') then
    raise exception 'wk100_method_review_not_authorized';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>3500
     or p_expected_decision_revision is null or p_expected_decision_revision not between 0 and 99999
     or not (p_payload ?& v_keys) or
     (select count(*) from jsonb_object_keys(p_payload))<>array_length(v_keys,1)
  then raise exception 'wk100_method_review_invalid'; end if;
  if jsonb_typeof(p_payload->'sourceKey')<>'string'
     or jsonb_typeof(p_payload->'providerKey')<>'string'
     or jsonb_typeof(p_payload->'proposalRevision')<>'number'
     or jsonb_typeof(p_payload->'decisionState')<>'string'
     or jsonb_typeof(p_payload->'constitutionVersion')<>'string'
     or jsonb_typeof(p_payload->'reason')<>'string'
  then raise exception 'wk100_method_review_invalid'; end if;
  v_key:=p_payload->>'sourceKey';
  v_state:=p_payload->>'decisionState';
  if v_key !~ '^[a-z][a-z0-9_]{2,63}$' or v_state not in
    ('held','collector_admitted','paused','retired')
    or length(p_payload->>'reason') not between 6 and 500
  then raise exception 'wk100_method_review_invalid'; end if;
  -- Proposal writes use 11400 for the SAME source key. Share that lock,
  -- otherwise a concurrent proposal revision can invalidate this admission.
  perform pg_catalog.pg_advisory_xact_lock(11400,pg_catalog.hashtext(v_key));
  select * into v_p from platform_private.wk100_source_proposals_v1
    where source_key=v_key order by revision desc limit 1;
  if not found or v_p.provider_key<>p_payload->>'providerKey' or
    v_p.revision::text<>p_payload->>'proposalRevision'
  then raise exception 'wk100_method_review_proposal_stale'; end if;
  select coalesce(max(decision_revision),0) into v_latest
    from platform_private.wk100_source_method_decisions_v1 where source_key=v_key;
  if v_latest<>p_expected_decision_revision then
    raise exception 'wk100_method_review_conflict'; end if;
  -- Retirement is final even if another subsequent hold/pause was recorded.
  -- Re-admission requires a separately designed and approved reactivation contract.
  if exists (
    select 1 from platform_private.wk100_source_method_decisions_v1
      where source_key=v_key and decision_state='retired'
  ) then raise exception 'wk100_method_source_retired'; end if;
  v_expected_parser:=case v_p.provider_key
    when 'youtube_ke' then 'youtube_kenya_weekly_top_songs_v1'
    when 'apple_ke' then 'apple_kenya_chart_v1'
    when 'boomplay_ke' then 'boomplay_kenya_chart_v1'
    when 'mdundo_ke' then 'mdundo_kenya_chart_v1'
    when 'shazam_ke' then 'shazam_kenya_discovery_v1'
    when 'spotify_ke' then 'spotify_kenya_offered_chart_csv_v1'
    when 'audiomack_ke' then 'audiomack_kenya_chart_v1'
    else null end;
  v_parser:=p_payload->>'parserClass';
  -- Terminal retirement and method admission both require super-admin review.
  -- Editors can hold or pause unsafe sources, but cannot retire them forever.
  if v_state in ('collector_admitted','retired') and not exists(
    select 1 from public.user_role_assignments ura
      where ura.user_id=v_actor and ura.role_key='super_admin' and
        ura.status='active' and (ura.expires_at is null or ura.expires_at>now())
  ) then
    raise exception 'wk100_method_restricted_decision_requires_super_admin';
  end if;
  if v_state='collector_admitted' then
    if v_expected_parser is null or v_parser<>v_expected_parser
      or v_p.method_class='research_only'
      -- YouTube Weekly Top Songs is *not* playlist entries or ordinal-only.
      -- Rank and native view counts, weekly period, and video consumption
      -- are mandatory before the provider's Top Songs adapter can be reviewed.
      or (v_p.provider_key='youtube_ke' and
        (v_p.behavior<>'video_consumption' or
         v_p.native_metric<>'rank_and_count' or v_p.cadence_kind<>'weekly'))
      or (v_p.provider_key='spotify_ke' and (v_p.behavior<>'consumption' or v_p.native_metric<>'rank_and_count' or v_p.cadence_kind<>'weekly' or v_p.method_class<>'offered_export'))
      or p_payload->>'methodClass'<>v_p.method_class
      or p_payload->>'nativePeriodAuthority'<>'provider_defined'
      or coalesce(length(p_payload->>'nativePeriodEvidenceRef'),0)<3
      or coalesce(p_payload->>'endpointSha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(p_payload->>'accessEvidenceSha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(p_payload->>'authorizationRef','') !~ '^[a-z][a-z0-9_./-]{2,119}$'
      or p_payload->>'authorizationExpiresAt' is null or
        (p_payload->>'authorizationExpiresAt')::timestamptz <= now()
      or (p_payload->>'authorizationExpiresAt')::timestamptz > now()+interval '400 days'
    then raise exception 'wk100_method_admission_unqualified'; end if;
  end if;
  insert into platform_private.wk100_source_method_decisions_v1(
    source_key,provider_key,proposal_revision,decision_revision,decision_state,
    parser_class,method_class,native_period_authority,native_period_evidence_ref,
    endpoint_sha256,access_evidence_sha256,authorization_ref,authorization_expires_at,
    constitution_version,reason,actor_user_id
  ) values (
    v_key,v_p.provider_key,v_p.revision,v_latest+1,v_state,
    nullif(v_parser,''),nullif(p_payload->>'methodClass',''),
    nullif(p_payload->>'nativePeriodAuthority',''),
    nullif(p_payload->>'nativePeriodEvidenceRef',''),
    nullif(p_payload->>'endpointSha256',''),
    nullif(p_payload->>'accessEvidenceSha256',''),
    nullif(p_payload->>'authorizationRef',''),
    nullif(p_payload->>'authorizationExpiresAt','')::timestamptz,
    p_payload->>'constitutionVersion',p_payload->>'reason',v_actor
  ) returning * into v_decision;
  return jsonb_build_object('sourceKey',v_decision.source_key,
    'providerKey',v_decision.provider_key,'proposalRevision',v_decision.proposal_revision,
    'decisionRevision',v_decision.decision_revision,'decisionState',v_decision.decision_state,
    'createdAt',v_decision.created_at,'canScore',false,'canPublish',false);
end; $review$;

create or replace function public.wk100_enroll_source_capture_contract_v1(
  p_source_key text,p_contract_version text,p_adapter_sha256 text,
  p_expected_proposal_revision integer,p_expected_decision_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $enroll$
declare
  v_actor uuid:=auth.uid();
  v_proposal platform_private.wk100_source_proposals_v1%rowtype;
  v_decision platform_private.wk100_source_method_decisions_v1%rowtype;
  v_contract_id uuid;
  v_expected_parser text;
begin
  if v_actor is null
    or not public.current_user_has_capability('manage_ingest')
    or not public.current_user_has_capability('manage_charts')
    or not exists(
      select 1 from public.user_role_assignments ura
      where ura.user_id=v_actor and ura.role_key='super_admin'
        and ura.status='active'
        and (ura.expires_at is null or ura.expires_at>now())
    ) then raise exception 'wk100_contract_enrollment_not_authorized'; end if;

  if p_source_key is null or
    p_source_key !~ '^[a-z][a-z0-9_]{2,63}$'
    or p_contract_version is null
    or p_contract_version !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$'
    or p_adapter_sha256 is null or p_adapter_sha256 !~ '^[a-f0-9]{64}$'
    or p_expected_proposal_revision is null
    or p_expected_proposal_revision not between 1 and 100000
    or p_expected_decision_revision is null
    or p_expected_decision_revision not between 1 and 100000
  then raise exception 'wk100_contract_enrollment_invalid'; end if;

  -- Exactly the same transaction lock as proposal and method review. A
  -- competing revision cannot slip between proof and insertion.
  perform pg_catalog.pg_advisory_xact_lock(11400,pg_catalog.hashtext(p_source_key));

  select * into v_proposal
  from platform_private.wk100_source_proposals_v1
  where source_key=p_source_key order by revision desc limit 1;
  if not found or v_proposal.revision<>p_expected_proposal_revision
    or v_proposal.method_class='research_only'
  then raise exception 'wk100_contract_proposal_stale_or_unqualified'; end if;

  select * into v_decision
  from platform_private.wk100_source_method_decisions_v1
  where source_key=p_source_key order by decision_revision desc limit 1;
  if not found or v_decision.decision_revision<>p_expected_decision_revision
    or v_decision.proposal_revision<>v_proposal.revision
    or v_decision.provider_key<>v_proposal.provider_key
    or v_decision.method_class<>v_proposal.method_class
    or v_decision.decision_state<>'collector_admitted'
    or v_decision.native_period_authority<>'provider_defined'
    or v_decision.authorization_expires_at<=now()
    or v_decision.endpoint_sha256 is null
    or v_decision.access_evidence_sha256 is null
    or v_decision.authorization_ref is null
  then raise exception 'wk100_contract_method_not_current'; end if;

  v_expected_parser:=case v_proposal.provider_key
    when 'youtube_ke' then 'youtube_kenya_weekly_top_songs_v1'
    when 'apple_ke' then 'apple_kenya_chart_v1'
    when 'boomplay_ke' then 'boomplay_kenya_chart_v1'
    when 'mdundo_ke' then 'mdundo_kenya_chart_v1'
    when 'shazam_ke' then 'shazam_kenya_discovery_v1'
    when 'spotify_ke' then 'spotify_kenya_offered_chart_csv_v1'
    when 'audiomack_ke' then 'audiomack_kenya_chart_v1'
    else null end;
  if v_expected_parser is null or v_decision.parser_class<>v_expected_parser
    or (v_proposal.provider_key='youtube_ke' and
       (v_proposal.behavior<>'video_consumption'
        or v_proposal.native_metric<>'rank_and_count'
        or v_proposal.cadence_kind<>'weekly'))
     or (v_proposal.provider_key='spotify_ke' and (v_proposal.behavior<>'consumption' or v_proposal.native_metric<>'rank_and_count' or v_proposal.cadence_kind<>'weekly' or v_proposal.method_class<>'offered_export'))
  then raise exception 'wk100_contract_parser_unqualified'; end if;

  -- Phase 1 allows one immutable capture contract per source. Later
  -- replacements require an explicit version/retirement migration, never
  -- a silent parallel contract or a newest-wins scheduler selection.
  if exists(select 1 from public.wk_chart_capture_contracts_v1
    where source_key=p_source_key)
  then raise exception 'wk100_contract_already_enrolled'; end if;

  insert into public.wk_chart_capture_contracts_v1(
    source_key,contract_version,provider_key,source_surface,market,behavior,
    native_metric,expected_depth,cadence_kind,interval_hours,eat_hour,
    eat_minute,weekday_eat,minimum_healthy_checkpoints,adapter_version,
    adapter_sha256,admission_state
  ) values(
    v_proposal.source_key,p_contract_version,v_proposal.provider_key,
    v_proposal.surface,'KE',v_proposal.behavior,v_proposal.native_metric,
    v_proposal.expected_depth,v_proposal.cadence_kind,v_proposal.interval_hours,
    v_proposal.eat_hour,v_proposal.eat_minute,v_proposal.weekday_eat,
    v_proposal.minimum_healthy_checkpoints,v_decision.parser_class,
    p_adapter_sha256,'candidate'
  ) returning id into v_contract_id;
  insert into platform_private.wk100_capture_contract_enrollments_v1(
    contract_id,source_key,contract_version,proposal_revision,
    decision_revision,adapter_sha256,actor_user_id
  ) values(v_contract_id,p_source_key,p_contract_version,
    v_proposal.revision,v_decision.decision_revision,p_adapter_sha256,v_actor);

  return jsonb_build_object('contractId',v_contract_id,
    'sourceKey',p_source_key,'contractVersion',p_contract_version,
    'proposalRevision',v_proposal.revision,
    'decisionRevision',v_decision.decision_revision,
    'state','candidate','canCollect',false,'canScore',false,'canPublish',false);
end; $enroll$;

do $wks_post$ begin if not has_function_privilege('authenticated','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE') or has_function_privilege('anon','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE') or not has_function_privilege('authenticated','public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)','EXECUTE') or has_function_privilege('anon','public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)','EXECUTE') then raise exception 'WK100 Spotify forward ACL mismatch'; end if; end; $wks_post$;
commit;
