-- CLI 2.107.0 filename minted by founder on exact 3af8bb43 (26 Nov 2026).
-- Issue #1441. Private, read-only research subject admission only.
-- Reuse the exact current SQL scoring kernel; the old no-argument contract
-- delegates without position projection. Input/ranking digest semantics unchanged.
-- No canonical Registry, approval, execution grant, job, freeze or publication write.
begin;

CREATE FUNCTION platform_private.charts2_compute_private_freeze_v1(p_include_investigation_positions boolean)
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
  investigation_positions jsonb:='[]'::jsonb;
  investigation_position jsonb;
  input jsonb;
  ranking jsonb;
  input_sha text;
  rank_sha text;
  source_key text;
  provider_key text;
  expected_endpoint text;
  official_export boolean;
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
    official_export:=(r->>'capture_mode') is not distinct from 'official_export_upload';
    if official_export then
      if source_key<>'youtube_ke'
         or r->>'native_period_authority' is distinct from 'operator_confirmed_official_export'
         or r->>'original_content_type' is distinct from 'text/csv'
         or r->>'parser_version' is distinct from 'charts2-youtube-official-export-v1'
         or r->>'method_revision' is not null
         or r->>'provider_updated_at' is not null
         or nullif(r->>'provider_week_ending_date','') is null
         or extract(isodow from (r->>'provider_week_ending_date')::date)<>4
         or (r->>'provider_week_ending_date')::date >=
            ((r->>'observed_at')::timestamptz at time zone 'UTC')::date
      then raise exception 'charts2_freeze_youtube_export_unqualified'; end if;
      expected_endpoint:='https://charts.youtube.com/charts/TopSongs/ke';
    elsif r->>'native_period_authority'='operator_confirmed_official_export' then
      raise exception 'charts2_freeze_youtube_export_unqualified';
    end if;
    if (source_receipts @> jsonb_build_array(jsonb_build_object('source_key',source_key)))
    then raise exception 'charts2_freeze_duplicate_source'; end if;
    receipt_id:=r->>'id';
    original_sha:=r->>'original_sha256';
    if r->>'receipt_schema' is distinct from 'charts2-original-receipt/v1'
       or r->>'source_endpoint' is distinct from expected_endpoint
       or r->>'market' is distinct from 'KE'
       or (not official_export and r->>'capture_mode' is distinct from 'service_original')
       or r->>'original_bucket' is distinct from 'charts2-evidence-private-v1'
       or original_sha !~ '^[a-f0-9]{64}$'
       or r->>'original_object_key' is distinct from
         source_key||'/'||left(original_sha,2)||'/'||original_sha||
         (case when official_export then '.csv' when source_key='youtube_ke' then '.json'
               when source_key='shazam_ke' then '.csv' else '.html' end)
       or coalesce((r->>'original_byte_length')::integer,0) not between 1 and 4000000
       or (not official_export and coalesce((r->>'method_revision')::integer,0)<1)
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
    if source_key='youtube_ke' and not official_export and (
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
      if official_export and (
        coalesce(o->>'provider_track_id','') !~ '^[A-Za-z0-9_-]{11}$'
        or o->>'provider_url' is distinct from 'https://www.youtube.com/watch?v='||(o->>'provider_track_id')
        or nullif(btrim(coalesce(o->>'artist','')),'') is null
        or jsonb_typeof(o->'view_count') is distinct from 'number'
        or coalesce(o->>'view_count','') !~ '^(0|[1-9][0-9]{0,14})$'
      ) then raise exception 'charts2_freeze_youtube_export_rows_unqualified';end if;
      provider_id:=nullif(o->>'provider_track_id','');
      if p_include_investigation_positions then
        investigation_position:=jsonb_build_object('source_key',source_key,'receipt_id',receipt_id,
          'original_sha256',original_sha,'rank',observed_rank,'title',o->>'title',
          'artist',o->>'artist','provider_track_id',provider_id);
      end if;
      matches:=0;l:=null;
      if provider_id is null then
        if source_key<>'shazam_ke'
        then
          unresolved:=unresolved+1;
          if p_include_investigation_positions then investigation_positions:=investigation_positions||
            jsonb_build_array(investigation_position||jsonb_build_object('disposition','research'));end if;
          continue;
        end if;
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
      if matches=0 then
        unresolved:=unresolved+1;
        if p_include_investigation_positions then investigation_positions:=investigation_positions||
          jsonb_build_array(investigation_position||jsonb_build_object('disposition','research'));end if;
        continue;
      end if;
      if matches<>1 then conflicts:=conflicts+1;
        if p_include_investigation_positions then investigation_positions:=investigation_positions||
          jsonb_build_array(investigation_position||jsonb_build_object('disposition','blocked'));end if;
        continue; end if;
      track_uuid:=l->>'track_id';
      if track_uuid is null then conflicts:=conflicts+1;
        if p_include_investigation_positions then investigation_positions:=investigation_positions||
          jsonb_build_array(investigation_position||jsonb_build_object('disposition','blocked'));end if;
        continue; end if;
      if seen_tracks ? (source_key||'/'||track_uuid) then
        conflicts:=conflicts+1;
        if p_include_investigation_positions then investigation_positions:=investigation_positions||
          jsonb_build_array(investigation_position||jsonb_build_object('disposition','blocked'));end if;
        continue;
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
    'can_publish',false) || case when p_include_investigation_positions then
      jsonb_build_object('investigation_positions',investigation_positions) else '{}'::jsonb end;
