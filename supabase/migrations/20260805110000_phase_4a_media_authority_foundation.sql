-- Phase 4A Migration 1: Media authority foundation.
--
-- This migration establishes the empty canonical Media schema, controlled
-- vocabularies, capabilities, integrity protection, and access perimeter.
--
-- It does not backfill compatibility assets, create public commands, alter
-- compatibility tables, or change Media runtime behavior.

begin;

do $phase_4a_m1_preflight$
begin
  if to_regclass('public.capability_definitions') is null then
    raise exception
      'STOP: public.capability_definitions does not exist';
  end if;

  if to_regclass('public.role_definitions') is null then
    raise exception
      'STOP: public.role_definitions does not exist';
  end if;

  if to_regclass('public.role_capabilities') is null then
    raise exception
      'STOP: public.role_capabilities does not exist';
  end if;

  if to_regclass('public.registry_media_assets') is null then
    raise exception
      'STOP: public.registry_media_assets does not exist';
  end if;

  if to_regclass('public.media_folders') is null then
    raise exception
      'STOP: public.media_folders does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_has_capability(text)'
  ) is null then
    raise exception
      'STOP: current_user_has_capability(text) does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_is_administrator()'
  ) is null then
    raise exception
      'STOP: current_user_is_administrator() does not exist';
  end if;

  if not exists (
    select 1
    from pg_extension
    where extname = 'pgcrypto'
  ) then
    raise exception
      'STOP: pgcrypto extension does not exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('media_editor'),
        ('editor'),
        ('reviewer'),
        ('registry_editor')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions definition
      where definition.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: One or more required Phase 4A role definitions do not exist';
  end if;
end;
$phase_4a_m1_preflight$;

create schema if not exists media;

revoke all on schema media from public, anon, authenticated;
grant usage on schema media to authenticated, service_role;

create table if not exists media.asset_kinds (
  asset_kind text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint asset_kinds_key_check
    check (asset_kind ~ '^[a-z][a-z0-9_]*$'),

  constraint asset_kinds_label_check
    check (nullif(btrim(label), '') is not null),

  constraint asset_kinds_description_check
    check (nullif(btrim(description), '') is not null)
);

create table if not exists media.asset_purposes (
  asset_purpose text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint asset_purposes_key_check
    check (asset_purpose ~ '^[a-z][a-z0-9_]*$'),

  constraint asset_purposes_label_check
    check (nullif(btrim(label), '') is not null),

  constraint asset_purposes_description_check
    check (nullif(btrim(description), '') is not null)
);

create table if not exists media.storage_providers (
  storage_provider text primary key,
  label text not null,
  description text not null,
  supports_verification boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),

  constraint storage_providers_key_check
    check (storage_provider ~ '^[a-z][a-z0-9_]*$'),

  constraint storage_providers_label_check
    check (nullif(btrim(label), '') is not null),

  constraint storage_providers_description_check
    check (nullif(btrim(description), '') is not null)
);

create table if not exists media.variant_roles (
  variant_role text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint variant_roles_key_check
    check (variant_role ~ '^[a-z][a-z0-9_]*$'),

  constraint variant_roles_label_check
    check (nullif(btrim(label), '') is not null),

  constraint variant_roles_description_check
    check (nullif(btrim(description), '') is not null)
);

create table if not exists media.usage_roles (
  usage_role text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint usage_roles_key_check
    check (usage_role ~ '^[a-z][a-z0-9_]*$'),

  constraint usage_roles_label_check
    check (nullif(btrim(label), '') is not null),

  constraint usage_roles_description_check
    check (nullif(btrim(description), '') is not null)
);

insert into media.asset_kinds (
  asset_kind,
  label,
  description,
  sort_order
)
values
  ('image', 'Image', 'Still image Media.', 10),
  ('document', 'Document', 'Document Media.', 20),
  ('audio', 'Audio', 'Audio Media.', 30),
  ('video', 'Video', 'Video Media.', 40),
  ('archive', 'Archive', 'Archive or package Media.', 50),
  ('other', 'Other', 'Other governed Media.', 1000)
on conflict (asset_kind)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

insert into media.asset_purposes (
  asset_purpose,
  label,
  description,
  sort_order
)
values
  ('general', 'General', 'General reusable Media.', 10),
  ('article_hero', 'Article hero', 'Hero Media for an Article.', 20),
  ('article_inline', 'Article inline', 'Inline Media for an Article.', 30),
  ('chart_artwork', 'Chart artwork', 'Artwork used by Chart authority.', 40),
  ('artist_photo', 'Artist photo', 'Artist portrait or profile Media.', 50),
  ('release_artwork', 'Release artwork', 'Release artwork Media.', 60),
  ('track_artwork', 'Track artwork', 'Track artwork Media.', 70),
  ('downloadable', 'Downloadable', 'Downloadable document or package.', 80),
  ('press_kit', 'Press kit', 'Press-kit Media.', 90),
  ('brand_asset', 'Brand asset', 'Reusable WAKILISHA brand Media.', 100),
  ('profile_media', 'Profile Media', 'Avatar, cover, or profile Media.', 110),
  ('social_card', 'Social card', 'Social sharing Media.', 120),
  ('system', 'System', 'System-generated or operational Media.', 1000)
on conflict (asset_purpose)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

insert into media.storage_providers (
  storage_provider,
  label,
  description,
  supports_verification
)
values
  (
    'lightsail_media',
    'Lightsail Media',
    'WAKILISHA Lightsail Media storage.',
    true
  ),
  (
    'supabase_storage',
    'Supabase Storage',
    'Supabase Storage object authority.',
    true
  ),
  (
    'external_url',
    'External URL',
    'Externally hosted delivery URL.',
    false
  ),
  (
    'legacy_unknown',
    'Legacy unknown',
    'Legacy locator whose storage provider is not yet proven.',
    false
  )
