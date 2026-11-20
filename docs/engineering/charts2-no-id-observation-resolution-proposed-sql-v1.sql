-- REVIEW-ONLY SQL DESIGN CANDIDATE, NOT YET A CLI-MINTED MIGRATION.
-- No execution against Production is authorized by this document.
-- This fact family cannot be represented by registry_track_provider_links:
-- the genuine Shazam chart original has no provider recording ID.
-- Corrections are append-only decisions, not rewritten source observations.
begin;
set local lock_timeout='5s';
set local statement_timeout='180s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('charts2-no-id-source-review-v1',0)
);

do $preflight$
begin
  if to_regclass('platform_private.charts2_capture_receipts_v1') is null
    or to_regclass('public.registry_tracks') is null
    or to_regprocedure('public.charts2_studio_private_snapshot_v1()') is null
    or to_regprocedure('platform_private.charts2_compute_private_freeze_v1()') is null
  then raise exception 'STOP: accepted five-source private freeze authority absent';
  end if;
  if to_regclass('platform_private.charts2_observation_review_events_v1') is not null
  then raise exception 'STOP: no-ID review authority already exists';
  end if;
end
$preflight$;

create table platform_private.charts2_observation_review_events_v1 (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  source_key text not null default 'shazam_ke'
    check(source_key='shazam_ke'),
  receipt_id uuid not null references platform_private.charts2_capture_receipts_v1(id),
  original_sha256 text not null
    check(original_sha256 ~ '^[a-f0-9]{64}$'),
  rank integer not null check(rank between 1 and 200),
  original_title text not null check(length(btrim(original_title))>0),
  original_artist text,
  revision integer not null check(revision>=1),
  previous_event_id uuid references platform_private.charts2_observation_review_events_v1(id),
  action text not null check(action in ('approve','revoke')),
  track_id uuid references public.registry_tracks(id),
  reviewer_id uuid not null,
  reviewed_at timestamptz not null default now(),
  review_note text not null check(length(btrim(review_note))>=40),
  evidence_url text not null check(evidence_url like 'https://%'),
  event_fingerprint text not null check(event_fingerprint ~ '^[a-f0-9]{64}$'),
  unique(receipt_id,rank,revision),
  check ((action='approve' and track_id is not null)
      or (action='revoke' and track_id is null))
);
alter table platform_private.charts2_observation_review_events_v1
  enable row level security;
revoke all on table platform_private.charts2_observation_review_events_v1
  from public,anon,authenticated,service_role;
grant select on table platform_private.charts2_observation_review_events_v1
  to service_role;

create function platform_private.reject_charts2_observation_review_rewrite_v1()
returns trigger language plpgsql
security definer set search_path=''
as $immut$
begin
  raise exception using errcode='42501',
    message='Reviewed chart observations are immutable; append a new decision.';
end
$immut$;
revoke all on function platform_private.reject_charts2_observation_review_rewrite_v1()
  from public,anon,authenticated,service_role;
create trigger charts2_observation_review_immutable_v1
  before update or delete on platform_private.charts2_observation_review_events_v1
  for each row execute function platform_private.reject_charts2_observation_review_rewrite_v1();