end
$function$;
revoke all on function platform_private.charts2_compute_private_freeze_v1(boolean)
  from public,anon,authenticated,service_role,mizizi_executor;
create or replace function platform_private.charts2_compute_private_freeze_v1()
returns jsonb language sql stable security definer
set search_path = pg_catalog
as $wrapper$
  select platform_private.charts2_compute_private_freeze_v1(false)
$wrapper$;
revoke all on function platform_private.charts2_compute_private_freeze_v1()
  from public,anon,authenticated,service_role,mizizi_executor;

-- A subject is a persisted hypothesis, never a Registry Track UUID.
-- The case UUID is also the private subject UUID; the journal remains the
-- sole case identity and lifecycle. The subject membership is immutable.
create table mizizi_private.chart_candidate_subjects_v1 (
  workspace_id uuid not null,
  case_id uuid primary key,
  membership_sha256 text not null check (membership_sha256 ~ '^[a-f0-9]{64}$'),
  observation_sha256 text not null check (observation_sha256 ~ '^[a-f0-9]{64}$'),
  admission_input_sha256 text not null check (admission_input_sha256 ~ '^[a-f0-9]{64}$'),
  initial_disposition text not null check (initial_disposition in ('research','blocked')),
  member_count integer not null check (member_count between 1 and 5),
  admitted_by uuid not null,
  admitted_at timestamptz not null default clock_timestamp(),
  unique (workspace_id,case_id),
  unique (workspace_id,membership_sha256),
  foreign key (workspace_id,case_id) references mizizi_private.cases(workspace_id,id)
    on update restrict on delete restrict,
  check (initial_disposition<>'blocked' or member_count=1)
);
create table mizizi_private.chart_candidate_positions_v1 (
  workspace_id uuid not null,
  case_id uuid not null,
  receipt_id uuid not null references platform_private.charts2_capture_receipts_v1(id)
    on update restrict on delete restrict,
  source_key text not null check (source_key in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')),
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  rank integer not null check (rank between 1 and case when source_key='shazam_ke' then 200 else 100 end),
  primary key (workspace_id,receipt_id,rank),
  unique (case_id,source_key),
  foreign key (workspace_id,case_id)
    references mizizi_private.chart_candidate_subjects_v1(workspace_id,case_id)
    on update restrict on delete restrict
);
alter table mizizi_private.chart_candidate_subjects_v1 enable row level security;
alter table mizizi_private.chart_candidate_positions_v1 enable row level security;
revoke all on mizizi_private.chart_candidate_subjects_v1,mizizi_private.chart_candidate_positions_v1
  from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.reject_chart_candidate_binding_mutation_v1()
returns trigger language plpgsql set search_path = pg_catalog as $immutable$
begin
  raise exception 'MIZIZI chart candidate binding is immutable' using errcode='23514';
end
$immutable$;
revoke all on function mizizi_private.reject_chart_candidate_binding_mutation_v1()
  from public,anon,authenticated,service_role,mizizi_executor;
create trigger mizizi_chart_candidate_subject_immutable before update or delete
  on mizizi_private.chart_candidate_subjects_v1 for each row
  execute function mizizi_private.reject_chart_candidate_binding_mutation_v1();
create trigger mizizi_chart_candidate_position_immutable before update or delete
  on mizizi_private.chart_candidate_positions_v1 for each row
  execute function mizizi_private.reject_chart_candidate_binding_mutation_v1();
create trigger mizizi_chart_candidate_subject_no_truncate before truncate
  on mizizi_private.chart_candidate_subjects_v1 for each statement
  execute function mizizi_private.reject_chart_candidate_binding_mutation_v1();
create trigger mizizi_chart_candidate_position_no_truncate before truncate
  on mizizi_private.chart_candidate_positions_v1 for each statement
  execute function mizizi_private.reject_chart_candidate_binding_mutation_v1();

-- Service-only projection for the existing Charts worker, which must verify
-- original Storage bytes and compare its independent JS scoring before it
-- presents an admission proposal. No browser receives service credentials.
create function public.mizizi_charts_candidate_input_v1()
returns jsonb language sql stable security definer set search_path = pg_catalog
as $input$
  select platform_private.charts2_compute_private_freeze_v1(true)
$input$;
revoke all on function public.mizizi_charts_candidate_input_v1()
  from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_charts_candidate_input_v1() to service_role;

-- Grouping is a hypothesis submitted under actual operator JWT. The database
-- independently derives the full current nonresolved workload; no supplied
-- title, Artist, ISRC, target identity, score, actor, or field claim is trusted.
-- Require complete partition; an overlap aborts the entire batch rather than
-- silently splitting/reassigning existing cases. Explicit supersession is a
-- later governed operation; there is no destructive regrouping here.
create function public.admin_mizizi_admit_chart_candidates_v1(
  p_expected_input_sha256 text, p_groups jsonb
)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $admit$
declare
  actor uuid;
  ws uuid;
  material jsonb;
  position_map jsonb;
  group_row jsonb;
  member_row jsonb;
  coord jsonb;
  coords jsonb;
  observations jsonb;
  disposition text;
  membership_sha text;
  observation_sha text;
  lookup_key text;
  seen jsonb:='{}'::jsonb;
  seen_sources jsonb;
  seen_count integer:=0;
  existing_case mizizi_private.cases%rowtype;
  binding mizizi_private.chart_candidate_subjects_v1%rowtype;
  fresh_id uuid;
  fresh_count integer:=0;
  replay_count integer:=0;
  result_cases jsonb:='[]'::jsonb;
begin
  actor:=mizizi_private.assert_headquarters_operator_v1('steward');
  if not coalesce(public.current_user_has_capability('manage_charts'),false) then
    raise exception 'MIZIZI chart investigation requires Charts authority' using errcode='42501';
  end if;
  if p_expected_input_sha256 is null or p_expected_input_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_groups) is distinct from 'array'
    or octet_length(p_groups::text)>300000 then
    raise exception 'Invalid chart investigation admission' using errcode='22023';
  end if;
  if jsonb_array_length(p_groups)>600 then
    raise exception 'Chart investigation group bound exceeded' using errcode='22023';
  end if;
  select id into strict ws from mizizi_private.workspaces
    where workspace_key='wakilisha-internal' and workspace_kind='internal' and status='active'
    for update;
  material:=platform_private.charts2_compute_private_freeze_v1(true);
  if material->>'input_sha256' is distinct from p_expected_input_sha256 then
    raise exception 'Stale chart investigation snapshot' using errcode='PT409';
  end if;
  select coalesce(jsonb_object_agg((v->>'receipt_id')||':'||(v->>'rank'),v),'{}'::jsonb)
    into position_map from jsonb_array_elements(material->'investigation_positions') v;
  if (select count(*) from jsonb_object_keys(position_map)) <>
    (material->>'unresolved_count')::integer+(material->>'conflict_count')::integer then
    raise exception 'Chart investigation scoring partition disagreement' using errcode='23514';
  end if;
  for group_row in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(group_row) is distinct from 'object' then
      raise exception 'Invalid chart investigation group' using errcode='22023';
    end if;
    if (select count(*) from jsonb_object_keys(group_row))<>2
       or not (group_row ?& array['disposition','positions'])
       or coalesce(group_row->>'disposition','') not in ('research','blocked')
       or jsonb_typeof(group_row->'positions') is distinct from 'array' then
      raise exception 'Invalid chart investigation group' using errcode='22023';
    end if;
    disposition:=group_row->>'disposition';
    if jsonb_array_length(group_row->'positions') not between 1 and 5
       or (disposition='blocked' and jsonb_array_length(group_row->'positions')<>1) then
      raise exception 'Invalid chart investigation member count' using errcode='22023';
    end if;
    seen_sources:='{}'::jsonb;
    coords:='[]'::jsonb;
    observations:='[]'::jsonb;
    for member_row in select value from jsonb_array_elements(group_row->'positions') loop
      if jsonb_typeof(member_row) is distinct from 'object' then
        raise exception 'Invalid chart investigation coordinate' using errcode='22023';
      end if;
      if (select count(*) from jsonb_object_keys(member_row))<>4
        or not (member_row ?& array['source_key','receipt_id','original_sha256','rank'])
        or jsonb_typeof(member_row->'rank') is distinct from 'number'
        or coalesce(member_row->>'rank','') !~ '^[1-9][0-9]{0,2}$'
        or coalesce(member_row->>'receipt_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
        or coalesce(member_row->>'original_sha256','') !~ '^[a-f0-9]{64}$'
        or coalesce(member_row->>'source_key','') not in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke') then
        raise exception 'Invalid chart investigation coordinate' using errcode='22023';
      end if;
      lookup_key:=(member_row->>'receipt_id')||':'||(member_row->>'rank');
      coord:=position_map->lookup_key;
      if coord is null or coord->>'disposition' is distinct from disposition
        or coord->>'original_sha256' is distinct from member_row->>'original_sha256'
        or coord->>'source_key' is distinct from member_row->>'source_key' then
        raise exception 'Chart investigation coordinate not in current disposition' using errcode='PT409';
      end if;
      if seen ? lookup_key or seen_sources ? (coord->>'source_key') then
        raise exception 'Duplicate chart investigation coordinate or source' using errcode='22023';
      end if;
      seen:=seen||jsonb_build_object(lookup_key,true);
      seen_sources:=seen_sources||jsonb_build_object(coord->>'source_key',true);
      seen_count:=seen_count+1;
      coords:=coords||jsonb_build_array(coord - 'title' - 'artist' - 'provider_track_id' - 'disposition');
      observations:=observations||jsonb_build_array(coord);
    end loop;
    select jsonb_agg(v order by v->>'source_key',v->>'receipt_id',(v->>'rank')::integer)
      into coords from jsonb_array_elements(coords) v;
    select jsonb_agg(v order by v->>'source_key',v->>'receipt_id',(v->>'rank')::integer)
      into observations from jsonb_array_elements(observations) v;
    membership_sha:=encode(extensions.digest(coords::text,'sha256'),'hex');
    observation_sha:=encode(extensions.digest(observations::text,'sha256'),'hex');
    select * into binding from mizizi_private.chart_candidate_subjects_v1 s
      where s.workspace_id=ws and s.membership_sha256=membership_sha;
    if found then
      select * into strict existing_case from mizizi_private.cases c
        where c.workspace_id=ws and c.id=binding.case_id;
      if binding.observation_sha256 is distinct from observation_sha
        or binding.initial_disposition is distinct from disposition
        or binding.member_count<>jsonb_array_length(coords)
        or existing_case.subject_type<>'recording'
        or existing_case.subject_id<>binding.case_id
        or existing_case.claim_family_key<>'charts2_recording_investigation_v1'
        or existing_case.case_key<>'mizizi:chart-candidate:v1:'||membership_sha
        or (select jsonb_agg(jsonb_build_object('source_key',p.source_key,'receipt_id',p.receipt_id,
            'original_sha256',p.original_sha256,'rank',p.rank)
            order by p.source_key,p.receipt_id,p.rank)
            from mizizi_private.chart_candidate_positions_v1 p where p.case_id=binding.case_id)
          is distinct from coords then
        raise exception 'Chart investigation existing binding conflict; reviewed reconciliation required' using errcode='PT409';
      end if;
      replay_count:=replay_count+1;
      result_cases:=result_cases||jsonb_build_array(jsonb_build_object('case_id',existing_case.id,
        'revision',existing_case.revision,'state',existing_case.case_state,'stage',existing_case.current_stage,
        'membership_sha256',membership_sha,'disposition',disposition,'status','replayed'));
    else
      if exists (select 1 from mizizi_private.chart_candidate_positions_v1 p
        join jsonb_array_elements(coords) v on p.receipt_id=(v->>'receipt_id')::uuid
          and p.rank=(v->>'rank')::integer where p.workspace_id=ws) then
        raise exception 'Chart investigation overlaps existing case; reviewed reconciliation required' using errcode='PT409';
      end if;
      fresh_id:=gen_random_uuid();
      insert into mizizi_private.cases(id,workspace_id,case_key,subject_type,subject_id,
        claim_family_key,claim_key,case_state,current_stage,epistemic_state,mutation_state,
        last_observation_fingerprint,policy_ruleset_version,transition_actor_key,transition_reason)
      values(fresh_id,ws,'mizizi:chart-candidate:v1:'||membership_sha,'recording',fresh_id,
        'charts2_recording_investigation_v1','mizizi.charts2.recording_identity',
        case when disposition='blocked' then 'held' else 'open' end,'triage','unknown','not_planned',
        observation_sha,'charts2-candidate-admission-v1','user:'||actor::text,
        'Operator admitted exact chart observations for private recording investigation.');
      insert into mizizi_private.chart_candidate_subjects_v1(workspace_id,case_id,membership_sha256,
        observation_sha256,admission_input_sha256,initial_disposition,member_count,admitted_by)
      values(ws,fresh_id,membership_sha,observation_sha,p_expected_input_sha256,
        disposition,jsonb_array_length(coords),actor);
      insert into mizizi_private.chart_candidate_positions_v1(workspace_id,case_id,receipt_id,
        source_key,original_sha256,rank)
      select ws,fresh_id,(v->>'receipt_id')::uuid,v->>'source_key',v->>'original_sha256',(v->>'rank')::integer
        from jsonb_array_elements(coords) v;
      fresh_count:=fresh_count+1;
      result_cases:=result_cases||jsonb_build_array(jsonb_build_object('case_id',fresh_id,
        'revision',1,'state',case when disposition='blocked' then 'held' else 'open' end,
        'stage','triage','membership_sha256',membership_sha,'disposition',disposition,'status','created'));
    end if;
  end loop;
  if seen_count<>(material->>'unresolved_count')::integer+(material->>'conflict_count')::integer then
    raise exception 'Incomplete chart investigation partition' using errcode='22023';
  end if;
  if (platform_private.charts2_compute_private_freeze_v1()->>'input_sha256') is distinct from p_expected_input_sha256 then
    raise exception 'Chart investigation changed during admission' using errcode='PT409';
  end if;
  return jsonb_build_object('contract','mizizi-charts-candidate-admission/v1',
    'input_sha256',p_expected_input_sha256,'position_count',seen_count,'created',fresh_count,
    'replayed',replay_count,'cases',result_cases,'jobs_dispatched',0,'can_publish',false);
end
$admit$;
revoke all on function public.admin_mizizi_admit_chart_candidates_v1(text,jsonb)
  from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_admit_chart_candidates_v1(text,jsonb) to authenticated;

comment on function public.admin_mizizi_admit_chart_candidates_v1(text,jsonb) is
  'Authenticated steward with Charts and Registry capabilities admits a complete current chart hypothesis partition. No research dispatch or canonical mutation.';

do $acl$
begin
  if has_function_privilege('anon','public.admin_mizizi_admit_chart_candidates_v1(text,jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.admin_mizizi_admit_chart_candidates_v1(text,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.admin_mizizi_admit_chart_candidates_v1(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.mizizi_charts_candidate_input_v1()','EXECUTE')
    or not has_function_privilege('service_role','public.mizizi_charts_candidate_input_v1()','EXECUTE')
    or has_function_privilege('service_role','platform_private.charts2_compute_private_freeze_v1(boolean)','EXECUTE')
    or has_table_privilege('authenticated','mizizi_private.chart_candidate_positions_v1','SELECT')
    or has_table_privilege('service_role','mizizi_private.chart_candidate_positions_v1','INSERT')
  then raise exception 'MIZIZI chart candidate authority fence failed';end if;
end
$acl$;
commit;
