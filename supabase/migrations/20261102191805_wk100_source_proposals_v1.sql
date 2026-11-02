-- WK100 Phase 1 source proposals. Mint this filename ONLY with accepted Supabase CLI.
-- Separate from immutable capture contracts and provider admission.
-- No seeds, cron, collector activation, scoring, publisher mutation or migration-history repair.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
begin
  if to_regnamespace('platform_private') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regclass('public.wk_chart_capture_contracts_v1') is null
     or to_regclass('platform_private.wk100_source_proposals_v1') is not null
     or to_regprocedure('public.wk100_submit_source_proposal_v1(jsonb,integer)') is not null
  then raise exception 'STOP: WK100 proposal authority preflight drift'; end if;
end;
$preflight$;

create table platform_private.wk100_source_proposals_v1 (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null check (provider_key in
    ('youtube_ke','spotify_ke','boomplay_ke','apple_ke','mdundo_ke','shazam_ke','audiomack_ke')),
  source_key text not null check (source_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint wk100_source_provider_identity check (
    source_key ~ ('^' || provider_key || '_[a-z][a-z0-9_]{1,45}$')),
  revision integer not null check (revision between 1 and 100000),
  surface text not null check (length(surface) between 3 and 180
    and surface=btrim(surface) and surface !~ '[[:cntrl:]<>]'),
  method_class text not null check (method_class in
    ('provider_api','offered_export','reviewed_page_adapter','research_only')),
  behavior text not null check (behavior in
    ('consumption','video_consumption','discovery','ugc_curation','broadcast_exposure')),
  native_metric text not null check (native_metric in ('rank','rank_and_count','event_count')),
  expected_depth smallint not null check (expected_depth between 1 and 500),
  cadence_kind text not null check (cadence_kind in ('daily','interval_hours','weekly')),
  interval_hours smallint,
  eat_hour smallint not null check (eat_hour between 0 and 23),
  eat_minute smallint not null check (eat_minute between 0 and 59),
  weekday_eat smallint,
  minimum_healthy_checkpoints smallint not null check (minimum_healthy_checkpoints between 1 and 56),
  evidence_reference text not null check (length(evidence_reference) between 1 and 240
    and evidence_reference=btrim(evidence_reference)
    and evidence_reference !~ '[[:cntrl:]<>?&=#@]'
    and strpos(evidence_reference,'//')=0),
  reason text check (reason is null or (length(reason)<=500
    and reason=btrim(reason) and reason !~ '[[:cntrl:]<>]')),
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  state text not null default 'proposed' check (state='proposed'),
  constraint wk100_source_proposal_revision_unique unique (source_key,revision),
  constraint wk100_source_proposal_measurement check (
    behavior <> 'video_consumption' or native_metric <> 'event_count'),
  constraint wk100_source_proposal_cadence check (
    (cadence_kind='weekly' and interval_hours is null and weekday_eat between 0 and 6
      and minimum_healthy_checkpoints=1)
    or (cadence_kind='daily' and interval_hours is null and weekday_eat is null
      and minimum_healthy_checkpoints<=7)
    or (cadence_kind='interval_hours' and interval_hours in (3,4,6,8,12,24)
      and weekday_eat is null and minimum_healthy_checkpoints<=168/interval_hours)
  )
);
comment on table platform_private.wk100_source_proposals_v1 is
  'Private append-only Admin source configuration proposals. No approved source, capture, score or publish authority.';
alter table platform_private.wk100_source_proposals_v1 enable row level security;
revoke all on platform_private.wk100_source_proposals_v1
  from public, anon, authenticated, service_role;

create function platform_private.wk100_source_proposal_immutable_v1()
returns trigger language plpgsql set search_path = pg_catalog as $immutable$
begin
  raise exception 'wk100_source_proposals_immutable';
end;
$immutable$;
create trigger wk100_source_proposals_update_delete_guard
  before update or delete on platform_private.wk100_source_proposals_v1
  for each row execute function platform_private.wk100_source_proposal_immutable_v1();
create trigger wk100_source_proposals_truncate_guard
  before truncate on platform_private.wk100_source_proposals_v1
  for each statement execute function platform_private.wk100_source_proposal_immutable_v1();
revoke all on function platform_private.wk100_source_proposal_immutable_v1()
  from public,anon,authenticated,service_role;

-- Invoker JWT is authoritative. Requests cannot choose actor, revision, state or admission.
-- A per-source advisory transaction lock serializes concurrent proposal revisions.
create function public.wk100_submit_source_proposal_v1(p_payload jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $submit$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_current integer;
  v_row platform_private.wk100_source_proposals_v1%rowtype;
  v_allowed text[] := array['providerKey','sourceKey','surface','methodClass','behavior','metric',
    'expectedDepth','cadence','intervalHours','eatHour','eatMinute','weekdayEat',
    'minimumHealthyCheckpoints','evidenceReference','reason'];
begin
  if v_actor is null or not public.current_user_has_capability('manage_ingest') then
    raise exception 'wk100_proposal_not_authorized';
  end if;
  if p_expected_revision is null or p_expected_revision not between 0 and 99999
     or p_payload is null or jsonb_typeof(p_payload)<>'object'
     or length(p_payload::text)>3000
     or not (p_payload ?& v_allowed)
     or (select count(*) from jsonb_object_keys(p_payload))<>array_length(v_allowed,1)
  then raise exception 'wk100_proposal_invalid'; end if;
  if jsonb_typeof(p_payload->'providerKey')<>'string'
    or jsonb_typeof(p_payload->'sourceKey')<>'string'
    or jsonb_typeof(p_payload->'surface')<>'string'
    or jsonb_typeof(p_payload->'methodClass')<>'string'
    or jsonb_typeof(p_payload->'behavior')<>'string'
    or jsonb_typeof(p_payload->'metric')<>'string'
    or jsonb_typeof(p_payload->'cadence')<>'string'
    or jsonb_typeof(p_payload->'evidenceReference')<>'string'
    or jsonb_typeof(p_payload->'expectedDepth')<>'number'
    or jsonb_typeof(p_payload->'eatHour')<>'number'
    or jsonb_typeof(p_payload->'eatMinute')<>'number'
    or jsonb_typeof(p_payload->'minimumHealthyCheckpoints')<>'number'
    or jsonb_typeof(p_payload->'intervalHours') not in ('null','number')
    or jsonb_typeof(p_payload->'weekdayEat') not in ('null','number')
    or jsonb_typeof(p_payload->'reason') not in ('null','string')
  then raise exception 'wk100_proposal_invalid'; end if;
  v_key:=p_payload->>'sourceKey';
  if p_payload->>'providerKey' not in
    ('youtube_ke','spotify_ke','boomplay_ke','apple_ke','mdundo_ke','shazam_ke','audiomack_ke')
    or v_key !~ ('^' || (p_payload->>'providerKey') || '_[a-z][a-z0-9_]{1,45}$')
    or length(v_key)>64
  then raise exception 'wk100_proposal_invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(11400,pg_catalog.hashtext(v_key));
  select coalesce(max(revision),0) into v_current
    from platform_private.wk100_source_proposals_v1 where source_key=v_key;
  if v_current<>p_expected_revision then
    raise exception 'wk100_source_proposal_conflict';
  end if;
  insert into platform_private.wk100_source_proposals_v1 (
    provider_key,source_key,revision,surface,method_class,behavior,native_metric,expected_depth,
    cadence_kind,interval_hours,eat_hour,eat_minute,weekday_eat,
    minimum_healthy_checkpoints,evidence_reference,reason,actor_user_id
  ) values (
    p_payload->>'providerKey',v_key,v_current+1,p_payload->>'surface',p_payload->>'methodClass',
    p_payload->>'behavior',p_payload->>'metric',
    (p_payload->>'expectedDepth')::integer,p_payload->>'cadence',
    (p_payload->>'intervalHours')::smallint,(p_payload->>'eatHour')::smallint,
    (p_payload->>'eatMinute')::smallint,(p_payload->>'weekdayEat')::smallint,
    (p_payload->>'minimumHealthyCheckpoints')::smallint,
    p_payload->>'evidenceReference',p_payload->>'reason',v_actor
  ) returning * into v_row;
  return jsonb_build_object('id',v_row.id,'providerKey',v_row.provider_key,'sourceKey',v_row.source_key,
    'revision',v_row.revision,'state','proposed','createdAt',v_row.created_at,
    'canCollect',false,'canScore',false,'canPublish',false);
end;
$submit$;

create function public.wk100_list_source_proposals_v1()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $list$
declare v_out jsonb;
begin
  if auth.uid() is null or not public.current_user_has_capability('manage_ingest') then
    raise exception 'wk100_proposal_not_authorized';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'providerKey',p.provider_key,'sourceKey',p.source_key,'revision',p.revision,
    'surface',p.surface,'methodClass',p.method_class,'behavior',p.behavior,
    'metric',p.native_metric,'expectedDepth',p.expected_depth,'cadence',p.cadence_kind,
    'intervalHours',p.interval_hours,'eatHour',p.eat_hour,'eatMinute',p.eat_minute,
    'weekdayEat',p.weekday_eat,'minimumHealthyCheckpoints',p.minimum_healthy_checkpoints,
    'evidenceReference',p.evidence_reference,'reason',p.reason,
    'createdAt',p.created_at,'state','proposed',
    'canCollect',false,'canScore',false,'canPublish',false)
    order by p.source_key),'[]'::jsonb) into v_out
  from (select distinct on(source_key) *
    from platform_private.wk100_source_proposals_v1
    order by source_key,revision desc) p;
  return v_out;
end;
$list$;

revoke all on function public.wk100_submit_source_proposal_v1(jsonb,integer),
  public.wk100_list_source_proposals_v1()
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_submit_source_proposal_v1(jsonb,integer),
  public.wk100_list_source_proposals_v1() to authenticated;

-- Postflight proves empty and unexposed. No source admission or scheduled capture.
do $postflight$
begin
  if exists(select 1 from platform_private.wk100_source_proposals_v1)
     or has_table_privilege('anon','platform_private.wk100_source_proposals_v1','SELECT')
     or has_table_privilege('authenticated','platform_private.wk100_source_proposals_v1','INSERT')
     or has_table_privilege('service_role','platform_private.wk100_source_proposals_v1','INSERT')
     or has_function_privilege('anon','public.wk100_submit_source_proposal_v1(jsonb,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.wk100_submit_source_proposal_v1(jsonb,integer)','EXECUTE')
  then raise exception 'WK100 source proposal postflight drift'; end if;
  raise notice 'WK100_PROPOSALS_EMPTY_PRIVATE_UNADMITTED_NO_CRON=PASS';
end;
$postflight$;
commit;
