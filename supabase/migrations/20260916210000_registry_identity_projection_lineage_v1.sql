begin;

-- ============================================================================
-- MIZIZI Slice 2 Gate D — durable Registry identity + projection lineage.
--
-- Principles:
--   * Historical observations are never rewritten to match current identity.
--   * Accepted identity transitions are append-only facts.
--   * Repeated historical repair events remain visible; the resolver follows
--     the latest accepted transition for each source identity.
--   * Ordinary aliases are not silently promoted into identity lineage.
--   * Generic archived status is not silently promoted into retirement.
--   * Current chart identity is a rebuildable projection over historical input,
--     so projection versions are captured separately from observation history.
-- ============================================================================

create table if not exists public.registry_identity_lineage (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  source_entity_id uuid not null,
  transition_type text not null,
  successor_entity_ids uuid[] not null default '{}'::uuid[],
  occurred_at timestamptz not null,
  source_authority text not null,
  source_record_id text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  transition_fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint registry_identity_lineage_entity_type_check
    check (entity_type in ('artist','track','release')),
  constraint registry_identity_lineage_transition_type_check
    check (
      transition_type in (
        'merge',
        'supersede',
        'split',
        'alias_replacement',
        'retired'
      )
    ),
  constraint registry_identity_lineage_successor_cardinality_check
    check (
      (transition_type = 'retired' and cardinality(successor_entity_ids) = 0)
      or
      (
        transition_type in ('merge','supersede','alias_replacement')
        and cardinality(successor_entity_ids) = 1
      )
      or
      (
        transition_type = 'split'
        and cardinality(successor_entity_ids) >= 2
      )
    ),
  constraint registry_identity_lineage_source_not_successor_check
    check (not (source_entity_id = any(successor_entity_ids))),
  constraint registry_identity_lineage_source_authority_check
    check (btrim(source_authority) <> ''),
  constraint registry_identity_lineage_source_record_check
    check (btrim(source_record_id) <> ''),
  constraint registry_identity_lineage_fingerprint_check
    check (transition_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_identity_lineage_authority_record_unique
    unique (source_authority, source_record_id)
);

create index if not exists registry_identity_lineage_source_latest_idx
  on public.registry_identity_lineage (
    entity_type,
    source_entity_id,
    occurred_at desc,
    created_at desc,
    id desc
  );

create index if not exists registry_identity_lineage_successors_gin_idx
  on public.registry_identity_lineage
  using gin (successor_entity_ids);

alter table public.registry_identity_lineage enable row level security;

revoke all on table public.registry_identity_lineage
  from public, anon, authenticated;
grant select on table public.registry_identity_lineage to service_role;

create table if not exists public.registry_identity_projection_lineage (
  id uuid primary key default gen_random_uuid(),
  projection_kind text not null,
  projection_key text not null,
  projection_version bigint not null,
  event_state text not null,
  projection_fingerprint text not null,
  canonical_track_id uuid,
  canonical_release_id uuid,
  canonical_artist_id uuid,
  canonical_state jsonb not null default '{}'::jsonb,
  canonical_state_fingerprint text not null,
  historical_observation_ref jsonb not null default '{}'::jsonb,
  provider_evidence_ref jsonb,
  rebuildable boolean not null default true,
  source_authority text not null,
  recorded_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint registry_identity_projection_kind_check
    check (btrim(projection_kind) <> ''),
  constraint registry_identity_projection_key_check
    check (btrim(projection_key) <> ''),
  constraint registry_identity_projection_version_check
    check (projection_version > 0),
  constraint registry_identity_projection_event_state_check
    check (event_state in ('valid','removed')),
  constraint registry_identity_projection_fingerprint_check
    check (projection_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_identity_projection_state_fingerprint_check
    check (canonical_state_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_identity_projection_source_authority_check
    check (btrim(source_authority) <> ''),
  constraint registry_identity_projection_version_unique
    unique (projection_kind, projection_key, projection_version)
);

create index if not exists registry_identity_projection_latest_idx
  on public.registry_identity_projection_lineage (
    projection_kind,
    projection_key,
    projection_version desc
  );

alter table public.registry_identity_projection_lineage enable row level security;

revoke all on table public.registry_identity_projection_lineage
  from public, anon, authenticated;
grant select on table public.registry_identity_projection_lineage to service_role;

create or replace function platform_private.reject_registry_lineage_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Registry lineage is append-only.';
end
$$;

revoke all on function platform_private.reject_registry_lineage_mutation_v1()
  from public, anon, authenticated;

drop trigger if exists trg_registry_identity_lineage_append_only
  on public.registry_identity_lineage;
create trigger trg_registry_identity_lineage_append_only
before update or delete
on public.registry_identity_lineage
for each row
execute function platform_private.reject_registry_lineage_mutation_v1();

drop trigger if exists trg_registry_identity_projection_lineage_append_only
  on public.registry_identity_projection_lineage;
create trigger trg_registry_identity_projection_lineage_append_only
before update or delete
on public.registry_identity_projection_lineage
for each row
execute function platform_private.reject_registry_lineage_mutation_v1();

create or replace function platform_private.registry_identity_exists_v1(
  p_entity_type text,
  p_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case lower(btrim(coalesce(p_entity_type,'')))
    when 'artist' then exists (
      select 1 from public.registry_artists where id = p_entity_id
    )
    when 'track' then exists (
      select 1 from public.registry_tracks where id = p_entity_id
    )
    when 'release' then exists (
      select 1 from public.registry_releases where id = p_entity_id
    )
    else false
  end
$$;

revoke all on function
  platform_private.registry_identity_exists_v1(text, uuid)
  from public, anon, authenticated;

create or replace function platform_private.registry_uuid_or_null_v1(
  p_value text
)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if nullif(btrim(coalesce(p_value,'')), '') is null then
    return null;
  end if;

  return btrim(p_value)::uuid;
exception
  when invalid_text_representation then
    return null;
end
$$;

revoke all on function platform_private.registry_uuid_or_null_v1(text)
  from public, anon, authenticated;

create or replace function platform_private.record_registry_identity_lineage_v1(
  p_entity_type text,
  p_source_entity_id uuid,
  p_transition_type text,
  p_successor_entity_ids uuid[],
  p_occurred_at timestamptz,
  p_source_authority text,
  p_source_record_id text,
  p_source_snapshot jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_transition_type text := lower(btrim(coalesce(p_transition_type,'')));
  v_successors uuid[];
  v_payload jsonb;
  v_fingerprint text;
  v_existing public.registry_identity_lineage%rowtype;
  v_id uuid;
begin
  if v_entity_type not in ('artist','track','release') then
    raise exception using errcode='22023',
      message='Unsupported Registry lineage entity type.';
  end if;

  if p_source_entity_id is null then
    raise exception using errcode='22023',
      message='Registry lineage source entity id is required.';
  end if;

  if v_transition_type not in (
    'merge',
    'supersede',
    'split',
    'alias_replacement',
    'retired'
  ) then
    raise exception using errcode='22023',
      message='Unsupported Registry lineage transition type.';
  end if;

  if p_occurred_at is null
     or nullif(btrim(coalesce(p_source_authority,'')), '') is null
     or nullif(btrim(coalesce(p_source_record_id,'')), '') is null
  then
    raise exception using errcode='22023',
      message='Registry lineage provenance is required.';
  end if;

  select coalesce(array_agg(x order by x), '{}'::uuid[])
  into v_successors
  from (
    select distinct successor_id as x
    from unnest(coalesce(p_successor_entity_ids, '{}'::uuid[]))
      as successor_id
    where successor_id is not null
  ) normalized;

  if v_transition_type = 'retired'
     and cardinality(v_successors) <> 0
  then
    raise exception using errcode='22023',
      message='Retired identity lineage cannot have a successor.';
  end if;

  if v_transition_type in ('merge','supersede','alias_replacement')
     and cardinality(v_successors) <> 1
  then
    raise exception using errcode='22023',
      message='This identity transition requires exactly one successor.';
  end if;

  if v_transition_type = 'split'
     and cardinality(v_successors) < 2
  then
    raise exception using errcode='22023',
      message='Split identity lineage requires at least two successors.';
  end if;

  if p_source_entity_id = any(v_successors) then
    raise exception using errcode='22023',
      message='Registry identity cannot succeed itself.';
  end if;

  v_payload := jsonb_build_object(
    'entity_type', v_entity_type,
    'source_entity_id', p_source_entity_id,
    'transition_type', v_transition_type,
    'successor_entity_ids', to_jsonb(v_successors),
    'occurred_at_epoch', extract(epoch from p_occurred_at),
    'source_authority', btrim(p_source_authority),
    'source_record_id', btrim(p_source_record_id),
    'source_snapshot', coalesce(p_source_snapshot, '{}'::jsonb),
    'metadata', coalesce(p_metadata, '{}'::jsonb)
  );

  v_fingerprint := encode(
    extensions.digest(v_payload::text, 'sha256'),
    'hex'
  );

  select *
  into v_existing
  from public.registry_identity_lineage
  where source_authority = btrim(p_source_authority)
    and source_record_id = btrim(p_source_record_id)
  limit 1;

  if found then
    if v_existing.transition_fingerprint <> v_fingerprint then
      raise exception using errcode='23505',
        message='Registry identity lineage replay drift.';
    end if;

    return v_existing.id;
  end if;

  insert into public.registry_identity_lineage (
    entity_type,
    source_entity_id,
    transition_type,
    successor_entity_ids,
    occurred_at,
    source_authority,
    source_record_id,
    source_snapshot,
    transition_fingerprint,
    metadata
  )
  values (
    v_entity_type,
    p_source_entity_id,
    v_transition_type,
    v_successors,
    p_occurred_at,
    btrim(p_source_authority),
    btrim(p_source_record_id),
    coalesce(p_source_snapshot, '{}'::jsonb),
    v_fingerprint,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function
  platform_private.record_registry_identity_lineage_v1(
    text, uuid, text, uuid[], timestamptz, text, text, jsonb, jsonb
  )
  from public, anon, authenticated;

create or replace function public.resolve_registry_identity_lineage_v1(
  p_entity_type text,
  p_entity_id uuid,
  p_max_depth integer default 16
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_max_depth integer := least(greatest(coalesce(p_max_depth,16),1),64);
  v_result jsonb;
begin
  if v_entity_type not in ('artist','track','release')
     or p_entity_id is null
  then
    raise exception using errcode='22023',
      message='Valid Registry entity type and id are required.';
  end if;

  with recursive latest as (
    select distinct on (l.entity_type, l.source_entity_id)
      l.*
    from public.registry_identity_lineage l
    where l.entity_type = v_entity_type
    order by
      l.entity_type,
      l.source_entity_id,
      l.occurred_at desc,
      l.created_at desc,
      l.id desc
  ),
  walk as (
    select
      p_entity_id as entity_id,
      array[p_entity_id]::uuid[] as path,
      0::integer as depth,
      false as cycle
    union all
    select
      successor.successor_id,
      w.path || successor.successor_id,
      w.depth + 1,
      successor.successor_id = any(w.path)
    from walk w
    join latest l
      on l.source_entity_id = w.entity_id
    cross join lateral unnest(l.successor_entity_ids)
      as successor(successor_id)
    where l.transition_type <> 'retired'
      and cardinality(l.successor_entity_ids) > 0
      and w.depth < v_max_depth
      and not w.cycle
  ),
  annotated as (
    select
      w.entity_id,
      w.path,
      w.depth,
      w.cycle,
      l.transition_type,
      l.successor_entity_ids,
      platform_private.registry_identity_exists_v1(
        v_entity_type,
        w.entity_id
      ) as entity_exists
    from walk w
    left join latest l
      on l.source_entity_id = w.entity_id
  ),
  terminal as (
    select distinct
      entity_id,
      entity_exists
    from annotated
    where transition_type is null
  ),
  stats as (
    select
      (select transition_type
       from latest
       where source_entity_id = p_entity_id
       limit 1) as first_transition_type,
      coalesce(max(depth),0) as lineage_depth,
      count(*) filter (where cycle) as cycle_count,
      count(*) filter (
        where depth >= v_max_depth
          and transition_type is not null
          and transition_type <> 'retired'
          and cardinality(successor_entity_ids) > 0
          and not cycle
      ) as max_depth_count,
      count(*) filter (where transition_type = 'retired')
        as retired_branch_count,
      count(*) filter (
        where cardinality(successor_entity_ids) > 1
      ) as branching_count
    from annotated
  ),
  terminal_stats as (
    select
      count(*) as terminal_count,
      count(*) filter (where entity_exists) as current_count,
      count(*) filter (where not entity_exists) as missing_count,
      coalesce(
        jsonb_agg(entity_id::text order by entity_id::text),
        '[]'::jsonb
      ) as terminal_ids,
      coalesce(
        jsonb_agg(entity_id::text order by entity_id::text)
          filter (where entity_exists),
        '[]'::jsonb
      ) as current_ids,
      coalesce(
        jsonb_agg(entity_id::text order by entity_id::text)
          filter (where not entity_exists),
        '[]'::jsonb
      ) as missing_ids
    from terminal
  )
  select jsonb_build_object(
    'entity_type', v_entity_type,
    'input_entity_id', p_entity_id,
    'resolution_status',
      case
        when s.cycle_count > 0 then 'cycle'
        when s.max_depth_count > 0 then 'max_depth'
        when s.first_transition_type is null
             and t.current_count = 1 then 'current'
        when s.first_transition_type is null
             and t.current_count = 0 then 'unresolved'
        when t.missing_count > 0 then 'unresolved'
        when t.current_count = 0
             and s.retired_branch_count > 0 then 'retired'
        when s.branching_count > 0 then 'split'
        when t.current_count = 1 then 'successor'
        when t.current_count > 1 then 'split'
        else 'unresolved'
      end,
    'first_transition_type', s.first_transition_type,
    'current_entity_ids', t.current_ids,
    'terminal_entity_ids', t.terminal_ids,
    'missing_terminal_entity_ids', t.missing_ids,
    'retired_branch_count', s.retired_branch_count,
    'lineage_depth', s.lineage_depth
  )
  into v_result
  from stats s
  cross join terminal_stats t;

  return v_result;
end
$$;

revoke all on function
  public.resolve_registry_identity_lineage_v1(text, uuid, integer)
  from public, anon;
grant execute on function
  public.resolve_registry_identity_lineage_v1(text, uuid, integer)
  to authenticated, service_role;

create or replace function public.admin_record_registry_identity_transition_v1(
  p_entity_type text,
  p_source_entity_id uuid,
  p_transition_type text,
  p_successor_entity_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, platform_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_transition_type text := lower(btrim(coalesce(p_transition_type,'')));
  v_snapshot jsonb := '{}'::jsonb;
  v_lineage_id uuid;
  v_record_id text := 'manual:' || gen_random_uuid()::text;
  v_successors uuid[];
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if v_entity_type not in ('artist','track','release')
     or p_source_entity_id is null
     or v_transition_type not in ('alias_replacement','retired')
     or nullif(btrim(coalesce(p_note,'')), '') is null
  then
    raise exception using errcode='22023',
      message='Valid explicit identity transition and rationale are required.';
  end if;

  if v_transition_type = 'alias_replacement' then
    if p_successor_entity_id is null
       or p_successor_entity_id = p_source_entity_id
       or not platform_private.registry_identity_exists_v1(
         v_entity_type,
         p_successor_entity_id
       )
    then
      raise exception using errcode='22023',
        message='Alias replacement requires a different current Registry successor.';
    end if;

    v_successors := array[p_successor_entity_id];
  else
    if p_successor_entity_id is not null then
      raise exception using errcode='22023',
        message='Retirement without replacement cannot name a successor.';
    end if;

    v_successors := '{}'::uuid[];
  end if;

  if v_entity_type = 'artist' then
    select coalesce(to_jsonb(a), '{}'::jsonb)
    into v_snapshot
    from public.registry_artists a
    where a.id = p_source_entity_id;
  elsif v_entity_type = 'track' then
    select coalesce(to_jsonb(t), '{}'::jsonb)
    into v_snapshot
    from public.registry_tracks t
    where t.id = p_source_entity_id;
  else
    select coalesce(to_jsonb(r), '{}'::jsonb)
    into v_snapshot
    from public.registry_releases r
    where r.id = p_source_entity_id;
  end if;

  v_snapshot := coalesce(
    v_snapshot,
    jsonb_build_object('source_row_present', false)
  );

  v_lineage_id :=
    platform_private.record_registry_identity_lineage_v1(
      v_entity_type,
      p_source_entity_id,
      v_transition_type,
      v_successors,
      now(),
      'admin_record_registry_identity_transition_v1',
      v_record_id,
      v_snapshot,
      jsonb_build_object(
        'note', btrim(p_note),
        'actor_id', v_user_id
      )
    );

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'identity_lineage_recorded',
    'registry_' || v_entity_type,
    p_source_entity_id,
    jsonb_build_object(
      'source_entity_id', p_source_entity_id,
      'source_snapshot', v_snapshot
    ),
    jsonb_build_object(
      'transition_type', v_transition_type,
      'successor_entity_ids', to_jsonb(v_successors),
      'lineage_id', v_lineage_id
    ),
    jsonb_build_object(
      'authority', 'admin_record_registry_identity_transition_v1',
      'note', btrim(p_note)
    )
  );

  return (
    select to_jsonb(l)
    from public.registry_identity_lineage l
    where l.id = v_lineage_id
  );
end
$$;

revoke all on function
  public.admin_record_registry_identity_transition_v1(
    text, uuid, text, uuid, text
  )
  from public, anon;
grant execute on function
  public.admin_record_registry_identity_transition_v1(
    text, uuid, text, uuid, text
  )
  to authenticated, service_role;

create or replace function
  platform_private.capture_registry_artist_resolution_lineage_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_successor uuid;
begin
  if new.action <> 'artist_merge'
     or new.status <> 'success'
     or new.source_artist_id is null
  then
    return new;
  end if;

  v_successor :=
    platform_private.registry_uuid_or_null_v1(
      new.result ->> 'canonicalArtistId'
    );

  if v_successor is null then
    v_successor :=
      platform_private.registry_uuid_or_null_v1(
        new.replacement_artists #>> '{0,artist_id}'
      );
  end if;

  if v_successor is null then
    raise exception using errcode='23514',
      message='Artist merge event is missing a canonical successor.';
  end if;

  perform platform_private.record_registry_identity_lineage_v1(
    'artist',
    new.source_artist_id,
    'merge',
    array[v_successor],
    new.created_at,
    'registry_artist_resolution_events',
    new.id::text,
    new.source_snapshot,
    jsonb_build_object(
      'action', new.action,
      'status', new.status,
      'note', new.note,
      'result', new.result
    )
  );

  return new;
end
$$;

revoke all on function
  platform_private.capture_registry_artist_resolution_lineage_v1()
  from public, anon, authenticated;

create or replace function
  platform_private.capture_registry_track_resolution_lineage_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_idx integer;
  v_source uuid;
  v_source_slug text;
begin
  if new.action <> 'track_duplicate_repair'
     or new.status <> 'success'
     or new.canonical_track_id is null
  then
    return new;
  end if;

  if coalesce(array_length(new.duplicate_track_ids,1),0) = 0 then
    return new;
  end if;

  for v_idx in 1..array_length(new.duplicate_track_ids,1)
  loop
    v_source := new.duplicate_track_ids[v_idx];
    v_source_slug := case
      when coalesce(array_length(new.duplicate_track_slugs,1),0) >= v_idx
      then new.duplicate_track_slugs[v_idx]
      else null
    end;

    if v_source is not null then
      perform platform_private.record_registry_identity_lineage_v1(
        'track',
        v_source,
        'supersede',
        array[new.canonical_track_id],
        new.created_at,
        'registry_track_resolution_events',
        new.id::text || ':' || v_source::text,
        jsonb_build_object(
          'source_track_id', v_source,
          'source_track_slug', v_source_slug
        ),
        jsonb_build_object(
          'action', new.action,
          'status', new.status,
          'confidence_bucket', new.confidence_bucket,
          'note', new.note,
          'result', new.result
        )
      );
    end if;
  end loop;

  return new;
end
$$;

revoke all on function
  platform_private.capture_registry_track_resolution_lineage_v1()
  from public, anon, authenticated;

create or replace function
  platform_private.capture_registry_artist_split_lineage_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_successors uuid[];
begin
  if new.action <> 'artist_credit_decoupled'
     or new.entity_type <> 'registry_artist'
     or new.entity_id is null
  then
    return new;
  end if;

  select coalesce(array_agg(x order by x), '{}'::uuid[])
  into v_successors
  from (
    select distinct value::uuid as x
    from jsonb_array_elements_text(
      coalesce(
        new.after_value -> 'replacement_artist_ids',
        '[]'::jsonb
      )
    ) as value
  ) normalized;

  if cardinality(v_successors) < 2 then
    raise exception using errcode='23514',
      message='Artist split audit event is missing replacement identities.';
  end if;

  perform platform_private.record_registry_identity_lineage_v1(
    'artist',
    new.entity_id,
    'split',
    v_successors,
    new.created_at,
    'registry_audit_log:artist_credit_decoupled',
    new.id::text,
    new.before_value,
    jsonb_build_object(
      'after_value', new.after_value,
      'audit_metadata', new.metadata
    )
  );

  return new;
end
$$;

revoke all on function
  platform_private.capture_registry_artist_split_lineage_v1()
  from public, anon, authenticated;

drop trigger if exists trg_capture_registry_artist_resolution_lineage_v1
  on public.registry_artist_resolution_events;
create trigger trg_capture_registry_artist_resolution_lineage_v1
after insert
on public.registry_artist_resolution_events
for each row
execute function
  platform_private.capture_registry_artist_resolution_lineage_v1();

drop trigger if exists trg_capture_registry_track_resolution_lineage_v1
  on public.registry_track_resolution_events;
create trigger trg_capture_registry_track_resolution_lineage_v1
after insert
on public.registry_track_resolution_events
for each row
execute function
  platform_private.capture_registry_track_resolution_lineage_v1();

drop trigger if exists trg_capture_registry_artist_split_lineage_v1
  on public.registry_audit_log;
create trigger trg_capture_registry_artist_split_lineage_v1
after insert
on public.registry_audit_log
for each row
execute function
  platform_private.capture_registry_artist_split_lineage_v1();

-- --------------------------------------------------------------------------
-- Historical backfill from accepted identity-resolution authorities.
-- Ordinary registry_artist_aliases are intentionally NOT backfilled.
-- --------------------------------------------------------------------------

do $gate_d_artist_merge_backfill$
declare
  r record;
  v_successor uuid;
begin
  for r in
    select *
    from public.registry_artist_resolution_events
    where action = 'artist_merge'
      and status = 'success'
    order by created_at, id
  loop
    v_successor :=
      platform_private.registry_uuid_or_null_v1(
        r.result ->> 'canonicalArtistId'
      );

    if v_successor is null then
      v_successor :=
        platform_private.registry_uuid_or_null_v1(
          r.replacement_artists #>> '{0,artist_id}'
        );
    end if;

    if v_successor is null then
      raise exception 'Gate D artist merge backfill missing successor: %', r.id;
    end if;

    perform platform_private.record_registry_identity_lineage_v1(
      'artist',
      r.source_artist_id,
      'merge',
      array[v_successor],
      r.created_at,
      'registry_artist_resolution_events',
      r.id::text,
      r.source_snapshot,
      jsonb_build_object(
        'action', r.action,
        'status', r.status,
        'note', r.note,
        'result', r.result
      )
    );
  end loop;
end
$gate_d_artist_merge_backfill$;

do $gate_d_track_resolution_backfill$
declare
  r record;
  v_idx integer;
  v_source uuid;
  v_source_slug text;
begin
  for r in
    select *
    from public.registry_track_resolution_events
    where action = 'track_duplicate_repair'
      and status = 'success'
    order by created_at, id
  loop
    if coalesce(array_length(r.duplicate_track_ids,1),0) = 0 then
      continue;
    end if;

    for v_idx in 1..array_length(r.duplicate_track_ids,1)
    loop
      v_source := r.duplicate_track_ids[v_idx];
      v_source_slug := case
        when coalesce(array_length(r.duplicate_track_slugs,1),0) >= v_idx
        then r.duplicate_track_slugs[v_idx]
        else null
      end;

      if v_source is not null then
        perform platform_private.record_registry_identity_lineage_v1(
          'track',
          v_source,
          'supersede',
          array[r.canonical_track_id],
          r.created_at,
          'registry_track_resolution_events',
          r.id::text || ':' || v_source::text,
          jsonb_build_object(
            'source_track_id', v_source,
            'source_track_slug', v_source_slug
          ),
          jsonb_build_object(
            'action', r.action,
            'status', r.status,
            'confidence_bucket', r.confidence_bucket,
            'note', r.note,
            'result', r.result
          )
        );
      end if;
    end loop;
  end loop;
end
$gate_d_track_resolution_backfill$;

do $gate_d_artist_split_backfill$
declare
  r record;
  v_successors uuid[];
begin
  for r in
    select *
    from public.registry_audit_log
    where action = 'artist_credit_decoupled'
      and entity_type = 'registry_artist'
      and entity_id is not null
    order by created_at, id
  loop
    select coalesce(array_agg(x order by x), '{}'::uuid[])
    into v_successors
    from (
      select distinct value::uuid as x
      from jsonb_array_elements_text(
        coalesce(
          r.after_value -> 'replacement_artist_ids',
          '[]'::jsonb
        )
      ) as value
    ) normalized;

    if cardinality(v_successors) < 2 then
      raise exception 'Gate D artist split backfill missing replacements: %', r.id;
    end if;

    perform platform_private.record_registry_identity_lineage_v1(
      'artist',
      r.entity_id,
      'split',
      v_successors,
      r.created_at,
      'registry_audit_log:artist_credit_decoupled',
      r.id::text,
      r.before_value,
      jsonb_build_object(
        'after_value', r.after_value,
        'audit_metadata', r.metadata
      )
    );
  end loop;
end
$gate_d_artist_split_backfill$;

create or replace function
  platform_private.record_registry_identity_projection_v1(
    p_projection_kind text,
    p_projection_key text,
    p_event_state text,
    p_projection_snapshot jsonb,
    p_recorded_at timestamptz,
    p_source_authority text
  )
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_kind text := btrim(coalesce(p_projection_kind,''));
  v_key text := btrim(coalesce(p_projection_key,''));
  v_event_state text := lower(btrim(coalesce(p_event_state,'')));
  v_snapshot jsonb := coalesce(p_projection_snapshot, '{}'::jsonb);
  v_track_id uuid;
  v_release_id uuid;
  v_artist_id uuid;
  v_canonical_state jsonb;
  v_canonical_state_fingerprint text;
  v_observation_ref jsonb;
  v_provider_ref jsonb;
  v_projection_payload jsonb;
  v_projection_fingerprint text;
  v_version bigint;
  v_id uuid;
begin
  if v_kind <> 'wk_chart_entry_v2'
     or nullif(v_key,'') is null
     or v_event_state not in ('valid','removed')
     or p_recorded_at is null
     or nullif(btrim(coalesce(p_source_authority,'')), '') is null
  then
    raise exception using errcode='22023',
      message='Invalid Registry identity projection lineage input.';
  end if;

  v_track_id :=
    platform_private.registry_uuid_or_null_v1(
      v_snapshot ->> 'canonical_track_id'
    );
  v_release_id :=
    platform_private.registry_uuid_or_null_v1(
      v_snapshot ->> 'canonical_release_id'
    );
  v_artist_id :=
    platform_private.registry_uuid_or_null_v1(
      v_snapshot ->> 'canonical_artist_id'
    );

  v_canonical_state := jsonb_strip_nulls(
    jsonb_build_object(
      'track',
        case
          when v_track_id is null then null
          else jsonb_build_object(
            'referenced_id', v_track_id,
            'registry_row', (
              select jsonb_build_object(
                'id', t.id,
                'slug', t.slug,
                'status', t.status,
                'updated_at', t.updated_at
              )
              from public.registry_tracks t
              where t.id = v_track_id
            ),
            'lineage_resolution',
              public.resolve_registry_identity_lineage_v1(
                'track',
                v_track_id,
                16
              )
          )
        end,
      'release',
        case
          when v_release_id is null then null
          else jsonb_build_object(
            'referenced_id', v_release_id,
            'registry_row', (
              select jsonb_build_object(
                'id', r.id,
                'slug', r.slug,
                'status', r.status,
                'updated_at', r.updated_at
              )
              from public.registry_releases r
              where r.id = v_release_id
            ),
            'lineage_resolution',
              public.resolve_registry_identity_lineage_v1(
                'release',
                v_release_id,
                16
              )
          )
        end,
      'artist',
        case
          when v_artist_id is null then null
          else jsonb_build_object(
            'referenced_id', v_artist_id,
            'registry_row', (
              select jsonb_build_object(
                'id', a.id,
                'slug', a.slug,
                'status', a.status,
                'updated_at', a.updated_at
              )
              from public.registry_artists a
              where a.id = v_artist_id
            ),
            'lineage_resolution',
              public.resolve_registry_identity_lineage_v1(
                'artist',
                v_artist_id,
                16
              )
          )
        end
    )
  );

  v_canonical_state_fingerprint := encode(
    extensions.digest(v_canonical_state::text, 'sha256'),
    'hex'
  );

  v_observation_ref := jsonb_build_object(
    'edition_id', v_snapshot ->> 'edition_id',
    'track_title', v_snapshot ->> 'track_title',
    'artist_name', v_snapshot ->> 'artist_name',
    'source_urls_seen', coalesce(
      v_snapshot -> 'source_urls_seen',
      '[]'::jsonb
    ),
    'observation_fingerprint', encode(
      extensions.digest(
        jsonb_build_object(
          'edition_id', v_snapshot ->> 'edition_id',
          'track_title', v_snapshot ->> 'track_title',
          'artist_name', v_snapshot ->> 'artist_name',
          'source_urls_seen', coalesce(
            v_snapshot -> 'source_urls_seen',
            '[]'::jsonb
          ),
          'occurrence_count', v_snapshot -> 'occurrence_count'
        )::text,
        'sha256'
      ),
      'hex'
    )
  );

  v_provider_ref := case
    when coalesce(v_snapshot -> 'source_payload', '{}'::jsonb) = '{}'::jsonb
    then null
    else jsonb_build_object(
      'kind', 'chart_source_payload',
      'source_payload_sha256', encode(
        extensions.digest(
          (v_snapshot -> 'source_payload')::text,
          'sha256'
        ),
        'hex'
      )
    )
  end;

  v_projection_payload := jsonb_build_object(
    'projection_kind', v_kind,
    'projection_key', v_key,
    'event_state', v_event_state,
    'canonical_track_id', v_track_id,
    'canonical_release_id', v_release_id,
    'canonical_artist_id', v_artist_id,
    'track_slug', v_snapshot ->> 'track_slug',
    'artist_slug', v_snapshot ->> 'artist_slug',
    'scoring_policy_version', v_snapshot ->> 'scoring_policy_version',
    'methodology_version', v_snapshot ->> 'methodology_version',
    'eligibility_policy_version', v_snapshot ->> 'eligibility_policy_version',
    'canonical_state_fingerprint', v_canonical_state_fingerprint,
    'historical_observation_ref', v_observation_ref,
    'provider_evidence_ref', v_provider_ref
  );

  v_projection_fingerprint := encode(
    extensions.digest(v_projection_payload::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_kind || ':' || v_key, 0)
  );

  select coalesce(max(projection_version),0) + 1
  into v_version
  from public.registry_identity_projection_lineage
  where projection_kind = v_kind
    and projection_key = v_key;

  insert into public.registry_identity_projection_lineage (
    projection_kind,
    projection_key,
    projection_version,
    event_state,
    projection_fingerprint,
    canonical_track_id,
    canonical_release_id,
    canonical_artist_id,
    canonical_state,
    canonical_state_fingerprint,
    historical_observation_ref,
    provider_evidence_ref,
    rebuildable,
    source_authority,
    recorded_at,
    metadata
  )
  values (
    v_kind,
    v_key,
    v_version,
    v_event_state,
    v_projection_fingerprint,
    v_track_id,
    v_release_id,
    v_artist_id,
    v_canonical_state,
    v_canonical_state_fingerprint,
    v_observation_ref,
    v_provider_ref,
    true,
    btrim(p_source_authority),
    p_recorded_at,
    jsonb_build_object(
      'track_slug', v_snapshot ->> 'track_slug',
      'artist_slug', v_snapshot ->> 'artist_slug',
      'raw_canonical_track_id', v_snapshot ->> 'canonical_track_id',
      'raw_canonical_release_id', v_snapshot ->> 'canonical_release_id',
      'raw_canonical_artist_id', v_snapshot ->> 'canonical_artist_id'
    )
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function
  platform_private.record_registry_identity_projection_v1(
    text, text, text, jsonb, timestamptz, text
  )
  from public, anon, authenticated;

create or replace function
  platform_private.capture_wk_chart_identity_projection_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_snapshot jsonb;
  v_state text;
  v_key text;
  v_recorded_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_snapshot := to_jsonb(old);
    v_state := 'removed';
    v_key := old.id;
    v_recorded_at := now();
  else
    v_snapshot := to_jsonb(new);
    v_state := 'valid';
    v_key := new.id;
    v_recorded_at := coalesce(new.updated_at, now());
  end if;

  perform platform_private.record_registry_identity_projection_v1(
    'wk_chart_entry_v2',
    v_key,
    v_state,
    v_snapshot,
    v_recorded_at,
    'wk_chart_entries_v2_identity_trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

revoke all on function
  platform_private.capture_wk_chart_identity_projection_v1()
  from public, anon, authenticated;

drop trigger if exists trg_capture_wk_chart_identity_projection_insert_v1
  on public.wk_chart_entries_v2;
create trigger trg_capture_wk_chart_identity_projection_insert_v1
after insert
on public.wk_chart_entries_v2
for each row
execute function
  platform_private.capture_wk_chart_identity_projection_v1();

drop trigger if exists trg_capture_wk_chart_identity_projection_update_v1
  on public.wk_chart_entries_v2;
create trigger trg_capture_wk_chart_identity_projection_update_v1
after update of
  canonical_track_id,
  canonical_release_id,
  canonical_artist_id,
  track_slug,
  artist_slug
on public.wk_chart_entries_v2
for each row
when (
  old.canonical_track_id is distinct from new.canonical_track_id
  or old.canonical_release_id is distinct from new.canonical_release_id
  or old.canonical_artist_id is distinct from new.canonical_artist_id
  or old.track_slug is distinct from new.track_slug
  or old.artist_slug is distinct from new.artist_slug
)
execute function
  platform_private.capture_wk_chart_identity_projection_v1();

drop trigger if exists trg_capture_wk_chart_identity_projection_delete_v1
  on public.wk_chart_entries_v2;
create trigger trg_capture_wk_chart_identity_projection_delete_v1
after delete
on public.wk_chart_entries_v2
for each row
execute function
  platform_private.capture_wk_chart_identity_projection_v1();

do $gate_d_chart_projection_backfill$
declare
  r public.wk_chart_entries_v2%rowtype;
begin
  for r in
    select *
    from public.wk_chart_entries_v2
    order by id
  loop
    perform platform_private.record_registry_identity_projection_v1(
      'wk_chart_entry_v2',
      r.id,
      'valid',
      to_jsonb(r),
      coalesce(r.updated_at, r.created_at, now()),
      'gate_d_backfill:wk_chart_entries_v2'
    );
  end loop;
end
$gate_d_chart_projection_backfill$;

create or replace view public.registry_identity_projection_lineage_status_v1
as
select
  ranked.id,
  ranked.projection_kind,
  ranked.projection_key,
  ranked.projection_version,
  ranked.event_state,
  case
    when ranked.version_rank = 1
         and ranked.event_state = 'valid'
    then 'valid'
    else 'stale'
  end as projection_state,
  ranked.projection_fingerprint,
  ranked.canonical_track_id,
  ranked.canonical_release_id,
  ranked.canonical_artist_id,
  ranked.canonical_state,
  ranked.canonical_state_fingerprint,
  ranked.historical_observation_ref,
  ranked.provider_evidence_ref,
  ranked.rebuildable,
  ranked.source_authority,
  ranked.recorded_at,
  ranked.metadata,
  ranked.created_at
from (
  select
    l.*,
    row_number() over (
      partition by l.projection_kind, l.projection_key
      order by l.projection_version desc, l.id desc
    ) as version_rank
  from public.registry_identity_projection_lineage l
) ranked;

revoke all on table public.registry_identity_projection_lineage_status_v1
  from public, anon, authenticated;
grant select on table public.registry_identity_projection_lineage_status_v1
  to service_role;

commit;
