-- Charts 2.0 / Phase 2 Take 3: immutable PRIVATE 100-recording freeze.
-- Name minted by pinned Supabase CLI 2.107.0 run 44513371361.
-- Do not create public wk_chart_editions_v2 or wk_chart_entries_v2.
begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

do $preflight$
begin
  if to_regprocedure('public.charts2_studio_private_snapshot_v1()') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('platform_private.charts2_capture_receipts_v1') is null
     or to_regclass('public.registry_tracks') is null
  then raise exception 'charts2_freeze_foundation_missing'; end if;
  if to_regclass('platform_private.charts2_private_freezes_v1') is not null
  then raise exception 'charts2_freeze_already_exists'; end if;
end
$preflight$;

create table platform_private.charts2_private_freezes_v1 (
  id uuid primary key default gen_random_uuid(),
  methodology_version text not null
    check (methodology_version='consumption_led_cultural_presence_v1'),
  scoring_policy_version text not null
    check (scoring_policy_version='charts2-private-ordinal-v1'),
  input_sha256 text not null unique check (input_sha256 ~ '^[a-f0-9]{64}$'),
  ranking_sha256 text not null check (ranking_sha256 ~ '^[a-f0-9]{64}$'),
  source_receipts jsonb not null
    check (jsonb_typeof(source_receipts)='array' and jsonb_array_length(source_receipts)=5),
  ranking jsonb not null
    check (jsonb_typeof(ranking)='array' and jsonb_array_length(ranking)=100),
  unresolved_observations integer not null check (unresolved_observations>=0),
  frozen_by uuid not null references auth.users(id),
  frozen_at timestamptz not null default now(),
  lifecycle text not null default 'frozen_private'
    check (lifecycle='frozen_private'),
  can_publish boolean not null default false check (can_publish=false)
);
alter table platform_private.charts2_private_freezes_v1 enable row level security;
revoke all on platform_private.charts2_private_freezes_v1
  from public,anon,authenticated,service_role;
create index charts2_private_freezes_v1_recent_idx on
  platform_private.charts2_private_freezes_v1 (frozen_at desc,id desc);

create function platform_private.charts2_reject_private_freeze_mutation_v1()
returns trigger language plpgsql security definer set search_path=''
as $guard$
begin
  raise exception using errcode='42501',
    message='charts2_private_freeze_is_immutable';
end
$guard$;
create trigger charts2_private_freezes_immutable_v1
before update or delete on platform_private.charts2_private_freezes_v1
for each row execute function
  platform_private.charts2_reject_private_freeze_mutation_v1();
revoke all on function platform_private.charts2_reject_private_freeze_mutation_v1()
from public,anon,authenticated,service_role;

-- Recompute only from current service-only authenticated Studio DB snapshot.
-- Never trust a browser-computed chart, Registry equivalence or rank array.
create function platform_private.charts2_compute_private_freeze_v1()
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog,public,platform_private,extensions'
as $compute$
declare
  s jsonb;
  r jsonb;
  o jsonb;
  l jsonb;
  p jsonb;
  links jsonb;
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
  for r in select value from jsonb_array_elements(s->'receipts')
             order by value->>'source_key' loop
    source_count:=source_count+1;
    source_key:=r->>'source_key';
    case source_key
      when 'youtube_ke' then
        provider_key:='youtube';expected_depth:=100;source_weight:=30;
      when 'mdundo_ke' then
        provider_key:='mdundo';expected_depth:=100;source_weight:=25;
      when 'apple_ke' then
        provider_key:='apple_music';expected_depth:=100;source_weight:=20;
      when 'audiomack_ke' then
        provider_key:='audiomack';expected_depth:=100;source_weight:=15;
      when 'shazam_ke' then
        provider_key:='shazam';expected_depth:=200;source_weight:=10;
      else raise exception 'charts2_freeze_source_invalid';
    end case;
    if (source_receipts @> jsonb_build_array(jsonb_build_object('source_key',source_key)))
    then raise exception 'charts2_freeze_duplicate_source'; end if;
    receipt_id:=r->>'id';
    original_sha:=r->>'original_sha256';
    if r->>'receipt_schema' is distinct from 'charts2-original-receipt/v1'
       or r->>'market' is distinct from 'KE'
       or r->>'capture_mode' is distinct from 'service_original'
       or r->>'original_bucket' is distinct from 'charts2-evidence-private-v1'
       or original_sha !~ '^[a-f0-9]{64}$'
       or r->>'original_object_key' is distinct from
         source_key||'/'||left(original_sha,2)||'/'||original_sha||
         (case when source_key='youtube_ke' then '.json'
               when source_key='shazam_ke' then '.csv' else '.html' end)
       or coalesce((r->>'original_byte_length')::integer,0)<1
       or coalesce((r->>'method_revision')::integer,0)<1
       or coalesce((r->>'expected_depth')::integer,0)<>expected_depth
       or coalesce((r->>'observed_depth')::integer,0)<>expected_depth
       or r->>'observed_status' is distinct from 'succeeded'
       or (r->>'candidate_only')::boolean is distinct from true
       or (r->>'can_score')::boolean is distinct from false
       or (r->>'can_publish')::boolean is distinct from false
       or nullif(r->>'observed_at','') is null
       or nullif(r->>'original_verified_at','') is null
       or r->>'observed_at' > r->>'original_verified_at'
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
      if provider_id is null then unresolved:=unresolved+1;continue; end if;
      matches:=0;l:=null;
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
           or p->'review_evidence'->>'evidence_url' not like 'https://%'
        then continue; end if;
        matches:=matches+1;l:=p;
      end loop;
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
              'credit_units',credit_units,'registry_provider_link_id',l->>'id'))),
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
    'registry_links',s->'registry_links','review_policy','exact_manual_receipt_v1');
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
$compute$;
revoke all on function platform_private.charts2_compute_private_freeze_v1()
from public,anon,authenticated,service_role;

