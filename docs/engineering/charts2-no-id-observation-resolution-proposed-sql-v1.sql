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
     or p_acknowledgement is distinct from
      'I independently verified this exact Shazam position and authorize its private Registry recording resolution.'
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
