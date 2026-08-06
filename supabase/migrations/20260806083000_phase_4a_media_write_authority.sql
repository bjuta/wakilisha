-- Phase 4A Media write authority and immutable replacement.
--
-- This migration adds operational commands that keep the canonical Media
-- authority and the compatibility projection synchronized in one transaction.
-- It does not tighten compatibility grants or policies, alter foreign keys,
-- change the frozen Institute, or modify the WordPress migration function.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_write_preflight$
declare
  v_count bigint;
begin
  if to_regnamespace('media') is null then
    raise exception 'STOP: media schema does not exist';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (select count(*) from media.asset_governance_versions) <> 1079
     or (select count(*) from media.legacy_asset_links) <> 1079
     or (select count(*) from public.registry_media_assets) <> 1079
     or (select count(*) from media.usage_links) <> 987
  then
    raise exception 'STOP: Phase 4A Media identity or usage baseline changed';
  end if;

  if (select count(*) from media.file_objects) <> 0
     or (select count(*) from media.asset_revisions) <> 0
     or (select count(*) from media.variants) <> 0
     or (select count(*) from media.variant_selections) <> 0
  then
    raise exception 'STOP: Write authority requires an empty file and revision baseline';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'create_media_asset',
      'register_media_file_object',
      'verify_media_file_object',
      'create_media_asset_revision',
      'register_media_variant',
      'activate_media_variant',
      'create_media_governance_version',
      'archive_media_asset',
      'restore_media_asset'
    )
    and procedure_row.prosecdef;

  if v_count <> 9 then
    raise exception 'STOP: Existing Media command authority is incomplete';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in (
        'create_media_asset_write_v2',
        'replace_media_asset_file_v2',
        'update_media_asset_record_v2',
        'update_media_asset_status_batch_v2'
      )
  ) then
    raise exception 'STOP: Media write authority already exists';
  end if;
end;
$phase_4a_write_preflight$;

alter table media.events
  drop constraint events_event_type_check;

alter table media.events
  add constraint events_event_type_check
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
      'asset_metadata_updated',
      'compatibility_projection_created',
      'compatibility_projection_updated',
      'retention_requested',
      'retention_approved',
      'physical_purge_completed'
    )
  );

