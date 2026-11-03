-- WK100 PHASE 1 CANDIDATE SOURCE METHOD DECISION AUTHORITY.
-- NOT an active migration. CLI-mint on accepted Mac after isolated validation.
-- This file is a candidate, not permission to call providers, schedule, rank,
-- publish, create a capture contract, or change any production state.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $preflight$
begin
  if to_regclass('platform_private.wk100_source_proposals_v1') is null
     or to_regclass('public.wk_chart_capture_contracts_v1') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regclass('platform_private.wk100_source_method_decisions_v1') is not null
     or to_regprocedure('public.wk100_review_source_method_v1(jsonb,integer)') is not null
  then raise exception 'STOP: WK100 method decision baseline drift'; end if;
end; $preflight$;

create table platform_private.wk100_source_method_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  provider_key text not null,
  proposal_revision integer not null check(proposal_revision between 1 and 100000),
  decision_revision integer not null check(decision_revision between 1 and 100000),
  decision_state text not null check(decision_state in ('held','collector_admitted','paused','retired')),
  parser_class text,
  method_class text,
  native_period_authority text check(native_period_authority is null or native_period_authority in ('unknown','provider_defined')),
  native_period_evidence_ref text,
  endpoint_sha256 text check(endpoint_sha256 is null or endpoint_sha256 ~ '^[a-f0-9]{64}$'),
  access_evidence_sha256 text check(access_evidence_sha256 is null or access_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  authorization_ref text,
  authorization_expires_at timestamptz,
  constitution_version text not null check(length(constitution_version) between 2 and 100 and constitution_version ~ '^[a-zA-Z0-9._-]+$'),
  reason text not null check(length(reason) between 6 and 500 and reason=btrim(reason) and reason !~ '[[:cntrl:]<>]'),
  actor_user_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  can_score boolean not null default false check(can_score=false),
  can_publish boolean not null default false check(can_publish=false),
  constraint wk100_source_method_revision_unique unique(source_key,decision_revision),
  constraint wk100_source_method_admission_evidence check (
    decision_state<>'collector_admitted' or (
      parser_class is not null and
      native_period_authority='provider_defined' and
      native_period_evidence_ref is not null and length(native_period_evidence_ref) between 3 and 240 and
      native_period_evidence_ref !~ '[[:cntrl:]<>?&=#@]' and
      endpoint_sha256 is not null and access_evidence_sha256 is not null and
      authorization_ref is not null and
      authorization_ref ~ '^[a-z][a-z0-9_./-]{2,119}$' and
      authorization_expires_at is not null
    ))
);
comment on table platform_private.wk100_source_method_decisions_v1 is
  'Immutable independently reviewed source-method decisions. A decision is not a collector manifest, credential, runtime activation, native-period proof or publishing grant.';
alter table platform_private.wk100_source_method_decisions_v1 enable row level security;
revoke all on platform_private.wk100_source_method_decisions_v1 from public,anon,authenticated,service_role;
create function platform_private.wk100_method_decision_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog as $immutable$
begin raise exception 'wk100_source_method_decision_immutable'; end; $immutable$;
create trigger wk100_method_decision_update_delete_guard before update or delete
  on platform_private.wk100_source_method_decisions_v1 for each row
  execute function platform_private.wk100_method_decision_immutable_v1();
create trigger wk100_method_decision_truncate_guard before truncate
  on platform_private.wk100_source_method_decisions_v1 for each statement
  execute function platform_private.wk100_method_decision_immutable_v1();
revoke all on function platform_private.wk100_method_decision_immutable_v1()
from public,anon,authenticated,service_role;

create function public.wk100_review_source_method_v1(p_payload jsonb,p_expected_decision_revision integer)
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

create function public.wk100_list_source_method_decisions_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $list$
declare v_out jsonb;
begin
  if auth.uid() is null or not public.current_user_has_capability('manage_ingest')
    then raise exception 'wk100_method_read_not_authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('sourceKey',d.source_key,
    'providerKey',d.provider_key,'proposalRevision',d.proposal_revision,
    'decisionRevision',d.decision_revision,'decisionState',d.decision_state,
    'constitutionVersion',d.constitution_version,'createdAt',d.created_at,
    'hasMethodEvidence',d.access_evidence_sha256 is not null,
    'nativePeriodAuthority',d.native_period_authority,
    'canScore',false,'canPublish',false) order by d.source_key),'[]'::jsonb) into v_out
  from (select distinct on(source_key) * from platform_private.wk100_source_method_decisions_v1
    order by source_key,decision_revision desc) d;
  return v_out;
end; $list$;
revoke all on function public.wk100_review_source_method_v1(jsonb,integer),
  public.wk100_list_source_method_decisions_v1() from public,anon,authenticated,service_role;
grant execute on function public.wk100_review_source_method_v1(jsonb,integer),
  public.wk100_list_source_method_decisions_v1() to authenticated;

do $postflight$
begin
  if exists(select 1 from platform_private.wk100_source_method_decisions_v1)
    or has_table_privilege('authenticated','platform_private.wk100_source_method_decisions_v1','SELECT')
    or has_table_privilege('service_role','platform_private.wk100_source_method_decisions_v1','INSERT')
    or has_function_privilege('anon','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE')
  then raise exception 'WK100 source method postflight failed'; end if;
  raise notice 'WK100_SOURCE_METHOD_EMPTY_IMMUTABLE_NOT_ACTIVATED_PASS';
end; $postflight$;
commit;
