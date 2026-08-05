-- Phase 4A Migration 1 verifier: Media authority foundation.
--
-- This verifier is read-only. It fails before Migration 1 and passes only
-- when the empty schema-only foundation matches the accepted blueprint.

begin;
set transaction read only;

do $phase_4a_m1_verify$
declare
  v_count bigint;
  v_text text;
begin
  if current_setting('transaction_read_only') <> 'on' then
    raise exception
      'STOP: Phase 4A Migration 1 verifier is not read-only';
  end if;

  if to_regnamespace('media') is null then
    raise exception
      'STOP: media schema does not exist';
  end if;

  if exists (
    select 1
    from (
      values
      ('asset_kinds', 1, 'asset_kind', 'text', 'NO'),
      ('asset_kinds', 2, 'label', 'text', 'NO'),
      ('asset_kinds', 3, 'description', 'text', 'NO'),
      ('asset_kinds', 4, 'enabled', 'boolean', 'NO'),
      ('asset_kinds', 5, 'sort_order', 'integer', 'NO'),
      ('asset_kinds', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('asset_purposes', 1, 'asset_purpose', 'text', 'NO'),
      ('asset_purposes', 2, 'label', 'text', 'NO'),
      ('asset_purposes', 3, 'description', 'text', 'NO'),
      ('asset_purposes', 4, 'enabled', 'boolean', 'NO'),
      ('asset_purposes', 5, 'sort_order', 'integer', 'NO'),
      ('asset_purposes', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('storage_providers', 1, 'storage_provider', 'text', 'NO'),
      ('storage_providers', 2, 'label', 'text', 'NO'),
      ('storage_providers', 3, 'description', 'text', 'NO'),
      ('storage_providers', 4, 'supports_verification', 'boolean', 'NO'),
      ('storage_providers', 5, 'enabled', 'boolean', 'NO'),
      ('storage_providers', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('variant_roles', 1, 'variant_role', 'text', 'NO'),
      ('variant_roles', 2, 'label', 'text', 'NO'),
      ('variant_roles', 3, 'description', 'text', 'NO'),
      ('variant_roles', 4, 'enabled', 'boolean', 'NO'),
      ('variant_roles', 5, 'sort_order', 'integer', 'NO'),
      ('variant_roles', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('usage_roles', 1, 'usage_role', 'text', 'NO'),
      ('usage_roles', 2, 'label', 'text', 'NO'),
      ('usage_roles', 3, 'description', 'text', 'NO'),
      ('usage_roles', 4, 'enabled', 'boolean', 'NO'),
      ('usage_roles', 5, 'sort_order', 'integer', 'NO'),
      ('usage_roles', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('assets', 1, 'id', 'uuid', 'NO'),
      ('assets', 2, 'asset_kind', 'text', 'NO'),
      ('assets', 3, 'asset_purpose', 'text', 'NO'),
      ('assets', 4, 'title', 'text', 'NO'),
      ('assets', 5, 'lifecycle_state', 'text', 'NO'),
      ('assets', 6, 'compatibility_folder_id', 'uuid', 'YES'),
      ('assets', 7, 'current_revision_id', 'uuid', 'YES'),
      ('assets', 8, 'current_governance_version_id', 'uuid', 'YES'),
      ('assets', 9, 'authority_revision', 'bigint', 'NO'),
      ('assets', 10, 'created_by', 'uuid', 'YES'),
      ('assets', 11, 'updated_by', 'uuid', 'YES'),
      ('assets', 12, 'archived_by', 'uuid', 'YES'),
      ('assets', 13, 'archived_at', 'timestamp with time zone', 'YES'),
      ('assets', 14, 'archive_reason', 'text', 'YES'),
      ('assets', 15, 'created_at', 'timestamp with time zone', 'NO'),
      ('assets', 16, 'updated_at', 'timestamp with time zone', 'NO'),
      ('file_objects', 1, 'id', 'uuid', 'NO'),
      ('file_objects', 2, 'sha256', 'text', 'YES'),
      ('file_objects', 3, 'byte_size', 'bigint', 'YES'),
      ('file_objects', 4, 'mime_type', 'text', 'YES'),
      ('file_objects', 5, 'original_filename', 'text', 'YES'),
      ('file_objects', 6, 'file_extension', 'text', 'YES'),
      ('file_objects', 7, 'storage_provider', 'text', 'NO'),
      ('file_objects', 8, 'storage_namespace', 'text', 'YES'),
      ('file_objects', 9, 'storage_path', 'text', 'YES'),
      ('file_objects', 10, 'delivery_url', 'text', 'YES'),
      ('file_objects', 11, 'technical_metadata', 'jsonb', 'NO'),
      ('file_objects', 12, 'verification_state', 'text', 'NO'),
      ('file_objects', 13, 'verified_by', 'uuid', 'YES'),
      ('file_objects', 14, 'verified_at', 'timestamp with time zone', 'YES'),
      ('file_objects', 15, 'verification_error', 'text', 'YES'),
      ('file_objects', 16, 'ingested_by', 'uuid', 'YES'),
      ('file_objects', 17, 'created_at', 'timestamp with time zone', 'NO'),
      ('asset_revisions', 1, 'id', 'uuid', 'NO'),
      ('asset_revisions', 2, 'asset_id', 'uuid', 'NO'),
      ('asset_revisions', 3, 'revision_number', 'bigint', 'NO'),
      ('asset_revisions', 4, 'original_file_object_id', 'uuid', 'NO'),
      ('asset_revisions', 5, 'previous_revision_id', 'uuid', 'YES'),
      ('asset_revisions', 6, 'replacement_reason', 'text', 'NO'),
      ('asset_revisions', 7, 'created_by', 'uuid', 'YES'),
      ('asset_revisions', 8, 'created_at', 'timestamp with time zone', 'NO'),
      ('variants', 1, 'id', 'uuid', 'NO'),
      ('variants', 2, 'asset_id', 'uuid', 'NO'),
      ('variants', 3, 'asset_revision_id', 'uuid', 'NO'),
      ('variants', 4, 'source_file_object_id', 'uuid', 'NO'),
      ('variants', 5, 'derived_file_object_id', 'uuid', 'NO'),
      ('variants', 6, 'variant_role', 'text', 'NO'),
      ('variants', 7, 'transformation_spec', 'jsonb', 'NO'),
      ('variants', 8, 'technical_metadata', 'jsonb', 'NO'),
      ('variants', 9, 'generator_name', 'text', 'YES'),
      ('variants', 10, 'generator_version', 'text', 'YES'),
      ('variants', 11, 'created_by', 'uuid', 'YES'),
      ('variants', 12, 'created_at', 'timestamp with time zone', 'NO'),
      ('variant_selections', 1, 'asset_revision_id', 'uuid', 'NO'),
      ('variant_selections', 2, 'variant_role', 'text', 'NO'),
      ('variant_selections', 3, 'variant_id', 'uuid', 'NO'),
      ('variant_selections', 4, 'selection_revision', 'bigint', 'NO'),
      ('variant_selections', 5, 'selected_by', 'uuid', 'YES'),
      ('variant_selections', 6, 'selected_at', 'timestamp with time zone', 'NO'),
      ('variant_selections', 7, 'updated_at', 'timestamp with time zone', 'NO'),
      ('asset_governance_versions', 1, 'id', 'uuid', 'NO'),
      ('asset_governance_versions', 2, 'asset_id', 'uuid', 'NO'),
      ('asset_governance_versions', 3, 'version_number', 'bigint', 'NO'),
      ('asset_governance_versions', 4, 'rights_status', 'text', 'NO'),
      ('asset_governance_versions', 5, 'rights_basis', 'text', 'YES'),
      ('asset_governance_versions', 6, 'rights_holder', 'text', 'YES'),
      ('asset_governance_versions', 7, 'licence_identifier', 'text', 'YES'),
      ('asset_governance_versions', 8, 'licence_terms', 'text', 'YES'),
      ('asset_governance_versions', 9, 'consent_status', 'text', 'NO'),
      ('asset_governance_versions', 10, 'consent_scope', 'text', 'YES'),
      ('asset_governance_versions', 11, 'sensitivity', 'text', 'NO'),
      ('asset_governance_versions', 12, 'embargo_state', 'text', 'NO'),
      ('asset_governance_versions', 13, 'embargo_until', 'timestamp with time zone', 'YES'),
      ('asset_governance_versions', 14, 'source_protection_class', 'text', 'NO'),
      ('asset_governance_versions', 15, 'preservation_state', 'text', 'NO'),
      ('asset_governance_versions', 16, 'retention_state', 'text', 'NO'),
      ('asset_governance_versions', 17, 'public_safety_state', 'text', 'NO'),
      ('asset_governance_versions', 18, 'internal_reason', 'text', 'YES'),
      ('asset_governance_versions', 19, 'approved_by', 'uuid', 'YES'),
      ('asset_governance_versions', 20, 'created_by', 'uuid', 'YES'),
      ('asset_governance_versions', 21, 'created_at', 'timestamp with time zone', 'NO'),
      ('usage_links', 1, 'id', 'uuid', 'NO'),
      ('usage_links', 2, 'asset_id', 'uuid', 'NO'),
      ('usage_links', 3, 'asset_revision_id', 'uuid', 'YES'),
      ('usage_links', 4, 'resolution_mode', 'text', 'NO'),
      ('usage_links', 5, 'target_authority', 'text', 'NO'),
      ('usage_links', 6, 'target_kind', 'text', 'NO'),
      ('usage_links', 7, 'target_id', 'uuid', 'NO'),
      ('usage_links', 8, 'target_version_kind', 'text', 'YES'),
      ('usage_links', 9, 'target_version_id', 'uuid', 'YES'),
      ('usage_links', 10, 'usage_role', 'text', 'NO'),
      ('usage_links', 11, 'placement_data', 'jsonb', 'NO'),
      ('usage_links', 12, 'display_order', 'integer', 'NO'),
      ('usage_links', 13, 'alt_text_snapshot', 'text', 'YES'),
      ('usage_links', 14, 'caption_snapshot', 'text', 'YES'),
      ('usage_links', 15, 'credit_snapshot', 'text', 'YES'),
      ('usage_links', 16, 'usage_state', 'text', 'NO'),
      ('usage_links', 17, 'usage_revision', 'bigint', 'NO'),
      ('usage_links', 18, 'state_reason', 'text', 'YES'),
      ('usage_links', 19, 'state_changed_by', 'uuid', 'YES'),
      ('usage_links', 20, 'state_changed_at', 'timestamp with time zone', 'YES'),
      ('usage_links', 21, 'created_by', 'uuid', 'YES'),
      ('usage_links', 22, 'created_at', 'timestamp with time zone', 'NO'),
      ('usage_links', 23, 'updated_at', 'timestamp with time zone', 'NO'),
      ('legacy_asset_links', 1, 'legacy_asset_id', 'uuid', 'NO'),
      ('legacy_asset_links', 2, 'asset_id', 'uuid', 'NO'),
      ('legacy_asset_links', 3, 'mapping_reason', 'text', 'NO'),
      ('legacy_asset_links', 4, 'legacy_snapshot', 'jsonb', 'NO'),
      ('legacy_asset_links', 5, 'created_by', 'uuid', 'YES'),
      ('legacy_asset_links', 6, 'created_at', 'timestamp with time zone', 'NO'),
      ('events', 1, 'id', 'uuid', 'NO'),
      ('events', 2, 'asset_id', 'uuid', 'YES'),
      ('events', 3, 'file_object_id', 'uuid', 'YES'),
      ('events', 4, 'asset_revision_id', 'uuid', 'YES'),
      ('events', 5, 'variant_id', 'uuid', 'YES'),
      ('events', 6, 'usage_link_id', 'uuid', 'YES'),
      ('events', 7, 'governance_version_id', 'uuid', 'YES'),
      ('events', 8, 'event_type', 'text', 'NO'),
      ('events', 9, 'actor_id', 'uuid', 'YES'),
      ('events', 10, 'reason', 'text', 'YES'),
      ('events', 11, 'prior_state', 'jsonb', 'YES'),
      ('events', 12, 'resulting_state', 'jsonb', 'YES'),
      ('events', 13, 'correlation_id', 'uuid', 'YES'),
      ('events', 14, 'created_at', 'timestamp with time zone', 'NO')
    ) expected(
      table_name,
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    )
    where not exists (
      select 1
      from information_schema.columns actual
      where actual.table_schema = 'media'
        and actual.table_name = expected.table_name
        and actual.ordinal_position = expected.ordinal_position
        and actual.column_name = expected.column_name
        and actual.data_type = expected.data_type
        and actual.is_nullable = expected.is_nullable
    )
  ) then
    raise exception
      'STOP: One or more Media columns differ from the accepted contract';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'media'
    and table_name in (
      'asset_kinds',
      'asset_purposes',
      'storage_providers',
      'variant_roles',
      'usage_roles',
      'assets',
      'file_objects',
      'asset_revisions',
      'variants',
      'variant_selections',
      'asset_governance_versions',
      'usage_links',
      'legacy_asset_links',
      'events'
    );

  if v_count <> 154 then
    raise exception
      'STOP: Expected 154 Media columns, found %',
      v_count;
  end if;

  if exists (
    select 1
    from (
      values
      ('asset_kinds', 'asset_kinds_pkey'),
      ('asset_kinds', 'asset_kinds_key_check'),
      ('asset_kinds', 'asset_kinds_label_check'),
      ('asset_kinds', 'asset_kinds_description_check'),
      ('asset_purposes', 'asset_purposes_pkey'),
      ('asset_purposes', 'asset_purposes_key_check'),
      ('asset_purposes', 'asset_purposes_label_check'),
      ('asset_purposes', 'asset_purposes_description_check'),
      ('storage_providers', 'storage_providers_pkey'),
      ('storage_providers', 'storage_providers_key_check'),
      ('storage_providers', 'storage_providers_label_check'),
      ('storage_providers', 'storage_providers_description_check'),
      ('variant_roles', 'variant_roles_pkey'),
      ('variant_roles', 'variant_roles_key_check'),
      ('variant_roles', 'variant_roles_label_check'),
      ('variant_roles', 'variant_roles_description_check'),
      ('usage_roles', 'usage_roles_pkey'),
      ('usage_roles', 'usage_roles_key_check'),
      ('usage_roles', 'usage_roles_label_check'),
      ('usage_roles', 'usage_roles_description_check'),
      ('assets', 'assets_pkey'),
      ('assets', 'assets_asset_kind_fkey'),
      ('assets', 'assets_asset_purpose_fkey'),
      ('assets', 'assets_compatibility_folder_id_fkey'),
      ('assets', 'assets_created_by_fkey'),
      ('assets', 'assets_updated_by_fkey'),
      ('assets', 'assets_title_check'),
      ('assets', 'assets_authority_revision_check'),
      ('assets', 'assets_lifecycle_state_check'),
      ('assets', 'assets_archive_integrity_check'),
      ('assets', 'assets_current_revision_id_fkey'),
      ('assets', 'assets_current_governance_version_id_fkey'),
      ('file_objects', 'file_objects_pkey'),
      ('file_objects', 'file_objects_storage_provider_fkey'),
      ('file_objects', 'file_objects_verified_by_fkey'),
      ('file_objects', 'file_objects_ingested_by_fkey'),
      ('file_objects', 'file_objects_sha256_check'),
      ('file_objects', 'file_objects_byte_size_check'),
      ('file_objects', 'file_objects_mime_type_check'),
      ('file_objects', 'file_objects_original_filename_check'),
      ('file_objects', 'file_objects_file_extension_check'),
      ('file_objects', 'file_objects_storage_namespace_check'),
      ('file_objects', 'file_objects_storage_path_check'),
      ('file_objects', 'file_objects_delivery_url_check'),
      ('file_objects', 'file_objects_locator_check'),
      ('file_objects', 'file_objects_technical_metadata_check'),
      ('file_objects', 'file_objects_verification_state_check'),
      ('file_objects', 'file_objects_verification_integrity_check'),
      ('asset_revisions', 'asset_revisions_pkey'),
      ('asset_revisions', 'asset_revisions_asset_id_fkey'),
      ('asset_revisions', 'asset_revisions_original_file_object_id_fkey'),
      ('asset_revisions', 'asset_revisions_previous_revision_id_fkey'),
      ('asset_revisions', 'asset_revisions_number_check'),
      ('asset_revisions', 'asset_revisions_replacement_reason_check'),
      ('asset_revisions', 'asset_revisions_asset_number_unique'),
      ('asset_revisions', 'asset_revisions_asset_file_unique'),
      ('asset_revisions', 'asset_revisions_first_previous_check'),
      ('variants', 'variants_pkey'),
      ('variants', 'variants_asset_id_fkey'),
      ('variants', 'variants_asset_revision_id_fkey'),
      ('variants', 'variants_source_file_object_id_fkey'),
      ('variants', 'variants_derived_file_object_id_fkey'),
      ('variants', 'variants_variant_role_fkey'),
      ('variants', 'variants_file_identity_check'),
      ('variants', 'variants_transformation_spec_check'),
      ('variants', 'variants_technical_metadata_check'),
      ('variants', 'variants_generator_name_check'),
      ('variants', 'variants_generator_version_check'),
      ('variants', 'variants_relationship_unique'),
      ('variant_selections', 'variant_selections_pkey'),
      ('variant_selections', 'variant_selections_asset_revision_id_fkey'),
      ('variant_selections', 'variant_selections_variant_role_fkey'),
      ('variant_selections', 'variant_selections_variant_id_fkey'),
      ('variant_selections', 'variant_selections_selected_by_fkey'),
      ('variant_selections', 'variant_selections_revision_check'),
      ('asset_governance_versions', 'asset_governance_versions_pkey'),
      ('asset_governance_versions', 'asset_governance_versions_asset_id_fkey'),
      ('asset_governance_versions', 'asset_governance_versions_number_check'),
      ('asset_governance_versions', 'asset_governance_versions_asset_number_unique'),
      ('asset_governance_versions', 'asset_governance_versions_rights_status_check'),
      ('asset_governance_versions', 'asset_governance_versions_consent_status_check'),
      ('asset_governance_versions', 'asset_governance_versions_sensitivity_check'),
      ('asset_governance_versions', 'asset_governance_versions_embargo_state_check'),
      ('asset_governance_versions', 'asset_governance_versions_source_protection_check'),
      ('asset_governance_versions', 'asset_governance_versions_preservation_state_check'),
      ('asset_governance_versions', 'asset_governance_versions_retention_state_check'),
      ('asset_governance_versions', 'asset_governance_versions_public_safety_check'),
      ('asset_governance_versions', 'asset_governance_versions_embargo_time_check'),
      ('asset_governance_versions', 'asset_governance_versions_public_rights_check'),
      ('asset_governance_versions', 'asset_governance_versions_public_consent_check'),
      ('asset_governance_versions', 'asset_governance_versions_confidential_check'),
      ('usage_links', 'usage_links_pkey'),
      ('usage_links', 'usage_links_asset_id_fkey'),
      ('usage_links', 'usage_links_asset_revision_id_fkey'),
      ('usage_links', 'usage_links_usage_role_fkey'),
      ('usage_links', 'usage_links_created_by_fkey'),
      ('usage_links', 'usage_links_resolution_mode_check'),
      ('usage_links', 'usage_links_target_authority_check'),
      ('usage_links', 'usage_links_target_kind_check'),
      ('usage_links', 'usage_links_target_version_pair_check'),
      ('usage_links', 'usage_links_resolution_binding_check'),
      ('usage_links', 'usage_links_placement_data_check'),
      ('usage_links', 'usage_links_display_order_check'),
      ('usage_links', 'usage_links_usage_state_check'),
      ('usage_links', 'usage_links_usage_revision_check'),
      ('usage_links', 'usage_links_state_integrity_check'),
      ('legacy_asset_links', 'legacy_asset_links_pkey'),
      ('legacy_asset_links', 'legacy_asset_links_asset_id_key'),
      ('legacy_asset_links', 'legacy_asset_links_legacy_asset_id_fkey'),
      ('legacy_asset_links', 'legacy_asset_links_asset_id_fkey'),
      ('legacy_asset_links', 'legacy_asset_links_mapping_reason_check'),
      ('legacy_asset_links', 'legacy_asset_links_snapshot_check'),
      ('events', 'events_pkey'),
      ('events', 'events_asset_id_fkey'),
      ('events', 'events_file_object_id_fkey'),
      ('events', 'events_asset_revision_id_fkey'),
      ('events', 'events_variant_id_fkey'),
      ('events', 'events_usage_link_id_fkey'),
      ('events', 'events_governance_version_id_fkey'),
      ('events', 'events_event_type_check'),
      ('events', 'events_object_identity_check'),
      ('events', 'events_prior_state_check'),
      ('events', 'events_resulting_state_check')
    ) expected(table_name, constraint_name)
    where not exists (
      select 1
      from pg_constraint constraint_row
      join pg_class relation
        on relation.oid = constraint_row.conrelid
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'media'
        and relation.relname = expected.table_name
        and constraint_row.conname = expected.constraint_name
    )
  ) then
    raise exception
      'STOP: One or more Media constraints are missing';
  end if;

  if exists (
    select 1
    from (
      values
      ('asset_kinds_pkey'),
      ('asset_purposes_pkey'),
      ('storage_providers_pkey'),
      ('variant_roles_pkey'),
      ('usage_roles_pkey'),
      ('assets_pkey'),
      ('assets_kind_state_updated_idx'),
      ('assets_purpose_state_updated_idx'),
      ('assets_compatibility_folder_idx'),
      ('assets_current_revision_idx'),
      ('assets_current_governance_idx'),
      ('file_objects_pkey'),
      ('file_objects_storage_locator_unique'),
      ('file_objects_hash_size_idx'),
      ('file_objects_verification_created_idx'),
      ('file_objects_provider_namespace_idx'),
      ('file_objects_mime_type_idx'),
      ('asset_revisions_pkey'),
      ('asset_revisions_asset_number_unique'),
      ('asset_revisions_asset_file_unique'),
      ('asset_revisions_asset_created_idx'),
      ('asset_revisions_previous_idx'),
      ('variants_pkey'),
      ('variants_relationship_unique'),
      ('variants_asset_revision_role_idx'),
      ('variants_source_file_idx'),
      ('variants_derived_file_idx'),
      ('variant_selections_pkey'),
      ('variant_selections_variant_idx'),
      ('asset_governance_versions_pkey'),
      ('asset_governance_versions_asset_number_unique'),
      ('governance_asset_created_idx'),
      ('governance_public_safety_idx'),
      ('usage_links_pkey'),
      ('usage_links_target_idx'),
      ('usage_links_asset_state_idx'),
      ('usage_links_revision_idx'),
      ('usage_links_active_identity_unique'),
      ('legacy_asset_links_pkey'),
      ('legacy_asset_links_asset_id_key'),
      ('legacy_asset_links_asset_idx'),
      ('events_pkey'),
      ('events_asset_created_idx'),
      ('events_file_object_created_idx'),
      ('events_correlation_idx')
    ) expected(index_name)
    where not exists (
      select 1
      from pg_indexes actual
      where actual.schemaname = 'media'
        and actual.indexname = expected.index_name
    )
  ) then
    raise exception
      'STOP: One or more Media indexes are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'media.assets'::regclass
      and constraint_row.conname = 'assets_current_revision_id_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
      and constraint_row.condeferred
      and pg_get_constraintdef(
        constraint_row.oid,
        true
      ) like '%ON DELETE RESTRICT%'
  ) then
    raise exception
      'STOP: Current revision foreign key is not exact';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'media.assets'::regclass
      and constraint_row.conname =
        'assets_current_governance_version_id_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
      and constraint_row.condeferred
      and pg_get_constraintdef(
        constraint_row.oid,
        true
      ) like '%ON DELETE RESTRICT%'
  ) then
    raise exception
      'STOP: Current governance foreign key is not exact';
  end if;

  if exists (
    (
      select asset_kind
      from media.asset_kinds
      except
      select *
      from (
        values
          ('image'),
          ('document'),
          ('audio'),
          ('video'),
          ('archive'),
          ('other')
      ) expected(asset_kind)
    )
    union all
    (
      select *
      from (
        values
          ('image'),
          ('document'),
          ('audio'),
          ('video'),
          ('archive'),
          ('other')
      ) expected(asset_kind)
      except
      select asset_kind
      from media.asset_kinds
    )
  ) then
    raise exception
      'STOP: Media asset-kind vocabulary differs';
  end if;

  if exists (
    (
      select asset_purpose
      from media.asset_purposes
      except
      select *
      from (
        values
          ('general'),
          ('article_hero'),
          ('article_inline'),
          ('chart_artwork'),
          ('artist_photo'),
          ('release_artwork'),
          ('track_artwork'),
          ('downloadable'),
          ('press_kit'),
          ('brand_asset'),
          ('profile_media'),
          ('social_card'),
          ('system')
      ) expected(asset_purpose)
    )
    union all
    (
      select *
      from (
        values
          ('general'),
          ('article_hero'),
          ('article_inline'),
          ('chart_artwork'),
          ('artist_photo'),
          ('release_artwork'),
          ('track_artwork'),
          ('downloadable'),
          ('press_kit'),
          ('brand_asset'),
          ('profile_media'),
          ('social_card'),
          ('system')
      ) expected(asset_purpose)
      except
      select asset_purpose
      from media.asset_purposes
    )
  ) then
    raise exception
      'STOP: Media asset-purpose vocabulary differs';
  end if;

  if exists (
    (
      select storage_provider
      from media.storage_providers
      except
      select *
      from (
        values
          ('lightsail_media'),
          ('supabase_storage'),
          ('external_url'),
          ('legacy_unknown')
      ) expected(storage_provider)
    )
    union all
    (
      select *
      from (
        values
          ('lightsail_media'),
          ('supabase_storage'),
          ('external_url'),
          ('legacy_unknown')
      ) expected(storage_provider)
      except
      select storage_provider
      from media.storage_providers
    )
  ) then
    raise exception
      'STOP: Media storage-provider vocabulary differs';
  end if;

  if exists (
    (
      select variant_role
      from media.variant_roles
      except
      select *
      from (
        values
          ('thumbnail'),
          ('responsive_width'),
          ('crop'),
          ('web_optimized'),
          ('social_card'),
          ('poster_frame'),
          ('audio_preview'),
          ('video_transcode'),
          ('preservation_copy'),
          ('other')
      ) expected(variant_role)
    )
    union all
    (
      select *
      from (
        values
          ('thumbnail'),
          ('responsive_width'),
          ('crop'),
          ('web_optimized'),
          ('social_card'),
          ('poster_frame'),
          ('audio_preview'),
          ('video_transcode'),
          ('preservation_copy'),
          ('other')
      ) expected(variant_role)
      except
      select variant_role
      from media.variant_roles
    )
  ) then
    raise exception
      'STOP: Media variant-role vocabulary differs';
  end if;

  if exists (
    (
      select usage_role
      from media.usage_roles
      except
      select *
      from (
        values
          ('article_hero'),
          ('article_inline'),
          ('chart_artwork'),
          ('artist_portrait'),
          ('author_avatar'),
          ('author_cover'),
          ('release_artwork'),
          ('track_artwork'),
          ('guide_hero'),
          ('highlight_artwork'),
          ('source_attachment'),
          ('other')
      ) expected(usage_role)
    )
    union all
    (
      select *
      from (
        values
          ('article_hero'),
          ('article_inline'),
          ('chart_artwork'),
          ('artist_portrait'),
          ('author_avatar'),
          ('author_cover'),
          ('release_artwork'),
          ('track_artwork'),
          ('guide_hero'),
          ('highlight_artwork'),
          ('source_attachment'),
          ('other')
      ) expected(usage_role)
      except
      select usage_role
      from media.usage_roles
    )
  ) then
    raise exception
      'STOP: Media usage-role vocabulary differs';
  end if;

  select count(*)
  into v_count
  from public.capability_definitions
  where capability_key in (
    'view_media_records',
    'register_media_files',
    'verify_media_files',
    'manage_media_assets',
    'manage_media_usage',
    'review_media_governance',
    'archive_media_assets',
    'approve_media_retention'
  )
    and domain = 'media';

  if v_count <> 8 then
    raise exception
      'STOP: Expected 8 Phase 4A capabilities, found %',
      v_count;
  end if;

  with expected(role_key, capability_key) as (
    values
      ('administrator', 'view_media_records'),
      ('administrator', 'register_media_files'),
      ('administrator', 'verify_media_files'),
      ('administrator', 'manage_media_assets'),
      ('administrator', 'manage_media_usage'),
      ('administrator', 'review_media_governance'),
      ('administrator', 'archive_media_assets'),
      ('administrator', 'approve_media_retention'),
      ('media_editor', 'view_media_records'),
      ('media_editor', 'register_media_files'),
      ('media_editor', 'manage_media_assets'),
      ('media_editor', 'manage_media_usage'),
      ('media_editor', 'archive_media_assets'),
      ('editor', 'view_media_records'),
      ('editor', 'register_media_files'),
      ('editor', 'manage_media_assets'),
      ('editor', 'manage_media_usage'),
      ('reviewer', 'view_media_records'),
      ('reviewer', 'review_media_governance'),
      ('registry_editor', 'view_media_records'),
      ('registry_editor', 'register_media_files'),
      ('registry_editor', 'manage_media_usage')
  )
  select count(*)
  into v_count
  from expected
  join public.role_capabilities assignment
    using (role_key, capability_key);

  if v_count <> 22 then
    raise exception
      'STOP: Expected 22 Phase 4A assignments, found %',
      v_count;
  end if;

  with expected(role_key, capability_key) as (
    values
      ('administrator', 'view_media_records'),
      ('administrator', 'register_media_files'),
      ('administrator', 'verify_media_files'),
      ('administrator', 'manage_media_assets'),
      ('administrator', 'manage_media_usage'),
      ('administrator', 'review_media_governance'),
      ('administrator', 'archive_media_assets'),
      ('administrator', 'approve_media_retention'),
      ('media_editor', 'view_media_records'),
      ('media_editor', 'register_media_files'),
      ('media_editor', 'manage_media_assets'),
      ('media_editor', 'manage_media_usage'),
      ('media_editor', 'archive_media_assets'),
      ('editor', 'view_media_records'),
      ('editor', 'register_media_files'),
      ('editor', 'manage_media_assets'),
      ('editor', 'manage_media_usage'),
      ('reviewer', 'view_media_records'),
      ('reviewer', 'review_media_governance'),
      ('registry_editor', 'view_media_records'),
      ('registry_editor', 'register_media_files'),
      ('registry_editor', 'manage_media_usage')
  )
  select count(*)
  into v_count
  from public.role_capabilities assignment
  where assignment.capability_key in (
    'view_media_records',
    'register_media_files',
    'verify_media_files',
    'manage_media_assets',
    'manage_media_usage',
    'review_media_governance',
    'archive_media_assets',
    'approve_media_retention'
  )
    and not exists (
      select 1
      from expected
      where expected.role_key = assignment.role_key
        and expected.capability_key = assignment.capability_key
    );

  if v_count <> 0 then
    raise exception
      'STOP: Forbidden Phase 4A role assignments exist: %',
      v_count;
  end if;

  select md5(
    string_agg(
      role_key,
      E'\n'
      order by role_key
    )
  )
  into v_text
  from public.role_definitions;

  if v_text <> 'c1e2f8e7d56dfdaf2e5991b38d5ff2ba' then
    raise exception
      'STOP: Role-key fingerprint changed: %',
      v_text;
  end if;

  select md5(
    string_agg(
      role_key || '|' || capability_key,
      E'\n'
      order by role_key, capability_key
    )
  )
  into v_text
  from public.role_capabilities
  where capability_key in (
    'upload_media',
    'manage_media_library',
    'view_missing_images',
    'view_broken_links',
    'view_media_migration'
  );

  if v_text <> '1a71dddc0f7dab4a260f85977873a000' then
    raise exception
      'STOP: Compatibility Media assignment fingerprint changed: %',
      v_text;
  end if;

  select md5(
    string_agg(
      table_name || '|' ||
      grantee || '|' ||
      privilege_type || '|' ||
      is_grantable,
      E'\n'
      order by
        table_name,
        grantee,
        privilege_type,
        is_grantable
    )
  )
  into v_text
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'capability_definitions',
      'role_definitions',
      'role_capabilities'
    );

  if v_text <> '08c6a19c6d1a64020c17c05b1e18cf14' then
    raise exception
      'STOP: Existing capability-table privilege fingerprint changed: %',
      v_text;
  end if;

  if md5(
       pg_get_functiondef(
         'public.current_user_has_capability(text)'::regprocedure
       )
     ) <> 'c274e080cdfc7c5df1f9240d3e1b3321'
  then
    raise exception
      'STOP: current_user_has_capability(text) changed';
  end if;

  if md5(
       pg_get_functiondef(
         'public.current_user_is_administrator()'::regprocedure
       )
     ) <> '7141fac0df104b995bff1a99f56ed563'
  then
    raise exception
      'STOP: current_user_is_administrator() changed';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace
    on namespace.oid = procedure_row.pronamespace
  where namespace.nspname = 'media'
    and procedure_row.proname in (
      'protect_immutable_row',
      'enforce_asset_pointer_integrity',
      'enforce_asset_revision_integrity',
      'enforce_variant_integrity',
      'enforce_variant_selection_integrity',
      'enforce_governance_integrity',
      'enforce_usage_link_integrity',
      'protect_usage_link_identity',
      'enforce_legacy_asset_link_integrity',
      'enforce_media_event_integrity'
    )
    and procedure_row.prosecdef = false
    and array_to_string(
      procedure_row.proconfig,
      ','
    ) like '%search_path=%';

  if v_count <> 10 then
    raise exception
      'STOP: Expected 10 internal Media functions, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_trigger trigger_row
  join pg_class relation
    on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'media'
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'file_objects_immutable',
      'asset_revisions_integrity',
      'asset_revisions_immutable',
      'assets_pointer_integrity',
      'variants_integrity',
      'variants_immutable',
      'variant_selections_integrity',
      'governance_integrity',
      'governance_immutable',
      'usage_links_integrity',
      'usage_links_identity_protection',
      'legacy_asset_links_integrity',
      'legacy_asset_links_immutable',
      'events_integrity',
      'events_append_only'
    );

  if v_count <> 15 then
    raise exception
      'STOP: Expected 15 Media triggers, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.assets'::regclass
      and trigger_row.tgname = 'assets_pointer_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) like '%AFTER INSERT OR UPDATE%'
  ) then
    raise exception
      'STOP: Media asset pointer trigger is not exact';
  end if;

  select count(*)
  into v_count
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'media'
    and relation.relkind = 'r'
    and relation.relrowsecurity
    and relation.relname in (
      'asset_kinds',
      'asset_purposes',
      'storage_providers',
      'variant_roles',
      'usage_roles',
      'assets',
      'file_objects',
      'asset_revisions',
      'variants',
      'variant_selections',
      'asset_governance_versions',
      'usage_links',
      'legacy_asset_links',
      'events'
    );

  if v_count <> 14 then
    raise exception
      'STOP: Expected RLS on 14 Media tables, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'media';

  if v_count <> 5 then
    raise exception
      'STOP: Expected exactly 5 Media policies, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'media'
      and tablename in (
        'assets',
        'file_objects',
        'asset_revisions',
        'variants',
        'variant_selections',
        'asset_governance_versions',
        'usage_links',
        'legacy_asset_links',
        'events'
      )
  ) then
    raise exception
      'STOP: Canonical Media tables must not have authenticated policies in Migration 1';
  end if;

  select
    (select count(*) from media.assets)
    + (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.asset_governance_versions)
    + (select count(*) from media.usage_links)
    + (select count(*) from media.legacy_asset_links)
    + (select count(*) from media.events)
  into v_count;

  if v_count <> 0 then
    raise exception
      'STOP: Canonical Media tables are not empty: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'media'
    and grant_row.table_name in (
      'assets',
      'file_objects',
      'asset_revisions',
      'variants',
      'variant_selections',
      'asset_governance_versions',
      'usage_links',
      'legacy_asset_links',
      'events'
    )
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE'
    );

  if v_count <> 0 then
    raise exception
      'STOP: Authenticated canonical Media write grants exist: %',
      v_count;
  end if;

  if has_schema_privilege('anon', 'media', 'USAGE') then
    raise exception
      'STOP: Anonymous role has Media schema usage';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'media'
      and grantee = 'anon'
  ) then
    raise exception
      'STOP: Anonymous role has Media table privileges';
  end if;

  if exists (
    select 1
    from information_schema.role_routine_grants
    where routine_schema = 'media'
      and grantee = 'anon'
  ) then
    raise exception
      'STOP: Anonymous role has Media routine privileges';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'public'
      and procedure_row.proname in (
        'register_media_file',
        'verify_media_file_object',
        'create_media_asset_revision',
        'register_media_variant',
        'activate_media_variant',
        'create_media_governance_version',
        'attach_media_usage',
        'detach_media_usage',
        'archive_media_usage',
        'archive_media_asset',
        'restore_media_asset',
        'request_media_retention',
        'approve_media_retention',
        'complete_media_physical_purge',
        'resolve_media_asset_delivery'
      )
  ) then
    raise exception
      'STOP: Migration 1 must not create browser-callable Media commands';
  end if;

  select count(*)
  into v_count
  from public.registry_media_assets;

  if v_count <> 1079 then
    raise exception
      'STOP: Compatibility asset count changed: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.registry_media_assets
  where status = 'active';

  if v_count <> 1079 then
    raise exception
      'STOP: Compatibility active asset count changed: %',
      v_count;
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_text
  from public.registry_media_assets asset_row;

  if v_text <> 'f32e074f96b01549b5e597ad8b5f4324' then
    raise exception
      'STOP: Compatibility asset-row fingerprint changed: %',
      v_text;
  end if;

  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'registry_media_assets',
      'media_folders'
    );

  if v_count <> 9 then
    raise exception
      'STOP: Compatibility policy count changed: %',
      v_count;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          policy_row.schemaname,
          policy_row.tablename,
          policy_row.policyname,
          policy_row.permissive,
          policy_row.roles::text,
          policy_row.cmd,
          coalesce(policy_row.qual, ''),
          coalesce(policy_row.with_check, '')
        ),
        E'\n'
        order by
          policy_row.tablename,
          policy_row.policyname
      ),
      ''
    )
  )
  into v_text
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename in (
      'registry_media_assets',
      'media_folders'
    );

  if v_text <> '9f56b431209ef2b152e7f701240cca4a' then
    raise exception
      'STOP: Compatibility policy fingerprint changed: %',
      v_text;
  end if;

  select count(*)
  into v_count
  from pg_constraint constraint_row
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_count <> 14 then
    raise exception
      'STOP: Direct compatibility foreign-key count changed: %',
      v_count;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(
            constraint_row.oid,
            true
          )
        ),
        E'\n'
        order by
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname
      ),
      ''
    )
  )
  into v_text
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_text <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: Direct compatibility foreign-key fingerprint changed: %',
      v_text;
  end if;