on conflict (storage_provider)
do update set
  label = excluded.label,
  description = excluded.description,
  supports_verification = excluded.supports_verification,
  enabled = true;

insert into media.variant_roles (
  variant_role,
  label,
  description,
  sort_order
)
values
  ('thumbnail', 'Thumbnail', 'Small preview derivative.', 10),
  ('responsive_width', 'Responsive width', 'Width-specific responsive derivative.', 20),
  ('crop', 'Crop', 'Governed crop derivative.', 30),
  ('web_optimized', 'Web optimized', 'Web-delivery optimized derivative.', 40),
  ('social_card', 'Social card', 'Social-card derivative.', 50),
  ('poster_frame', 'Poster frame', 'Poster frame for moving Media.', 60),
  ('audio_preview', 'Audio preview', 'Audio preview derivative.', 70),
  ('video_transcode', 'Video transcode', 'Video transcode derivative.', 80),
  ('preservation_copy', 'Preservation copy', 'Preservation derivative.', 90),
  ('other', 'Other', 'Other governed derivative.', 1000)
on conflict (variant_role)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

insert into media.usage_roles (
  usage_role,
  label,
  description,
  sort_order
)
values
  ('article_hero', 'Article hero', 'Hero placement for an Article.', 10),
  ('article_inline', 'Article inline', 'Inline placement for an Article.', 20),
  ('chart_artwork', 'Chart artwork', 'Artwork placement for a Chart entry.', 30),
  ('artist_portrait', 'Artist portrait', 'Portrait placement for an Artist.', 40),
  ('author_avatar', 'Author avatar', 'Avatar placement for an Author.', 50),
  ('author_cover', 'Author cover', 'Cover placement for an Author.', 60),
  ('release_artwork', 'Release artwork', 'Artwork placement for a Release.', 70),
  ('track_artwork', 'Track artwork', 'Artwork placement for a Track.', 80),
  ('guide_hero', 'Guide hero', 'Hero placement for a Guide.', 90),
  ('highlight_artwork', 'Highlight artwork', 'Artwork placement for a Highlight.', 100),
  ('source_attachment', 'Source attachment', 'Media attached to a Source.', 110),
  ('other', 'Other', 'Other governed Media placement.', 1000)
on conflict (usage_role)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

create table if not exists media.assets (
  id uuid primary key default gen_random_uuid(),
  asset_kind text not null,
  asset_purpose text not null default 'general',
  title text not null,
  lifecycle_state text not null default 'active',
  compatibility_folder_id uuid,
  current_revision_id uuid,
  current_governance_version_id uuid,
  authority_revision bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  archived_by uuid,
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assets_asset_kind_fkey
    foreign key (asset_kind)
    references media.asset_kinds(asset_kind)
    on update cascade
    on delete restrict,

  constraint assets_asset_purpose_fkey
    foreign key (asset_purpose)
    references media.asset_purposes(asset_purpose)
    on update cascade
    on delete restrict,

  constraint assets_compatibility_folder_id_fkey
    foreign key (compatibility_folder_id)
    references public.media_folders(id)
    on delete set null,

  constraint assets_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint assets_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint assets_title_check
    check (nullif(btrim(title), '') is not null),

  constraint assets_authority_revision_check
    check (authority_revision >= 1),

  constraint assets_lifecycle_state_check
    check (
      lifecycle_state in (
        'active',
        'archived',
        'retention_pending',
        'purged'
      )
    ),

  constraint assets_archive_integrity_check
    check (
      (
        lifecycle_state <> 'archived'
        or (
          archived_by is not null
          and archived_at is not null
          and nullif(btrim(archive_reason), '') is not null
        )
      )
      and
      (
        lifecycle_state <> 'active'
        or (
          archived_by is null
          and archived_at is null
          and archive_reason is null
        )
      )
    )
);

create table if not exists media.file_objects (
  id uuid primary key default gen_random_uuid(),
  sha256 text,
  byte_size bigint,
  mime_type text,
  original_filename text,
  file_extension text,
  storage_provider text not null,
  storage_namespace text,
  storage_path text,
  delivery_url text,
  technical_metadata jsonb not null default '{}'::jsonb,
  verification_state text not null default 'unverified',
  verified_by uuid,
  verified_at timestamptz,
  verification_error text,
  ingested_by uuid,
  created_at timestamptz not null default now(),

  constraint file_objects_storage_provider_fkey
    foreign key (storage_provider)
    references media.storage_providers(storage_provider)
    on update cascade
    on delete restrict,

  constraint file_objects_verified_by_fkey
    foreign key (verified_by)
    references auth.users(id)
    on delete set null,

  constraint file_objects_ingested_by_fkey
    foreign key (ingested_by)
    references auth.users(id)
    on delete set null,

  constraint file_objects_sha256_check
    check (
      sha256 is null
      or sha256 ~ '^[0-9a-f]{64}$'
    ),

  constraint file_objects_byte_size_check
    check (
      byte_size is null
      or byte_size >= 0
    ),

  constraint file_objects_mime_type_check
    check (
      mime_type is null
      or nullif(btrim(mime_type), '') is not null
    ),

  constraint file_objects_original_filename_check
    check (
      original_filename is null
      or nullif(btrim(original_filename), '') is not null
    ),

  constraint file_objects_file_extension_check
    check (
      file_extension is null
      or nullif(btrim(file_extension), '') is not null
    ),

  constraint file_objects_storage_namespace_check
    check (
      storage_namespace is null
      or nullif(btrim(storage_namespace), '') is not null
    ),

  constraint file_objects_storage_path_check
    check (
      storage_path is null
      or nullif(btrim(storage_path), '') is not null
    ),

  constraint file_objects_delivery_url_check
    check (
      delivery_url is null
      or nullif(btrim(delivery_url), '') is not null
    ),

  constraint file_objects_locator_check
    check (
      storage_path is not null
      or delivery_url is not null
    ),

  constraint file_objects_technical_metadata_check
    check (
      jsonb_typeof(technical_metadata) = 'object'
    ),

  constraint file_objects_verification_state_check
    check (
      verification_state in (
        'unverified',
        'verified',
        'failed',
        'unreachable'
      )
    ),

  constraint file_objects_verification_integrity_check
    check (
      (
        verification_state = 'unverified'
        and verified_by is null
        and verified_at is null
        and verification_error is null
      )
      or
      (
        verification_state = 'verified'
        and sha256 is not null
        and byte_size is not null
        and nullif(btrim(mime_type), '') is not null
        and storage_path is not null
        and verified_by is not null
        and verified_at is not null
        and verification_error is null
      )
      or
      (
        verification_state in ('failed', 'unreachable')
        and nullif(btrim(verification_error), '') is not null
        and (
          (
            verified_by is null
            and verified_at is null
          )
          or
          (
            verified_by is not null
            and verified_at is not null
          )
        )
      )
    )
);

