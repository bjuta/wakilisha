begin;

-- MIZIZI Slice 2 / Gate C
-- Converge the remaining core-music legacy relationship observations onto
-- typed Registry relationship authority while preserving the old rows as
-- immutable historical Institute evidence.
--
-- This migration intentionally does NOT drop the broader cultural graph.

do $$
declare
  v_count bigint;
begin
  -- Exact historical shell -> canonical Registry mapping.
  -- Any drift or ambiguity fails closed.

  select count(*)
  into v_count
  from public.cultural_entities ce
  join public.registry_artists ra
    on ra.id = 'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
   and ra.slug = 'mejja'
  where ce.id = 'a9d48d47-73f2-40e0-ab4d-95b52ac13ff4'::uuid
    and ce.entity_type = 'artist'
    and ce.slug = 'mejja'
    and ce.source_table = 'institute_smoke_seed'
    and ce.source_id = 'artist:mejja';

  if v_count <> 1 then
    raise exception 'Gate C exact Mejja legacy-to-Registry mapping drift';
  end if;

  select count(*)
  into v_count
  from public.cultural_entities ce
  join public.registry_artists ra
    on ra.id = '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
   and ra.slug = 'fik-fameica'
  where ce.id = '1876ae6d-7952-4d1c-823f-8fc91c2bed42'::uuid
    and ce.entity_type = 'artist'
    and ce.slug = 'fik-fameica'
    and ce.source_table = 'institute_smoke_seed'
    and ce.source_id = 'artist:fik-fameica';

  if v_count <> 1 then
    raise exception 'Gate C exact Fik Fameica legacy-to-Registry mapping drift';
  end if;

  select count(*)
  into v_count
  from public.cultural_entities ce
  join public.registry_tracks rt
    on rt.id = '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
   and rt.slug = 'siaka'
  where ce.id = '66e8d211-8472-4942-9716-d5864eacd8d3'::uuid
    and ce.entity_type = 'track'
    and ce.slug = 'siaka'
    and ce.source_table = 'institute_smoke_seed'
    and ce.source_id = 'track:siaka';

  if v_count <> 1 then
    raise exception 'Gate C exact Siaka legacy-to-Registry mapping drift';
  end if;

  select count(*)
  into v_count
  from public.cultural_entities ce
  join public.registry_releases rr
    on rr.id = 'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
   and rr.slug = 'mtoto-wa-khadija'
  where ce.id = '5dc336ee-3a12-4763-be7b-cf1fed1d54b0'::uuid
    and ce.entity_type = 'release'
    and ce.slug = 'mtoto-wa-khadija'
    and ce.source_table = 'institute_smoke_seed'
    and ce.source_id = 'release:mtoto-wa-khadija';

  if v_count <> 1 then
    raise exception 'Gate C exact Mtoto wa Khadija legacy-to-Registry mapping drift';
  end if;

  -- Refuse an already-populated conflicting canonical pointer.
  if exists (
    select 1
    from public.cultural_entities
    where id = 'a9d48d47-73f2-40e0-ab4d-95b52ac13ff4'::uuid
      and canonical_source_id is not null
      and (
        canonical_source_table is distinct from 'registry_artists'
        or canonical_source_id is distinct from
          'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
      )
  ) then
    raise exception 'Gate C conflicting Mejja canonical pointer';
  end if;

  if exists (
    select 1
    from public.cultural_entities
    where id = '1876ae6d-7952-4d1c-823f-8fc91c2bed42'::uuid
      and canonical_source_id is not null
      and (
        canonical_source_table is distinct from 'registry_artists'
        or canonical_source_id is distinct from
          '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
      )
  ) then
    raise exception 'Gate C conflicting Fik Fameica canonical pointer';
  end if;

  if exists (
    select 1
    from public.cultural_entities
    where id = '66e8d211-8472-4942-9716-d5864eacd8d3'::uuid
      and canonical_source_id is not null
      and (
        canonical_source_table is distinct from 'registry_tracks'
        or canonical_source_id is distinct from
          '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
      )
  ) then
    raise exception 'Gate C conflicting Siaka canonical pointer';
  end if;

  if exists (
    select 1
    from public.cultural_entities
    where id = '5dc336ee-3a12-4763-be7b-cf1fed1d54b0'::uuid
      and canonical_source_id is not null
      and (
        canonical_source_table is distinct from 'registry_releases'
        or canonical_source_id is distinct from
          'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
      )
  ) then
    raise exception 'Gate C conflicting Mtoto wa Khadija canonical pointer';
  end if;

  update public.cultural_entities
  set
    canonical_source_table = 'registry_artists',
    canonical_source_id =
      'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
  where id = 'a9d48d47-73f2-40e0-ab4d-95b52ac13ff4'::uuid
    and (
      canonical_source_table is distinct from 'registry_artists'
      or canonical_source_id is distinct from
        'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
    );

  update public.cultural_entities
  set
    canonical_source_table = 'registry_artists',
    canonical_source_id =
      '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
  where id = '1876ae6d-7952-4d1c-823f-8fc91c2bed42'::uuid
    and (
      canonical_source_table is distinct from 'registry_artists'
      or canonical_source_id is distinct from
        '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
    );

  update public.cultural_entities
  set
    canonical_source_table = 'registry_tracks',
    canonical_source_id =
      '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
  where id = '66e8d211-8472-4942-9716-d5864eacd8d3'::uuid
    and (
      canonical_source_table is distinct from 'registry_tracks'
      or canonical_source_id is distinct from
        '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
    );

  update public.cultural_entities
  set
    canonical_source_table = 'registry_releases',
    canonical_source_id =
      'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
  where id = '5dc336ee-3a12-4763-be7b-cf1fed1d54b0'::uuid
    and (
      canonical_source_table is distinct from 'registry_releases'
      or canonical_source_id is distinct from
        'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
    );

  -- Exact relationship IDs are reused across the two authority tables.
  -- Refuse collisions with any unrelated typed relationship.
  if exists (
    select 1
    from public.registry_entity_relationships
    where id = '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and (
        source_entity_type is distinct from 'track'
        or source_entity_id is distinct from
          '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
        or target_entity_type is distinct from 'release'
        or target_entity_id is distinct from
          'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
        or relationship_type is distinct from 'appeared_on'
      )
  ) then
    raise exception 'Gate C typed Siaka/Mtoto relationship ID collision';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships
    where id = 'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and (
        source_entity_type is distinct from 'artist'
        or source_entity_id is distinct from
          'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
        or target_entity_type is distinct from 'artist'
        or target_entity_id is distinct from
          '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
        or relationship_type is distinct from 'collaborated_with'
      )
  ) then
    raise exception 'Gate C typed Mejja/Fik relationship ID collision';
  end if;

  -- Also reject a duplicate exact typed relationship under another ID.
  if exists (
    select 1
    from public.registry_entity_relationships
    where id <> '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and source_entity_type = 'track'
      and source_entity_id =
        '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
      and target_entity_type = 'release'
      and target_entity_id =
        'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
      and relationship_type = 'appeared_on'
  ) then
    raise exception 'Gate C duplicate typed Siaka/Mtoto relationship';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships
    where id <> 'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and source_entity_type = 'artist'
      and source_entity_id =
        'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
      and target_entity_type = 'artist'
      and target_entity_id =
        '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
      and relationship_type = 'collaborated_with'
  ) then
    raise exception 'Gate C duplicate typed Mejja/Fik relationship';
  end if;
