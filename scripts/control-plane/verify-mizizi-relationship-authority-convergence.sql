\set ON_ERROR_STOP on

do $$
begin
  -- Exact legacy -> Registry identity mapping.
  if not exists (
    select 1
    from public.cultural_entities
    where id = 'a9d48d47-73f2-40e0-ab4d-95b52ac13ff4'::uuid
      and canonical_source_table = 'registry_artists'
      and canonical_source_id =
        'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
  ) then
    raise exception 'Gate C verifier: Mejja canonical mapping missing';
  end if;

  if not exists (
    select 1
    from public.cultural_entities
    where id = '1876ae6d-7952-4d1c-823f-8fc91c2bed42'::uuid
      and canonical_source_table = 'registry_artists'
      and canonical_source_id =
        '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
  ) then
    raise exception 'Gate C verifier: Fik Fameica canonical mapping missing';
  end if;

  if not exists (
    select 1
    from public.cultural_entities
    where id = '66e8d211-8472-4942-9716-d5864eacd8d3'::uuid
      and canonical_source_table = 'registry_tracks'
      and canonical_source_id =
        '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
  ) then
    raise exception 'Gate C verifier: Siaka canonical mapping missing';
  end if;

  if not exists (
    select 1
    from public.cultural_entities
    where id = '5dc336ee-3a12-4763-be7b-cf1fed1d54b0'::uuid
      and canonical_source_table = 'registry_releases'
      and canonical_source_id =
        'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
  ) then
    raise exception 'Gate C verifier: Release canonical mapping missing';
  end if;

  -- Typed Track -> Release historical observation.
  if not exists (
    select 1
    from public.registry_entity_relationships
    where id = '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and source_entity_type = 'track'
      and source_entity_id =
        '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
      and source_slug = 'siaka'
      and target_entity_type = 'release'
      and target_entity_id =
        'e9a367d3-7cc4-4126-94ec-1e651dbe6ecf'::uuid
      and target_slug = 'mtoto-wa-khadija'
      and relationship_type = 'appeared_on'
      and relationship_status = 'needs_review'
      and review_status = 'pending_review'
      and public_safe is false
      and metadata ->> 'legacy_authority' = 'entity_relationships'
  ) then
    raise exception 'Gate C verifier: typed Siaka/Mtoto relationship invalid';
  end if;

  -- Typed Artist -> Artist reviewed observation. Public-safe remains false
  -- because typed evidence promotion policy is intentionally stricter.
  if not exists (
    select 1
    from public.registry_entity_relationships
    where id = 'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and source_entity_type = 'artist'
      and source_entity_id =
        'efdf79dc-9280-406a-b6e3-f8672f6b783f'::uuid
      and source_slug = 'mejja'
      and target_entity_type = 'artist'
      and target_entity_id =
        '33b93023-0479-4feb-ade7-a1185f86cb23'::uuid
      and target_slug = 'fik-fameica'
      and relationship_type = 'collaborated_with'
      and relationship_status = 'active'
      and review_status = 'approved'
      and public_safe is false
      and metadata ->> 'legacy_public_safe' = 'true'
  ) then
    raise exception 'Gate C verifier: typed Mejja/Fik relationship invalid';
  end if;

  if (
    select count(*)
    from public.registry_relationship_evidence
    where (
      relationship_id =
        '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid
      and evidence_id =
        '9e39f45d-10f4-45fc-af3e-9af17aa5e6a7'::uuid
      and support_type = 'supports'
    )
    or (
      relationship_id =
        'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
      and evidence_id =
        '164714b3-955d-4bfe-a456-c2a70a343685'::uuid
      and support_type = 'supports'
    )
  ) <> 2 then
    raise exception 'Gate C verifier: migrated relationship evidence missing';
  end if;

  -- Historical legacy observations still exist.
  if (
    select count(*)
    from public.entity_relationships
    where id in (
      '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid,
      'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
    )
  ) <> 2 then
    raise exception 'Gate C verifier: historical relationships were lost';
  end if;

  if (
    select count(*)
    from public.relationship_evidence
    where relationship_id in (
      '8c03e889-3c3a-47f2-a776-9f8534191180'::uuid,
      'ea733423-2c3b-4d47-93ea-6af44b6577b3'::uuid
    )
  ) <> 2 then
    raise exception 'Gate C verifier: historical evidence links were lost';
  end if;

  -- Mechanical legacy-core freeze exists at all three mutation surfaces.
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.cultural_entities'::regclass
      and tgname = 'trg_reject_legacy_core_cultural_entity_mutation'
      and not tgisinternal
  ) then
    raise exception 'Gate C verifier: cultural entity freeze trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.entity_relationships'::regclass
      and tgname = 'trg_reject_legacy_core_relationship_mutation'
      and not tgisinternal
  ) then
    raise exception 'Gate C verifier: relationship freeze trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.relationship_evidence'::regclass
      and tgname = 'trg_reject_legacy_core_relationship_evidence_mutation'
      and not tgisinternal
  ) then
    raise exception 'Gate C verifier: legacy evidence freeze trigger missing';
  end if;
end
$$;

select 'MIZIZI_RELATIONSHIP_AUTHORITY_CONVERGENCE_PASS'
  as verification_result;
