-- WAKILISHA 100 #1329. STAGED SQL CANDIDATE — NOT A SUPABASE MIGRATION.
-- Do not execute against Production or rename into supabase/migrations by hand.
-- CLI-MINTED VERSION AUTHORITY: 20261030095808_wk100_governed_publisher_v1.sql
-- The CLI minted its filename in a disposable worktree on 2026-10-30.
-- No file survived the disposable worktree; only the version/name was retained.
-- Do not promote this design candidate into that migration until DB acceptance.
-- Gate: replay on a clean isolated Preview, denied-role checks, exact receipts,
-- one-week conflict, immutable history, and a complete controlled publisher.
--
-- This is an approved-evidence/weekly-slot AUTHORITY, not an Edition writer.
-- The statement never changes wk_chart_editions_v2 or wk_chart_entries_v2.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

-- SAFETY INTERLOCK: this tracked design candidate is NOT a deployable migration.
-- An accepted CLI-minted migration may remove this interlock only after review,
-- exact-schema SQL acceptance and explicit Preview authority.
do $$
begin
  raise exception using errcode='P0001',
    message='WK100_CANDIDATE_EXECUTION_PROHIBITED: not an accepted migration';
end;
$$;

create table platform_private.wk100_governed_editorial_approvals_v1 (
  id uuid primary key default gen_random_uuid(),
  program_id text not null default 'top100' check (program_id='top100'),
  week_start_eat date not null,
  edition_slot_key text not null,
  proposal_sha256 text not null check (proposal_sha256 ~ '^[a-f0-9]{64}$'),
  proposal_snapshot_sha256 text not null check (proposal_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  constitution_sha256 text not null check (constitution_sha256 ~ '^[a-f0-9]{64}$'),
  rank_input_sha256 text not null check (rank_input_sha256 ~ '^[a-f0-9]{64}$'),
  proposal_snapshot jsonb not null check (jsonb_typeof(proposal_snapshot)='object'),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  constraint wk100_governed_editorial_approval_week_monday_check
    check (extract(isodow from week_start_eat)=1),
  constraint wk100_governed_editorial_approval_slot_check
    check (edition_slot_key='wk100:KE:'||week_start_eat::text),
  constraint wk100_governed_editorial_approval_week_unique
    unique (program_id,week_start_eat),
  constraint wk100_governed_editorial_approval_snapshot_unique
    unique (proposal_snapshot_sha256)
);

alter table platform_private.wk100_governed_editorial_approvals_v1
  enable row level security;
revoke all on platform_private.wk100_governed_editorial_approvals_v1
  from public,anon,authenticated,service_role;

create function platform_private.wk100_block_editorial_approval_mutation_v1()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  raise exception using errcode='42501',
    message='WK100 approved source-evidence reviews are immutable.';
end;
$$;

revoke execute on function
  platform_private.wk100_block_editorial_approval_mutation_v1()
from public,anon,authenticated,service_role;

create trigger wk100_editorial_approvals_immutable_rows
before update or delete
on platform_private.wk100_governed_editorial_approvals_v1
for each row
execute function platform_private.wk100_block_editorial_approval_mutation_v1();

create trigger wk100_editorial_approvals_immutable_truncate
before truncate
on platform_private.wk100_governed_editorial_approvals_v1
for each statement
execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- A sealed source receipt is not approval to use that provider for a Kenya
-- chart. The separate source/legal-methodology decision has its own human
-- authority and must be recorded BEFORE any reviewed week is accepted.
create table platform_private.wk100_governed_source_admissions_v1 (
  id uuid primary key default gen_random_uuid(),
  week_start_eat date not null
    check (extract(isodow from week_start_eat)=1),
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id),
  authority_sha256 text not null
    check (authority_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  unique(week_start_eat,contract_id)
);
alter table platform_private.wk100_governed_source_admissions_v1
  enable row level security;
revoke all on platform_private.wk100_governed_source_admissions_v1
  from public,anon,authenticated,service_role;
create trigger wk100_source_admission_immutable_rows
before update or delete
on platform_private.wk100_governed_source_admissions_v1
for each row
execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_source_admission_immutable_truncate
before truncate on platform_private.wk100_governed_source_admissions_v1
for each statement
execute function platform_private.wk100_block_editorial_approval_mutation_v1();

create function public.wk100_admit_governed_source_v1(
  p_week_start_eat date,p_contract_id uuid,p_authority_sha256 text
) returns uuid language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_existing platform_private.wk100_governed_source_admissions_v1%rowtype;
begin
  if v_actor is null or
     not public.current_user_has_capability('manage_charts') or
     not public.current_user_has_capability('manage_ingest') then
    raise exception using errcode='42501',
      message='WK100 source authority requires both chart and ingest stewardship';
  end if;
  if p_week_start_eat is null or
     extract(isodow from p_week_start_eat)<>1 or
     p_authority_sha256 !~ '^[a-f0-9]{64}$' or
     not exists(
       select 1 from public.wk_chart_capture_contracts_v1 c
       where c.id=p_contract_id and c.market='KE'
         and c.admission_state='candidate'
         and c.native_metric in ('rank','rank_and_count')
     ) then
    raise exception 'WK100 source admission requires exact existing KE source, method and authority evidence';
  end if;
  insert into platform_private.wk100_governed_source_admissions_v1
   (week_start_eat,contract_id,authority_sha256,approved_by)
  values(p_week_start_eat,p_contract_id,p_authority_sha256,v_actor)
  on conflict(week_start_eat,contract_id) do nothing returning id into v_id;
  if v_id is null then
    select * into strict v_existing
    from platform_private.wk100_governed_source_admissions_v1
    where week_start_eat=p_week_start_eat and contract_id=p_contract_id;
    if v_existing.authority_sha256<>p_authority_sha256 then
      raise exception using errcode='23505',
        message='WK100 source admission has conflicting immutable authority';
    end if;
    v_id:=v_existing.id;
  end if;
  return v_id;
end;
$$;
revoke execute on function
  public.wk100_admit_governed_source_v1(date,uuid,text)
from public,anon,authenticated,service_role;
grant execute on function
  public.wk100_admit_governed_source_v1(date,uuid,text)
to authenticated;

-- Trusted server-side private-reader replay evidence. A human Editor cannot
-- self-attest scoring. The trusted server must check raw bytes and recompute
-- the independent ranking BEFORE calling the service-role-only RPC below.
create table platform_private.wk100_private_replay_attestations_v1 (
  id uuid primary key default gen_random_uuid(),
  week_start_eat date not null,
  proposal_snapshot_sha256 text not null unique
    check (proposal_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  proposal_sha256 text not null check (proposal_sha256 ~ '^[a-f0-9]{64}$'),
  rank_input_sha256 text not null check (rank_input_sha256 ~ '^[a-f0-9]{64}$'),
  constitution_sha256 text not null check (constitution_sha256 ~ '^[a-f0-9]{64}$'),
  attested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '48 hours'),
  unique(week_start_eat,proposal_snapshot_sha256)
);
alter table platform_private.wk100_private_replay_attestations_v1 enable row level security;
revoke all on platform_private.wk100_private_replay_attestations_v1
  from public,anon,authenticated,service_role;
create trigger wk100_private_replay_immutable_rows
before update or delete on platform_private.wk100_private_replay_attestations_v1
for each row execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_private_replay_immutable_truncate
before truncate on platform_private.wk100_private_replay_attestations_v1
for each statement execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- Service-only transport boundary: this RPC itself does not replay sources.
-- Only an existing restricted server path after full native byte/digest/rank
-- verification may invoke it; never expose service credentials to browsers.
create function public.wk100_attest_private_ranking_replay_v1(p_proposal jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_hash text;
  v_week date;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode='42501',message='WK100 private replay attestation is server-only';
  end if;
  if p_proposal is null or jsonb_typeof(p_proposal)<>'object'
     or p_proposal->>'schema_version'<>'wk100-governed-edition-proposal-v1'
     or p_proposal->>'can_publish' is distinct from 'false'
     or p_proposal->>'can_write_registry' is distinct from 'false'
     or coalesce(p_proposal->>'proposal_sha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_proposal->>'rank_input_sha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_proposal->>'constitution_sha256','') !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_proposal->'observed_entries') is distinct from 'array'
     or jsonb_array_length(p_proposal->'observed_entries')<>100 then
    raise exception 'WK100 private replay attestation requires complete nonpublishing proposal';
  end if;
  v_week:=(p_proposal->>'week_start_eat')::date;
  v_hash:=encode(extensions.digest(p_proposal::text,'sha256'),'hex');
  insert into platform_private.wk100_private_replay_attestations_v1
    (week_start_eat,proposal_snapshot_sha256,proposal_sha256,
     rank_input_sha256,constitution_sha256)
  values(v_week,v_hash,p_proposal->>'proposal_sha256',
         p_proposal->>'rank_input_sha256',p_proposal->>'constitution_sha256')
  on conflict (proposal_snapshot_sha256) do nothing returning id into v_id;
  if v_id is null then
    select id into strict v_id
    from platform_private.wk100_private_replay_attestations_v1
    where proposal_snapshot_sha256=v_hash
      and week_start_eat=v_week
      and proposal_sha256=p_proposal->>'proposal_sha256';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.wk100_attest_private_ranking_replay_v1(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_attest_private_ranking_replay_v1(jsonb)
  to service_role;

-- A real signed-in Chart Editor must approve exactly one frozen, previously
-- private-verified proposal. This approval is NOT a capability to publish.
-- Raw bytes must also have passed the pre-existing private reader checks.
create function public.wk100_register_governed_editorial_approval_v1(p_proposal jsonb)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_actor uuid;
  v_week date;
  v_start timestamptz;
  v_end timestamptz;
  v_cutoff timestamptz;
  v_deadline timestamptz;
  v_review timestamptz;
  v_proposal_sha text;
  v_snapshot_sha text;
  v_source jsonb;
  v_item jsonb;
  v_seen_sources text[] := '{}'::text[];
  v_seen_operators text[] := '{}'::text[];
  v_seen_providers text[] := '{}'::text[];
  v_ref jsonb;
  v_seen_attempts uuid[] := '{}'::uuid[];
  v_seen_rows uuid[] := '{}'::uuid[];
  v_attempt uuid;
  v_contract record;
  v_count integer;
  v_rank integer;
  v_expected integer := 1;
  v_existing platform_private.wk100_governed_editorial_approvals_v1%rowtype;
  v_id uuid;
begin
  v_actor:=auth.uid();
  if v_actor is null or not
    public.current_user_has_capability('manage_charts') then
    raise exception using errcode='42501',
      message='WK100 reviewed publication authority requires a live Chart Editor capability.';
  end if;

  if p_proposal is null or jsonb_typeof(p_proposal)<>'object'
     or p_proposal->>'schema_version'<>'wk100-governed-edition-proposal-v1'
     or p_proposal->>'state'<>'candidate_for_separate_governed_review'
     or p_proposal->>'can_publish'<>'false'
     or p_proposal->>'can_write_registry'<>'false' then
    raise exception 'WK100 approval requires an explicitly nonpublishing governed proposal.';
  end if;

  if (p_proposal->>'week_start_eat') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'WK100 approval week format invalid.';
  end if;
  v_week:=(p_proposal->>'week_start_eat')::date;
  if extract(isodow from v_week)<>1
     or p_proposal->>'edition_slot_key'<>'wk100:KE:'||v_week::text
     or (p_proposal->>'edition_date_eat')::date<>v_week+7
     or not exists (
       select 1 from public.wk_chart_programs_v2 p
       where p.id='top100' and p.series_slug='top100'
         and p.market_slug='KE' and p.chart_size=100
     ) then
    raise exception 'WK100 requested Edition is outside the existing Kenya Top 100 programme/week.';
  end if;

  if (p_proposal->>'proposal_sha256') !~ '^[a-f0-9]{64}$'
     or (p_proposal->>'constitution_sha256') !~ '^[a-f0-9]{64}$'
     or (p_proposal->>'rank_input_sha256') !~ '^[a-f0-9]{64}$' then
    raise exception 'WK100 content-addressed evidence digests are missing.';
  end if;
  v_proposal_sha:=p_proposal->>'proposal_sha256';
  -- A database-local snapshot digest protects the exact approved JSONB.
  -- It is deliberately distinct from the Node canonicalJSON SHA256.
  v_snapshot_sha:=encode(extensions.digest(p_proposal::text,'sha256'),'hex');
  if not exists (
    select 1 from platform_private.wk100_private_replay_attestations_v1 a
    where a.week_start_eat=v_week
      and a.proposal_snapshot_sha256=v_snapshot_sha
      and a.proposal_sha256=v_proposal_sha
      and a.rank_input_sha256=p_proposal->>'rank_input_sha256'
      and a.constitution_sha256=p_proposal->>'constitution_sha256'
      and a.expires_at>now()
  ) then
    raise exception using errcode='42501',
      message='WK100 trusted private source and ranking replay attestation missing';
  end if;

  v_start:=v_week::timestamp at time zone 'Africa/Nairobi';
  v_end:=(v_week+7)::timestamp at time zone 'Africa/Nairobi';
  v_cutoff:=(p_proposal->>'cutoff_at_utc')::timestamptz;
  v_deadline:=(p_proposal->>'deadline_at_utc')::timestamptz;
  v_review:=(p_proposal#>>'{editor_review,reviewed_at_utc}')::timestamptz;
  if v_cutoff<v_end or v_deadline<v_cutoff
     or v_deadline>v_end+interval '7 days'
     or v_review<v_cutoff or v_review>v_deadline
     or p_proposal#>>'{editor_review,editor_ref}' is null
     or clock_timestamp()>v_deadline
     or clock_timestamp()<v_cutoff then
    raise exception 'WK100 EAT cutoff or editorial review is invalid.';
  end if;

  if jsonb_typeof(p_proposal->'source_receipts')<>'array'
     or jsonb_array_length(p_proposal->'source_receipts') not between 2 and 8
     or jsonb_typeof(p_proposal->'selected_attempt_ids')<>'array'
     or jsonb_array_length(p_proposal->'selected_attempt_ids')
        <>jsonb_array_length(p_proposal->'source_receipts') then
    raise exception 'WK100 source receipt panel is incomplete.';
  end if;

  -- Every declared source must map to one real successful and fully persisted
  -- Week/market capture attempt, with unchanged SHA and native period.
  for v_source in select value from jsonb_array_elements(p_proposal->'source_receipts') loop
    if coalesce(v_source->>'source_key','')=any(v_seen_sources)
       or coalesce(v_source->>'operator_key','')=any(v_seen_operators)
       or nullif(btrim(coalesce(v_source->>'operator_key','')),'') is null
       or (v_source->>'raw_sha256') !~ '^[a-f0-9]{64}$' then
      raise exception 'WK100 source/operator duplication or invalid hash.';
    end if;
    v_seen_sources:=array_append(v_seen_sources,v_source->>'source_key');
    v_seen_operators:=array_append(v_seen_operators,v_source->>'operator_key');

    select a.id,a.record_count,a.payload_sha256,
           a.native_period_start,a.native_period_end,
           a.native_period_evidence_ref,
           c.expected_depth,c.provider_key,c.source_key
      into strict v_contract
    from public.wk_chart_capture_attempts_v1 a
    join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
    where c.source_key=v_source->>'source_key'
      and c.market='KE'
      and a.week_start_eat=v_week
      and a.status='succeeded'
      and a.native_period_authority='provider_defined'
      and a.payload_sha256=v_source->>'raw_sha256'
      and a.id::text in (
        select jsonb_array_elements_text(p_proposal->'selected_attempt_ids')
      );
    if v_contract.id=any(v_seen_attempts)
       or v_contract.provider_key=any(v_seen_providers)
       or v_contract.record_count<>v_contract.expected_depth
       or v_contract.native_period_start is distinct from
         (v_source#>>'{native_period,starts_at}')::timestamptz
       or v_contract.native_period_end is distinct from
         (v_source#>>'{native_period,ends_at}')::timestamptz
       or v_contract.native_period_evidence_ref is distinct from
         v_source#>>'{native_period,evidence_ref}' then
      raise exception 'WK100 source receipt authority or period mismatches the database.';
    end if;
    if not exists (
      select 1
      from platform_private.wk100_governed_source_admissions_v1 admitted
      join public.wk_chart_capture_attempts_v1 att
        on att.contract_id=admitted.contract_id
      where admitted.week_start_eat=v_week
        and att.id=v_contract.id
        and admitted.approved_at<=v_deadline
        and admitted.authority_sha256 ~ '^[a-f0-9]{64}$'
    ) then
      raise exception using errcode='42501',
        message='WK100 source not separately admitted for this chart week';
    end if;
    v_seen_attempts:=array_append(v_seen_attempts,v_contract.id);
    v_seen_providers:=array_append(v_seen_providers,v_contract.provider_key);

    select count(*) into v_count
      from public.wk_chart_capture_rows_v1 r
      where r.attempt_id=v_contract.id;
    if v_count<>v_contract.record_count then
      raise exception 'WK100 selected capture source rows are incomplete.';
    end if;
  end loop;

  if cardinality(v_seen_attempts)<>jsonb_array_length(p_proposal->'selected_attempt_ids') then
    raise exception 'WK100 selected attempt set does not match the source panel.';
  end if;

  if jsonb_typeof(p_proposal->'observed_entries')<>'array'
     or jsonb_array_length(p_proposal->'observed_entries')<>100 then
    raise exception 'WK100 editorial review must contain exactly 100 ranked observations.';
  end if;
  for v_item in select value from jsonb_array_elements(p_proposal->'observed_entries') loop
    v_rank:=(v_item->>'rank')::integer;
    if v_rank<>v_expected
       or nullif(btrim(v_item->>'original_title'),'') is null
       or nullif(btrim(v_item->>'original_artist'),'') is null
       or (v_item->>'score')::numeric<=0 then
      raise exception 'WK100 ranks, observed text or positive scores are incomplete.';
    end if;
    v_expected:=v_expected+1;

    -- An original title/artist is never invented at the editorial layer.
    v_attempt:=(v_item#>>'{source_observation,attempt_id}')::uuid;
    if not v_attempt=any(v_seen_attempts)
       or (v_item#>>'{source_observation,capture_row_id}')::uuid=any(v_seen_rows) then
      raise exception 'WK100 ranked observation contains a foreign/duplicate source row.';
    end if;
    v_seen_rows:=array_append(v_seen_rows,(v_item#>>'{source_observation,capture_row_id}')::uuid);
    select count(*) into v_count
    from public.wk_chart_capture_rows_v1 r
    join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
    join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
    where r.id=(v_item#>>'{source_observation,capture_row_id}')::uuid
      and r.attempt_id=v_attempt
      and r.source_rank=(v_item#>>'{source_observation,source_rank}')::integer
      and c.source_key=v_item#>>'{source_observation,source_key}'
      and a.payload_sha256=v_item#>>'{source_observation,raw_sha256}'
      and r.title_observed=v_item->>'original_title'
      and r.artist_observed=v_item->>'original_artist';
    if v_count<>1 then
      raise exception 'WK100 original observed title, artist, rank or evidence ID cannot be verified.';
    end if;
    if (v_item->>'canonical_track_id') is null then
      if coalesce(v_item->>'provisional_ref','') !~ '^wk100:obs:v1:[a-f0-9]{64}:[0-9a-f-]{36}$'
        or v_item->>'provisional_ref'<>
           'wk100:obs:v1:'||
           (v_item#>>'{source_observation,raw_sha256}')||':'||
           lower(v_item#>>'{source_observation,capture_row_id}') then
        raise exception 'WK100 provisional observation must be source-anchored.';
      end if;
    else
      if v_item->>'provisional_ref' is not null
         or (v_item->>'canonical_track_id') !~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        raise exception 'WK100 canonical and provisional identity may not coexist.';
      end if;
      select count(*) into v_count
      from public.wk_chart_capture_rows_v1 r
      join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
      join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
      join public.registry_track_provider_links l
        on l.provider_key=c.provider_key
        and l.provider_track_id=r.provider_track_id
        and l.match_status='matched'
      join public.registry_tracks t on t.id=l.track_id and t.status='active'
      where r.id=(v_item#>>'{source_observation,capture_row_id}')::uuid
        and l.track_id=(v_item->>'canonical_track_id')::uuid;
      if v_count<>1 then
        raise exception 'WK100 canonical Track is not attested by the selected provider observation.';
      end if;
    end if;

    if jsonb_typeof(v_item->'corroboration_refs')<>'array'
       or jsonb_array_length(v_item->'corroboration_refs')=0 then
      raise exception 'WK100 ranked entry lacks source contribution evidence.';
    end if;
    for v_ref in select value from jsonb_array_elements(v_item->'corroboration_refs')
    loop
      select count(*) into v_count
      from public.wk_chart_capture_rows_v1 r
      join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
      join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
      where c.source_key=v_ref->>'source_key'
        and a.id=any(v_seen_attempts)
        and r.source_rank=(v_ref->>'source_rank')::integer
        and (
          (
            v_item->>'canonical_track_id' is null
            and r.id=(v_item#>>'{source_observation,capture_row_id}')::uuid
          )
          or (
            v_item->>'canonical_track_id' is not null
            and exists (
              select 1 from public.registry_track_provider_links l
              join public.registry_tracks t
                on t.id=l.track_id and t.status='active'
              where l.provider_key=c.provider_key
                and l.provider_track_id=r.provider_track_id
                and l.match_status='matched'
                and l.track_id=(v_item->>'canonical_track_id')::uuid
            )
          )
        );
      if v_count<>1 then
        raise exception 'WK100 source contribution identity lacks verified capture evidence.';
      end if;
    end loop;
  end loop;

  -- Atomic immutable one-per-week approval, unlike proposal digest uniqueness.
  insert into platform_private.wk100_governed_editorial_approvals_v1
    (week_start_eat,edition_slot_key,proposal_sha256,
     proposal_snapshot_sha256,constitution_sha256,rank_input_sha256,
     proposal_snapshot,approved_by)
  values(v_week,p_proposal->>'edition_slot_key',v_proposal_sha,
         v_snapshot_sha,p_proposal->>'constitution_sha256',
         p_proposal->>'rank_input_sha256',p_proposal,v_actor)
  on conflict (program_id,week_start_eat) do nothing
  returning id into v_id;

  if v_id is null then
    select * into strict v_existing
    from platform_private.wk100_governed_editorial_approvals_v1
    where program_id='top100' and week_start_eat=v_week;
    if v_existing.proposal_snapshot_sha256<>v_snapshot_sha
       or v_existing.proposal_sha256<>v_proposal_sha then
      raise exception using errcode='23505',
        message='WK100 week already has a different immutable reviewed proposal.';
    end if;
    v_id:=v_existing.id;
  end if;
  return v_id;
end;
$$;

revoke execute on function
  public.wk100_register_governed_editorial_approval_v1(jsonb)
from public,anon,authenticated,service_role;
-- Intentionally callable by signed-in users; the function verifies live
-- auth.uid() and manage_charts against the existing role authority.
grant execute on function
  public.wk100_register_governed_editorial_approval_v1(jsonb)
to authenticated;


-- The review-slot lock alone does not stop an unrelated V2 writer racing
-- against the same WK100 week. Enforce one global Top100 Edition per date.
-- Other programmes preserve their current indexing/eligibility behavior.
create unique index wk100_unique_program_edition_date_v1
  on public.wk_chart_editions_v2(program_id,edition_date)
  where program_id='top100' and edition_date is not null;

-- Private, append-only review Handoff to the EXISTING Registry/MIZIZI
-- stewardship workflows. This is NOT a duplicate Track writer and never
-- modifies a canonical Registry entity.
create table platform_private.wk100_pending_identity_investigations_v1 (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null,
  rank integer not null check(rank between 1 and 100),
  provisional_ref text not null unique
    check(provisional_ref ~ '^wk100:obs:v1:[a-f0-9]{64}:[0-9a-f-]{36}$'),
  capture_row_id uuid not null,
  attempt_id uuid not null,
  source_key text not null,
  original_title text not null,
  original_artist text not null,
  submitted_at timestamptz not null default now(),
  unique(edition_id,rank),
  unique(edition_id,capture_row_id)
);
alter table platform_private.wk100_pending_identity_investigations_v1
  enable row level security;
revoke all on platform_private.wk100_pending_identity_investigations_v1
  from public,anon,authenticated,service_role;
create trigger wk100_pending_identity_immutable_rows
before update or delete on platform_private.wk100_pending_identity_investigations_v1
for each row
execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_pending_identity_immutable_truncate
before truncate on platform_private.wk100_pending_identity_investigations_v1
for each statement
execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- Immutable one-week STAGING ledger, not public approval and not publication.
-- One approved snapshot may stage at most one draft Edition per EAT week.
create table platform_private.wk100_governed_staged_editions_v1 (
  id uuid primary key default gen_random_uuid(),
  program_id text not null default 'top100' check (program_id='top100'),
  week_start_eat date not null,
  approval_id uuid not null references
    platform_private.wk100_governed_editorial_approvals_v1(id),
  edition_id text not null unique,
  proposal_sha256 text not null check (proposal_sha256 ~ '^[a-f0-9]{64}$'),
  staged_by uuid not null,
  staged_at timestamptz not null default now(),
  unique (program_id,week_start_eat)
);
alter table platform_private.wk100_governed_staged_editions_v1 enable row level security;
revoke all on platform_private.wk100_governed_staged_editions_v1
  from public,anon,authenticated,service_role;
create trigger wk100_staged_edition_rows_immutable
before update or delete on platform_private.wk100_governed_staged_editions_v1
for each row execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_staged_edition_truncate_immutable
before truncate on platform_private.wk100_governed_staged_editions_v1
for each statement execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- Legacy Chart V2's status publication guard is UPDATE-only. Restrict a
-- previously unguarded published INSERT for the WK100 programme alone.
-- Publication UPDATE remains subject to the existing legacy guard and is NOT
-- enabled by this candidate.
create function platform_private.wk100_block_direct_published_insert_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
  if new.program_id='top100' and new.status='published' then
    raise exception using errcode='42501',
      message='WK100 direct published Edition INSERT prohibited';
  end if;
  return new;
end;
$$;
revoke execute on function platform_private.wk100_block_direct_published_insert_v1()
  from public,anon,authenticated,service_role;
create trigger wk100_block_direct_published_insert
before insert on public.wk_chart_editions_v2 for each row
execute function platform_private.wk100_block_direct_published_insert_v1();


-- A transient promotion authority is bound to a single Postgres transaction.
-- It also leaves an immutable public-release audit receipt after commit.
create table platform_private.wk100_governed_publications_v1 (
  id uuid primary key default gen_random_uuid(),
  approved_review_id uuid not null unique references
    platform_private.wk100_governed_editorial_approvals_v1(id),
  edition_id text not null unique,
  proposal_sha256 text not null check(proposal_sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid not null,
  authorized_tx bigint not null,
  published_at timestamptz not null default clock_timestamp()
);
alter table platform_private.wk100_governed_publications_v1 enable row level security;
revoke all on platform_private.wk100_governed_publications_v1
  from public,anon,authenticated,service_role;
create trigger wk100_publications_immutable_rows
before update or delete on platform_private.wk100_governed_publications_v1
for each row execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_publications_immutable_truncate
before truncate on platform_private.wk100_governed_publications_v1
for each statement execute function platform_private.wk100_block_editorial_approval_mutation_v1();

-- Preserve Chart V2's existing eligibility behavior for every other programme.
-- WK100 has different rank-evidence authority, so publication is admitted ONLY
-- when this same SQL transaction created the immutable verified grant above.
-- An arbitrary GUC or a user-supplied proposal field cannot bypass this check.
create or replace function public.wk_chart_editions_publish_integrity_guard()
returns trigger language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.status='published' and old.status is distinct from new.status then
    if new.program_id='top100' then
      if not exists (
        select 1 from platform_private.wk100_governed_publications_v1 g
        join platform_private.wk100_governed_staged_editions_v1 s
          on s.approval_id=g.approved_review_id
         and s.edition_id=g.edition_id
        where g.edition_id=new.id
          and s.proposal_sha256=g.proposal_sha256
          and g.authorized_tx=txid_current()
          and g.published_by=auth.uid()
      ) then
        raise exception using errcode='42501',
          message='WK100 requires same-transaction reviewed publication grant';
      end if;
    else
      perform public.chart_assert_publishable_edition(new.id);
    end if;
  end if;
  return new;
end;
$$;

-- Additional independent WK100-only guard, also blocks unpublishing or
-- republishing an Edition without a fresh, impossible-to-forge transaction.
create function platform_private.wk100_block_ungoverned_promotion_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
  if old.program_id='top100' and old.status='published'
     and new.status is distinct from old.status then
    raise exception using errcode='42501',
      message='WK100 published Edition cannot be silently demoted';
  end if;
  if new.program_id='top100' and new.status='published'
     and old.status is distinct from 'published' then
    if not exists (
      select 1 from platform_private.wk100_governed_publications_v1 g
      where g.edition_id=new.id
        and g.authorized_tx=txid_current()
        and g.published_by=auth.uid()
    ) then
      raise exception using errcode='42501',
        message='WK100 ungoverned publication forbidden';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function platform_private.wk100_block_ungoverned_promotion_v1()
  from public,anon,authenticated,service_role;
create trigger wk100_block_ungoverned_promotion
before update of status on public.wk_chart_editions_v2
for each row execute function platform_private.wk100_block_ungoverned_promotion_v1();

-- Preserve the ORIGINAL WK100 source-native snapshot once a staged ledger
-- exists. Registry/MIZIZI may attach verified metadata through a future
-- separate, audited correction workflow; it must not rewrite ranks or labels.
create function platform_private.wk100_block_staged_content_mutation_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
declare
  v_program text;
  v_week date;
begin
  if tg_table_name='wk_chart_entries_v2' then
    select e.program_id,e.period_start into v_program,v_week
    from public.wk_chart_editions_v2 e
    where e.id=old.edition_id;
    if v_program='top100' and exists (
      select 1 from platform_private.wk100_governed_staged_editions_v1 s
      where s.program_id='top100' and s.week_start_eat=v_week
        and s.edition_id=old.edition_id
    ) then
      raise exception using errcode='42501',
        message='WK100 staged original observations are immutable';
    end if;
  elsif tg_table_name='wk_chart_editions_v2' and
     old.program_id='top100' and exists (
       select 1 from platform_private.wk100_governed_staged_editions_v1 s
       where s.edition_id=old.id
     ) then
    if tg_op='DELETE' then
      raise exception using errcode='42501',
        message='WK100 approved Edition cannot be deleted';
    end if;
    if (to_jsonb(new)-'updated_at'-'status'-'published_at'-'published_by')
         is distinct from
       (to_jsonb(old)-'updated_at'-'status'-'published_at'-'published_by')
    then
      raise exception using errcode='42501',
        message='WK100 approved Edition snapshot may not be rewritten';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke execute on function platform_private.wk100_block_staged_content_mutation_v1()
  from public,anon,authenticated,service_role;
create trigger wk100_stage_entry_update_delete_guard
before update or delete on public.wk_chart_entries_v2 for each row
execute function platform_private.wk100_block_staged_content_mutation_v1();
create trigger wk100_stage_edition_update_delete_guard
before update or delete on public.wk_chart_editions_v2 for each row
execute function platform_private.wk100_block_staged_content_mutation_v1();

-- A completed staged Edition must also reject late INSERTs; otherwise a
-- separate writer could append rank 101 without modifying approved rows.
create function platform_private.wk100_block_extra_staged_entry_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
  if exists(
    select 1 from platform_private.wk100_governed_staged_editions_v1 s
    where s.edition_id=new.edition_id
  ) then
    raise exception using errcode='42501',
      message='WK100 staged Edition cannot receive additional entries';
  end if;
  return new;
end;
$$;
revoke execute on function platform_private.wk100_block_extra_staged_entry_v1()
from public,anon,authenticated,service_role;
create trigger wk100_block_extra_staged_entry
before insert on public.wk_chart_entries_v2
for each row
execute function platform_private.wk100_block_extra_staged_entry_v1();

-- Stage exactly 100 snapshot rows in one transaction. Never publishes.
create function public.wk100_stage_governed_weekly_edition_v1(
  p_week date, p_proposal_sha256 text
) returns text
language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid();
  v_approval platform_private.wk100_governed_editorial_approvals_v1%rowtype;
  v_prior platform_private.wk100_governed_staged_editions_v1%rowtype;
  v_entry jsonb;
  v_id text;
  v_rank integer:=0;
  v_match_count integer;
  v_identity text;
  v_seen text[]:='{}'::text[];
begin
  if v_actor is null or not public.current_user_has_capability('publish_charts') then
    raise exception using errcode='42501',message='WK100 publisher capability required';
  end if;
  if p_week is null or coalesce(p_proposal_sha256,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'WK100 exact week and approved digest required';
  end if;
  -- One approved source snapshot is the serialization point for retries.
  -- The clock gate belongs at editorial approval, not at idempotent retries.
  select * into strict v_approval from
    platform_private.wk100_governed_editorial_approvals_v1
    where program_id='top100' and week_start_eat=p_week
    for update;
  if v_approval.proposal_sha256 is distinct from p_proposal_sha256
    or v_approval.proposal_snapshot_sha256 is distinct from
       encode(extensions.digest(v_approval.proposal_snapshot::text,'sha256'),'hex') then
    raise exception 'WK100 approval snapshot/digest does not match';
  end if;
  select * into v_prior from platform_private.wk100_governed_staged_editions_v1
   where program_id='top100' and week_start_eat=p_week;
  if found then
    if v_prior.approval_id<>v_approval.id or
       v_prior.proposal_sha256<>p_proposal_sha256 or
       not exists(select 1 from public.wk_chart_editions_v2 e
         where e.id=v_prior.edition_id and e.program_id='top100'
           and e.status='draft' and e.edition_date=p_week+7
           and (select count(*) from public.wk_chart_entries_v2 x
                where x.edition_id=e.id)=100) then
      raise exception 'WK100 staged week has conflicting or incomplete Edition';
    end if;
    return v_prior.edition_id;
  end if;
  v_id:='wk100-ke-'||to_char(p_week,'YYYYMMDD');
  if exists(select 1 from public.wk_chart_editions_v2 e
    where e.id=v_id or (e.program_id='top100' and e.edition_date=p_week+7)) then
    raise exception 'WK100 overlapping Edition slot already exists';
  end if;
  if jsonb_typeof(v_approval.proposal_snapshot->'observed_entries')<>'array'
     or jsonb_array_length(v_approval.proposal_snapshot->'observed_entries')<>100 then
    raise exception 'WK100 approved Edition does not have 100 entries';
  end if;
  insert into public.wk_chart_editions_v2
    (id,program_id,edition_slug,edition_label,edition_date,
     period_start,period_end,entry_count,chart_size,status,
     methodology_version,source_policy_version,rule_set_snapshot)
  values
    (v_id,'top100',(p_week+7)::text,'WAKILISHA 100 — '||p_week::text,
     p_week+7,p_week,p_week+6,100,100,'draft',
     v_approval.proposal_snapshot->>'methodology_version',
     'wk100-governed-v1',
     jsonb_build_object('proposal_sha256',p_proposal_sha256,
       'wk100_evidence_version','wk100-governed-edition-proposal-v1'));
  for v_entry in select value from jsonb_array_elements(
      v_approval.proposal_snapshot->'observed_entries') loop
    v_rank:=v_rank+1;
    v_identity:=coalesce(v_entry->>'canonical_track_id',v_entry->>'provisional_ref');
    if (v_entry->>'rank')::integer<>v_rank or
      v_identity is null or v_identity=any(v_seen) or
      coalesce((v_entry->>'score')::numeric,0)<=0 then
      raise exception 'WK100 duplicate identity, rank drift or invalid score';
    end if;
    v_seen:=array_append(v_seen,v_identity);
    -- Re-read the original observation before staging; do not import
    -- title/artist labels which no longer match the immutable capture row.
    select count(*) into v_match_count
    from public.wk_chart_capture_rows_v1 r
    join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
    join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
    where r.id=(v_entry#>>'{source_observation,capture_row_id}')::uuid
      and a.id=(v_entry#>>'{source_observation,attempt_id}')::uuid
      and a.week_start_eat=p_week and a.status='succeeded'
      and a.payload_sha256=v_entry#>>'{source_observation,raw_sha256}'
      and c.source_key=v_entry#>>'{source_observation,source_key}'
      and r.source_rank=(v_entry#>>'{source_observation,source_rank}')::integer
      and r.title_observed=v_entry->>'original_title'
      and r.artist_observed=v_entry->>'original_artist';
    if v_match_count<>1 then
      raise exception 'WK100 source observation no longer matches reviewed evidence';
    end if;
    insert into public.wk_chart_entries_v2
      (id,edition_id,rank,track_title,artist_name,canonical_track_id,
       total_score,source_score,source_count,source_payload,
       methodology_version,scoring_policy_version)
    values
      (v_id||'-'||lpad(v_rank::text,3,'0'),v_id,v_rank,
       v_entry->>'original_title',v_entry->>'original_artist',
       v_entry->>'canonical_track_id',
       (v_entry->>'score')::numeric,(v_entry->>'score')::numeric,
       jsonb_array_length(v_entry->'corroboration_refs'),
       jsonb_build_object('wk100_source_review','governed-v1',
         'proposal_sha256',p_proposal_sha256,
         'identity_pending',(v_entry->>'canonical_track_id') is null),
       v_approval.proposal_snapshot->>'methodology_version',
       v_approval.proposal_snapshot->>'methodology_version');
    if v_entry->>'canonical_track_id' is null then
      insert into platform_private.wk100_pending_identity_investigations_v1
        (edition_id,rank,provisional_ref,capture_row_id,attempt_id,
         source_key,original_title,original_artist)
      values
        (v_id,v_rank,v_entry->>'provisional_ref',
         (v_entry#>>'{source_observation,capture_row_id}')::uuid,
         (v_entry#>>'{source_observation,attempt_id}')::uuid,
         v_entry#>>'{source_observation,source_key}',
         v_entry->>'original_title',v_entry->>'original_artist');
    end if;
  end loop;
  if v_rank<>100 or (select count(*) from public.wk_chart_entries_v2
                     where edition_id=v_id)<>100 then
    raise exception 'WK100 atomic stage missing entries';
  end if;
  if (select count(*) from platform_private.wk100_pending_identity_investigations_v1
      where edition_id=v_id) <>
     (select count(*) from jsonb_array_elements(
        v_approval.proposal_snapshot->'observed_entries') x
       where x->>'canonical_track_id' is null) then
    raise exception 'WK100 pending Registry investigation roster incomplete';
  end if;
  insert into platform_private.wk100_governed_staged_editions_v1
    (week_start_eat,approval_id,edition_id,proposal_sha256,staged_by)
    values(p_week,v_approval.id,v_id,p_proposal_sha256,v_actor);
  return v_id;
end;
$$;
revoke execute on function public.wk100_stage_governed_weekly_edition_v1(date,text)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_stage_governed_weekly_edition_v1(date,text)
  to authenticated;


-- Final reviewed PUBLICATION transition. Dedicated privileges + immutable
-- approval + staged entries + transaction-bound grant must ALL agree.
-- Does not invent metadata or change any historical rank/source text.
create function public.wk100_publish_governed_weekly_edition_v1(
  p_week date,p_proposal_sha256 text
) returns text language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid();
  v_review platform_private.wk100_governed_editorial_approvals_v1%rowtype;
  v_stage platform_private.wk100_governed_staged_editions_v1%rowtype;
  v_prior platform_private.wk100_governed_publications_v1%rowtype;
  v_item jsonb;
  v_rank integer:=0;
  v_matching integer;
  v_cutoff timestamptz;
  v_deadline timestamptz;
begin
  if v_actor is null or not public.current_user_has_capability('publish_charts') then
    raise exception using errcode='42501',
      message='WK100 publication requires active human Chart Publisher';
  end if;
  if p_week is null or coalesce(p_proposal_sha256,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'WK100 publication requires approved exact week/digest';
  end if;
  select * into strict v_review from
    platform_private.wk100_governed_editorial_approvals_v1
    where program_id='top100' and week_start_eat=p_week for update;
  select * into strict v_stage from
    platform_private.wk100_governed_staged_editions_v1
    where program_id='top100' and week_start_eat=p_week for update;
  if v_review.id is distinct from v_stage.approval_id
    or v_review.proposal_sha256 is distinct from p_proposal_sha256
    or v_stage.proposal_sha256 is distinct from p_proposal_sha256
    or encode(extensions.digest(v_review.proposal_snapshot::text,'sha256'),'hex')
      is distinct from v_review.proposal_snapshot_sha256 then
    raise exception 'WK100 approval, staging and published evidence diverged';
  end if;

  -- Exact retries are safe; no new publication receipt can be minted.
  select * into v_prior from platform_private.wk100_governed_publications_v1
    where edition_id=v_stage.edition_id;
  if found then
    if v_prior.approved_review_id is distinct from v_review.id
      or v_prior.proposal_sha256 is distinct from p_proposal_sha256
      or not exists(select 1 from public.wk_chart_editions_v2 e
        where e.id=v_stage.edition_id and e.program_id='top100'
          and e.status='published'
          and (select count(*) from public.wk_chart_entries_v2 x
            where x.edition_id=e.id)=100) then
      raise exception 'WK100 publication replay conflicts with frozen release';
    end if;
    return v_stage.edition_id;
  end if;

  v_cutoff:=(v_review.proposal_snapshot->>'cutoff_at_utc')::timestamptz;
  v_deadline:=(v_review.proposal_snapshot->>'deadline_at_utc')::timestamptz;
  if clock_timestamp()<v_cutoff or clock_timestamp()>v_deadline then
    raise exception using errcode='42501',
      message='WK100 unapproved publication time window; visible incident required';
  end if;
  if not exists(select 1 from public.wk_chart_editions_v2 e
    where e.id=v_stage.edition_id and e.program_id='top100'
      and e.status='draft' and e.edition_date=p_week+7
      and e.period_start=p_week and e.period_end=p_week+6
      and e.entry_count=100 and e.chart_size=100
      and e.rule_set_snapshot->>'proposal_sha256'=p_proposal_sha256) then
    raise exception 'WK100 staging Edition is incomplete or altered';
  end if;
  if (select count(*) from public.wk_chart_entries_v2 x
       where x.edition_id=v_stage.edition_id)<>100 then
    raise exception 'WK100 stage has missing or excess rows';
  end if;
  for v_item in
    select value from jsonb_array_elements(v_review.proposal_snapshot->'observed_entries')
  loop
    v_rank:=v_rank+1;
    if v_rank>100 or (v_item->>'rank')::integer<>v_rank then
      raise exception 'WK100 publisher rank sequence changed';
    end if;
    select count(*) into v_matching
    from public.wk_chart_entries_v2 e
    where e.edition_id=v_stage.edition_id
      and e.rank=v_rank
      and e.track_title=v_item->>'original_title'
      and e.artist_name=v_item->>'original_artist'
      and e.canonical_track_id is not distinct from v_item->>'canonical_track_id'
      and e.total_score=(v_item->>'score')::numeric
      and e.source_payload->>'proposal_sha256'=p_proposal_sha256;
    if v_matching<>1 then
      raise exception 'WK100 frozen entry mismatch before publication at rank %',v_rank;
    end if;
  end loop;
  if v_rank<>100 then
    raise exception 'WK100 cannot publish fewer than 100 authenticated ranks';
  end if;
  if (select count(*) from platform_private.wk100_pending_identity_investigations_v1
      where edition_id=v_stage.edition_id) <>
     (select count(*) from jsonb_array_elements(
       v_review.proposal_snapshot->'observed_entries') x
       where x->>'canonical_track_id' is null) then
    raise exception 'WK100 source identity review handoff differs from frozen edition';
  end if;

  -- Only this transaction can satisfy BOTH Chart V2 publication guards.
  -- A rollback retracts both the grant and Edition status update.
  insert into platform_private.wk100_governed_publications_v1
    (approved_review_id,edition_id,proposal_sha256,published_by,authorized_tx)
  values(v_review.id,v_stage.edition_id,p_proposal_sha256,v_actor,txid_current());
  update public.wk_chart_editions_v2
    set status='published',
        published_at=clock_timestamp(),
        published_by=v_actor::text
    where id=v_stage.edition_id and program_id='top100' and status='draft';
  if not found then
    raise exception 'WK100 reviewed publication status transition failed';
  end if;
  return v_stage.edition_id;
end;
$$;
revoke execute on function
  public.wk100_publish_governed_weekly_edition_v1(date,text)
from public,anon,authenticated,service_role;
grant execute on function
  public.wk100_publish_governed_weekly_edition_v1(date,text)
to authenticated;



-- Immutable post-publication identity linkage, separated from the frozen
-- observed rank/text. Resolution requires Registry's own verified provider
-- mapping; this function NEVER writes a Track or rewrites Chart V2 Entries.
create table platform_private.wk100_governed_identity_links_v1 (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null,
  rank integer not null check(rank between 1 and 100),
  provisional_ref text not null,
  canonical_track_id uuid not null references public.registry_tracks(id),
  authority_sha256 text not null check(authority_sha256 ~ '^[a-f0-9]{64}$'),
  linked_by uuid not null,
  linked_at timestamptz not null default clock_timestamp(),
  unique(edition_id,rank),
  unique(provisional_ref)
);
alter table platform_private.wk100_governed_identity_links_v1 enable row level security;
revoke all on platform_private.wk100_governed_identity_links_v1
from public,anon,authenticated,service_role;
create trigger wk100_identity_links_immutable_rows
before update or delete on platform_private.wk100_governed_identity_links_v1
for each row execute function platform_private.wk100_block_editorial_approval_mutation_v1();
create trigger wk100_identity_links_immutable_truncate
before truncate on platform_private.wk100_governed_identity_links_v1
for each statement execute function platform_private.wk100_block_editorial_approval_mutation_v1();

create function public.wk100_link_governed_recording_identity_v1(
  p_edition_id text,p_rank integer,p_track_id uuid,p_authority_sha256 text
) returns uuid language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid();
  v_pending platform_private.wk100_pending_identity_investigations_v1%rowtype;
  v_existing platform_private.wk100_governed_identity_links_v1%rowtype;
  v_approved_count integer;
  v_distinct_count integer;
  v_tracks uuid[];
  v_link_id uuid;
begin
  if v_actor is null or
     not public.current_user_has_capability('manage_registry') or
     not public.current_user_has_capability('manage_charts') then
    raise exception using errcode='42501',
      message='WK100 identity correction requires chart and Registry stewardship';
  end if;
  if p_edition_id is null or p_rank not between 1 and 100 or
     p_track_id is null or coalesce(p_authority_sha256,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'WK100 identity linkage requires exact evidence and recording';
  end if;
  select * into strict v_pending from
    platform_private.wk100_pending_identity_investigations_v1
    where edition_id=p_edition_id and rank=p_rank for update;
  if not exists(
    select 1 from platform_private.wk100_governed_publications_v1 p
    join public.wk_chart_editions_v2 e on e.id=p.edition_id
    join public.wk_chart_entries_v2 x on x.edition_id=e.id
    where p.edition_id=p_edition_id and e.program_id='top100'
      and e.status='published' and x.rank=p_rank
      and x.canonical_track_id is null
      and x.track_title=v_pending.original_title
      and x.artist_name=v_pending.original_artist
  ) then
    raise exception 'WK100 original published provisional recording not found';
  end if;

  -- Respect BOTH accepted link systems used by the existing private reader.
  -- Any conflicting provider->Track assertion keeps identity unresolved.
  select count(*),count(distinct track_id),array_agg(distinct track_id)
    into v_approved_count,v_distinct_count,v_tracks
  from (
    select l.track_id
    from public.wk_chart_capture_rows_v1 r
    join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
    join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
    join public.registry_track_provider_links l
      on l.provider_key=c.provider_key and l.provider_track_id=r.provider_track_id
      and l.match_status='matched'
    where r.id=v_pending.capture_row_id and a.id=v_pending.attempt_id
    union
    select legacy.registry_entity_id
    from public.wk_chart_capture_rows_v1 r
    join public.wk_chart_capture_attempts_v1 a on a.id=r.attempt_id
    join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
    join public.provider_entity_links legacy
      on legacy.provider=c.provider_key
      and legacy.provider_entity_id=r.provider_track_id
      and legacy.registry_entity_type='track'
      and legacy.match_status='confirmed'
    where r.id=v_pending.capture_row_id and a.id=v_pending.attempt_id
  ) verified;
  if v_approved_count=0 or v_distinct_count<>1 or
     v_tracks[1] is distinct from p_track_id or
     not exists(select 1 from public.registry_tracks t
       where t.id=p_track_id and t.status='active') then
    raise exception using errcode='42501',
      message='WK100 recording has no unique current verified Registry identity';
  end if;
  insert into platform_private.wk100_governed_identity_links_v1
    (edition_id,rank,provisional_ref,canonical_track_id,authority_sha256,linked_by)
  values(p_edition_id,p_rank,v_pending.provisional_ref,p_track_id,p_authority_sha256,v_actor)
  on conflict(edition_id,rank) do nothing returning id into v_link_id;
  if v_link_id is null then
    select * into strict v_existing
    from platform_private.wk100_governed_identity_links_v1
    where edition_id=p_edition_id and rank=p_rank;
    if v_existing.provisional_ref<>v_pending.provisional_ref or
       v_existing.canonical_track_id<>p_track_id or
       v_existing.authority_sha256<>p_authority_sha256 then
      raise exception using errcode='23505',
        message='WK100 canonical link conflicts with immutable history';
    end if;
    v_link_id:=v_existing.id;
  end if;
  return v_link_id;
end;
$$;
revoke execute on function
  public.wk100_link_governed_recording_identity_v1(text,integer,uuid,text)
from public,anon,authenticated,service_role;
grant execute on function
  public.wk100_link_governed_recording_identity_v1(text,integer,uuid,text)
to authenticated;

commit;