create table if not exists media.asset_revisions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  revision_number bigint not null,
  original_file_object_id uuid not null,
  previous_revision_id uuid,
  replacement_reason text not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint asset_revisions_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint asset_revisions_original_file_object_id_fkey
    foreign key (original_file_object_id)
    references media.file_objects(id)
    on delete restrict,

  constraint asset_revisions_previous_revision_id_fkey
    foreign key (previous_revision_id)
    references media.asset_revisions(id)
    on delete restrict,

  constraint asset_revisions_number_check
    check (revision_number >= 1),

  constraint asset_revisions_replacement_reason_check
    check (nullif(btrim(replacement_reason), '') is not null),

  constraint asset_revisions_asset_number_unique
    unique (asset_id, revision_number),

  constraint asset_revisions_asset_file_unique
    unique (asset_id, original_file_object_id),

  constraint asset_revisions_first_previous_check
    check (
      (
        revision_number = 1
        and previous_revision_id is null
      )
      or
      (
        revision_number > 1
        and previous_revision_id is not null
      )
    )
);

create table if not exists media.variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  asset_revision_id uuid not null,
  source_file_object_id uuid not null,
  derived_file_object_id uuid not null,
  variant_role text not null,
  transformation_spec jsonb not null default '{}'::jsonb,
  technical_metadata jsonb not null default '{}'::jsonb,
  generator_name text,
  generator_version text,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint variants_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint variants_asset_revision_id_fkey
    foreign key (asset_revision_id)
    references media.asset_revisions(id)
    on delete restrict,

  constraint variants_source_file_object_id_fkey
    foreign key (source_file_object_id)
    references media.file_objects(id)
    on delete restrict,

  constraint variants_derived_file_object_id_fkey
    foreign key (derived_file_object_id)
    references media.file_objects(id)
    on delete restrict,

  constraint variants_variant_role_fkey
    foreign key (variant_role)
    references media.variant_roles(variant_role)
    on update cascade
    on delete restrict,

  constraint variants_file_identity_check
    check (
      source_file_object_id <> derived_file_object_id
    ),

  constraint variants_transformation_spec_check
    check (
      jsonb_typeof(transformation_spec) = 'object'
    ),

  constraint variants_technical_metadata_check
    check (
      jsonb_typeof(technical_metadata) = 'object'
    ),

  constraint variants_generator_name_check
    check (
      generator_name is null
      or nullif(btrim(generator_name), '') is not null
    ),

  constraint variants_generator_version_check
    check (
      generator_version is null
      or nullif(btrim(generator_version), '') is not null
    ),

  constraint variants_relationship_unique
    unique (
      asset_revision_id,
      source_file_object_id,
      derived_file_object_id,
      variant_role
    )
);

create table if not exists media.variant_selections (
  asset_revision_id uuid not null,
  variant_role text not null,
  variant_id uuid not null,
  selection_revision bigint not null default 1,
  selected_by uuid,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint variant_selections_pkey
    primary key (asset_revision_id, variant_role),

  constraint variant_selections_asset_revision_id_fkey
    foreign key (asset_revision_id)
    references media.asset_revisions(id)
    on delete restrict,

  constraint variant_selections_variant_role_fkey
    foreign key (variant_role)
    references media.variant_roles(variant_role)
    on update cascade
    on delete restrict,

  constraint variant_selections_variant_id_fkey
    foreign key (variant_id)
    references media.variants(id)
    on delete restrict,

  constraint variant_selections_selected_by_fkey
    foreign key (selected_by)
    references auth.users(id)
    on delete set null,

  constraint variant_selections_revision_check
    check (selection_revision >= 1)
);

