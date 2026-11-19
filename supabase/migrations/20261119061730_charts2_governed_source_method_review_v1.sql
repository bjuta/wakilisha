-- Charts 2.0 Phase 1: first-party YouTube method evidence and accountable review.
-- Filename minted by pinned Supabase CLI 2.107.0, PR #1399 run 44471059204.
-- Method approval remains an explicit signed-in manage_charts decision, never
-- a side effect of probing. No scheduler, scoring or public chart mutation.
begin;

create table platform_private.charts2_source_method_probes_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null default 'youtube_ke' check (source_key = 'youtube_ke'),
  exact_endpoint text not null default 'https://charts.youtube.com/youtubei/v1/browse?alt=json'
    check (exact_endpoint = 'https://charts.youtube.com/youtubei/v1/browse?alt=json'),
  reviewed_method text not null default 'POST' check (reviewed_method = 'POST'),
  target_period_key text not null check (target_period_key ~ '^weekly:[0-9]{8}:[0-9]{8}:ke$'),
  provider_week_ending_date date not null,
  actor_id uuid not null,
  expected_method_revision integer not null check (expected_method_revision >= 0),
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  original_object_key text not null,
  original_byte_length integer not null check (original_byte_length between 1 and 4000000),
  observed_depth integer not null check (observed_depth between 1 and 100),
  checked_at timestamptz not null default now()
);
create table platform_private.charts2_source_method_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null default 'youtube_ke' check (source_key = 'youtube_ke'),
  action text not null check (action in ('admit','hold')),
  actor_id uuid not null,
  method_revision integer not null check (method_revision > 0),
  probe_id uuid references platform_private.charts2_source_method_probes_v1(id),
  evidence_sha256 text,
  acknowledged_scope text not null check (length(acknowledged_scope) between 24 and 600),
  authorization_expires_at timestamptz,
  decided_at timestamptz not null default now(),
  unique (source_key,method_revision),
  constraint charts2_review_proof_required check (
    (action = 'admit' and probe_id is not null and evidence_sha256 is not null
      and authorization_expires_at is not null)
    or (action = 'hold' and probe_id is null and evidence_sha256 is null
      and authorization_expires_at is null)
  )
);

create trigger charts2_method_probe_immutable_v1
before update or delete on platform_private.charts2_source_method_probes_v1
for each row execute function platform_private.charts2_reject_receipt_mutation_v1();
create trigger charts2_method_decision_immutable_v1
before update or delete on platform_private.charts2_source_method_decisions_v1
for each row execute function platform_private.charts2_reject_receipt_mutation_v1();

alter table platform_private.charts2_source_method_probes_v1 enable row level security;
alter table platform_private.charts2_source_method_decisions_v1 enable row level security;
revoke all on platform_private.charts2_source_method_probes_v1 from public, anon, authenticated;
revoke all on platform_private.charts2_source_method_decisions_v1 from public, anon, authenticated;

-- Called only by the existing capability-gated Edge worker, AFTER a real
-- first-party native POST, strict parser, private Storage create-only upload,
-- independent SHA-256 object readback and current actor getUser check.
create function public.charts2_record_youtube_method_probe_v1(
  p_actor uuid,p_period text,p_end_date date,p_sha text,
  p_object_key text,p_size integer,p_depth integer
) returns jsonb
language plpgsql security definer
set search_path = ''
as $
declare
  rev integer;
  probe_id uuid;
  start_date date;
begin
  if p_actor is null or p_period is null or
     p_period !~ '^weekly:[0-9]{8}:[0-9]{8}:ke$' or
     p_end_date is null or
     to_char(p_end_date,'YYYYMMDD') <> substring(p_period from 17 for 8) or
     extract(isodow from p_end_date) <> 4 then
    raise exception 'charts2_method_probe_period_invalid';
  end if;
  start_date := to_date(substring(p_period from 8 for 8),'YYYYMMDD');
  if to_char(start_date,'YYYYMMDD') <> substring(p_period from 8 for 8)
     or p_end_date - start_date <> 6 then
    raise exception 'charts2_method_probe_period_invalid';
  end if;
  if p_sha is null or p_sha !~ '^[a-f0-9]{64}$'
     or p_object_key is distinct from
       'youtube_ke/' || substring(p_sha from 1 for 2) || '/' || p_sha || '.json'
     or p_size is null or p_size not between 1 and 4000000
     or p_depth is null or p_depth not between 1 and 100
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id='charts2-evidence-private-v1' and o.name=p_object_key
     ) then
    raise exception 'charts2_method_probe_original_unverified';
  end if;
  select m.method_revision into rev
  from platform_private.charts2_source_methods_v1 m
  where m.source_key='youtube_ke';
  if rev is null then raise exception 'charts2_method_probe_source_missing'; end if;
  insert into platform_private.charts2_source_method_probes_v1
    (target_period_key,provider_week_ending_date,actor_id,
     expected_method_revision,original_sha256,original_object_key,
     original_byte_length,observed_depth)
  values (p_period,p_end_date,p_actor,rev,p_sha,p_object_key,p_size,p_depth)
  returning id into probe_id;
  return pg_catalog.jsonb_build_object(
    'probe_id',probe_id,'expected_revision',rev
  );
