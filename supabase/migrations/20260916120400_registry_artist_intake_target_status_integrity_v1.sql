-- MIZIZI Slice 2 Artist Intake Target Status Integrity V1
--
-- Aligns review/apply target eligibility with the downstream Artist Origin and
-- Enrichment authorities: only active or draft canonical Artists are eligible.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-intake-target-status-integrity-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure('platform_private.registry_artist_intake_review_snapshot_v1(uuid)') is null
     or to_regprocedure('public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid)') is null
     or to_regprocedure('public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid)') is null
  then
    raise exception 'STOP: Artist Intake Authority V1 target foundation is missing';
  end if;
end
$preflight$;

create or replace function platform_private.registry_artist_intake_review_snapshot_v1(
  p_staging_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
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
     or v_run.provider<>'csv_manual_upload'
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
$$;

create or replace function public.admin_review_registry_artist_intake_v1(
  p_intake_run_id uuid,
  p_staging_id uuid,
  p_decision text,
  p_notes text default null,
  p_target_registry_artist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
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
     or v_run.provider<>'csv_manual_upload'
     or v_run.provider_entity_type<>'artist'
     or v_run.mode<>'artist_intake'
  then
    raise exception using errcode='42501', message='Artist intake run is outside CSV Artist Intake V1.';
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
$$;

create or replace function public.admin_mark_registry_artist_intake_applied_v1(
  p_staging_id uuid,
  p_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_review jsonb;
  v_run_id uuid;
  v_target_id uuid;
begin
  perform platform_private.registry_artist_intake_current_admin_v1();
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);
  v_run_id:=(v_review->>'intake_run_id')::uuid;
  v_target_id:=nullif(v_review->>'target_registry_artist_id','')::uuid;

  if p_artist_id is null
     or not exists (
       select 1
       from public.registry_artists artist
       where artist.id=p_artist_id
         and artist.status in ('active','draft')
     )
  then
    raise exception using errcode='22023', message='Applied Artist intake result must resolve to an active or draft Registry Artist.';
  end if;

  if v_target_id is not null and v_target_id<>p_artist_id then
    raise exception using errcode='40001', message='Applied Artist does not match the reviewed Registry target.';
  end if;

  update public.provider_intake_artist_staging
  set
    applied_registry_artist_id=p_artist_id,
    action_taken='processed',
    updated_at=now()
  where id=p_staging_id
    and action_taken is null;

  if not found then
    raise exception using errcode='40001', message='Artist intake row was already applied or changed concurrently.';
  end if;

  if not exists (
       select 1
       from public.provider_intake_artist_staging staging
       where staging.intake_run_id=v_run_id
         and (
           staging.review_status='pending'
           or (staging.review_status='accepted' and staging.action_taken is null)
         )
     )
  then
    update public.provider_intake_runs
    set
      status='completed',
      completed_at=coalesce(completed_at,now())
    where id=v_run_id;
  end if;

  return jsonb_build_object(
    'staging_id',p_staging_id,
    'artist_id',p_artist_id,
    'action_taken','processed'
  );
end
$$;

revoke all on function public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid) from public;
revoke all on function public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid) from public;
grant execute on function public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid) to authenticated;

comment on function public.admin_review_registry_artist_intake_v1(uuid,uuid,text,text,uuid) is
  'Records a caller-bound Artist intake review. Accepted existing targets must remain active or draft so every downstream governed admission is executable.';
comment on function public.admin_mark_registry_artist_intake_applied_v1(uuid,uuid) is
  'Seals an accepted Artist intake row only when the applied canonical Artist remains active or draft.';

commit;