create table if not exists media.asset_governance_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  version_number bigint not null,
  rights_status text not null default 'unknown',
  rights_basis text,
  rights_holder text,
  licence_identifier text,
  licence_terms text,
  consent_status text not null default 'unknown',
  consent_scope text,
  sensitivity text not null default 'none',
  embargo_state text not null default 'none',
  embargo_until timestamptz,
  source_protection_class text not null default 'internal',
  preservation_state text not null default 'unassessed',
  retention_state text not null default 'retain',
  public_safety_state text not null default 'internal',
  internal_reason text,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint asset_governance_versions_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint asset_governance_versions_number_check
    check (version_number >= 1),

  constraint asset_governance_versions_asset_number_unique
    unique (asset_id, version_number),

  constraint asset_governance_versions_rights_status_check
    check (
      rights_status in (
        'unknown',
        'owned',
        'licensed',
        'public_domain',
        'fair_use',
        'needs_clearance',
        'restricted'
      )
    ),

  constraint asset_governance_versions_consent_status_check
    check (
      consent_status in (
        'unknown',
        'not_required',
        'requested',
        'granted',
        'limited',
        'declined',
        'withdrawn'
      )
    ),

  constraint asset_governance_versions_sensitivity_check
    check (
      sensitivity in (
        'none',
        'low',
        'moderate',
        'high',
        'extreme'
      )
    ),

  constraint asset_governance_versions_embargo_state_check
    check (
      embargo_state in (
        'none',
        'scheduled',
        'active',
        'released'
      )
    ),

  constraint asset_governance_versions_source_protection_check
    check (
      source_protection_class in (
        'public',
        'public_redacted',
        'internal',
        'restricted',
        'confidential'
      )
    ),

  constraint asset_governance_versions_preservation_state_check
    check (
      preservation_state in (
        'unassessed',
        'working_copy',
        'preservation_candidate',
        'preserved',
        'at_risk',
        'lost'
      )
    ),

  constraint asset_governance_versions_retention_state_check
    check (
      retention_state in (
        'retain',
        'review_required',
        'purge_requested',
        'purge_approved',
        'purged'
      )
    ),

  constraint asset_governance_versions_public_safety_check
    check (
      public_safety_state in (
        'internal',
        'review_required',
        'approved_public',
        'approved_redacted',
        'blocked'
      )
    ),

  constraint asset_governance_versions_embargo_time_check
    check (
      embargo_state not in ('scheduled', 'active')
      or embargo_until is not null
    ),

  constraint asset_governance_versions_public_rights_check
    check (
      public_safety_state not in (
        'approved_public',
        'approved_redacted'
      )
      or rights_status <> 'restricted'
    ),

  constraint asset_governance_versions_public_consent_check
    check (
      public_safety_state not in (
        'approved_public',
        'approved_redacted'
      )
      or consent_status in ('granted', 'not_required')
    ),

  constraint asset_governance_versions_confidential_check
    check (
      source_protection_class <> 'confidential'
      or public_safety_state not in (
        'approved_public',
        'approved_redacted'
      )
    )
);

create table if not exists media.usage_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  asset_revision_id uuid,
  resolution_mode text not null default 'current_revision',
  target_authority text not null,
  target_kind text not null,
  target_id uuid not null,
  target_version_kind text,
  target_version_id uuid,
  usage_role text not null,
  placement_data jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  alt_text_snapshot text,
  caption_snapshot text,
  credit_snapshot text,
  usage_state text not null default 'active',
  usage_revision bigint not null default 1,
  state_reason text,
  state_changed_by uuid,
  state_changed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usage_links_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint usage_links_asset_revision_id_fkey
    foreign key (asset_revision_id)
    references media.asset_revisions(id)
    on delete restrict,

  constraint usage_links_usage_role_fkey
    foreign key (usage_role)
    references media.usage_roles(usage_role)
    on update cascade
    on delete restrict,

  constraint usage_links_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint usage_links_resolution_mode_check
    check (
      resolution_mode in (
        'current_revision',
        'exact_revision',
        'legacy_snapshot'
      )
    ),

  constraint usage_links_target_authority_check
    check (
      target_authority in (
        'editorial',
        'registry',
        'charts',
        'guides',
        'sources'
      )
    ),

  constraint usage_links_target_kind_check
    check (
      target_kind in (
        'article',
        'artist',
        'author',
        'release',
        'track',
        'chart_entry',
        'guide',
        'guide_page',
        'highlight',
        'source'
      )
    ),

  constraint usage_links_target_version_pair_check
    check (
      (
        target_version_kind is null
        and target_version_id is null
      )
      or
      (
        nullif(btrim(target_version_kind), '') is not null
        and target_version_id is not null
      )
    ),

  constraint usage_links_resolution_binding_check
    check (
      (
        resolution_mode in (
          'current_revision',
          'legacy_snapshot'
        )
        and asset_revision_id is null
      )
      or
      (
        resolution_mode = 'exact_revision'
        and asset_revision_id is not null
      )
    ),

  constraint usage_links_placement_data_check
    check (
      jsonb_typeof(placement_data) = 'object'
    ),

  constraint usage_links_display_order_check
    check (display_order >= 0),

  constraint usage_links_usage_state_check
    check (
      usage_state in (
        'active',
        'detached',
        'archived'
      )
    ),

  constraint usage_links_usage_revision_check
    check (usage_revision >= 1),

  constraint usage_links_state_integrity_check
    check (
      (
        usage_state = 'active'
        and state_reason is null
        and state_changed_by is null
        and state_changed_at is null
      )
      or
      (
        usage_state in ('detached', 'archived')
        and nullif(btrim(state_reason), '') is not null
        and state_changed_by is not null
        and state_changed_at is not null
      )
    )
);

create table if not exists media.legacy_asset_links (
  legacy_asset_id uuid primary key,
  asset_id uuid not null unique,
  mapping_reason text not null,
  legacy_snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint legacy_asset_links_legacy_asset_id_fkey
    foreign key (legacy_asset_id)
    references public.registry_media_assets(id)
    on delete restrict,

  constraint legacy_asset_links_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint legacy_asset_links_mapping_reason_check
    check (nullif(btrim(mapping_reason), '') is not null),

  constraint legacy_asset_links_snapshot_check
    check (jsonb_typeof(legacy_snapshot) = 'object')
);

