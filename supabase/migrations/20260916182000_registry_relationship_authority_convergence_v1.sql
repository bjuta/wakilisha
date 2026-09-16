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


-- -------------------------------------------------------------------------
-- Fail closed on exact historical observation/evidence drift and on any
-- pre-existing typed row that carries the right endpoints but the wrong
-- migration provenance. Exact fully-converged rows remain replay-safe.
-- -------------------------------------------------------------------------

do $gate_c_authority_preflight$
begin
  if not exists (
    select 1
    from public.entity_relationships er
    where er.id = '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and er.source_entity_id =
        '66e8d211-8472-4942-9716-d5864eacd8d3'::uuid
      and er.target_entity_id =
        '5dc336ee-3a12-4763-be7b-cf1fed1d54b0'::uuid
      and er.relationship_type = 'appeared_on'
      and er.reason =
        'Smoke relationship: Siaka appears in the Mtoto wa Khadija release context.'
      and er.confidence = 'medium'
      and er.review_status = 'pending_review'
      and er.public_safe is false
      and er.reviewed_by =
        '27937fb0-147f-4d0f-b735-3b9b9b82f38f'::uuid
      and er.reviewed_at =
        '2026-06-29 21:50:26.637697+00'::timestamptz
      and er.review_note =
        'Admin review action from Institute review queue: needs more evidence'
  ) then
    raise exception 'Gate C historical Siaka/Mtoto relationship drift';
  end if;

  if not exists (
    select 1
    from public.entity_relationships er
    where er.id = 'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and er.source_entity_id =
        'a9d48d47-73f2-40e0-ab4d-95b52ac13ff4'::uuid
      and er.target_entity_id =
        '1876ae6d-7952-4d1c-823f-8fc91c2bed42'::uuid
      and er.relationship_type = 'collaborated_with'
      and er.reason =
        'Smoke relationship: Mejja and Fik Fameica are both primary artists on Siaka.'
      and er.confidence = 'medium'
      and er.review_status = 'approved'
      and er.public_safe is true
      and er.reviewed_by =
        '27937fb0-147f-4d0f-b735-3b9b9b82f38f'::uuid
      and er.reviewed_at =
        '2026-06-29 21:49:58.055082+00'::timestamptz
      and er.review_note =
        'Admin review action from Institute review queue: public safe enabled'
  ) then
    raise exception 'Gate C historical Mejja/Fik relationship drift';
  end if;

  if not exists (
    select 1
    from public.relationship_evidence re
    join public.evidence_items e on e.id = re.evidence_id
    where re.relationship_id =
          '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and re.evidence_id =
          '9e39f45d-10f4-45fc-af3e-9af17aa5e6a7'::uuid
      and re.support_type = 'supports'
      and re.note =
          'Smoke evidence attached to prove the relationship review path.'
      and e.evidence_type = 'release_metadata'
      and e.review_status = 'unreviewed'
      and e.retrieval_status = 'review_only'
  ) then
    raise exception 'Gate C historical Siaka/Mtoto evidence drift';
  end if;

  if not exists (
    select 1
    from public.relationship_evidence re
    join public.evidence_items e on e.id = re.evidence_id
    where re.relationship_id =
          'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and re.evidence_id =
          '164714b3-955d-4bfe-a456-c2a70a343685'::uuid
      and re.support_type = 'supports'
      and re.note =
          'Smoke evidence attached to prove the relationship review path.'
      and e.evidence_type = 'track_metadata'
      and e.review_status = 'reviewed'
      and e.retrieval_status = 'default_retrieval'
  ) then
    raise exception 'Gate C historical Mejja/Fik evidence drift';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships typed
    join public.entity_relationships legacy on legacy.id = typed.id
    where typed.id =
          '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and (
        typed.source_entity_type is distinct from 'track'
        or typed.source_slug is distinct from 'siaka'
        or typed.target_entity_type is distinct from 'release'
        or typed.target_slug is distinct from 'mtoto-wa-khadija'
        or typed.relationship_type is distinct from 'appeared_on'
        or typed.relationship_status is distinct from 'needs_review'
        or typed.source_kind is distinct from
           'legacy_cultural_relationship_migration'
        or typed.source_entity is distinct from 'entity_relationships'
        or typed.source_record_id is distinct from legacy.id::text
        or typed.confidence is not null
        or typed.source_entity_id is distinct from
           '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
        or typed.target_entity_id is distinct from
           'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
        or typed.plain_reason is distinct from legacy.reason
        or typed.review_status is distinct from 'pending_review'
        or typed.public_safe is distinct from false
        or typed.created_by is distinct from legacy.created_by
        or typed.updated_by is distinct from legacy.created_by
        or typed.reviewed_by is distinct from legacy.reviewed_by
        or typed.reviewed_at is distinct from legacy.reviewed_at
        or typed.review_note is distinct from legacy.review_note
        or typed.created_at is distinct from legacy.created_at
        or typed.updated_at is distinct from legacy.updated_at
        or not (
          typed.metadata @> jsonb_build_object(
            'legacy_authority', 'entity_relationships',
            'legacy_relationship_id', legacy.id,
            'legacy_source_entity_id', legacy.source_entity_id,
            'legacy_target_entity_id', legacy.target_entity_id,
            'legacy_confidence', legacy.confidence,
            'legacy_review_status', legacy.review_status,
            'legacy_public_safe', legacy.public_safe
          )
        )
      )
  ) then
    raise exception 'Gate C typed Siaka/Mtoto provenance drift';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships typed
    join public.entity_relationships legacy on legacy.id = typed.id
    where typed.id =
          'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and (
        typed.source_entity_type is distinct from 'artist'
        or typed.source_slug is distinct from 'mejja'
        or typed.target_entity_type is distinct from 'artist'
        or typed.target_slug is distinct from 'fik-fameica'
        or typed.relationship_type is distinct from 'collaborated_with'
        or typed.relationship_status is distinct from 'active'
        or typed.source_kind is distinct from
           'legacy_cultural_relationship_migration'
        or typed.source_entity is distinct from 'entity_relationships'
        or typed.source_record_id is distinct from legacy.id::text
        or typed.confidence is not null
        or typed.source_entity_id is distinct from
           'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
        or typed.target_entity_id is distinct from
           '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
        or typed.plain_reason is distinct from legacy.reason
        or typed.review_status is distinct from 'approved'
        or typed.public_safe is distinct from false
        or typed.created_by is distinct from legacy.created_by
        or typed.updated_by is distinct from legacy.created_by
        or typed.reviewed_by is distinct from legacy.reviewed_by
        or typed.reviewed_at is distinct from legacy.reviewed_at
        or typed.review_note is distinct from legacy.review_note
        or typed.created_at is distinct from legacy.created_at
        or typed.updated_at is distinct from legacy.updated_at
        or not (
          typed.metadata @> jsonb_build_object(
            'legacy_authority', 'entity_relationships',
            'legacy_relationship_id', legacy.id,
            'legacy_source_entity_id', legacy.source_entity_id,
            'legacy_target_entity_id', legacy.target_entity_id,
            'legacy_confidence', legacy.confidence,
            'legacy_review_status', legacy.review_status,
            'legacy_public_safe', legacy.public_safe
          )
        )
      )
  ) then
    raise exception 'Gate C typed Mejja/Fik provenance drift';
  end if;

  if exists (
    select 1
    from public.registry_relationship_evidence typed
    join public.relationship_evidence legacy
      on legacy.relationship_id = typed.relationship_id
     and legacy.evidence_id = typed.evidence_id
    where typed.relationship_id =
          '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and typed.evidence_id =
          '9e39f45d-10f4-45fc-af3e-9af17aa5e6a7'::uuid
      and (
        typed.support_type is distinct from legacy.support_type
        or typed.note is distinct from legacy.note
        or typed.created_by is not null
      )
  ) then
    raise exception 'Gate C typed Siaka/Mtoto evidence provenance drift';
  end if;

  if exists (
    select 1
    from public.registry_relationship_evidence typed
    join public.relationship_evidence legacy
      on legacy.relationship_id = typed.relationship_id
     and legacy.evidence_id = typed.evidence_id
    where typed.relationship_id =
          'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and typed.evidence_id =
          '164714b3-955d-4bfe-a456-c2a70a343685'::uuid
      and (
        typed.support_type is distinct from legacy.support_type
        or typed.note is distinct from legacy.note
        or typed.created_by is not null
      )
  ) then
    raise exception 'Gate C typed Mejja/Fik evidence provenance drift';
  end if;
end
$gate_c_authority_preflight$;

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
