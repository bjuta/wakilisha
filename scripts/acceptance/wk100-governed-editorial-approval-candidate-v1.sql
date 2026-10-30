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

  v_start:=v_week::timestamp at time zone 'Africa/Nairobi';
  v_end:=(v_week+7)::timestamp at time zone 'Africa/Nairobi';
  v_cutoff:=(p_proposal->>'cutoff_at_utc')::timestamptz;
  v_deadline:=(p_proposal->>'deadline_at_utc')::timestamptz;
  v_review:=(p_proposal#>>'{editor_review,reviewed_at_utc}')::timestamptz;
  if v_cutoff<v_end or v_deadline<v_cutoff
     or v_deadline>v_end+interval '7 days'
     or v_review<v_cutoff or v_review>v_deadline
     or p_proposal#>>'{editor_review,editor_ref}' is null then
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

commit;