create table if not exists media.events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid,
  file_object_id uuid,
  asset_revision_id uuid,
  variant_id uuid,
  usage_link_id uuid,
  governance_version_id uuid,
  event_type text not null,
  actor_id uuid,
  reason text,
  prior_state jsonb,
  resulting_state jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now(),

  constraint events_asset_id_fkey
    foreign key (asset_id)
    references media.assets(id)
    on delete restrict,

  constraint events_file_object_id_fkey
    foreign key (file_object_id)
    references media.file_objects(id)
    on delete restrict,

  constraint events_asset_revision_id_fkey
    foreign key (asset_revision_id)
    references media.asset_revisions(id)
    on delete restrict,

  constraint events_variant_id_fkey
    foreign key (variant_id)
    references media.variants(id)
    on delete restrict,

  constraint events_usage_link_id_fkey
    foreign key (usage_link_id)
    references media.usage_links(id)
    on delete restrict,

  constraint events_governance_version_id_fkey
    foreign key (governance_version_id)
    references media.asset_governance_versions(id)
    on delete restrict,

  constraint events_event_type_check
    check (
      event_type in (
        'asset_created',
        'legacy_asset_mapped',
        'file_object_registered',
        'file_object_verified',
        'file_object_verification_failed',
        'file_object_unreachable',
        'asset_revision_created',
        'asset_revision_activated',
        'variant_registered',
        'variant_activated',
        'usage_attached',
        'usage_detached',
        'usage_archived',
        'governance_version_created',
        'asset_archived',
        'asset_restored',
        'retention_requested',
        'retention_approved',
        'physical_purge_completed'
      )
    ),

  constraint events_object_identity_check
    check (
      num_nonnulls(
        asset_id,
        file_object_id,
        asset_revision_id,
        variant_id,
        usage_link_id,
        governance_version_id
      ) >= 1
    ),

  constraint events_prior_state_check
    check (
      prior_state is null
      or jsonb_typeof(prior_state) = 'object'
    ),

  constraint events_resulting_state_check
    check (
      resulting_state is null
      or jsonb_typeof(resulting_state) = 'object'
    )
);

do $phase_4a_m1_pointer_foreign_keys$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_current_revision_id_fkey'
      and conrelid = 'media.assets'::regclass
  ) then
    alter table media.assets
      add constraint assets_current_revision_id_fkey
      foreign key (current_revision_id)
      references media.asset_revisions(id)
      on delete restrict
      deferrable initially deferred;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_current_governance_version_id_fkey'
      and conrelid = 'media.assets'::regclass
  ) then
    alter table media.assets
      add constraint assets_current_governance_version_id_fkey
      foreign key (current_governance_version_id)
      references media.asset_governance_versions(id)
      on delete restrict
      deferrable initially deferred;
  end if;
end;
$phase_4a_m1_pointer_foreign_keys$;

create unique index if not exists file_objects_storage_locator_unique
on media.file_objects (
  storage_provider,
  coalesce(storage_namespace, ''),
  storage_path
)
where storage_path is not null;

create index if not exists assets_kind_state_updated_idx
on media.assets (
  asset_kind,
  lifecycle_state,
  updated_at desc
);

create index if not exists assets_purpose_state_updated_idx
on media.assets (
  asset_purpose,
  lifecycle_state,
  updated_at desc
);

create index if not exists assets_compatibility_folder_idx
on media.assets (compatibility_folder_id)
where compatibility_folder_id is not null;

create index if not exists assets_current_revision_idx
on media.assets (current_revision_id)
where current_revision_id is not null;

create index if not exists assets_current_governance_idx
on media.assets (current_governance_version_id)
where current_governance_version_id is not null;

create index if not exists file_objects_hash_size_idx
on media.file_objects (sha256, byte_size)
where sha256 is not null;

create index if not exists file_objects_verification_created_idx
on media.file_objects (
  verification_state,
  created_at desc
);

create index if not exists file_objects_provider_namespace_idx
on media.file_objects (
  storage_provider,
  storage_namespace
);

create index if not exists file_objects_mime_type_idx
on media.file_objects (mime_type)
where mime_type is not null;

create index if not exists asset_revisions_asset_created_idx
on media.asset_revisions (
  asset_id,
  created_at desc
);

create index if not exists asset_revisions_previous_idx
on media.asset_revisions (previous_revision_id)
where previous_revision_id is not null;

create index if not exists variants_asset_revision_role_idx
on media.variants (
  asset_revision_id,
  variant_role,
  created_at desc
);

create index if not exists variants_source_file_idx
on media.variants (source_file_object_id);

create index if not exists variants_derived_file_idx
on media.variants (derived_file_object_id);

create index if not exists variant_selections_variant_idx
on media.variant_selections (variant_id);

create index if not exists governance_asset_created_idx
on media.asset_governance_versions (
  asset_id,
  created_at desc
);

create index if not exists governance_public_safety_idx
on media.asset_governance_versions (
  public_safety_state,
  rights_status,
  consent_status,
  created_at desc
);

create index if not exists usage_links_target_idx
on media.usage_links (
  target_authority,
  target_kind,
  target_id,
  usage_state
);

create index if not exists usage_links_asset_state_idx
on media.usage_links (
  asset_id,
  usage_state,
  updated_at desc
);

create index if not exists usage_links_revision_idx
on media.usage_links (asset_revision_id)
where asset_revision_id is not null;