-- A caller-bound human decision about a *chart position*, NOT a canonical
-- provider Track link. It does not insert or update Registry or Chart V2 rows.
create function public.admin_review_charts2_no_id_observation_v1(
  p_receipt_id uuid,
  p_original_sha256 text,
  p_rank integer,
  p_action text,
  p_track_id uuid,
  p_review_note text,
  p_evidence_url text,
  p_expected_previous_event_id uuid,
  p_acknowledgement text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $review$
declare
  v_user uuid:=auth.uid();
  r platform_private.charts2_capture_receipts_v1%rowtype;
  o jsonb;
  v_prev platform_private.charts2_observation_review_events_v1%rowtype;
  v_event platform_private.charts2_observation_review_events_v1%rowtype;
  v_current_id uuid;
  v_revision integer:=1;
  v_fingerprint text;
begin
  if v_user is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
  then raise exception using errcode='42501',
    message='Charts and Registry review permission is required.';
  end if;
  if p_receipt_id is null
     or p_original_sha256 !~ '^[a-f0-9]{64}$'
     or p_rank is null or p_rank not between 1 and 200
     or p_action not in ('approve','revoke')
     or nullif(btrim(p_review_note),'') is null
     or length(btrim(p_review_note))<40
     or p_evidence_url not like 'https://%'
     or p_acknowledgement is distinct from (
       case p_action
         when 'approve' then
           'I independently verified this exact Shazam position and authorize its private Registry recording resolution.'
         when 'revoke' then
           'I revoke this exact private Shazam recording resolution after independent re-review.'
         else ''
       end
     )
  then raise exception using errcode='22023',
    message='Exact source, independent evidence and explicit review approval required.';
  end if;
  if (p_action='approve' and p_track_id is null)
    or (p_action='revoke' and p_track_id is not null)
  then raise exception using errcode='22023',
    message='Reviewed Track identity or explicit revocation required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('charts2-no-id:'||p_receipt_id::text||':'||p_rank,0)
  );
  select * into r from platform_private.charts2_capture_receipts_v1
    where id=p_receipt_id and source_key='shazam_ke'
      and original_sha256=p_original_sha256
      and observed_status='succeeded' and original_verified_at is not null
      and observed_depth=200;
  if not found or r.id is distinct from (
    select latest.id from platform_private.charts2_capture_receipts_v1 latest
    where latest.source_key='shazam_ke' and latest.observed_status='succeeded'
    order by latest.created_at desc,latest.id desc limit 1
  ) then raise exception using errcode='40001',
    message='Shazam original is no longer the exact current verified receipt.';
  end if;
  select item.value into o from jsonb_array_elements(r.observations) item(value)
    where item.value->>'rank'=p_rank::text;
  if o is null or nullif(o->>'provider_track_id','') is not null
    or nullif(btrim(o->>'title'),'') is null
  then raise exception using errcode='22023',
    message='This is not a verified Shazam source position without a provider ID.';
  end if;
  if p_action='approve' and not exists (
    select 1 from public.registry_tracks track
    where track.id=p_track_id and track.status='active'
  ) then raise exception using errcode='23514',
    message='An existing active Registry recording must be independently verified.';
  end if;

  select * into v_prev from platform_private.charts2_observation_review_events_v1 e
    where e.receipt_id=p_receipt_id and e.rank=p_rank
    order by e.revision desc limit 1;
  v_current_id:=case when found then v_prev.id else null end;
  if v_current_id is distinct from p_expected_previous_event_id then
    if v_current_id is not null and v_prev.previous_event_id
       is not distinct from p_expected_previous_event_id
       and v_prev.action=p_action
       and v_prev.track_id is not distinct from p_track_id
       and v_prev.reviewer_id=v_user
       and v_prev.review_note=btrim(p_review_note)
       and v_prev.evidence_url=btrim(p_evidence_url)
    then
      return jsonb_build_object('event_id',v_prev.id,'action',v_prev.action,
        'revision',v_prev.revision,'idempotent_replay',true,'can_publish',false);
    end if;
    raise exception using errcode='40001',
      message='Shazam review revision changed; reload before another decision.';
  end if;
  if v_current_id is not null then v_revision:=v_prev.revision+1;end if;
  if p_action='revoke' and
     (v_current_id is null or v_prev.action<>'approve') then
    raise exception using errcode='23514',
      message='There is no accepted review to revoke.';
  end if;

  v_fingerprint:=encode(extensions.digest(jsonb_build_object(
    'receipt_id',p_receipt_id,'original_sha256',p_original_sha256,
    'rank',p_rank,'action',p_action,'track_id',p_track_id,
    'revision',v_revision,'previous_id',v_current_id,
    'reviewer_id',v_user,'review_note',btrim(p_review_note),
    'evidence_url',btrim(p_evidence_url)
  )::text,'sha256'),'hex');

  insert into platform_private.charts2_observation_review_events_v1(
    source_key,receipt_id,original_sha256,rank,
    original_title,original_artist,revision,previous_event_id,
    action,track_id,reviewer_id,review_note,evidence_url,event_fingerprint
  ) values (
    'shazam_ke',p_receipt_id,p_original_sha256,p_rank,
    o->>'title',nullif(o->>'artist',''),v_revision,v_current_id,
    p_action,p_track_id,v_user,btrim(p_review_note),
    btrim(p_evidence_url),v_fingerprint
  ) returning * into v_event;
  return jsonb_build_object('event_id',v_event.id,'action',v_event.action,
    'revision',v_event.revision,'idempotent_replay',false,'can_publish',false);