end
$$;

-- Insert internal/unreviewed typed rows first. Evidence is attached before
-- any approved review state is restored, preserving the typed promotion gate.

insert into public.registry_entity_relationships (
  id,
  source_entity_type,
  source_slug,
  target_entity_type,
  target_slug,
  relationship_type,
  relationship_status,
  source_kind,
  source_entity,
  source_record_id,
  confidence,
  metadata,
  created_at,
  updated_at,
  source_entity_id,
  target_entity_id,
  plain_reason,
  review_status,
  public_safe,
  created_by,
  updated_by
)
select
  er.id,
  'track',
  'siaka',
  'release',
  'mtoto-wa-khadija',
  er.relationship_type,
  'needs_review',
  'legacy_cultural_relationship_migration',
  'entity_relationships',
  er.id::text,
  null,
  jsonb_build_object(
    'legacy_authority', 'entity_relationships',
    'legacy_relationship_id', er.id,
    'legacy_source_entity_id', er.source_entity_id,
    'legacy_target_entity_id', er.target_entity_id,
    'legacy_confidence', er.confidence,
    'legacy_review_status', er.review_status,
    'legacy_public_safe', er.public_safe,
    'legacy_created_at', er.created_at,
    'legacy_updated_at', er.updated_at
  ),
  er.created_at,
  er.updated_at,
  '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid,
  'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid,
  er.reason,
  'unreviewed',
  false,
  er.created_by,
  er.created_by
from public.entity_relationships er
where er.id = '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
on conflict (id) do nothing;

insert into public.registry_entity_relationships (
  id,
  source_entity_type,
  source_slug,
  target_entity_type,
  target_slug,
  relationship_type,
  relationship_status,
  source_kind,
  source_entity,
  source_record_id,
  confidence,
  metadata,
  created_at,
  updated_at,
  source_entity_id,
  target_entity_id,
  plain_reason,
  review_status,
  public_safe,
  created_by,
  updated_by
)
select
  er.id,
  'artist',
  'mejja',
  'artist',
  'fik-fameica',
  er.relationship_type,
  'active',
  'legacy_cultural_relationship_migration',
  'entity_relationships',
  er.id::text,
  null,
  jsonb_build_object(
    'legacy_authority', 'entity_relationships',
    'legacy_relationship_id', er.id,
    'legacy_source_entity_id', er.source_entity_id,
    'legacy_target_entity_id', er.target_entity_id,
    'legacy_confidence', er.confidence,
    'legacy_review_status', er.review_status,
    'legacy_public_safe', er.public_safe,
    'legacy_created_at', er.created_at,
    'legacy_updated_at', er.updated_at
  ),
  er.created_at,
  er.updated_at,
  'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid,
  '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid,
  er.reason,
  'unreviewed',
  false,
  er.created_by,
  er.created_by