end;
$phase_4a_m1_verify$;

with metrics as (
  select
    to_regnamespace('media') is not null
      as media_schema_exists,

    (
      select count(*)
      from pg_class relation
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'media'
        and relation.relkind = 'r'
        and relation.relname in (
          'asset_kinds',
          'asset_purposes',
          'storage_providers',
          'variant_roles',
          'usage_roles'
        )
    ) as reference_table_count,

    (
      select count(*)
      from pg_class relation
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'media'
        and relation.relkind = 'r'
        and relation.relname in (
          'assets',
          'file_objects',
          'asset_revisions',
          'variants',
          'variant_selections',
          'asset_governance_versions',
          'usage_links',
          'legacy_asset_links',
          'events'
        )
    ) as canonical_table_count,

    (select count(*) from media.asset_kinds)
      as asset_kind_count,

    (select count(*) from media.asset_purposes)
      as asset_purpose_count,

    (select count(*) from media.storage_providers)
      as storage_provider_count,

    (select count(*) from media.variant_roles)
      as variant_role_count,

    (select count(*) from media.usage_roles)
      as usage_role_count,

    (
      select count(*)
      from public.capability_definitions
      where capability_key in (
        'view_media_records',
        'register_media_files',
        'verify_media_files',
        'manage_media_assets',
        'manage_media_usage',
        'review_media_governance',
        'archive_media_assets',
        'approve_media_retention'
      )
        and domain = 'media'
    ) as phase4a_capability_count,

    (
      select count(*)
      from public.role_capabilities
      where capability_key in (
        'view_media_records',
        'register_media_files',
        'verify_media_files',
        'manage_media_assets',
        'manage_media_usage',
        'review_media_governance',
        'archive_media_assets',
        'approve_media_retention'
      )
    ) as phase4a_role_assignment_count,

    0::bigint as forbidden_phase4a_role_assignment_count,

    (
      select md5(
        string_agg(
          role_key,
          E'\n'
          order by role_key
        )
      )
      from public.role_definitions
    ) as role_key_fingerprint,

    (
      select md5(
        string_agg(
          role_key || '|' || capability_key,
          E'\n'
          order by role_key, capability_key
        )
      )
      from public.role_capabilities
      where capability_key in (
        'upload_media',
        'manage_media_library',
        'view_missing_images',
        'view_broken_links',
        'view_media_migration'
      )
    ) as compatibility_media_role_assignment_fingerprint,

    (
      select md5(
        string_agg(
          table_name || '|' ||
          grantee || '|' ||
          privilege_type || '|' ||
          is_grantable,
          E'\n'
          order by
            table_name,
            grantee,
            privilege_type,
            is_grantable
        )
      )
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in (
          'capability_definitions',
          'role_definitions',
          'role_capabilities'
        )
    ) as capability_table_privilege_fingerprint,

    md5(
      pg_get_functiondef(
        'public.current_user_has_capability(text)'::regprocedure
      )
    ) as current_user_has_capability_definition_md5,

    md5(
      pg_get_functiondef(
        'public.current_user_is_administrator()'::regprocedure
      )
    ) as current_user_is_administrator_definition_md5,

    (
      (select count(*) from media.assets)
      + (select count(*) from media.file_objects)
      + (select count(*) from media.asset_revisions)
      + (select count(*) from media.variants)
      + (select count(*) from media.variant_selections)
      + (select count(*) from media.asset_governance_versions)
      + (select count(*) from media.usage_links)
      + (select count(*) from media.legacy_asset_links)
      + (select count(*) from media.events)
    ) as canonical_row_count,

    (
      select count(*)
      from pg_class relation
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'media'
        and relation.relkind = 'r'
        and relation.relrowsecurity
    ) as rls_enabled_table_count,

    (
      select count(*)
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'media'
        and grant_row.table_name in (
          'assets',
          'file_objects',
          'asset_revisions',
          'variants',
          'variant_selections',
          'asset_governance_versions',
          'usage_links',
          'legacy_asset_links',
          'events'
        )
        and grant_row.grantee = 'authenticated'
        and grant_row.privilege_type in (
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
        )
    ) as authenticated_canonical_write_grant_count,

    (
      (
        case
          when has_schema_privilege(
            'anon',
            'media',
            'USAGE'
          )
            then 1
          else 0
        end
      )
      + (
        select count(*)
        from information_schema.role_table_grants
        where table_schema = 'media'
          and grantee = 'anon'
      )
      + (
        select count(*)
        from information_schema.role_routine_grants
        where routine_schema = 'media'
          and grantee = 'anon'
      )
    ) as anonymous_media_privilege_count,

    (
      select count(*)
      from pg_constraint constraint_row
      join pg_class referenced_table
        on referenced_table.oid = constraint_row.confrelid
      join pg_namespace referenced_namespace
        on referenced_namespace.oid = referenced_table.relnamespace
      where constraint_row.contype = 'f'
        and referenced_namespace.nspname = 'public'
        and referenced_table.relname = 'registry_media_assets'
    ) as direct_registry_media_asset_fk_count,

    (
      select md5(
        coalesce(
          string_agg(
            concat_ws(
              '|',
              source_namespace.nspname,
              source_table.relname,
              constraint_row.conname,
              pg_get_constraintdef(
                constraint_row.oid,
                true
              )
            ),
            E'\n'
            order by
              source_namespace.nspname,
              source_table.relname,
              constraint_row.conname
          ),
          ''
        )
      )
      from pg_constraint constraint_row
      join pg_class source_table
        on source_table.oid = constraint_row.conrelid
      join pg_namespace source_namespace
        on source_namespace.oid = source_table.relnamespace
      join pg_class referenced_table
        on referenced_table.oid = constraint_row.confrelid
      join pg_namespace referenced_namespace
        on referenced_namespace.oid = referenced_table.relnamespace
      where constraint_row.contype = 'f'
        and referenced_namespace.nspname = 'public'
        and referenced_table.relname = 'registry_media_assets'
    ) as direct_registry_media_asset_fk_fingerprint,

    (
      select count(*)
      from public.registry_media_assets
    ) as compatibility_asset_count,

    (
      select count(*)
      from public.registry_media_assets
      where status = 'active'
    ) as compatibility_active_asset_count,

    (
      select md5(
        string_agg(
          to_jsonb(asset_row)::text,
          E'\n'
          order by asset_row.id::text
        )
      )
      from public.registry_media_assets asset_row
    ) as compatibility_asset_row_fingerprint,

    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename in (
          'registry_media_assets',
          'media_folders'
        )
    ) as compatibility_policy_count,

    (
      select md5(
        coalesce(
          string_agg(
            concat_ws(
              '|',
              policy_row.schemaname,
              policy_row.tablename,
              policy_row.policyname,
              policy_row.permissive,
              policy_row.roles::text,
              policy_row.cmd,
              coalesce(policy_row.qual, ''),
              coalesce(policy_row.with_check, '')
            ),
            E'\n'
            order by
              policy_row.tablename,
              policy_row.policyname
          ),
          ''
        )
      )
      from pg_policies policy_row
      where policy_row.schemaname = 'public'
        and policy_row.tablename in (
          'registry_media_assets',
          'media_folders'
        )
    ) as compatibility_policy_fingerprint
)
select jsonb_build_object(
  'verification', 'PASS',
  'media_schema_exists',
    media_schema_exists,
  'reference_table_count',
    reference_table_count,
  'canonical_table_count',
    canonical_table_count,
  'asset_kind_count',
    asset_kind_count,
  'asset_purpose_count',
    asset_purpose_count,
  'storage_provider_count',
    storage_provider_count,
  'variant_role_count',
    variant_role_count,
  'usage_role_count',
    usage_role_count,
  'phase4a_capability_count',
    phase4a_capability_count,
  'phase4a_role_assignment_count',
    phase4a_role_assignment_count,
  'forbidden_phase4a_role_assignment_count',
    forbidden_phase4a_role_assignment_count,
  'role_key_fingerprint',
    role_key_fingerprint,
  'compatibility_media_role_assignment_fingerprint',
    compatibility_media_role_assignment_fingerprint,
  'capability_table_privilege_fingerprint',
    capability_table_privilege_fingerprint,
  'current_user_has_capability_definition_md5',
    current_user_has_capability_definition_md5,
  'current_user_is_administrator_definition_md5',
    current_user_is_administrator_definition_md5,
  'canonical_row_count',
    canonical_row_count,
  'rls_enabled_table_count',
    rls_enabled_table_count,
  'authenticated_canonical_write_grant_count',
    authenticated_canonical_write_grant_count,
  'anonymous_media_privilege_count',
    anonymous_media_privilege_count,
  'direct_registry_media_asset_fk_count',
    direct_registry_media_asset_fk_count,
  'direct_registry_media_asset_fk_fingerprint',
    direct_registry_media_asset_fk_fingerprint,
  'compatibility_asset_count',
    compatibility_asset_count,
  'compatibility_active_asset_count',
    compatibility_active_asset_count,
  'compatibility_asset_row_fingerprint',
    compatibility_asset_row_fingerprint,
  'compatibility_policy_count',
    compatibility_policy_count,
  'compatibility_policy_fingerprint',
    compatibility_policy_fingerprint,
  'migration_scope',
    'schema_only'
) as phase_4a_m1_media_authority_foundation;

rollback;