create unique index if not exists usage_links_active_identity_unique
on media.usage_links (
  asset_id,
  target_authority,
  target_kind,
  target_id,
  coalesce(target_version_kind, ''),
  coalesce(
    target_version_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  usage_role,
  md5(placement_data::text)
)
where usage_state = 'active';

create index if not exists legacy_asset_links_asset_idx
on media.legacy_asset_links (asset_id);

create index if not exists events_asset_created_idx
on media.events (
  asset_id,
  created_at desc,
  id desc
)
where asset_id is not null;

create index if not exists events_file_object_created_idx
on media.events (
  file_object_id,
  created_at desc,
  id desc
)
where file_object_id is not null;

create index if not exists events_correlation_idx
on media.events (
  correlation_id,
  created_at,
  id
)
where correlation_id is not null;

create or replace function media.protect_immutable_row()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Media row in %.% is immutable',
    tg_table_schema,
    tg_table_name;
end;
$function$;

create or replace function media.enforce_asset_pointer_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, media
as $function$
declare
  v_revision_asset_id uuid;
  v_revision_number bigint;
  v_verification_state text;
  v_highest_revision bigint;
  v_governance_asset_id uuid;
begin
  if new.current_revision_id is not null then
    select
      revision.asset_id,
      revision.revision_number,
      file_object.verification_state
    into
      v_revision_asset_id,
      v_revision_number,
      v_verification_state
    from media.asset_revisions revision
    join media.file_objects file_object
      on file_object.id = revision.original_file_object_id
    where revision.id = new.current_revision_id;

    if not found
       or v_revision_asset_id <> new.id
       or v_verification_state <> 'verified'
    then
      raise exception
        'Current Media revision must belong to the asset and use a verified file object';
    end if;

    select max(revision.revision_number)
    into v_highest_revision
    from media.asset_revisions revision
    where revision.asset_id = new.id;

    if v_revision_number <> v_highest_revision then
      raise exception
        'Current Media revision must be the highest asset revision';
    end if;
  end if;

  if new.current_governance_version_id is not null then
    select governance.asset_id
    into v_governance_asset_id
    from media.asset_governance_versions governance
    where governance.id = new.current_governance_version_id;

    if not found
       or v_governance_asset_id <> new.id
    then
      raise exception
        'Current Media governance version must belong to the asset';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_asset_revision_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, media
as $function$
declare
  v_previous_asset_id uuid;
  v_previous_number bigint;
begin
  if new.revision_number = 1 then
    if new.previous_revision_id is not null then
      raise exception
        'Media revision 1 must not have a previous revision';
    end if;
  else
    select
      revision.asset_id,
      revision.revision_number
    into
      v_previous_asset_id,
      v_previous_number
    from media.asset_revisions revision
    where revision.id = new.previous_revision_id;

    if not found
       or v_previous_asset_id <> new.asset_id
       or v_previous_number <> new.revision_number - 1
    then
      raise exception
        'Media revision must reference the immediately previous revision for the same asset';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_variant_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, media
as $function$
declare
  v_revision_asset_id uuid;
  v_revision_original_file_id uuid;
  v_source_state text;
  v_derived_state text;
begin
  select
    revision.asset_id,
    revision.original_file_object_id
  into
    v_revision_asset_id,
    v_revision_original_file_id
  from media.asset_revisions revision
  where revision.id = new.asset_revision_id;

  if not found
     or v_revision_asset_id <> new.asset_id
  then
    raise exception
      'Media variant revision must belong to the same asset';
  end if;

  select file_object.verification_state
  into v_source_state
  from media.file_objects file_object
  where file_object.id = new.source_file_object_id;

  select file_object.verification_state
  into v_derived_state
  from media.file_objects file_object
  where file_object.id = new.derived_file_object_id;

  if v_source_state <> 'verified'
     or v_derived_state <> 'verified'
  then
    raise exception
      'Media variant source and derived file objects must be verified';
  end if;

  if new.source_file_object_id <> v_revision_original_file_id
     and not exists (
       select 1
       from media.variants source_variant
       where source_variant.asset_revision_id = new.asset_revision_id
         and source_variant.derived_file_object_id =
           new.source_file_object_id
     )
  then
    raise exception
      'Media variant source must be the revision original or an existing supported source variant';
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_variant_selection_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, media
as $function$
declare
  v_variant_revision_id uuid;
  v_variant_role text;
  v_derived_state text;
begin
  select
    variant.asset_revision_id,
    variant.variant_role,
    file_object.verification_state
  into
    v_variant_revision_id,
    v_variant_role,
    v_derived_state
  from media.variants variant
  join media.file_objects file_object
    on file_object.id = variant.derived_file_object_id
  where variant.id = new.variant_id;

  if not found
     or v_variant_revision_id <> new.asset_revision_id
     or v_variant_role <> new.variant_role
     or v_derived_state <> 'verified'
  then
    raise exception
      'Selected Media variant must match the revision and role and use a verified derived file';
  end if;

  if tg_op = 'UPDATE' then
    if new.asset_revision_id is distinct from old.asset_revision_id
       or new.variant_role is distinct from old.variant_role
    then
      raise exception
        'Media variant-selection identity is immutable';
    end if;

    if new.variant_id is not distinct from old.variant_id then
      raise exception
        'Media variant activation must select a different immutable variant';
    end if;

    if new.selection_revision <> old.selection_revision + 1 then
      raise exception
        'Media variant activation must increment selection revision exactly once';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_governance_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.retention_state = 'purged' then
    raise exception
      'Purged Media governance requires the future governed physical-purge command';
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_usage_link_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, media
as $function$
declare
  v_revision_asset_id uuid;
begin
  if new.asset_revision_id is not null then
    select revision.asset_id
    into v_revision_asset_id
    from media.asset_revisions revision
    where revision.id = new.asset_revision_id;

    if not found
       or v_revision_asset_id <> new.asset_id
    then
      raise exception
        'Media usage revision must belong to the same asset';
    end if;
  end if;

  if new.resolution_mode = 'legacy_snapshot'
     and not exists (
       select 1
       from media.legacy_asset_links link
       where link.asset_id = new.asset_id
     )
  then
    raise exception
      'Legacy-snapshot Media usage requires an immutable legacy bridge';
  end if;

  if tg_op = 'UPDATE' then
    if new.usage_state = old.usage_state then
      raise exception
        'Media usage lifecycle update must change usage state';
    end if;

    if new.usage_revision <> old.usage_revision + 1 then
      raise exception
        'Media usage lifecycle update must increment usage revision exactly once';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function media.protect_usage_link_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Media usage links cannot be deleted';
  end if;

  if new.id is distinct from old.id
     or new.asset_id is distinct from old.asset_id
     or new.asset_revision_id is distinct from old.asset_revision_id
     or new.resolution_mode is distinct from old.resolution_mode
     or new.target_authority is distinct from old.target_authority
     or new.target_kind is distinct from old.target_kind
     or new.target_id is distinct from old.target_id
     or new.target_version_kind is distinct from old.target_version_kind
     or new.target_version_id is distinct from old.target_version_id
     or new.usage_role is distinct from old.usage_role
     or new.placement_data is distinct from old.placement_data
     or new.display_order is distinct from old.display_order
     or new.alt_text_snapshot is distinct from old.alt_text_snapshot
     or new.caption_snapshot is distinct from old.caption_snapshot
     or new.credit_snapshot is distinct from old.credit_snapshot
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception
      'Media usage identity and placement are immutable';
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_legacy_asset_link_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.legacy_asset_id is null
     or new.asset_id is null
     or nullif(btrim(new.mapping_reason), '') is null
     or jsonb_typeof(new.legacy_snapshot) <> 'object'
  then
    raise exception
      'Media legacy bridge identity, reason, and snapshot are required';
  end if;

  return new;
end;
$function$;

create or replace function media.enforce_media_event_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if num_nonnulls(
       new.asset_id,
       new.file_object_id,
       new.asset_revision_id,
       new.variant_id,
       new.usage_link_id,
       new.governance_version_id
     ) < 1
  then
    raise exception
      'Media event requires at least one canonical object identity';
  end if;

  return new;
end;
$function$;

revoke all on all functions in schema media
from public, anon, authenticated;

grant execute on all functions in schema media
to service_role;

drop trigger if exists file_objects_immutable
on media.file_objects;

create trigger file_objects_immutable
before update or delete
on media.file_objects
for each row
execute function media.protect_immutable_row();

drop trigger if exists asset_revisions_integrity
on media.asset_revisions;

create trigger asset_revisions_integrity
before insert or update
on media.asset_revisions
for each row
execute function media.enforce_asset_revision_integrity();

drop trigger if exists asset_revisions_immutable
on media.asset_revisions;

create trigger asset_revisions_immutable
before update or delete
on media.asset_revisions
for each row
execute function media.protect_immutable_row();

drop trigger if exists assets_pointer_integrity
on media.assets;

create constraint trigger assets_pointer_integrity
after insert or update
on media.assets
deferrable initially deferred
for each row
execute function media.enforce_asset_pointer_integrity();

drop trigger if exists variants_integrity
on media.variants;

create trigger variants_integrity
before insert or update
on media.variants
for each row
execute function media.enforce_variant_integrity();

drop trigger if exists variants_immutable
on media.variants;

create trigger variants_immutable
before update or delete
on media.variants
for each row
execute function media.protect_immutable_row();

drop trigger if exists variant_selections_integrity
on media.variant_selections;

create trigger variant_selections_integrity
before insert or update
on media.variant_selections
for each row
execute function media.enforce_variant_selection_integrity();

drop trigger if exists governance_integrity
on media.asset_governance_versions;

create trigger governance_integrity
before insert or update
on media.asset_governance_versions
for each row
execute function media.enforce_governance_integrity();

drop trigger if exists governance_immutable
on media.asset_governance_versions;

create trigger governance_immutable
before update or delete
on media.asset_governance_versions
for each row
execute function media.protect_immutable_row();

drop trigger if exists usage_links_integrity
on media.usage_links;

create trigger usage_links_integrity
before insert or update
on media.usage_links
for each row
execute function media.enforce_usage_link_integrity();

drop trigger if exists usage_links_identity_protection
on media.usage_links;

create trigger usage_links_identity_protection
before update or delete
on media.usage_links
for each row
execute function media.protect_usage_link_identity();

drop trigger if exists legacy_asset_links_integrity
on media.legacy_asset_links;

create trigger legacy_asset_links_integrity
before insert or update
on media.legacy_asset_links
for each row
execute function media.enforce_legacy_asset_link_integrity();

drop trigger if exists legacy_asset_links_immutable
on media.legacy_asset_links;

create trigger legacy_asset_links_immutable
before update or delete
on media.legacy_asset_links
for each row
execute function media.protect_immutable_row();

drop trigger if exists events_integrity
on media.events;

create trigger events_integrity
before insert or update
on media.events
for each row
execute function media.enforce_media_event_integrity();

drop trigger if exists events_append_only
on media.events;

create trigger events_append_only
before update or delete
on media.events
for each row
execute function media.protect_immutable_row();

alter table media.asset_kinds enable row level security;
alter table media.asset_purposes enable row level security;
alter table media.storage_providers enable row level security;
alter table media.variant_roles enable row level security;
alter table media.usage_roles enable row level security;
alter table media.assets enable row level security;
alter table media.file_objects enable row level security;
alter table media.asset_revisions enable row level security;
alter table media.variants enable row level security;
alter table media.variant_selections enable row level security;
alter table media.asset_governance_versions enable row level security;
alter table media.usage_links enable row level security;
alter table media.legacy_asset_links enable row level security;
alter table media.events enable row level security;

drop policy if exists asset_kinds_authorized_read
on media.asset_kinds;

create policy asset_kinds_authorized_read
on media.asset_kinds
for select
to authenticated
using (
  public.current_user_has_capability('view_media_records')
);

drop policy if exists asset_purposes_authorized_read
on media.asset_purposes;

create policy asset_purposes_authorized_read
on media.asset_purposes
for select
to authenticated
using (
  public.current_user_has_capability('view_media_records')
);

drop policy if exists storage_providers_authorized_read
on media.storage_providers;

create policy storage_providers_authorized_read
on media.storage_providers
for select
to authenticated
using (
  public.current_user_has_capability('view_media_records')
);

drop policy if exists variant_roles_authorized_read
on media.variant_roles;

create policy variant_roles_authorized_read
on media.variant_roles
for select
to authenticated
using (
  public.current_user_has_capability('view_media_records')
);

drop policy if exists usage_roles_authorized_read
on media.usage_roles;

create policy usage_roles_authorized_read
on media.usage_roles
for select
to authenticated
using (
  public.current_user_has_capability('view_media_records')
);

revoke all on all tables in schema media
from public, anon, authenticated;

grant select
on media.asset_kinds,
   media.asset_purposes,
   media.storage_providers,
   media.variant_roles,
   media.usage_roles
to authenticated;

grant all on all tables in schema media
to service_role;

insert into public.capability_definitions (
  capability_key,
  label,
  domain,
  description
)
values
  (
    'view_media_records',
    'View Media records',
    'media',
    'View controlled Media reference records and future authorized internal Media reads.'
  ),
  (
    'register_media_files',
    'Register Media files',
    'media',
    'Register immutable Media file-object identities through governed commands.'
  ),
  (
    'verify_media_files',
    'Verify Media files',
    'media',
    'Verify exact Media bytes, checksums, technical metadata, and storage locators.'
  ),
  (
    'manage_media_assets',
    'Manage Media assets',
    'media',
    'Create and manage logical Media assets, revisions, variants, and lifecycle.'
  ),
  (
    'manage_media_usage',
    'Manage Media usage',
    'media',
    'Attach, detach, and archive governed Media usage relationships.'
  ),
  (
    'review_media_governance',
    'Review Media governance',
    'media',
    'Review rights, consent, sensitivity, embargo, source protection, and public safety.'
  ),
  (
    'archive_media_assets',
    'Archive Media assets',
    'media',
    'Archive and restore logical Media assets while preserving history.'
  ),
  (
    'approve_media_retention',
    'Approve Media retention',
    'media',
    'Approve retention and future governed physical-purge decisions.'
  )
on conflict (capability_key)
do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now()
where (
  public.capability_definitions.label,
  public.capability_definitions.domain,
  public.capability_definitions.description
) is distinct from (
  excluded.label,
  excluded.domain,
  excluded.description
);

insert into public.role_capabilities (
  role_key,
  capability_key
)
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
on conflict (role_key, capability_key)
do nothing;

comment on schema media is
  'Canonical WAKILISHA Media authority for logical assets, exact bytes, revisions, variants, governance, usage, compatibility bridges, and events.';

comment on table media.assets is
  'Stable logical Media identity across exact-file replacements and derivative generation.';

comment on table media.file_objects is
  'Immutable identity for one exact byte sequence at one immutable storage locator.';

comment on table media.asset_revisions is
  'Immutable replacement history selecting one exact original file object for one logical Media asset.';

comment on table media.variants is
  'Immutable derivative relationship between source and derived Media file objects.';

comment on table media.variant_selections is
  'Governed mutable pointer selecting one active immutable variant per revision and role.';

comment on table media.asset_governance_versions is
  'Immutable governance versions for rights, consent, safety, sensitivity, embargo, source protection, preservation, and retention.';

comment on table media.usage_links is
  'Typed canonical Media usage identity with immutable placement and governed lifecycle.';

comment on table media.legacy_asset_links is
  'Immutable one-to-one compatibility bridge from registry_media_assets to canonical logical Media assets.';

comment on table media.events is
  'Append-only canonical Media lifecycle and provenance events.';

do $phase_4a_m1_assertions$
declare
  v_count bigint;
  v_text text;
begin
  select count(*)
  into v_count
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
    );

  if v_count <> 5 then
    raise exception
      'STOP: Expected 5 Media reference tables, found %',
      v_count;
  end if;

  select count(*)
  into v_count
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
    );

  if v_count <> 9 then
    raise exception
      'STOP: Expected 9 canonical Media tables, found %',
      v_count;
  end if;

  if (
    select count(*)
    from media.asset_kinds
  ) <> 6 then
    raise exception
      'STOP: Media asset-kind vocabulary is not exact';
  end if;

  if (
    select count(*)
    from media.asset_purposes
  ) <> 13 then
    raise exception
      'STOP: Media asset-purpose vocabulary is not exact';
  end if;

  if (
    select count(*)
    from media.storage_providers
  ) <> 4 then
    raise exception
      'STOP: Media storage-provider vocabulary is not exact';
  end if;

  if (
    select count(*)
    from media.variant_roles
  ) <> 10 then
    raise exception
      'STOP: Media variant-role vocabulary is not exact';
  end if;

  if (
    select count(*)
    from media.usage_roles
  ) <> 12 then
    raise exception
      'STOP: Media usage-role vocabulary is not exact';
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
      'STOP: Expected 8 Phase 4A Media capabilities, found %',
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
      'STOP: Expected 22 Phase 4A Media role assignments, found %',
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
      'STOP: Forbidden Phase 4A Media role assignments exist: %',
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
      'STOP: Expected 10 locked internal Media integrity functions, found %',
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
      'STOP: Expected 15 Media integrity triggers, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.assets'::regclass
      and trigger_row.tgname = 'assets_pointer_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
  ) then
    raise exception
      'STOP: Media asset pointer trigger is not deferred';
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
      'STOP: Canonical Media authority tables must remain empty: %',
      v_count;
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

  select count(*)
  into v_count
  from public.registry_media_assets;

  if v_count <> 1079 then
    raise exception
      'STOP: Compatibility Media asset count changed: %',
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
      'STOP: Compatibility Media asset fingerprint changed: %',
      v_text;
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
      'STOP: Compatibility Media policy fingerprint changed: %',
      v_text;
  end if;

  select count(*)
  into v_count
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
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_count <> 14 then
    raise exception
      'STOP: Direct compatibility Media foreign-key count changed: %',
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
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_text <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: Direct compatibility Media foreign-key fingerprint changed: %',
      v_text;
  end if;
end;
$phase_4a_m1_assertions$;

commit;