end;
$;
revoke all on function public.charts2_record_youtube_method_probe_v1(
  uuid,text,date,text,text,integer,integer
) from public,anon,authenticated,service_role;
grant execute on function public.charts2_record_youtube_method_probe_v1(
  uuid,text,date,text,text,integer,integer
) to service_role;

-- Unlike the service-only recorder, ONLY an authenticated actor holding the
-- live manage_charts capability can authorize/revoke a collector method.
-- Actor identity is derived inside Postgres from the JWT, not a client parameter.
create function public.charts2_decide_youtube_method_v1(
  p_action text,p_probe_id uuid,p_expected_revision integer,p_ack text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  method_row platform_private.charts2_source_methods_v1%rowtype;
  proof platform_private.charts2_source_method_probes_v1%rowtype;
  next_revision integer;
  expiration timestamptz;
begin
  if actor is null or
     not coalesce(public.current_user_has_capability('manage_charts'),false) then
    raise exception 'charts2_method_review_not_authorized' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('admit','hold') or
     p_expected_revision is null or p_expected_revision < 0 or
     p_ack is null or length(trim(p_ack)) not between 24 and 600 then
    raise exception 'charts2_method_review_arguments_invalid';
  end if;
  select * into method_row
  from platform_private.charts2_source_methods_v1 m
  where m.source_key='youtube_ke'
  for update;
  if not found or method_row.method_revision <> p_expected_revision
     or method_row.method_revision >= 2147483646 then
    raise exception 'charts2_method_review_revision_conflict';
  end if;
  next_revision := method_row.method_revision+1;
  if p_action='admit' then
    if p_probe_id is null or
       p_ack <> 'I approve first-party YouTube Kenya Top Songs POST for evidence-only manual collection.' then
      raise exception 'charts2_method_review_attestation_required';
    end if;
    select * into proof
    from platform_private.charts2_source_method_probes_v1 e
    where e.id=p_probe_id and e.source_key='youtube_ke'
      and e.actor_id=actor and e.expected_method_revision=p_expected_revision
      and e.checked_at > now()-interval '20 minutes'
      and e.checked_at <= now()
      and e.provider_week_ending_date is not null;
    if not found or not exists (
      select 1 from storage.objects o
      where o.bucket_id='charts2-evidence-private-v1'
        and o.name=proof.original_object_key
    ) then
      raise exception 'charts2_method_review_evidence_unqualified';
    end if;
    expiration := now()+interval '24 hours';
    update platform_private.charts2_source_methods_v1
    set exact_endpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json',
        reviewed_method='POST',review_state='collector_admitted',
        reviewed_by=actor,reviewed_at=now(),
        authorization_expires_at=expiration,
        access_evidence_sha256=proof.original_sha256,
        method_revision=next_revision,updated_at=now()
    where source_key='youtube_ke';
  else
    if p_probe_id is not null then
      raise exception 'charts2_method_review_hold_probe_forbidden';
    end if;
    update platform_private.charts2_source_methods_v1
    set exact_endpoint=null,reviewed_method=null,review_state='held',
        reviewed_by=null,reviewed_at=null,authorization_expires_at=null,
        access_evidence_sha256=null,method_revision=next_revision,updated_at=now()
    where source_key='youtube_ke';
  end if;
  insert into platform_private.charts2_source_method_decisions_v1
    (action,actor_id,method_revision,probe_id,evidence_sha256,
     acknowledged_scope,authorization_expires_at)
  values
    (p_action,actor,next_revision,
     case when p_action='admit' then p_probe_id else null end,
     case when p_action='admit' then proof.original_sha256 else null end,
     p_ack,expiration);
  return pg_catalog.jsonb_build_object(
    'source_key','youtube_ke',
    'review_state',case when p_action='admit' then 'collector_admitted' else 'held' end,
    'method_revision',next_revision,
    'authorization_expires_at',expiration,
    'can_score',false,'can_publish',false
  );
end;
$$;
revoke all on function public.charts2_decide_youtube_method_v1(
  text,uuid,integer,text
) from public,anon,authenticated,service_role;
grant execute on function public.charts2_decide_youtube_method_v1(
  text,uuid,integer,text
) to authenticated;

comment on function public.charts2_decide_youtube_method_v1(text,uuid,integer,text)
is 'Authenticated manage_charts-only, explicit 24-hour YouTube native POST admission or revocation; uses current JWT, recent verified private evidence, expected revision and immutable audit. No scoring or publication.';

commit;