create or replace function media.insert_verified_file_object_v2(
  p_file jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, media
as $function$
declare
  v_file_object_id uuid := gen_random_uuid();
  v_storage_provider text;
  v_storage_namespace text;
  v_storage_path text;
  v_delivery_url text;
  v_original_filename text;
  v_mime_type text;
  v_sha256 text;
  v_byte_size bigint;
  v_file_extension text;
  v_technical_metadata jsonb;
begin
  if p_actor_id is null then
    raise exception 'Media file registration requires an actor';
  end if;

  if p_file is null or jsonb_typeof(p_file) <> 'object' then
    raise exception 'Media file payload must be an object';
  end if;

  v_storage_provider := nullif(btrim(p_file ->> 'storage_provider'), '');
  v_storage_namespace := nullif(btrim(p_file ->> 'storage_namespace'), '');
  v_storage_path := nullif(btrim(p_file ->> 'storage_path'), '');
  v_delivery_url := nullif(btrim(p_file ->> 'delivery_url'), '');
  v_original_filename := nullif(btrim(p_file ->> 'original_filename'), '');
  v_mime_type := nullif(btrim(p_file ->> 'mime_type'), '');
  v_sha256 := lower(nullif(btrim(p_file ->> 'sha256'), ''));
  v_byte_size := nullif(p_file ->> 'byte_size', '')::bigint;
  v_technical_metadata := coalesce(p_file -> 'technical_metadata', '{}'::jsonb);

  if v_storage_provider is null
     or not exists (
       select 1
       from media.storage_providers provider_row
       where provider_row.storage_provider = v_storage_provider
         and provider_row.enabled
     )
  then
    raise exception 'Unknown or disabled Media storage provider';
  end if;

  if v_storage_path is null or v_delivery_url is null then
    raise exception 'Verified Media requires an immutable path and delivery URL';
  end if;

  if v_sha256 is null or v_sha256 !~ '^[0-9a-f]{64}$'
     or v_byte_size is null or v_byte_size < 0
     or v_mime_type is null
  then
    raise exception 'Verified Media requires checksum, byte size, and MIME type';
  end if;

  if jsonb_typeof(v_technical_metadata) <> 'object' then
    raise exception 'Media technical metadata must be an object';
  end if;

  if exists (
    select 1
    from media.file_objects object_row
    where object_row.storage_provider = v_storage_provider
      and coalesce(object_row.storage_namespace, '') = coalesce(v_storage_namespace, '')
      and object_row.storage_path = v_storage_path
  ) then
    raise exception 'Media storage locator is already registered';
  end if;

  v_file_extension :=
    case
      when v_original_filename is not null
       and strpos(reverse(v_original_filename), '.') > 0
      then lower(reverse(split_part(reverse(v_original_filename), '.', 1)))
      else null
    end;

  insert into media.file_objects (
    id,
    sha256,
    byte_size,
    mime_type,
    original_filename,
    file_extension,
    storage_provider,
    storage_namespace,
    storage_path,
    delivery_url,
    technical_metadata,
    verification_state,
    verified_by,
    verified_at,
    verification_error,
    ingested_by
  )
  values (
    v_file_object_id,
    v_sha256,
    v_byte_size,
    v_mime_type,
    v_original_filename,
    v_file_extension,
    v_storage_provider,
    v_storage_namespace,
    v_storage_path,
    v_delivery_url,
    v_technical_metadata,
    'verified',
    p_actor_id,
    now(),
    null,
    p_actor_id
  );

  insert into media.events (
    file_object_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values
    (
      v_file_object_id,
      'file_object_registered',
      p_actor_id,
      'Immutable Media file object registered by operational write authority',
      jsonb_build_object(
        'storage_provider', v_storage_provider,
        'storage_namespace', v_storage_namespace,
        'storage_path', v_storage_path,
        'verification_state', 'verified'
      ),
      p_correlation_id
    ),
    (
      v_file_object_id,
      'file_object_verified',
      p_actor_id,
      'Uploaded Media bytes accepted with checksum evidence',
      jsonb_build_object(
        'sha256', v_sha256,
        'byte_size', v_byte_size,
        'mime_type', v_mime_type,
        'verification_state', 'verified'
      ),
      p_correlation_id
    );

  return v_file_object_id;
end;
$function$;

revoke all on function media.insert_verified_file_object_v2(jsonb, uuid, uuid)
from public, anon, authenticated;

grant execute on function media.insert_verified_file_object_v2(jsonb, uuid, uuid)
to service_role;

create or replace function media.register_optional_variant_v2(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_original_file_object_id uuid,
  p_variant jsonb,
  p_actor_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media
as $function$
declare
  v_derived_file_object_id uuid;
  v_variant record;
  v_selection record;
  v_variant_role text;
begin
  if p_variant is null or p_variant = 'null'::jsonb then
    return null;
  end if;

  if jsonb_typeof(p_variant) <> 'object'
     or jsonb_typeof(p_variant -> 'file') <> 'object'
  then
    raise exception 'Media variant payload must include a file object';
  end if;

  v_variant_role := nullif(btrim(p_variant ->> 'variant_role'), '');

  if v_variant_role is null then
    raise exception 'Media variant role is required';
  end if;

  v_derived_file_object_id := media.insert_verified_file_object_v2(
    p_variant -> 'file',
    p_actor_id,
    p_correlation_id
  );

  select *
  into v_variant
  from public.register_media_variant(
    p_asset_id,
    p_asset_revision_id,
    p_original_file_object_id,
    v_derived_file_object_id,
    v_variant_role,
    coalesce(p_variant -> 'transformation_spec', '{}'::jsonb),
    coalesce(p_variant -> 'technical_metadata', '{}'::jsonb),
    nullif(btrim(p_variant ->> 'generator_name'), ''),
    nullif(btrim(p_variant ->> 'generator_version'), ''),
    p_correlation_id
  );

  select *
  into v_selection
  from public.activate_media_variant(
    p_asset_revision_id,
    v_variant_role,
    v_variant.variant_id,
    0,
    'Activate immutable derivative for the current Media revision',
    p_correlation_id
  );

  return jsonb_build_object(
    'derived_file_object_id', v_derived_file_object_id,
    'variant_id', v_variant.variant_id,
    'variant_role', v_variant_role,
    'selection_revision', v_selection.selection_revision
  );
end;
$function$;

revoke all on function media.register_optional_variant_v2(uuid, uuid, uuid, jsonb, uuid, uuid)
from public, anon, authenticated;

grant execute on function media.register_optional_variant_v2(uuid, uuid, uuid, jsonb, uuid, uuid)
to service_role;

create or replace function public.create_media_asset_write_v2(
  p_asset jsonb,
  p_file jsonb,
  p_variant jsonb default null,
  p_reason text default 'Create Media asset through operational write authority',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_asset record;
  v_revision record;
  v_asset_id uuid;
  v_original_file_object_id uuid;
  v_variant_result jsonb;
  v_compatibility jsonb;
  v_slug text;
  v_title text;
  v_asset_kind text;
  v_asset_purpose text;
  v_folder_id uuid;
  v_metadata jsonb;
  v_tags text[];
  v_original_filename text;
  v_file_extension text;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if p_asset is null or jsonb_typeof(p_asset) <> 'object' then
    raise exception 'Media asset payload must be an object';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media creation reason is required';
  end if;

  v_title := nullif(btrim(p_asset ->> 'title'), '');
  v_asset_kind := coalesce(nullif(btrim(p_asset ->> 'asset_kind'), ''), 'other');
  v_asset_purpose := coalesce(nullif(btrim(p_asset ->> 'asset_purpose'), ''), 'general');
  v_folder_id := nullif(p_asset ->> 'folder_id', '')::uuid;
  v_slug := coalesce(
    nullif(btrim(p_asset ->> 'slug'), ''),
    'media-' || replace(gen_random_uuid()::text, '-', '')
  );

  if v_title is null then
    raise exception 'Media title is required';
  end if;

  select *
  into v_asset
  from public.create_media_asset(
    v_asset_kind,
    v_asset_purpose,
    v_title,
    v_folder_id,
    v_correlation_id
  );

  v_asset_id := v_asset.asset_id;
  v_original_file_object_id := media.insert_verified_file_object_v2(
    p_file,
    v_actor_id,
    v_correlation_id
  );

  select *
  into v_revision
  from public.create_media_asset_revision(
    v_asset_id,
    1,
    v_original_file_object_id,
    btrim(p_reason),
    v_correlation_id
  );

  v_variant_result := media.register_optional_variant_v2(
    v_asset_id,
    v_revision.asset_revision_id,
    v_original_file_object_id,
    p_variant,
    v_actor_id,
    v_correlation_id
  );

  v_original_filename := nullif(btrim(p_file ->> 'original_filename'), '');
  v_file_extension :=
    case
      when v_original_filename is not null
       and strpos(reverse(v_original_filename), '.') > 0
      then lower(reverse(split_part(reverse(v_original_filename), '.', 1)))
      else null
    end;

  if p_asset ? 'tags' then
    if jsonb_typeof(p_asset -> 'tags') <> 'array' then
      raise exception 'Media tags must be an array';
    end if;
    select coalesce(array_agg(value), '{}'::text[])
    into v_tags
    from jsonb_array_elements_text(p_asset -> 'tags') value;
  else
    v_tags := '{}'::text[];
  end if;

  v_metadata :=
    coalesce(p_asset -> 'metadata', '{}'::jsonb)
    || coalesce(p_file -> 'technical_metadata', '{}'::jsonb)
    || jsonb_build_object(
      'file_name', v_original_filename,
      'file_size', (p_file ->> 'byte_size')::bigint
    );

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Media metadata must be an object';
  end if;

  insert into public.registry_media_assets (
    id,
    slug,
    title,
    url,
    mime_type,
    media_kind,
    status,
    source_kind,
    source_entity,
    source_record_id,
    source_staging_record_id,
    storage_bucket,
    storage_path,
    folder_id,
    file_kind,
    asset_purpose,
    display_filename,
    original_filename,
    file_extension,
    file_size_bytes,
    content_date,
    rights_status,
    credit_text,
    country_code,
    language_code,
    tags,
    internal_notes,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_asset_id,
    v_slug,
    v_title,
    p_file ->> 'delivery_url',
    p_file ->> 'mime_type',
    coalesce(nullif(btrim(p_asset ->> 'media_kind'), ''), v_asset_kind),
    coalesce(nullif(btrim(p_asset ->> 'status'), ''), 'active'),
    coalesce(nullif(btrim(p_asset ->> 'source_kind'), ''), 'editor_upload'),
    nullif(btrim(p_asset ->> 'source_entity'), ''),
    nullif(btrim(p_asset ->> 'source_record_id'), ''),
    nullif(
      btrim(p_asset ->> 'source_staging_record_id'),
      ''
    )::uuid,
    coalesce(nullif(btrim(p_asset ->> 'storage_bucket'), ''), 'lightsail-media'),
    p_file ->> 'storage_path',
    v_folder_id,
    coalesce(nullif(btrim(p_asset ->> 'file_kind'), ''), v_asset_kind),
    v_asset_purpose,
    coalesce(nullif(btrim(p_asset ->> 'display_filename'), ''), v_title),
    v_original_filename,
    v_file_extension,
    (p_file ->> 'byte_size')::bigint,
    nullif(p_asset ->> 'content_date', '')::date,
    coalesce(nullif(btrim(p_asset ->> 'rights_status'), ''), 'unknown'),
    nullif(btrim(p_asset ->> 'credit_text'), ''),
    nullif(upper(btrim(p_asset ->> 'country_code')), ''),
    nullif(lower(btrim(p_asset ->> 'language_code')), ''),
    v_tags,
    nullif(btrim(p_asset ->> 'internal_notes'), ''),
    v_metadata,
    now(),
    now()
  )
  returning to_jsonb(registry_media_assets)
  into v_compatibility;

  insert into media.legacy_asset_links (
    legacy_asset_id,
    asset_id,
    mapping_reason,
    legacy_snapshot,
    created_by
  )
  values (
    v_asset_id,
    v_asset_id,
    'Phase 4A operational write authority bridge',
    v_compatibility,
    v_actor_id
  );

  insert into media.events (
    asset_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    v_asset_id,
    'compatibility_projection_created',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'compatibility_asset_id', v_asset_id,
      'storage_path', p_file ->> 'storage_path',
      'authority_revision', v_revision.authority_revision
    ),
    v_correlation_id
  );

  return jsonb_build_object(
    'asset_id', v_asset_id,
    'file_object_id', v_original_file_object_id,
    'asset_revision_id', v_revision.asset_revision_id,
    'revision_number', v_revision.revision_number,
    'authority_revision', v_revision.authority_revision,
    'variant', v_variant_result,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.replace_media_asset_file_v2(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_file jsonb,
  p_variant jsonb default null,
  p_reason text default 'Replace Media file with immutable revision',
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_asset media.assets%rowtype;
  v_compatibility public.registry_media_assets%rowtype;
  v_original_file_object_id uuid;
  v_revision record;
  v_variant_result jsonb;
  v_original_filename text;
  v_file_extension text;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media replacement reason is required';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media asset does not exist';
  end if;

  if v_asset.lifecycle_state <> 'active' then
    raise exception 'Only an active Media asset may receive a replacement revision';
  end if;

  if v_asset.authority_revision <> p_expected_authority_revision then
    raise exception 'Stale Media authority revision';
  end if;

  select *
  into v_compatibility
  from public.registry_media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media compatibility projection does not exist';
  end if;

  if not exists (
    select 1
    from media.legacy_asset_links bridge_row
    where bridge_row.legacy_asset_id = p_asset_id
      and bridge_row.asset_id = p_asset_id
  ) then
    raise exception 'Media compatibility bridge does not exist';
  end if;

  v_original_file_object_id := media.insert_verified_file_object_v2(
    p_file,
    v_actor_id,
    v_correlation_id
  );

  select *
  into v_revision
  from public.create_media_asset_revision(
    p_asset_id,
    p_expected_authority_revision,
    v_original_file_object_id,
    btrim(p_reason),
    v_correlation_id
  );

  v_variant_result := media.register_optional_variant_v2(
    p_asset_id,
    v_revision.asset_revision_id,
    v_original_file_object_id,
    p_variant,
    v_actor_id,
    v_correlation_id
  );

  v_original_filename := nullif(btrim(p_file ->> 'original_filename'), '');
  v_file_extension :=
    case
      when v_original_filename is not null
       and strpos(reverse(v_original_filename), '.') > 0
      then lower(reverse(split_part(reverse(v_original_filename), '.', 1)))
      else null
    end;

  update public.registry_media_assets
  set
    url = p_file ->> 'delivery_url',
    mime_type = p_file ->> 'mime_type',
    storage_bucket = coalesce(storage_bucket, 'lightsail-media'),
    storage_path = p_file ->> 'storage_path',
    original_filename = coalesce(v_original_filename, original_filename),
    file_extension = coalesce(v_file_extension, file_extension),
    file_size_bytes = (p_file ->> 'byte_size')::bigint,
    metadata =
      coalesce(metadata, '{}'::jsonb)
      || coalesce(p_file -> 'technical_metadata', '{}'::jsonb)
      || jsonb_build_object(
        'file_name', coalesce(v_original_filename, metadata ->> 'file_name'),
        'file_size', (p_file ->> 'byte_size')::bigint
      ),
    updated_at = now()
  where id = p_asset_id;

  insert into media.events (
    asset_id,
    asset_revision_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    v_revision.asset_revision_id,
    'compatibility_projection_updated',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'url', v_compatibility.url,
      'storage_path', v_compatibility.storage_path,
      'current_revision_id', v_asset.current_revision_id,
      'authority_revision', v_asset.authority_revision
    ),
    jsonb_build_object(
      'url', p_file ->> 'delivery_url',
      'storage_path', p_file ->> 'storage_path',
      'current_revision_id', v_revision.asset_revision_id,
      'authority_revision', v_revision.authority_revision
    ),
    v_correlation_id
  );

  return jsonb_build_object(
    'asset_id', p_asset_id,
    'file_object_id', v_original_file_object_id,
    'asset_revision_id', v_revision.asset_revision_id,
    'revision_number', v_revision.revision_number,
    'authority_revision', v_revision.authority_revision,
    'variant', v_variant_result,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.update_media_asset_record_v2(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_patch jsonb,
  p_reason text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_asset media.assets%rowtype;
  v_compatibility public.registry_media_assets%rowtype;
  v_new_title text;
  v_new_asset_kind text;
  v_new_asset_purpose text;
  v_new_folder_id uuid;
  v_new_status text;
  v_new_lifecycle_state text;
  v_new_revision bigint;
  v_tags text[];
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Media update patch must be an object';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media update reason is required';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media asset does not exist';
  end if;

  if v_asset.authority_revision <> p_expected_authority_revision then
    raise exception 'Stale Media authority revision';
  end if;

  select *
  into v_compatibility
  from public.registry_media_assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media compatibility projection does not exist';
  end if;

  v_new_title :=
    case when p_patch ? 'title'
      then nullif(btrim(p_patch ->> 'title'), '')
      else v_asset.title
    end;

  if v_new_title is null then
    raise exception 'Media title is required';
  end if;

  v_new_asset_kind :=
    case when p_patch ? 'file_kind'
      then coalesce(nullif(btrim(p_patch ->> 'file_kind'), ''), v_asset.asset_kind)
      else v_asset.asset_kind
    end;

  v_new_asset_purpose :=
    case when p_patch ? 'asset_purpose'
      then coalesce(nullif(btrim(p_patch ->> 'asset_purpose'), ''), 'general')
      else v_asset.asset_purpose
    end;

  v_new_folder_id :=
    case when p_patch ? 'folder_id'
      then nullif(p_patch ->> 'folder_id', '')::uuid
      else v_asset.compatibility_folder_id
    end;

  v_new_status :=
    case when p_patch ? 'status'
      then coalesce(nullif(btrim(p_patch ->> 'status'), ''), v_compatibility.status)
      else v_compatibility.status
    end;

  if v_new_status not in ('active', 'archived', 'needs_review', 'rejected') then
    raise exception 'Unsupported Media status';
  end if;

  v_new_lifecycle_state :=
    case when v_new_status = 'archived' then 'archived' else 'active' end;

  if not exists (
    select 1 from media.asset_kinds kind_row
    where kind_row.asset_kind = v_new_asset_kind and kind_row.enabled
  ) then
    raise exception 'Unknown or disabled Media asset kind';
  end if;

  if not exists (
    select 1 from media.asset_purposes purpose_row
    where purpose_row.asset_purpose = v_new_asset_purpose and purpose_row.enabled
  ) then
    raise exception 'Unknown or disabled Media asset purpose';
  end if;

  if v_new_folder_id is not null
     and not exists (
       select 1 from public.media_folders folder_row
       where folder_row.id = v_new_folder_id
     )
  then
    raise exception 'Compatibility Media folder does not exist';
  end if;

  if p_patch ? 'metadata'
     and jsonb_typeof(p_patch -> 'metadata') <> 'object'
  then
    raise exception 'Media metadata patch must be an object';
  end if;

  if p_patch ? 'tags' then
    if jsonb_typeof(p_patch -> 'tags') <> 'array' then
      raise exception 'Media tags must be an array';
    end if;
    select coalesce(array_agg(value), '{}'::text[])
    into v_tags
    from jsonb_array_elements_text(p_patch -> 'tags') value;
  else
    v_tags := v_compatibility.tags;
  end if;

  v_new_revision := v_asset.authority_revision + 1;

  update media.assets
  set
    asset_kind = v_new_asset_kind,
    asset_purpose = v_new_asset_purpose,
    title = v_new_title,
    lifecycle_state = v_new_lifecycle_state,
    compatibility_folder_id = v_new_folder_id,
    authority_revision = v_new_revision,
    updated_by = v_actor_id,
    archived_by = case when v_new_lifecycle_state = 'archived' then v_actor_id else null end,
    archived_at = case when v_new_lifecycle_state = 'archived' then now() else null end,
    archive_reason = case when v_new_lifecycle_state = 'archived' then btrim(p_reason) else null end,
    updated_at = now()
  where id = p_asset_id;

  update public.registry_media_assets
  set
    title = v_new_title,
    status = v_new_status,
    folder_id = v_new_folder_id,
    file_kind = v_new_asset_kind,
    asset_purpose = v_new_asset_purpose,
    display_filename = case when p_patch ? 'display_filename' then nullif(btrim(p_patch ->> 'display_filename'), '') else display_filename end,
    original_filename = case when p_patch ? 'original_filename' then nullif(btrim(p_patch ->> 'original_filename'), '') else original_filename end,
    content_date = case when p_patch ? 'content_date' then nullif(p_patch ->> 'content_date', '')::date else content_date end,
    rights_status = case when p_patch ? 'rights_status' then coalesce(nullif(btrim(p_patch ->> 'rights_status'), ''), 'unknown') else rights_status end,
    credit_text = case when p_patch ? 'credit_text' then nullif(btrim(p_patch ->> 'credit_text'), '') else credit_text end,
    country_code = case when p_patch ? 'country_code' then nullif(upper(btrim(p_patch ->> 'country_code')), '') else country_code end,
    language_code = case when p_patch ? 'language_code' then nullif(lower(btrim(p_patch ->> 'language_code')), '') else language_code end,
    tags = v_tags,
    internal_notes = case when p_patch ? 'internal_notes' then nullif(btrim(p_patch ->> 'internal_notes'), '') else internal_notes end,
    metadata = case when p_patch ? 'metadata' then coalesce(metadata, '{}'::jsonb) || (p_patch -> 'metadata') else metadata end,
    updated_at = now()
  where id = p_asset_id;

  insert into media.events (
    asset_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    'asset_metadata_updated',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'title', v_asset.title,
      'asset_kind', v_asset.asset_kind,
      'asset_purpose', v_asset.asset_purpose,
      'lifecycle_state', v_asset.lifecycle_state,
      'compatibility_status', v_compatibility.status,
      'authority_revision', v_asset.authority_revision
    ),
    jsonb_build_object(
      'title', v_new_title,
      'asset_kind', v_new_asset_kind,
      'asset_purpose', v_new_asset_purpose,
      'lifecycle_state', v_new_lifecycle_state,
      'compatibility_status', v_new_status,
      'authority_revision', v_new_revision
    ),
    v_correlation_id
  );

  return jsonb_build_object(
    'asset_id', p_asset_id,
    'status', v_new_status,
    'lifecycle_state', v_new_lifecycle_state,
    'authority_revision', v_new_revision,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.update_media_asset_status_batch_v2(
  p_asset_ids uuid[],
  p_status text,
  p_reason text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_asset_id uuid;
  v_authority_revision bigint;
  v_count integer := 0;
begin
  v_actor_id := media.require_command_actor('manage_media_assets');

  if p_asset_ids is null or cardinality(p_asset_ids) = 0 then
    raise exception 'Media status batch requires at least one asset';
  end if;

  if cardinality(p_asset_ids) > 200 then
    raise exception 'Media status batch may contain at most 200 assets';
  end if;

  if p_status not in ('active', 'archived', 'needs_review', 'rejected') then
    raise exception 'Unsupported Media status';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media status reason is required';
  end if;

  for v_asset_id in
    select distinct unnest(p_asset_ids)
    order by 1
  loop
    select authority_revision
    into v_authority_revision
    from media.assets
    where id = v_asset_id
    for update;

    if not found then
      raise exception 'Media asset does not exist: %', v_asset_id;
    end if;

    perform public.update_media_asset_record_v2(
      v_asset_id,
      v_authority_revision,
      jsonb_build_object('status', p_status),
      btrim(p_reason),
      v_correlation_id
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'updated_count', v_count,
    'status', p_status,
    'correlation_id', v_correlation_id
  );
end;
$function$;

revoke all on function public.create_media_asset_write_v2(jsonb, jsonb, jsonb, text, uuid)
from public, anon;
revoke all on function public.replace_media_asset_file_v2(uuid, bigint, jsonb, jsonb, text, uuid)
from public, anon;
revoke all on function public.update_media_asset_record_v2(uuid, bigint, jsonb, text, uuid)
from public, anon;
revoke all on function public.update_media_asset_status_batch_v2(uuid[], text, text, uuid)
from public, anon;

grant execute on function public.create_media_asset_write_v2(jsonb, jsonb, jsonb, text, uuid)
to authenticated, service_role;
grant execute on function public.replace_media_asset_file_v2(uuid, bigint, jsonb, jsonb, text, uuid)
to authenticated, service_role;
grant execute on function public.update_media_asset_record_v2(uuid, bigint, jsonb, text, uuid)
to authenticated, service_role;
grant execute on function public.update_media_asset_status_batch_v2(uuid[], text, text, uuid)
to authenticated, service_role;

comment on function public.create_media_asset_write_v2(jsonb, jsonb, jsonb, text, uuid)
is 'Creates canonical Media identity, immutable original revision, optional derivative, compatibility projection, and bridge atomically.';

comment on function public.replace_media_asset_file_v2(uuid, bigint, jsonb, jsonb, text, uuid)
is 'Creates a new immutable Media revision and optional derivative without overwriting a registered storage path.';

comment on function public.update_media_asset_record_v2(uuid, bigint, jsonb, text, uuid)
is 'Updates canonical Media metadata, compatibility projection, and lifecycle with optimistic concurrency.';

comment on function public.update_media_asset_status_batch_v2(uuid[], text, text, uuid)
is 'Applies a governed Media status change to at most 200 assets in one transaction.';

do $phase_4a_write_assertions$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'create_media_asset_write_v2',
      'replace_media_asset_file_v2',
      'update_media_asset_record_v2',
      'update_media_asset_status_batch_v2'
    )
    and procedure_row.prosecdef;

  if v_count <> 4 then
    raise exception 'STOP: Media write command installation is incomplete';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (select count(*) from public.registry_media_assets) <> 1079
     or (select count(*) from media.legacy_asset_links) <> 1079
     or (select count(*) from media.file_objects) <> 0
     or (select count(*) from media.asset_revisions) <> 0
     or (select count(*) from media.variants) <> 0
     or (select count(*) from media.variant_selections) <> 0
  then
    raise exception 'STOP: Command installation changed Media data';
  end if;
end;
$phase_4a_write_assertions$;

commit;