end
$review$;
revoke all on function public.admin_review_charts2_no_id_observation_v1(
  uuid,text,integer,text,uuid,text,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.admin_review_charts2_no_id_observation_v1(
  uuid,text,integer,text,uuid,text,text,uuid,text)
  to authenticated;

-- The existing Studio private snapshot and private-freeze SQL computation
-- are preserved except the exact reviewed-Shazam contributions added below.
-- The same 30/25/20/15/10 weights and 200 denominator remain immutable.

-- BEGIN EXACT DEFINITION REPLACEMENTS

-- Existing read-only Studio projection and database freeze both account
-- for the same complete, append-only reviewed-Shazam event set.
CREATE OR REPLACE FUNCTION public.charts2_studio_private_snapshot_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with latest as (
  select distinct on (r.source_key) r.*
  from platform_private.charts2_capture_receipts_v1 r
  where r.source_key in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')
  order by r.source_key,r.created_at desc,r.id desc
),
observed_ids as (
  select distinct
    case l.source_key when 'youtube_ke' then 'youtube'
      when 'mdundo_ke' then 'mdundo'
      when 'apple_ke' then 'apple_music'
      when 'audiomack_ke' then 'audiomack'
      when 'shazam_ke' then 'shazam' end as provider_key,
    o.v->>'provider_track_id' as provider_track_id
  from latest l
  cross join lateral pg_catalog.jsonb_array_elements(l.observations) o(v)
  where nullif(o.v->>'provider_track_id','') is not null
)
select pg_catalog.jsonb_build_object(
  'contract','charts2-private-studio/v1',
  'read_at',pg_catalog.now(),
  'methodology',(
    select pg_catalog.jsonb_build_object(
      'version',v.methodology_version,
      'scoring_policy_version',v.scoring_policy_version,
      'rule_set',v.rule_set)
    from public.wk_chart_methodologies_v2 v
    where v.methodology_version='consumption_led_cultural_presence_v1'
  ),
  'receipts',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(r)-'captured_by'-'created_at'
      order by r.source_key
    ) from latest r
  ),'[]'::jsonb),
  'history',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',h.id,'source_key',h.source_key,'observed_at',h.observed_at,
      'original_sha256',h.original_sha256,
      'observed_depth',h.observed_depth,'expected_depth',h.expected_depth,
      'observed_status',h.observed_status,'native_period_authority',h.native_period_authority,
      'provider_week_ending_date',h.provider_week_ending_date
    ) order by h.observed_at desc,h.id desc)
    from (
      select id,source_key,observed_at,original_sha256,observed_depth,
        expected_depth,observed_status,native_period_authority,
        provider_week_ending_date
      from platform_private.charts2_capture_receipts_v1
      order by observed_at desc,id desc limit 35
    ) h
  ),'[]'::jsonb),
  'source_methods',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'source_key',m.source_key,'review_state',m.review_state,
      'reviewed_method',m.reviewed_method,
      'method_revision',m.method_revision,
      'authorization_expires_at',m.authorization_expires_at)
      order by m.source_key)
    from platform_private.charts2_source_methods_v1 m
    where m.source_key in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')
  ),'[]'::jsonb),
  'observation_reviews',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', e.id,'source_key',e.source_key,
      'receipt_id',e.receipt_id,'original_sha256',e.original_sha256,
      'rank',e.rank,'title',e.original_title,
      'artist',e.original_artist,'provider_track_id',null,
      'track_id',e.track_id,'track_status',e.track_status,
      'action',e.action,'review_note',e.review_note,
      'evidence_url',e.evidence_url,'event_fingerprint',e.event_fingerprint
    ) order by e.receipt_id,e.rank)
    from (
      select distinct on (evt.receipt_id,evt.rank)
        evt.*,track.status as track_status
      from platform_private.charts2_observation_review_events_v1 evt
      join latest current_receipt on current_receipt.id=evt.receipt_id
        and current_receipt.original_sha256=evt.original_sha256
      left join public.registry_tracks track on track.id=evt.track_id
      order by evt.receipt_id,evt.rank,evt.revision desc
    ) e
  ),'[]'::jsonb),
  'registry_links',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',l.id,'track_id',l.track_id,
      'provider_key',l.provider_key,'provider_track_id',l.provider_track_id,
      'match_method',l.match_method,'match_status',l.match_status,
      'match_confidence',l.match_confidence,
      'track_status',t.status,
      'review_evidence',pg_catalog.jsonb_build_object(
        'charts2_studio_review_v1',l.raw_payload->'charts2_studio_review_v1',
        'source_key',l.raw_payload->'source_key',
        'receipt_id',l.raw_payload->'receipt_id',
        'original_sha256',l.raw_payload->'original_sha256',
        'provider_track_id',l.raw_payload->'provider_track_id',
        'review_note',l.raw_payload->'review_note',
        'evidence_url',l.raw_payload->'evidence_url')
    ) order by l.provider_key,l.provider_track_id,l.track_id)
    from public.registry_track_provider_links l
    join public.registry_tracks t on t.id=l.track_id
    where exists (
      select 1 from observed_ids o
      where o.provider_key=l.provider_key and o.provider_track_id=l.provider_track_id
    )
  ),'[]'::jsonb)
);
$function$


