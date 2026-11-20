-- REVIEW DESIGN ONLY. NOT AN EXECUTABLE MIGRATION AT THIS PATH.
-- CLI-mint canonical filename, replay in a clean Supabase Preview.
-- Extend the EXISTING governed Artist Intake from exact Charts originals,
-- never disguise a chart observation as a CSV upload.
begin;
set local lock_timeout='5s';
set local statement_timeout='180s';
select pg_catalog.pg_advisory_xact_lock(
 pg_catalog.hashtextextended('charts2-artist-intake-origin-v1',0));

do $preflight$
begin
 if to_regclass('public.provider_intake_artist_staging') is null or
    to_regclass('public.provider_intake_runs') is null or
    to_regclass('platform_private.charts2_capture_receipts_v1') is null or
    to_regprocedure('public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid)') is null
 then raise exception 'STOP: governed Artist Intake or Charts originals absent'; end if;
 if to_regprocedure('public.admin_stage_charts2_artist_intake_v1(text,uuid,text,integer)') is not null
 then raise exception 'STOP: Chart Artist Intake origin already installed'; end if;
end
$preflight$;

-- This does not create a new Artist or create an alias. It stages ONE
-- immutable source-name observation for the existing Artist Intake review.
create unique index provider_intake_runs_charts2_artist_origin_once_v1
on public.provider_intake_runs(idempotency_key)
where provider='charts2_chart_observation';

