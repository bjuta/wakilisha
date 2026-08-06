do $phase4a_media_write_live_acceptance$
declare
  v_current_revision_id uuid;
  v_revision_one_id uuid;
  v_revision_two_id uuid;
begin
  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      to_regprocedure(
        'media.enforce_asset_pointer_integrity()'
      )
      and pg_get_userbyid(
        procedure_row.proowner
      ) = 'postgres'
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(
          procedure_row.proconfig
        ) setting_row
        where setting_row =
          'search_path=pg_catalog, media'
      )
  ) then
    raise exception
      'STOP: Deferred pointer trigger authority is not accepted';
  end if;

  if has_table_privilege(
    'authenticated',
    'media.asset_governance_versions',
    'SELECT'
  ) then
    raise exception
      'STOP: Authenticated has direct governance-table SELECT';
  end if;

  if (select count(*) from media.assets) <> 1080
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1080
     or (
       select count(*)
       from public.registry_media_assets
     ) <> 1080
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1080
     or (select count(*) from media.usage_links) <> 987
     or (select count(*) from media.file_objects) <> 4
     or (select count(*) from media.asset_revisions) <> 2
     or (select count(*) from media.variants) <> 2
     or (
       select count(*)
       from media.variant_selections
     ) <> 2
  then
    raise exception
      'STOP: Accepted final Media counts changed';
  end if;

  select current_revision_id
  into v_current_revision_id
  from media.assets
  where id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
    and authority_revision = 5
    and lifecycle_state = 'archived'
    and archived_by = '27937fb0-147f-4d0f-b735-3b9b9b82f38f'::uuid
    and archived_at is not null
    and archive_reason = 'Archive completed Phase 4A Media write-authority live proof';

  if v_current_revision_id is null then
    raise exception
      'STOP: Proof asset archive authority is incomplete';
  end if;

  if not exists (
    select 1
    from public.registry_media_assets
    where id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
      and title = 'phase4a-live-proof-20260806T114423Z.png'
      and status = 'archived'
      and storage_path =
        'uploads/1786024902551-746750be-phase4a-live-proof-20260806t114423z.png'
      and url = 'https://media.wakilisha.africa/uploads/1786024902551-746750be-phase4a-live-proof-20260806t114423z.png'
  ) then
    raise exception
      'STOP: Archived compatibility projection is wrong';
  end if;

  select id
  into v_revision_one_id
  from media.asset_revisions
  where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
    and revision_number = 1;

  select id
  into v_revision_two_id
  from media.asset_revisions
  where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
    and revision_number = 2;

  if v_revision_one_id is null
     or v_revision_two_id is null
     or v_current_revision_id <> v_revision_two_id
  then
    raise exception
      'STOP: Immutable revision pointers are wrong';
  end if;

  if not exists (
    select 1
    from media.asset_revisions
    where id = v_revision_two_id
      and previous_revision_id = v_revision_one_id
  ) then
    raise exception
      'STOP: Immutable revision ancestry is missing';
  end if;

  if (
    select count(distinct file_id)
    from (
      select original_file_object_id as file_id
      from media.asset_revisions
      where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid

      union all

      select derived_file_object_id as file_id
      from media.variants
      where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
    ) accepted_files
  ) <> 4 then
    raise exception
      'STOP: Accepted proof does not contain four immutable files';
  end if;

  if exists (
    select 1
    from (
      select original_file_object_id as file_id
      from media.asset_revisions
      where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid

      union all

      select derived_file_object_id as file_id
      from media.variants
      where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
    ) accepted_files
    join media.file_objects file_row
      on file_row.id = accepted_files.file_id
    where file_row.verification_state <> 'verified'
       or file_row.sha256 !~ '^[0-9a-f]{64}$'
       or file_row.byte_size <= 0
       or file_row.verified_at is null
  ) then
    raise exception
      'STOP: Accepted immutable file verification changed';
  end if;

  if (
    select count(*)
    from media.variant_selections selection_row
    join media.asset_revisions revision_row
      on revision_row.id =
        selection_row.asset_revision_id
    where revision_row.asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
      and selection_row.variant_role =
        'responsive_width'
  ) <> 2 then
    raise exception
      'STOP: Accepted responsive selections changed';
  end if;

  if (
    select count(
      distinct original_row.storage_path
    )
    from media.asset_revisions revision_row
    join media.file_objects original_row
      on original_row.id =
        revision_row.original_file_object_id
    where revision_row.asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
  ) <> 2 then
    raise exception
      'STOP: Original immutable paths are not distinct';
  end if;

  if (
    select count(
      distinct derived_row.storage_path
    )
    from media.variants variant_row
    join media.file_objects derived_row
      on derived_row.id =
        variant_row.derived_file_object_id
    where variant_row.asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
  ) <> 2 then
    raise exception
      'STOP: Derivative immutable paths are not distinct';
  end if;

  if exists (
    select 1
    from media.file_objects
    where storage_path in (
      'uploads/1786016706831-014b10d5-phase4a-live-proof-20260806t114423z.png',
      'uploads/1786018965027-1d375aa6-phase4a-live-proof-20260806t114423z.png'
    )
  )
  or exists (
    select 1
    from public.registry_media_assets
    where storage_path in (
      'uploads/1786016706831-014b10d5-phase4a-live-proof-20260806t114423z.png',
      'uploads/1786018965027-1d375aa6-phase4a-live-proof-20260806t114423z.png'
    )
  ) then
    raise exception
      'STOP: Confirmed orphan paths became registered';
  end if;

  if exists (
    select 1
    from media.usage_links
    where asset_id = '7e6866dd-8a40-4a0f-bea5-aae08db721b0'::uuid
  ) then
    raise exception
      'STOP: Proof asset unexpectedly has usage links';
  end if;
end;
$phase4a_media_write_live_acceptance$;

select jsonb_pretty(
  jsonb_build_object(
    'verification',
      'PHASE_4A_MEDIA_WRITE_LIVE_ACCEPTANCE_PASS',
    'asset_id', '7e6866dd-8a40-4a0f-bea5-aae08db721b0',
    'proof_status', 'archived',
    'authority_revision', 5,
    'current_revision_number', 2,
    'canonical_assets',
      (select count(*) from media.assets),
    'governance_versions',
      (
        select count(*)
        from media.asset_governance_versions
      ),
    'compatibility_assets',
      (
        select count(*)
        from public.registry_media_assets
      ),
    'legacy_bridges',
      (
        select count(*)
        from media.legacy_asset_links
      ),
    'usage_links',
      (select count(*) from media.usage_links),
    'file_objects',
      (select count(*) from media.file_objects),
    'asset_revisions',
      (select count(*) from media.asset_revisions),
    'variants',
      (select count(*) from media.variants),
    'variant_selections',
      (
        select count(*)
        from media.variant_selections
      ),
    'authenticated_direct_governance_select',
      false,
    'confirmed_orphans_registered',
      false
  )
) as phase4a_media_write_live_acceptance;