-- Return only a bounded review gate to an already-authorized Edge caller.
create function public.charts2_private_freeze_preflight_v1()
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog,public,platform_private'
as $gate$
declare r jsonb; latest uuid;
begin
  r:=platform_private.charts2_compute_private_freeze_v1();
  select f.id into latest from platform_private.charts2_private_freezes_v1 f
    order by f.frozen_at desc,f.id desc limit 1;
  return r||jsonb_build_object('latest_freeze_id',latest,
    'recent_freezes',coalesce((select jsonb_agg(
      jsonb_build_object('id',id,'frozen_at',frozen_at,
        'input_sha256',input_sha256,'ranking_sha256',ranking_sha256,
        'frozen_private',true) order by frozen_at desc,id desc)
      from (select id,frozen_at,input_sha256,ranking_sha256
        from platform_private.charts2_private_freezes_v1
        order by frozen_at desc,id desc limit 15) x),'[]'::jsonb));
end
$gate$;
revoke all on function public.charts2_private_freeze_preflight_v1()
from public,anon,authenticated,service_role;
grant execute on function public.charts2_private_freeze_preflight_v1()
to service_role;

-- Real user-JWT only. No Edge service-role impersonation or browser INSERT.
create function public.charts2_freeze_private_candidate_v1(
  p_expected_input_sha256 text,
  p_expected_previous_id uuid,
  p_ack text
) returns jsonb language plpgsql volatile security definer
set search_path='pg_catalog,public,platform_private,auth'
as $freeze$
declare
  actor uuid:=auth.uid();
  material jsonb;
  previous uuid;
  duplicate platform_private.charts2_private_freezes_v1%rowtype;
  fresh_id uuid;
begin
  if actor is null
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then raise exception using errcode='42501',
      message='charts2_private_freeze_requires_charts_and_registry'; end if;
  if p_ack is distinct from
    'I approve freezing this exact 100-recording private chart candidate. It will not publish.'
  then raise exception 'charts2_private_freeze_explicit_approval_required';end if;
  if p_expected_input_sha256 is null or
     p_expected_input_sha256 !~ '^[a-f0-9]{64}$'
  then raise exception 'charts2_private_freeze_digest_invalid';end if;
  perform pg_advisory_xact_lock(
    hashtextextended('charts2-private-freeze-actor-approval-v1',0));
  material:=platform_private.charts2_compute_private_freeze_v1();
  if material->>'input_sha256' is distinct from p_expected_input_sha256
  then raise exception 'charts2_private_freeze_stale_snapshot';end if;
  if (material->>'freeze_ready')::boolean is distinct from true
     or (material->>'eligible_count')::integer<100
     or (material->>'conflict_count')::integer<>0
     or jsonb_array_length(material->'ranking')<>100
  then raise exception 'charts2_private_freeze_insufficient_registry_authority';end if;
  select * into duplicate from platform_private.charts2_private_freezes_v1
    where input_sha256=p_expected_input_sha256;
  if found then
    if duplicate.ranking_sha256 is distinct from material->>'ranking_sha256'
    then raise exception 'charts2_private_freeze_digest_conflict';end if;
    return jsonb_build_object('id',duplicate.id,'input_sha256',duplicate.input_sha256,
      'ranking_sha256',duplicate.ranking_sha256,'count',100,
      'idempotent',true,'private',true,'can_publish',false);
  end if;
  select f.id into previous from platform_private.charts2_private_freezes_v1 f
    order by f.frozen_at desc,f.id desc limit 1;
  if previous is distinct from p_expected_previous_id
  then raise exception 'charts2_private_freeze_revision_conflict';end if;
  insert into platform_private.charts2_private_freezes_v1(
    methodology_version,scoring_policy_version,input_sha256,ranking_sha256,
    source_receipts,ranking,unresolved_observations,frozen_by)
  values (
    'consumption_led_cultural_presence_v1','charts2-private-ordinal-v1',
    material->>'input_sha256',material->>'ranking_sha256',
    material->'source_receipts',material->'ranking',
    (material->>'unresolved_count')::integer,actor)
  returning id into fresh_id;
  return jsonb_build_object('id',fresh_id,'input_sha256',material->>'input_sha256',
    'ranking_sha256',material->>'ranking_sha256','count',100,
    'idempotent',false,'private',true,'can_publish',false);
end
$freeze$;
revoke all on function public.charts2_freeze_private_candidate_v1(text,uuid,text)
from public,anon,authenticated,service_role;
grant execute on function public.charts2_freeze_private_candidate_v1(text,uuid,text)
to authenticated;

comment on table platform_private.charts2_private_freezes_v1 is
'Immutable 100-position private Charts 2.0 snapshots, never public chart editions.';
comment on function public.charts2_freeze_private_candidate_v1(text,uuid,text)
is 'Authentic user-JWT reviewed private-only freeze with 100 Registry-authorized tracks, transaction-locked expected digest and revision.';
commit;