create function platform_private.assert_charts2_artist_intake_receipt_v1(
  p_staging_id uuid
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,platform_private,auth
as $assert$
declare
  s public.provider_intake_artist_staging%rowtype;
  r platform_private.charts2_capture_receipts_v1%rowtype;
  o jsonb;
begin
  select * into s from public.provider_intake_artist_staging
    where id=p_staging_id;
  if not found or
    not exists(select 1 from public.provider_intake_runs run
      where run.id=s.intake_run_id and
        run.provider='charts2_chart_observation' and
        run.mode='artist_intake' and
        run.provider_entity_type='artist')
  then raise exception using errcode='42501',
    message='An exact Chart-derived Artist Intake review is required.';end if;
  select * into r from platform_private.charts2_capture_receipts_v1
    where id=(s.source_metadata->>'chart_receipt_id')::uuid
      and source_key=s.source_metadata->>'chart_source_key'
      and original_sha256=s.source_metadata->>'chart_original_sha256'
      and original_verified_at is not null and observed_status='succeeded';
  if not found or r.id is distinct from (
    select newest.id from platform_private.charts2_capture_receipts_v1 newest
    where newest.source_key=r.source_key
    order by newest.created_at desc,newest.id desc limit 1
  ) then raise exception using errcode='40001',
    message='Chart Artist observation no longer current or verified.';end if;
  select row.value into o from jsonb_array_elements(r.observations) row(value)
    where row.value->>'rank'=s.source_metadata->>'chart_rank';
  if o is null or o->>'artist' is distinct from s.source_artist_name or
    lower(btrim(s.source_artist_name)) is distinct from s.source_normalized_name or
    nullif(o->>'provider_track_id','') is distinct from
      nullif(s.source_metadata->>'chart_provider_track_id','')
  then raise exception using errcode='40001',
    message='Chart Artist source claim disagrees with the immutable original.';end if;
end
$assert$;
revoke all on function platform_private.assert_charts2_artist_intake_receipt_v1(uuid)
 from public,anon,authenticated,service_role;

create function public.admin_stage_charts2_artist_intake_v1(
 p_source_key text,p_receipt_id uuid,p_original_sha256 text,p_rank integer
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,platform_private,auth
as $stage$
declare
  v_user uuid:=auth.uid();
  r platform_private.charts2_capture_receipts_v1%rowtype;
  o jsonb;
  v_name text;
  v_run public.provider_intake_runs%rowtype;
  v_staging public.provider_intake_artist_staging%rowtype;
  v_key text;
begin
 if v_user is null or
   not coalesce(public.current_user_has_capability('manage_charts'),false) or
   not coalesce(public.current_user_has_capability('manage_registry'),false)
 then raise exception using errcode='42501',
   message='Charts and Registry permissions are both required.';end if;
 if p_source_key not in ('youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke')
  or p_receipt_id is null or p_original_sha256 !~ '^[a-f0-9]{64}$'
  or p_rank is null or p_rank<1 or
  p_rank>case when p_source_key='shazam_ke' then 200 else 100 end
 then raise exception using errcode='22023',
   message='A qualified exact chart original is required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('chart-artist-intake:'||p_receipt_id::text||':'||p_rank,0));
 select * into r from platform_private.charts2_capture_receipts_v1
   where id=p_receipt_id and source_key=p_source_key
     and original_sha256=p_original_sha256
     and original_verified_at is not null and observed_status='succeeded';
 if not found or r.id is distinct from (
   select newest.id from platform_private.charts2_capture_receipts_v1 newest
   where newest.source_key=p_source_key
   order by newest.created_at desc,newest.id desc limit 1
 ) then raise exception using errcode='40001',
   message='Chart original is no longer the current verified source.';end if;
 select row.value into o from jsonb_array_elements(r.observations) row(value)
   where row.value->>'rank'=p_rank::text;
 v_name:=nullif(btrim(o->>'artist'),'');
 if v_name is null or length(v_name)<2 then
   raise exception using errcode='22023',
     message='This original does not provide an Artist credit. Independently verify the Artist through another governed evidence source.';end if;

 v_key:='charts2-artist-observation:'||p_receipt_id||':'||p_rank;
 select * into v_run from public.provider_intake_runs
   where provider='charts2_chart_observation'
     and idempotency_key=v_key;
 if found then
   select * into v_staging from public.provider_intake_artist_staging
     where intake_run_id=v_run.id order by created_at limit 1;
   if not found or
      v_staging.source_metadata->>'chart_original_sha256' is distinct from p_original_sha256
   then raise exception using errcode='40001',
     message='Reviewed Artist Intake source state changed.';end if;
   return jsonb_build_object('run_id',v_run.id,'staging_id',v_staging.id,
     'idempotent_replay',true,'can_publish',false);
 end if;
 insert into public.provider_intake_runs(
   idempotency_key,provider,provider_entity_type,provider_entity_id,
   storefront_or_market,mode,actor,status,summary_json
 ) values (
   v_key,'charts2_chart_observation','artist',
   'chart-receipt:'||p_receipt_id::text||':rank:'||p_rank::text,
   'KE','artist_intake','user:'||v_user::text,'started',
   jsonb_build_object('source_key',p_source_key,'receipt_id',p_receipt_id,
     'original_sha256',p_original_sha256,'rank',p_rank,
     'chart_original_only',true)
 ) returning * into v_run;
 insert into public.provider_intake_artist_staging(
   intake_run_id,source_artist_name,source_normalized_name,
   source_spotify_id,source_spotify_uri,source_origin_iso2,
   source_metadata,match_status,review_status
 ) values (
   v_run.id,v_name,lower(btrim(v_name)),
   null,null,null,
   jsonb_build_object('chart_source_key',p_source_key,
     'chart_receipt_id',p_receipt_id,'chart_original_sha256',p_original_sha256,
     'chart_rank',p_rank,'chart_provider_track_id',nullif(o->>'provider_track_id',''),
     'chart_artist_claim_only',true),
   'no_match','pending'
 ) returning * into v_staging;
 return jsonb_build_object('run_id',v_run.id,'staging_id',v_staging.id,
   'idempotent_replay',false,'can_publish',false);
end
$stage$;
revoke all on function public.admin_stage_charts2_artist_intake_v1(
 text,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_stage_charts2_artist_intake_v1(
 text,uuid,text,integer) to authenticated;

-- The following existing SQL is preserved EXACTLY except that its recorded
-- provider family admits the additional chart_observation run and requires
-- assert_charts2_artist_intake_receipt_v1 before reviewed admission/apply.
-- BEGIN EXACT GOVERNED ARTIST FUNCTION REPLACEMENTS
CREATE OR REPLACE FUNCTION platform_private.registry_artist_intake_review_fingerprint_v1(p_staging_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
begin
  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=v_row.intake_run_id;

  if not found
     or v_run.provider not in ('csv_manual_upload','charts2_chart_observation')
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
  then
    raise exception using errcode='42501', message='Artist intake run is outside CSV Artist Intake V1.';
  end if;

  if v_run.provider='charts2_chart_observation' then
    perform platform_private.assert_charts2_artist_intake_receipt_v1(v_row.id);
  end if;

  return encode(
    extensions.digest(
      jsonb_build_object(
        'staging_id',v_row.id::text,
        'intake_run_id',v_row.intake_run_id::text,
        'provider',v_run.provider,
        'provider_entity_type',v_run.provider_entity_type,
        'mode',v_run.mode,
        'source_artist_name',v_row.source_artist_name,
        'source_normalized_name',v_row.source_normalized_name,
        'source_spotify_id',v_row.source_spotify_id,
        'source_spotify_uri',v_row.source_spotify_uri,
        'source_origin_iso2',v_row.source_origin_iso2,
        'source_popularity',v_row.source_popularity,
        'source_followers',v_row.source_followers,
        'source_genres',coalesce(v_row.source_genres,'[]'::jsonb),
        'source_images',coalesce(v_row.source_images,'{}'::jsonb),
        'source_metadata',coalesce(v_row.source_metadata,'{}'::jsonb),
        'match_status',v_row.match_status,
        'matched_registry_artist_id',v_row.matched_registry_artist_id,
        'matched_registry_artist_name',v_row.matched_registry_artist_name,
        'match_confidence',v_row.match_confidence,
        'match_reason',v_row.match_reason,
        'review_status',v_row.review_status,
        'reviewed_by',v_row.reviewed_by,
        'reviewed_at',v_row.reviewed_at,
        'review_notes',v_row.review_notes,
        'target_registry_artist_id',v_row.target_registry_artist_id
      )::text,
      'sha256'
    ),
    'hex'
  );
end
$function$


CREATE OR REPLACE FUNCTION platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_user_id uuid;
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=v_row.intake_run_id;

  if not found
     or v_run.provider not in ('csv_manual_upload','charts2_chart_observation')
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
     or v_row.review_status<>'accepted'
     or v_row.action_taken is not null
     or v_row.reviewed_by is null
     or v_row.reviewed_at is null
     or v_row.review_fingerprint is null
     or v_row.review_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode='42501', message='Artist intake row is not an unapplied accepted V1 review.';
  end if;

  if v_row.reviewed_at < now()-interval '30 days'
     or v_row.reviewed_at > now()+interval '5 minutes'
  then
    raise exception using errcode='42501', message='Artist intake review is outside the V1 freshness window.';
  end if;

  if v_run.provider='charts2_chart_observation' then
    perform platform_private.assert_charts2_artist_intake_receipt_v1(v_row.id);
  end if;

  v_fingerprint:=platform_private.registry_artist_intake_review_fingerprint_v1(v_row.id);
  if v_fingerprint<>v_row.review_fingerprint then
    raise exception using errcode='40001', message='Artist intake reviewed facts changed after approval.';
  end if;

  if v_row.target_registry_artist_id is not null
     and not exists (
       select 1
       from public.registry_artists artist
       where artist.id=v_row.target_registry_artist_id
         and artist.status in ('active','draft')
     )
  then
    raise exception using errcode='42501', message='Reviewed Artist intake target is no longer active or draft.';
  end if;

  return jsonb_build_object(
    'staging_id',v_row.id,
    'intake_run_id',v_row.intake_run_id,
    'source_artist_name',v_row.source_artist_name,
    'source_normalized_name',v_row.source_normalized_name,
    'source_spotify_id',v_row.source_spotify_id,
    'source_spotify_uri',v_row.source_spotify_uri,
    'source_origin_iso2',v_row.source_origin_iso2,
    'source_popularity',v_row.source_popularity,
    'source_followers',v_row.source_followers,
    'source_genres',coalesce(v_row.source_genres,'[]'::jsonb),
    'source_images',coalesce(v_row.source_images,'{}'::jsonb),
    'source_metadata',coalesce(v_row.source_metadata,'{}'::jsonb),
    'match_status',v_row.match_status,
    'matched_registry_artist_id',v_row.matched_registry_artist_id,
    'reviewed_by',v_row.reviewed_by,
    'reviewed_at',v_row.reviewed_at,
    'review_fingerprint',v_row.review_fingerprint,
    'target_registry_artist_id',v_row.target_registry_artist_id,
    'applying_user_id',v_user_id
  );
end
$function$


CREATE OR REPLACE FUNCTION public.admin_review_registry_artist_intake_v1(p_intake_run_id uuid, p_staging_id uuid, p_decision text, p_notes text DEFAULT NULL::text, p_target_registry_artist_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth'
AS $function$
declare
  v_user_id uuid;
  v_row public.provider_intake_artist_staging%rowtype;
  v_run public.provider_intake_runs%rowtype;
  v_target_id uuid;
  v_fingerprint text;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();

  if p_decision not in ('accepted','rejected') then
    raise exception using errcode='22023', message='Artist intake decision must be accepted or rejected.';
  end if;

  select staging.*
  into v_row
  from public.provider_intake_artist_staging staging
  where staging.id=p_staging_id
    and staging.intake_run_id=p_intake_run_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Artist intake staging row is missing from this run.';
  end if;

  if v_row.action_taken='processed' then
    raise exception using errcode='55000', message='Applied Artist intake reviews are immutable.';
  end if;

  select intake_run.*
  into v_run
  from public.provider_intake_runs intake_run
  where intake_run.id=p_intake_run_id;

  if not found
     or v_run.provider not in ('csv_manual_upload','charts2_chart_observation')
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
  then
    raise exception using errcode='42501', message='Artist intake run is outside CSV Artist Intake V1.';
  end if;

  if v_run.provider='charts2_chart_observation' then
    perform platform_private.assert_charts2_artist_intake_receipt_v1(p_staging_id);
  end if;

  if p_decision='accepted' then
    v_target_id:=coalesce(p_target_registry_artist_id,v_row.matched_registry_artist_id);

    if v_row.match_status<>'no_match' and v_target_id is null then
      raise exception using errcode='22023', message='Accepted matched Artist intake rows require an explicit Registry target.';
    end if;

    if v_target_id is not null
       and not exists (
         select 1
         from public.registry_artists artist
         where artist.id=v_target_id
           and artist.status in ('active','draft')
       )
    then
      raise exception using errcode='22023', message='Artist intake target must be an active or draft Registry Artist.';
    end if;
  else
    v_target_id:=null;
  end if;

  update public.provider_intake_artist_staging
  set
    review_status=p_decision,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_notes=nullif(btrim(coalesce(p_notes,'')),''),
    target_registry_artist_id=v_target_id,
    review_fingerprint=null,
    applied_registry_artist_id=null,
    action_taken=case when p_decision='rejected' then 'skipped' else null end,
    updated_at=now()
  where id=v_row.id;

  v_fingerprint:=platform_private.registry_artist_intake_review_fingerprint_v1(v_row.id);

  update public.provider_intake_artist_staging
  set review_fingerprint=v_fingerprint
  where id=v_row.id;

  return jsonb_build_object(
    'staging_id',v_row.id,
    'decision',p_decision,
    'target_registry_artist_id',v_target_id,
    'review_fingerprint',v_fingerprint,
    'reviewed_by',v_user_id
  );
end
$function$

-- END EXACT GOVERNED ARTIST FUNCTION REPLACEMENTS
commit;