CREATE OR REPLACE FUNCTION platform_private.charts2_compute_private_freeze_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog,public,platform_private,extensions'
AS $function$
declare
  s jsonb;
  r jsonb;
  o jsonb;
  l jsonb;
  p jsonb;
  links jsonb;
  observation_reviews jsonb;
  scores jsonb:='{}'::jsonb;
  seen_tracks jsonb:='{}'::jsonb;
  seen_ranks jsonb;
  source_receipts jsonb:='[]'::jsonb;
  input jsonb;
  ranking jsonb;
  input_sha text;
  rank_sha text;
  source_key text;
  provider_key text;
  expected_endpoint text;
  original_sha text;
  expected_depth integer;
  source_weight integer;
  observed_rank integer;
  rank_count integer;
  credit_units integer;
  receipt_id text;
  provider_id text;
  track_uuid text;
  eligible integer;
  source_count integer:=0;
  unresolved integer:=0;
  conflicts integer:=0;
  matches integer;
  existing jsonb;
  max_sources integer;
  required_weights constant jsonb :=
    '{"youtube_ke":30,"mdundo_ke":25,"apple_ke":20,"audiomack_ke":15,"shazam_ke":10}'::jsonb;
begin
  s:=public.charts2_studio_private_snapshot_v1();
  if s->>'contract' is distinct from 'charts2-private-studio/v1'
     or s->'methodology'->>'version' is distinct from
        'consumption_led_cultural_presence_v1'
     or s->'methodology'->>'scoring_policy_version' is distinct from
        'charts2-private-ordinal-v1'
     or s->'methodology'->'rule_set'->'weights' is distinct from required_weights
     or (s->'methodology'->'rule_set'->>'unit_denominator')::integer
          is distinct from 200
  then raise exception 'charts2_freeze_methodology_drift'; end if;
  if jsonb_typeof(s->'receipts') is distinct from 'array'
     or jsonb_array_length(s->'receipts')<>5
  then raise exception 'charts2_freeze_requires_five_receipts'; end if;
  links:=coalesce(s->'registry_links','[]'::jsonb);
  if jsonb_typeof(links)<>'array'
  then raise exception 'charts2_freeze_registry_snapshot_invalid'; end if;
  observation_reviews:=coalesce(s->'observation_reviews','[]'::jsonb);
  if jsonb_typeof(observation_reviews)<>'array'
  then raise exception 'charts2_freeze_observation_reviews_invalid'; end if;
  for r in select value from jsonb_array_elements(s->'receipts')
             order by value->>'source_key' loop
    source_count:=source_count+1;
    source_key:=r->>'source_key';
    case source_key
      when 'youtube_ke' then
        provider_key:='youtube';expected_depth:=100;source_weight:=30;
        expected_endpoint:='https://charts.youtube.com/youtubei/v1/browse?alt=json';
      when 'mdundo_ke' then
        provider_key:='mdundo';expected_depth:=100;source_weight:=25;
        expected_endpoint:='https://play.mdundo.com/top-charts/ke';
      when 'apple_ke' then
        provider_key:='apple_music';expected_depth:=100;source_weight:=20;
        expected_endpoint:='https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172';
      when 'audiomack_ke' then
        provider_key:='audiomack';expected_depth:=100;source_weight:=15;
        expected_endpoint:='https://audiomack.com/geo-charts/playlist/kenya';
      when 'shazam_ke' then
        provider_key:='shazam';expected_depth:=200;source_weight:=10;
        expected_endpoint:='https://www.shazam.com/services/charts/csv/top-200/kenya';
      else raise exception 'charts2_freeze_source_invalid';
    end case;
    if (source_receipts @> jsonb_build_array(jsonb_build_object('source_key',source_key)))
    then raise exception 'charts2_freeze_duplicate_source'; end if;
    receipt_id:=r->>'id';
    original_sha:=r->>'original_sha256';
    if r->>'receipt_schema' is distinct from 'charts2-original-receipt/v1'
       or r->>'source_endpoint' is distinct from expected_endpoint
       or r->>'market' is distinct from 'KE'
       or r->>'capture_mode' is distinct from 'service_original'
       or r->>'original_bucket' is distinct from 'charts2-evidence-private-v1'
       or original_sha !~ '^[a-f0-9]{64}$'
       or r->>'original_object_key' is distinct from
         source_key||'/'||left(original_sha,2)||'/'||original_sha||
         (case when source_key='youtube_ke' then '.json'
               when source_key='shazam_ke' then '.csv' else '.html' end)
       or coalesce((r->>'original_byte_length')::integer,0) not between 1 and 4000000
       or coalesce((r->>'method_revision')::integer,0)<1
       or coalesce((r->>'expected_depth')::integer,0)<>expected_depth
       or coalesce((r->>'observed_depth')::integer,0)<>expected_depth
       or r->>'observed_status' is distinct from 'succeeded'
       or (r->>'candidate_only')::boolean is distinct from true
       or (r->>'can_score')::boolean is distinct from false
       or (r->>'can_publish')::boolean is distinct from false
       or nullif(r->>'observed_at','') is null
       or nullif(r->>'original_verified_at','') is null
       or (r->>'observed_at')::timestamptz >
           (r->>'original_verified_at')::timestamptz
       or jsonb_typeof(r->'observations') is distinct from 'array'
       or jsonb_array_length(r->'observations')<>expected_depth
    then raise exception 'charts2_freeze_receipt_unqualified_%',source_key; end if;
    if source_key='youtube_ke' and (
       r->>'native_period_authority' is distinct from 'provider_declared_end_date'
       or nullif(r->>'provider_week_ending_date','') is null
    ) then raise exception 'charts2_freeze_youtube_week_unqualified'; end if;
    source_receipts:=source_receipts||jsonb_build_array(jsonb_build_object(
      'source_key',source_key,'receipt_id',receipt_id,'original_sha256',original_sha,
      'native_period_authority',r->>'native_period_authority',
      'observed_at',r->>'observed_at',
      'provider_updated_at',r->>'provider_updated_at',
      'provider_week_ending_date',r->>'provider_week_ending_date'));
    seen_ranks:='{}'::jsonb;
    for o in select value from jsonb_array_elements(r->'observations') loop
      if coalesce((o->>'rank') ~ '^[0-9]+$',false) is false
      then raise exception 'charts2_freeze_rank_invalid'; end if;
      observed_rank:=(o->>'rank')::integer;
      if observed_rank<1 or observed_rank>expected_depth or
         seen_ranks ? observed_rank::text or nullif(o->>'title','') is null
      then raise exception 'charts2_freeze_rank_or_title_invalid'; end if;
      seen_ranks:=seen_ranks||jsonb_build_object(observed_rank::text,true);
      provider_id:=nullif(o->>'provider_track_id','');
      matches:=0;l:=null;
      if provider_id is null then
        if source_key<>'shazam_ke'
        then unresolved:=unresolved+1;continue;end if;
        for p in select value from jsonb_array_elements(observation_reviews) loop
          if p->>'source_key' is distinct from source_key
            or p->>'receipt_id' is distinct from receipt_id
            or p->>'original_sha256' is distinct from original_sha
            or p->>'rank' is distinct from observed_rank::text
            or p->>'title' is distinct from o->>'title'
            or nullif(p->>'artist','') is distinct from nullif(o->>'artist','')
            or p->>'provider_track_id' is not null
            or p->>'action' is distinct from 'approve'
            or p->>'track_status' is distinct from 'active'
            or coalesce(p->>'event_fingerprint','') !~ '^[a-f0-9]{64}$'
            or length(btrim(coalesce(p->>'review_note','')))<40
            or coalesce(p->>'evidence_url','') not like 'https://%'
          then continue;end if;
          matches:=matches+1;l:=p;
        end loop;
      else
      for p in select value from jsonb_array_elements(links) loop
        if p->>'provider_key' is distinct from provider_key or
           p->>'provider_track_id' is distinct from provider_id
        then continue; end if;
        -- The actual Registry admits only manual, isrc and title/artist
        -- methods. A mere label claiming exact ID is NOT accepted authority.
        if p->>'track_status' is distinct from 'active'
           or p->>'match_status' is distinct from 'matched'
           or p->>'match_method' is distinct from 'manual'
           or (p->>'match_confidence')::numeric is distinct from 1
        then continue; end if;
        -- Exact provenance, reviewed by the existing Registry broker.
        if p->'review_evidence'->>'charts2_studio_review_v1' is distinct from 'true'
           or p->'review_evidence'->>'source_key' is distinct from source_key
           or p->'review_evidence'->>'receipt_id' is distinct from receipt_id
           or p->'review_evidence'->>'original_sha256' is distinct from original_sha
           or p->'review_evidence'->>'provider_track_id' is distinct from provider_id
           or length(btrim(coalesce(p->'review_evidence'->>'review_note','')))<40
           or coalesce(p->'review_evidence'->>'evidence_url','') not like 'https://%'
        then continue; end if;
        matches:=matches+1;l:=p;
      end loop;
      end if;
      if matches=0 then unresolved:=unresolved+1;continue; end if;
      if matches<>1 then conflicts:=conflicts+1;continue; end if;
      track_uuid:=l->>'track_id';
      if track_uuid is null then conflicts:=conflicts+1;continue; end if;
      if seen_tracks ? (source_key||'/'||track_uuid) then
        conflicts:=conflicts+1;continue;
      end if;
      seen_tracks:=seen_tracks||jsonb_build_object(source_key||'/'||track_uuid,true);
      credit_units:=source_weight*(200/expected_depth)*
        (expected_depth-observed_rank+1);
      existing:=coalesce(scores->track_uuid,
        jsonb_build_object('track_id',track_uuid,'score_units',0,
          'source_contributions','[]'::jsonb));
      scores:=jsonb_set(scores,array[track_uuid],
        jsonb_build_object('track_id',track_uuid,
          'score_units',(existing->>'score_units')::integer+credit_units,
          'source_contributions',existing->'source_contributions'||
            jsonb_build_array(jsonb_build_object(
              'source_key',source_key,'receipt_id',receipt_id,
              'original_sha256',original_sha,'rank',observed_rank,
              'source_weight_points',source_weight,
              'credit_units',credit_units) ||
              case when provider_id is null
                then jsonb_build_object('registry_observation_resolution_id',l->>'id')
                else jsonb_build_object('registry_provider_link_id',l->>'id')
              end)),
        true);
    end loop;
    select count(*) into rank_count from jsonb_object_keys(seen_ranks);
    if rank_count<>expected_depth
    then raise exception 'charts2_freeze_rank_depth_gap'; end if;
  end loop;
  if source_count<>5 then raise exception 'charts2_freeze_source_count_invalid';end if;
  select count(*) into eligible from jsonb_each(scores);
  select coalesce(jsonb_agg(jsonb_build_object(
        'position',pos,'track_id',track_id,'score_units',units,
        'score_points',to_char(units::numeric/200,'FM999990.00'),
        'source_contributions',contributions) order by pos),'[]'::jsonb)
  into ranking
  from (
    select row_number() over (order by units desc,track_id asc)::integer as pos,
      track_id,units,contributions
    from (
      select key as track_id,(value->>'score_units')::integer as units,
        value->'source_contributions' as contributions
      from jsonb_each(scores)
    ) ordered_scores
  ) numbered
  where pos<=100;
  input:=jsonb_build_object(
    'methodology',s->'methodology','receipts',s->'receipts',
    'registry_links',s->'registry_links','observation_reviews',s->'observation_reviews',
    'review_policy','exact_manual_receipt_plus_shazam_v1');
  input_sha:=encode(extensions.digest(input::text,'sha256'),'hex');
  rank_sha:=encode(extensions.digest(ranking::text,'sha256'),'hex');
  return jsonb_build_object('contract','charts2-private-freeze-preflight/v1',
    'methodology_version','consumption_led_cultural_presence_v1',
    'scoring_policy_version','charts2-private-ordinal-v1',
    'input_sha256',input_sha,'ranking_sha256',rank_sha,
    'eligible_count',eligible,'unresolved_count',unresolved,'conflict_count',conflicts,
    'source_receipts',source_receipts,'ranking',ranking,
    'freeze_ready',eligible>=100 and conflicts=0,
    'can_publish',false);
end
$function$

-- END EXACT DEFINITION REPLACEMENTS
commit;
