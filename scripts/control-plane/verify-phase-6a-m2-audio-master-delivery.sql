-- Permanent read-only verifier for Phase 6A M2 Audio master and delivery authority.

begin;

do $phase_6a_m2_verify$
declare
  v_audio_v1_submit text;
  v_audio_v1_register text;
  v_fingerprint text;
  v_snapshot text;
begin
  if not exists (
    select 1
    from media.variant_roles
    where variant_role = 'audio_delivery'
      and enabled
  ) then
    raise exception
      'M2 verification failed: audio_delivery variant role is missing';
  end if;

  if not exists (
    select 1
    from media.usage_roles
    where usage_role = 'audio_master'
      and enabled
  ) then
    raise exception
      'M2 verification failed: audio_master usage role is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('master_media_asset_id'),
        ('master_media_revision_id'),
        ('audio_delivery_variant_id')
    ) required(column_name)
    where not exists (
      select 1
      from information_schema.columns column_row
      where column_row.table_schema = 'audio'
        and column_row.table_name = 'publication_versions'
        and column_row.column_name = required.column_name
    )
  ) then
    raise exception
      'M2 verification failed: Audio version Media snapshot columns are incomplete';
  end if;

  if to_regprocedure(
       'audio.current_publication_master(uuid)'
     ) is null
     or to_regprocedure(
       'audio.enforce_publication_version_media_integrity()'
     ) is null
     or to_regprocedure(
       'public.set_audio_publication_master(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.submit_audio_delivery_processing_v1(uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.register_audio_delivery_processing_outputs_v1(uuid,text,jsonb)'
     ) is null
  then
    raise exception
      'M2 verification failed: one or more M2 functions are missing';
  end if;

  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'audio.publication.master.set'
      and enabled
  ) then
    raise exception
      'M2 verification failed: Audio master command type is missing';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    left join media.assets asset
      on asset.id = usage.asset_id
    left join media.asset_revisions revision
      on revision.id = usage.asset_revision_id
     and revision.asset_id = usage.asset_id
    left join media.file_objects original_file
      on original_file.id = revision.original_file_object_id
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'audio_publication'
      and usage.usage_role = 'audio_master'
      and usage.usage_state = 'active'
      and (
        usage.target_version_id is not null
        or usage.resolution_mode <> 'exact_revision'
        or asset.asset_kind is distinct from 'audio'
        or revision.id is null
        or original_file.verification_state is distinct from 'verified'
        or original_file.storage_provider is distinct from 'lightsail_media'
        or original_file.storage_path !~ '^masters/audio/'
      )
  ) then
    raise exception
      'M2 verification failed: active Audio master usage violates exact protected-master authority';
  end if;

  if exists (
    select 1
    from audio.publication_versions version
    left join media.assets asset
      on asset.id = version.master_media_asset_id
    left join media.asset_revisions revision
      on revision.id = version.master_media_revision_id
     and revision.asset_id = version.master_media_asset_id
    left join media.variants delivery
      on delivery.id = version.audio_delivery_variant_id
    where
      (
        (version.master_media_asset_id is null)
        <>
        (version.master_media_revision_id is null)
      )
      or (
        version.master_media_asset_id is not null
        and (
          asset.asset_kind is distinct from 'audio'
          or revision.id is null
        )
      )
      or (
        version.audio_delivery_variant_id is not null
        and (
          delivery.variant_role is distinct from 'audio_delivery'
          or delivery.asset_id is distinct from version.master_media_asset_id
          or delivery.asset_revision_id is distinct from version.master_media_revision_id
        )
      )
  ) then
    raise exception
      'M2 verification failed: immutable Audio version Media identity is inconsistent';
  end if;

  if exists (
    select 1
    from editorial.resources resource_row
    left join editorial.audio_publication_resources binding
      on binding.resource_id = resource_row.id
    where resource_row.resource_kind in (
      'audio_episode',
      'standalone_audio'
    )
      and (
        binding.resource_id is null
        or (
          resource_row.current_working_version_id,
          resource_row.current_submitted_version_id,
          resource_row.current_approved_version_id,
          resource_row.current_published_version_id
        ) is distinct from (
          binding.current_working_version_id,
          binding.current_submitted_version_id,
          binding.current_approved_version_id,
          binding.current_published_version_id
        )
      )
  ) then
    raise exception
      'M2 verification failed: Audio Resource lifecycle pointer compatibility mismatch';
  end if;

  v_audio_v1_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_audio_v1_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position(
       'audio-publication-v1'
       in v_audio_v1_submit
     ) > 0
     or position(
       'audio-publication-v1'
       in v_audio_v1_register
     ) > 0
  then
    raise exception
      'M2 verification failed: accepted Phase 4 v1 processing functions were broadened';
  end if;

  v_fingerprint := pg_get_functiondef(
    'audio.publication_content_fingerprint(uuid)'::regprocedure
  );
  v_snapshot := pg_get_functiondef(
    'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure
  );

  if position('master_media_asset_id' in v_fingerprint) = 0
     or position('master_media_revision_id' in v_fingerprint) = 0
     or position('audio_delivery_variant_id' in v_fingerprint) = 0
     or position('master_media_asset_id' in v_snapshot) = 0
     or position('master_media_revision_id' in v_snapshot) = 0
     or position('audio_delivery_variant_id' in v_snapshot) = 0
  then
    raise exception
      'M2 verification failed: Audio fingerprint or snapshot no longer freezes Media identity';
  end if;
end;
$phase_6a_m2_verify$;

select
  'PASS: Phase 6A M2 Audio master and full-length delivery authority is intact.'
    as verification_result;

rollback;