from public.entity_relationships er
where er.id = 'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
on conflict (id) do nothing;

insert into public.registry_relationship_evidence (
  relationship_id,
  evidence_id,
  support_type,
  note,
  created_by
)
select
  re.relationship_id,
  re.evidence_id,
  re.support_type,
  re.note,
  null
from public.relationship_evidence re
where re.relationship_id in (
  '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid,
  'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
)
on conflict (relationship_id, evidence_id, support_type) do nothing;

-- Restore the accepted review projection only after evidence exists.
update public.registry_entity_relationships typed
set
  relationship_status = 'needs_review',
  review_status = 'pending_review',
  public_safe = false,
  reviewed_by = legacy.reviewed_by,
  reviewed_at = legacy.reviewed_at,
  review_note = legacy.review_note,
  updated_at = legacy.updated_at
from public.entity_relationships legacy
where typed.id =
      '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
  and legacy.id = typed.id;

update public.registry_entity_relationships typed
set
  relationship_status = 'active',
  review_status = 'approved',
  -- Intentionally stricter than the legacy projection.
  -- Supporting evidence is reviewed/default-retrieval but is not approved,
  -- therefore current typed policy does not allow public_safe=true.
  public_safe = false,
  reviewed_by = legacy.reviewed_by,
  reviewed_at = legacy.reviewed_at,
  review_note = legacy.review_note,
  updated_at = legacy.updated_at
from public.entity_relationships legacy
where typed.id =
      'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
  and legacy.id = typed.id;

-- -------------------------------------------------------------------------
-- Fail-closed historical boundary for legacy core-music cultural entities.
-- Broader non-music Institute semantics remain available.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_cultural_entity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_core_types constant text[] :=
    array['artist','track','release','label','genre']::text[];
begin
  if tg_op = 'INSERT' then
    if new.entity_type = any(v_core_types) then
      raise exception
        'Core music identity must use typed Registry authority, not cultural_entities'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.entity_type = any(v_core_types) then
      raise exception
        'Historical core music cultural entities are immutable'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.entity_type = any(v_core_types) then
    raise exception
      'Historical core music cultural entities are immutable'
      using errcode = '42501';
  end if;

  if new.entity_type = any(v_core_types) then
    raise exception
      'Core music identity must use typed Registry authority, not cultural_entities'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_cultural_entity_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_cultural_entity_mutation
on public.cultural_entities;

create trigger
  trg_reject_legacy_core_cultural_entity_mutation
before insert or update or delete
on public.cultural_entities
for each row
execute function
  public.reject_legacy_core_cultural_entity_mutation();

-- -------------------------------------------------------------------------
-- Freeze legacy relationships whenever either endpoint is core music.
-- Non-music Institute relationships retain their existing governance road.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_relationship_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_is_core boolean := false;
  v_new_is_core boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = old.id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_old_is_core;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1
      from public.cultural_entities source_entity
      join public.cultural_entities target_entity
        on target_entity.id = new.target_entity_id
      where source_entity.id = new.source_entity_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_new_is_core;
  end if;

  if v_old_is_core or v_new_is_core then
    raise exception
      'Core music relationships must use typed Registry relationship authority'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_relationship_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_relationship_mutation
on public.entity_relationships;

create trigger
  trg_reject_legacy_core_relationship_mutation
before insert or update or delete
on public.entity_relationships
for each row
execute function
  public.reject_legacy_core_relationship_mutation();

-- -------------------------------------------------------------------------
-- Freeze evidence links attached to historical legacy core relationships.
-- -------------------------------------------------------------------------

create or replace function public.reject_legacy_core_relationship_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_is_core boolean := false;
  v_new_is_core boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = old.relationship_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_old_is_core;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1
      from public.entity_relationships er
      join public.cultural_entities source_entity
        on source_entity.id = er.source_entity_id
      join public.cultural_entities target_entity
        on target_entity.id = er.target_entity_id
      where er.id = new.relationship_id
        and (
          source_entity.entity_type in
            ('artist','track','release','label','genre')
          or target_entity.entity_type in
            ('artist','track','release','label','genre')
        )
    )
    into v_new_is_core;
  end if;

  if v_old_is_core or v_new_is_core then
    raise exception
      'Historical core music legacy relationship evidence is immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$$;

revoke all on function
  public.reject_legacy_core_relationship_evidence_mutation()
from public, anon, authenticated;

drop trigger if exists
  trg_reject_legacy_core_relationship_evidence_mutation
on public.relationship_evidence;

create trigger
  trg_reject_legacy_core_relationship_evidence_mutation
before insert or update or delete
on public.relationship_evidence
for each row
execute function
  public.reject_legacy_core_relationship_evidence_mutation();

commit;
