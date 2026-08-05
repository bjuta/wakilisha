begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_4a_m3_preflight$
declare
  v_count bigint;
  v_text text;
begin
  if to_regnamespace('media') is null then
    raise exception 'STOP: media schema does not exist';
  end if;

  select count(*) into v_count from media.assets;
  if v_count <> 1079 then
    raise exception 'STOP: Expected 1079 Media assets, found %', v_count;
  end if;

  select count(*) into v_count from media.asset_governance_versions;
  if v_count <> 1079 then
    raise exception 'STOP: Expected 1079 governance versions, found %', v_count;
  end if;

  select count(*) into v_count from media.legacy_asset_links;
  if v_count <> 1079 then
    raise exception 'STOP: Expected 1079 legacy bridges, found %', v_count;
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.usage_links)
  ) <> 0 then
    raise exception
      'STOP: Migration 3 requires empty file, revision, variant, selection, and usage tables';
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
      'STOP: Compatibility asset fingerprint changed: %',
      v_text;
  end if;
end;
$phase_4a_m3_preflight$;

create or replace function media.require_command_actor(
  p_capability text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authenticated Media command actor is required';
  end if;

  if not (
    public.current_user_has_capability(p_capability)
    or public.current_user_is_administrator()
  ) then
    raise exception
      'Media capability % is required',
      p_capability;
  end if;

  return v_actor_id;
end;
$function$;

revoke all on function media.require_command_actor(text)
from public, anon, authenticated;

grant execute on function media.require_command_actor(text)
to service_role;

create or replace function media.protect_immutable_row()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_guard text;
begin
  if tg_table_schema = 'media'
     and tg_table_name = 'file_objects'
     and tg_op = 'UPDATE'
  then
    v_guard :=
      current_setting(
        'media.verifying_file_object_id',
        true
      );

    if v_guard = old.id::text
       and old.verification_state = 'unverified'
       and new.verification_state in (
         'verified',
         'failed',
         'unreachable'
       )
       and new.id is not distinct from old.id
       and new.storage_provider is not distinct from old.storage_provider
       and new.storage_namespace is not distinct from old.storage_namespace
       and new.storage_path is not distinct from old.storage_path
       and new.delivery_url is not distinct from old.delivery_url
       and new.original_filename is not distinct from old.original_filename
       and new.file_extension is not distinct from old.file_extension
       and new.ingested_by is not distinct from old.ingested_by
       and new.created_at is not distinct from old.created_at
    then
      return new;
    end if;
  end if;

  raise exception
    'Media row in %.% is immutable',
    tg_table_schema,
    tg_table_name;
end;
$function$;

revoke all on function media.protect_immutable_row()
from public, anon, authenticated;

grant execute on function media.protect_immutable_row()
to service_role;

create or replace function public.create_media_asset(
  p_asset_kind text,
  p_asset_purpose text,
  p_title text,
  p_compatibility_folder_id uuid default null,
  p_correlation_id uuid default null
)
returns table (
  asset_id uuid,
  governance_version_id uuid,
  authority_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset_id uuid := gen_random_uuid();
  v_governance_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  if nullif(btrim(p_title), '') is null then
    raise exception 'Media asset title is required';
  end if;

  if not exists (
    select 1
    from media.asset_kinds kind
    where kind.asset_kind = p_asset_kind
      and kind.enabled
  ) then
    raise exception 'Unknown or disabled Media asset kind';
  end if;

  if not exists (
    select 1
    from media.asset_purposes purpose
    where purpose.asset_purpose = p_asset_purpose
      and purpose.enabled
  ) then
    raise exception 'Unknown or disabled Media asset purpose';
  end if;

  if p_compatibility_folder_id is not null
     and not exists (
       select 1
       from public.media_folders folder
       where folder.id = p_compatibility_folder_id
     )
  then
    raise exception 'Compatibility Media folder does not exist';
  end if;

  insert into media.assets (
    id,
    asset_kind,
    asset_purpose,
    title,
    lifecycle_state,
    compatibility_folder_id,
    current_governance_version_id,
    authority_revision,
    created_by,
    updated_by
  )
  values (
    v_asset_id,
    p_asset_kind,
    p_asset_purpose,
    btrim(p_title),
    'active',
    p_compatibility_folder_id,
    null,
    1,
    v_actor_id,
    v_actor_id
  );

  insert into media.asset_governance_versions (
    id,
    asset_id,
    version_number,
    rights_status,
    consent_status,
    sensitivity,
    embargo_state,
    source_protection_class,
    preservation_state,
    retention_state,
    public_safety_state,
    internal_reason,
    created_by
  )
  values (
    v_governance_id,
    v_asset_id,
    1,
    'unknown',
    'unknown',
    'none',
    'none',
    'internal',
    'unassessed',
    'retain',
    'internal',
    'Initial governance created with explicit unknown and internal states',
    v_actor_id
  );

  update media.assets
  set current_governance_version_id = v_governance_id
  where id = v_asset_id;

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
    'asset_created',
    v_actor_id,
    'Logical Media asset created',
    jsonb_build_object(
      'asset_kind', p_asset_kind,
      'asset_purpose', p_asset_purpose,
      'authority_revision', 1
    ),
    v_correlation_id
  );

  insert into media.events (
    asset_id,
    governance_version_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    v_asset_id,
    v_governance_id,
    'governance_version_created',
    v_actor_id,
    'Initial Media governance created',
    jsonb_build_object(
      'version_number', 1,
      'public_safety_state', 'internal'
    ),
    v_correlation_id
  );

  return query
  select
    v_asset_id,
    v_governance_id,
    1::bigint,
    v_correlation_id;
end;
$function$;

create or replace function public.register_media_file_object(
  p_storage_provider text,
  p_storage_namespace text,
  p_storage_path text,
  p_delivery_url text,
  p_original_filename text,
  p_mime_type text default null,
  p_byte_size bigint default null,
  p_technical_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table (
  file_object_id uuid,
  verification_state text,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_file_object_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_extension text;
begin
  v_actor_id :=
    media.require_command_actor('register_media_files');

  if not exists (
    select 1
    from media.storage_providers provider
    where provider.storage_provider = p_storage_provider
      and provider.enabled
  ) then
    raise exception 'Unknown or disabled Media storage provider';
  end if;

  if nullif(btrim(p_storage_path), '') is null
     and nullif(btrim(p_delivery_url), '') is null
  then
    raise exception 'Media file object requires a path or delivery URL';
  end if;

  if p_byte_size is not null and p_byte_size < 0 then
    raise exception 'Media byte size cannot be negative';
  end if;

  if p_technical_metadata is null
     or jsonb_typeof(p_technical_metadata) <> 'object'
  then
    raise exception 'Media technical metadata must be an object';
  end if;

  if nullif(btrim(p_storage_path), '') is not null
     and exists (
       select 1
       from media.file_objects object_row
       where object_row.storage_provider = p_storage_provider
         and coalesce(object_row.storage_namespace, '') =
           coalesce(nullif(btrim(p_storage_namespace), ''), '')
         and object_row.storage_path = btrim(p_storage_path)
     )
  then
    raise exception 'Media storage locator is already registered';
  end if;

  v_extension :=
    case
      when nullif(btrim(p_original_filename), '') is not null
       and strpos(reverse(btrim(p_original_filename)), '.') > 0
      then lower(
        reverse(
          split_part(
            reverse(btrim(p_original_filename)),
            '.',
            1
          )
        )
      )
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
    ingested_by
  )
  values (
    v_file_object_id,
    null,
    p_byte_size,
    nullif(btrim(p_mime_type), ''),
    nullif(btrim(p_original_filename), ''),
    v_extension,
    p_storage_provider,
    nullif(btrim(p_storage_namespace), ''),
    nullif(btrim(p_storage_path), ''),
    nullif(btrim(p_delivery_url), ''),
    p_technical_metadata,
    'unverified',
    v_actor_id
  );

  insert into media.events (
    file_object_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    v_file_object_id,
    'file_object_registered',
    v_actor_id,
    'Candidate Media file object registered',
    jsonb_build_object(
      'storage_provider', p_storage_provider,
      'storage_namespace',
        nullif(btrim(p_storage_namespace), ''),
      'storage_path',
        nullif(btrim(p_storage_path), ''),
      'delivery_url',
        nullif(btrim(p_delivery_url), ''),
      'verification_state', 'unverified'
    ),
    v_correlation_id
  );

  return query
  select
    v_file_object_id,
    'unverified'::text,
    v_correlation_id;
end;
$function$;

create or replace function public.verify_media_file_object(
  p_file_object_id uuid,
  p_result_state text,
  p_sha256 text default null,
  p_byte_size bigint default null,
  p_mime_type text default null,
  p_technical_metadata jsonb default '{}'::jsonb,
  p_failure_detail text default null,
  p_correlation_id uuid default null
)
returns table (
  file_object_id uuid,
  verification_state text,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_object media.file_objects%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_event_type text;
begin
  v_actor_id :=
    media.require_command_actor('verify_media_files');

  select *
  into v_object
  from media.file_objects
  where id = p_file_object_id
  for update;

  if not found then
    raise exception 'Media file object does not exist';
  end if;

  if v_object.verification_state <> 'unverified' then
    raise exception 'Media file verification is already finalized';
  end if;

  if p_result_state not in (
    'verified',
    'failed',
    'unreachable'
  ) then
    raise exception 'Invalid Media verification result state';
  end if;

  if p_technical_metadata is null
     or jsonb_typeof(p_technical_metadata) <> 'object'
  then
    raise exception 'Media technical metadata must be an object';
  end if;

  if p_result_state = 'verified' then
    if p_sha256 is null
       or p_sha256 !~ '^[0-9a-f]{64}$'
       or p_byte_size is null
       or p_byte_size < 0
       or nullif(btrim(p_mime_type), '') is null
       or v_object.storage_path is null
    then
      raise exception
        'Verified Media requires checksum, byte size, MIME type, and immutable storage path';
    end if;

    if nullif(btrim(p_failure_detail), '') is not null then
      raise exception 'Verified Media cannot include failure detail';
    end if;

    v_event_type := 'file_object_verified';
  else
    if nullif(btrim(p_failure_detail), '') is null then
      raise exception 'Failed or unreachable Media requires failure detail';
    end if;

    v_event_type :=
      case p_result_state
        when 'failed' then
          'file_object_verification_failed'
        else
          'file_object_unreachable'
      end;
  end if;

  perform set_config(
    'media.verifying_file_object_id',
    p_file_object_id::text,
    true
  );

  update media.file_objects
  set
    sha256 =
      case
        when p_result_state = 'verified'
          then p_sha256
        else sha256
      end,
    byte_size =
      case
        when p_result_state = 'verified'
          then p_byte_size
        else byte_size
      end,
    mime_type =
      case
        when p_result_state = 'verified'
          then btrim(p_mime_type)
        else mime_type
      end,
    technical_metadata =
      technical_metadata || p_technical_metadata,
    verification_state = p_result_state,
    verified_by = v_actor_id,
    verified_at = now(),
    verification_error =
      case
        when p_result_state = 'verified'
          then null
        else btrim(p_failure_detail)
      end
  where id = p_file_object_id;

  perform set_config(
    'media.verifying_file_object_id',
    '',
    true
  );

  insert into media.events (
    file_object_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_file_object_id,
    v_event_type,
    v_actor_id,
    coalesce(
      nullif(btrim(p_failure_detail), ''),
      'Media file object verified'
    ),
    jsonb_build_object(
      'verification_state',
      v_object.verification_state
    ),
    jsonb_build_object(
      'verification_state',
      p_result_state,
      'sha256',
      case
        when p_result_state = 'verified'
          then p_sha256
        else null
      end,
      'byte_size',
      case
        when p_result_state = 'verified'
          then p_byte_size
        else null
      end,
      'mime_type',
      case
        when p_result_state = 'verified'
          then btrim(p_mime_type)
        else null
      end
    ),
    v_correlation_id
  );

  return query
  select
    p_file_object_id,
    p_result_state,
    v_correlation_id;
end;
$function$;

create or replace function public.create_media_asset_revision(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_file_object_id uuid,
  p_replacement_reason text,
  p_correlation_id uuid default null
)
returns table (
  asset_revision_id uuid,
  revision_number bigint,
  authority_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset media.assets%rowtype;
  v_file_state text;
  v_revision_id uuid := gen_random_uuid();
  v_revision_number bigint;
  v_previous_revision_id uuid;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  if nullif(btrim(p_replacement_reason), '') is null then
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

  if v_asset.authority_revision <>
     p_expected_authority_revision
  then
    raise exception
      'Stale Media authority revision: expected %, current %',
      p_expected_authority_revision,
      v_asset.authority_revision;
  end if;

  if v_asset.lifecycle_state <> 'active' then
    raise exception 'Only active Media assets accept revisions';
  end if;

  select verification_state
  into v_file_state
  from media.file_objects
  where id = p_file_object_id;

  if not found or v_file_state <> 'verified' then
    raise exception 'Media revision requires a verified file object';
  end if;

  select
    coalesce(max(revision_number), 0) + 1,
    v_asset.current_revision_id
  into
    v_revision_number,
    v_previous_revision_id
  from media.asset_revisions
  where asset_id = p_asset_id;

  insert into media.asset_revisions (
    id,
    asset_id,
    revision_number,
    original_file_object_id,
    previous_revision_id,
    replacement_reason,
    created_by
  )
  values (
    v_revision_id,
    p_asset_id,
    v_revision_number,
    p_file_object_id,
    v_previous_revision_id,
    btrim(p_replacement_reason),
    v_actor_id
  );

  update media.assets
  set
    current_revision_id = v_revision_id,
    authority_revision = authority_revision + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_asset_id;

  insert into media.events (
    asset_id,
    asset_revision_id,
    file_object_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    v_revision_id,
    p_file_object_id,
    'asset_revision_created',
    v_actor_id,
    btrim(p_replacement_reason),
    jsonb_build_object(
      'revision_number', v_revision_number,
      'previous_revision_id', v_previous_revision_id,
      'file_object_id', p_file_object_id
    ),
    v_correlation_id
  );

  insert into media.events (
    asset_id,
    asset_revision_id,
    file_object_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    v_revision_id,
    p_file_object_id,
    'asset_revision_activated',
    v_actor_id,
    btrim(p_replacement_reason),
    jsonb_build_object(
      'current_revision_id',
      v_previous_revision_id,
      'authority_revision',
      v_asset.authority_revision
    ),
    jsonb_build_object(
      'current_revision_id',
      v_revision_id,
      'authority_revision',
      v_asset.authority_revision + 1
    ),
    v_correlation_id
  );

  return query
  select
    v_revision_id,
    v_revision_number,
    v_asset.authority_revision + 1,
    v_correlation_id;
end;
$function$;

create or replace function public.register_media_variant(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_source_file_object_id uuid,
  p_derived_file_object_id uuid,
  p_variant_role text,
  p_transformation_spec jsonb default '{}'::jsonb,
  p_technical_metadata jsonb default '{}'::jsonb,
  p_generator_name text default null,
  p_generator_version text default null,
  p_correlation_id uuid default null
)
returns table (
  variant_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_variant_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  if p_transformation_spec is null
     or jsonb_typeof(p_transformation_spec) <> 'object'
     or p_technical_metadata is null
     or jsonb_typeof(p_technical_metadata) <> 'object'
  then
    raise exception 'Media variant metadata must be objects';
  end if;

  if not exists (
    select 1
    from media.variant_roles role_row
    where role_row.variant_role = p_variant_role
      and role_row.enabled
  ) then
    raise exception 'Unknown or disabled Media variant role';
  end if;

  if exists (
    select 1
    from media.variants variant
    where variant.asset_revision_id = p_asset_revision_id
      and variant.source_file_object_id =
        p_source_file_object_id
      and variant.derived_file_object_id =
        p_derived_file_object_id
      and variant.variant_role = p_variant_role
  ) then
    raise exception 'Media variant relationship already exists';
  end if;

  insert into media.variants (
    id,
    asset_id,
    asset_revision_id,
    source_file_object_id,
    derived_file_object_id,
    variant_role,
    transformation_spec,
    technical_metadata,
    generator_name,
    generator_version,
    created_by
  )
  values (
    v_variant_id,
    p_asset_id,
    p_asset_revision_id,
    p_source_file_object_id,
    p_derived_file_object_id,
    p_variant_role,
    p_transformation_spec,
    p_technical_metadata,
    nullif(btrim(p_generator_name), ''),
    nullif(btrim(p_generator_version), ''),
    v_actor_id
  );

  insert into media.events (
    asset_id,
    asset_revision_id,
    variant_id,
    file_object_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    p_asset_revision_id,
    v_variant_id,
    p_derived_file_object_id,
    'variant_registered',
    v_actor_id,
    'Immutable Media variant registered',
    jsonb_build_object(
      'variant_role', p_variant_role,
      'source_file_object_id',
        p_source_file_object_id,
      'derived_file_object_id',
        p_derived_file_object_id
    ),
    v_correlation_id
  );

  return query
  select v_variant_id, v_correlation_id;
end;
$function$;

create or replace function public.activate_media_variant(
  p_asset_revision_id uuid,
  p_variant_role text,
  p_variant_id uuid,
  p_expected_selection_revision bigint,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  variant_id uuid,
  selection_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset_id uuid;
  v_existing media.variant_selections%rowtype;
  v_new_revision bigint;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_assets');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media variant activation reason is required';
  end if;

  select variant.asset_id
  into v_asset_id
  from media.variants variant
  join media.file_objects file_object
    on file_object.id = variant.derived_file_object_id
  where variant.id = p_variant_id
    and variant.asset_revision_id = p_asset_revision_id
    and variant.variant_role = p_variant_role
    and file_object.verification_state = 'verified';

  if not found then
    raise exception
      'Media variant does not match revision, role, and verified delivery';
  end if;

  select *
  into v_existing
  from media.variant_selections
  where asset_revision_id = p_asset_revision_id
    and variant_role = p_variant_role
  for update;

  if found then
    if v_existing.selection_revision <>
       p_expected_selection_revision
    then
      raise exception
        'Stale Media selection revision: expected %, current %',
        p_expected_selection_revision,
        v_existing.selection_revision;
    end if;

    update media.variant_selections
    set
      variant_id = p_variant_id,
      selection_revision = selection_revision + 1,
      selected_by = v_actor_id,
      selected_at = now(),
      updated_at = now()
    where asset_revision_id = p_asset_revision_id
      and variant_role = p_variant_role
    returning selection_revision
    into v_new_revision;
  else
    if p_expected_selection_revision <> 0 then
      raise exception
        'First Media variant activation expects selection revision 0';
    end if;

    insert into media.variant_selections (
      asset_revision_id,
      variant_role,
      variant_id,
      selection_revision,
      selected_by
    )
    values (
      p_asset_revision_id,
      p_variant_role,
      p_variant_id,
      1,
      v_actor_id
    );

    v_new_revision := 1;
  end if;

  insert into media.events (
    asset_id,
    asset_revision_id,
    variant_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    v_asset_id,
    p_asset_revision_id,
    p_variant_id,
    'variant_activated',
    v_actor_id,
    btrim(p_reason),
    case
      when v_existing.variant_id is null
        then null
      else jsonb_build_object(
        'variant_id', v_existing.variant_id,
        'selection_revision',
          v_existing.selection_revision
      )
    end,
    jsonb_build_object(
      'variant_id', p_variant_id,
      'selection_revision', v_new_revision
    ),
    v_correlation_id
  );

  return query
  select
    p_variant_id,
    v_new_revision,
    v_correlation_id;
end;
$function$;

create or replace function public.create_media_governance_version(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_governance jsonb,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  governance_version_id uuid,
  version_number bigint,
  authority_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset media.assets%rowtype;
  v_governance_id uuid := gen_random_uuid();
  v_version_number bigint;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('review_media_governance');

  if p_governance is null
     or jsonb_typeof(p_governance) <> 'object'
  then
    raise exception 'Complete Media governance payload is required';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media governance reason is required';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media asset does not exist';
  end if;

  if v_asset.authority_revision <>
     p_expected_authority_revision
  then
    raise exception
      'Stale Media authority revision: expected %, current %',
      p_expected_authority_revision,
      v_asset.authority_revision;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from media.asset_governance_versions
  where asset_id = p_asset_id;

  insert into media.asset_governance_versions (
    id,
    asset_id,
    version_number,
    rights_status,
    rights_basis,
    rights_holder,
    licence_identifier,
    licence_terms,
    consent_status,
    consent_scope,
    sensitivity,
    embargo_state,
    embargo_until,
    source_protection_class,
    preservation_state,
    retention_state,
    public_safety_state,
    internal_reason,
    approved_by,
    created_by
  )
  values (
    v_governance_id,
    p_asset_id,
    v_version_number,
    coalesce(p_governance ->> 'rights_status', 'unknown'),
    nullif(btrim(p_governance ->> 'rights_basis'), ''),
    nullif(btrim(p_governance ->> 'rights_holder'), ''),
    nullif(btrim(p_governance ->> 'licence_identifier'), ''),
    nullif(btrim(p_governance ->> 'licence_terms'), ''),
    coalesce(p_governance ->> 'consent_status', 'unknown'),
    nullif(btrim(p_governance ->> 'consent_scope'), ''),
    coalesce(p_governance ->> 'sensitivity', 'none'),
    coalesce(p_governance ->> 'embargo_state', 'none'),
    nullif(p_governance ->> 'embargo_until', '')::timestamptz,
    coalesce(
      p_governance ->> 'source_protection_class',
      'internal'
    ),
    coalesce(
      p_governance ->> 'preservation_state',
      'unassessed'
    ),
    coalesce(
      p_governance ->> 'retention_state',
      'retain'
    ),
    coalesce(
      p_governance ->> 'public_safety_state',
      'internal'
    ),
    btrim(p_reason),
    case
      when coalesce(
        p_governance ->> 'public_safety_state',
        'internal'
      ) in ('approved_public', 'approved_redacted')
        then v_actor_id
      else null
    end,
    v_actor_id
  );

  update media.assets
  set
    current_governance_version_id = v_governance_id,
    authority_revision = authority_revision + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_asset_id;

  insert into media.events (
    asset_id,
    governance_version_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    v_governance_id,
    'governance_version_created',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'current_governance_version_id',
      v_asset.current_governance_version_id,
      'authority_revision',
      v_asset.authority_revision
    ),
    jsonb_build_object(
      'current_governance_version_id',
      v_governance_id,
      'version_number',
      v_version_number,
      'authority_revision',
      v_asset.authority_revision + 1
    ),
    v_correlation_id
  );

  return query
  select
    v_governance_id,
    v_version_number,
    v_asset.authority_revision + 1,
    v_correlation_id;
end;
$function$;

create or replace function public.archive_media_asset(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  asset_id uuid,
  lifecycle_state text,
  authority_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset media.assets%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('archive_media_assets');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media archive reason is required';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media asset does not exist';
  end if;

  if v_asset.authority_revision <>
     p_expected_authority_revision
  then
    raise exception
      'Stale Media authority revision: expected %, current %',
      p_expected_authority_revision,
      v_asset.authority_revision;
  end if;

  if v_asset.lifecycle_state <> 'active' then
    raise exception 'Only active Media assets may be archived';
  end if;

  update media.assets
  set
    lifecycle_state = 'archived',
    authority_revision = authority_revision + 1,
    archived_by = v_actor_id,
    archived_at = now(),
    archive_reason = btrim(p_reason),
    updated_by = v_actor_id,
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
    'asset_archived',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'lifecycle_state', v_asset.lifecycle_state,
      'authority_revision', v_asset.authority_revision
    ),
    jsonb_build_object(
      'lifecycle_state', 'archived',
      'authority_revision',
      v_asset.authority_revision + 1
    ),
    v_correlation_id
  );

  return query
  select
    p_asset_id,
    'archived'::text,
    v_asset.authority_revision + 1,
    v_correlation_id;
end;
$function$;

create or replace function public.restore_media_asset(
  p_asset_id uuid,
  p_expected_authority_revision bigint,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  asset_id uuid,
  lifecycle_state text,
  authority_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_asset media.assets%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('archive_media_assets');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Media restore reason is required';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Media asset does not exist';
  end if;

  if v_asset.authority_revision <>
     p_expected_authority_revision
  then
    raise exception
      'Stale Media authority revision: expected %, current %',
      p_expected_authority_revision,
      v_asset.authority_revision;
  end if;

  if v_asset.lifecycle_state <> 'archived' then
    raise exception 'Only archived Media assets may be restored';
  end if;

  update media.assets
  set
    lifecycle_state = 'active',
    authority_revision = authority_revision + 1,
    archived_by = null,
    archived_at = null,
    archive_reason = null,
    updated_by = v_actor_id,
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
    'asset_restored',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'lifecycle_state', v_asset.lifecycle_state,
      'authority_revision', v_asset.authority_revision
    ),
    jsonb_build_object(
      'lifecycle_state', 'active',
      'authority_revision',
      v_asset.authority_revision + 1
    ),
    v_correlation_id
  );

  return query
  select
    p_asset_id,
    'active'::text,
    v_asset.authority_revision + 1,
    v_correlation_id;
end;
$function$;

revoke all on function public.create_media_asset(
  text,
  text,
  text,
  uuid,
  uuid
) from public, anon;

revoke all on function public.register_media_file_object(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb,
  uuid
) from public, anon;

revoke all on function public.verify_media_file_object(
  uuid,
  text,
  text,
  bigint,
  text,
  jsonb,
  text,
  uuid
) from public, anon;

revoke all on function public.create_media_asset_revision(
  uuid,
  bigint,
  uuid,
  text,
  uuid
) from public, anon;

revoke all on function public.register_media_variant(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
) from public, anon;

revoke all on function public.activate_media_variant(
  uuid,
  text,
  uuid,
  bigint,
  text,
  uuid
) from public, anon;

revoke all on function public.create_media_governance_version(
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) from public, anon;

revoke all on function public.archive_media_asset(
  uuid,
  bigint,
  text,
  uuid
) from public, anon;

revoke all on function public.restore_media_asset(
  uuid,
  bigint,
  text,
  uuid
) from public, anon;

grant execute on function public.create_media_asset(
  text,
  text,
  text,
  uuid,
  uuid
) to authenticated, service_role;

grant execute on function public.register_media_file_object(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  jsonb,
  uuid
) to authenticated, service_role;

grant execute on function public.verify_media_file_object(
  uuid,
  text,
  text,
  bigint,
  text,
  jsonb,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.create_media_asset_revision(
  uuid,
  bigint,
  uuid,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.register_media_variant(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.activate_media_variant(
  uuid,
  text,
  uuid,
  bigint,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.create_media_governance_version(
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.archive_media_asset(
  uuid,
  bigint,
  text,
  uuid
) to authenticated, service_role;

grant execute on function public.restore_media_asset(
  uuid,
  bigint,
  text,
  uuid
) to authenticated, service_role;

do $phase_4a_m3_assertions$
declare
  v_count bigint;
  v_text text;
begin
  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace
    on namespace.oid = procedure_row.pronamespace
  where namespace.nspname = 'public'
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
    raise exception
      'STOP: Expected 9 security-definer Media commands, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_routine_grants grant_row
  where grant_row.routine_schema = 'public'
    and grant_row.routine_name in (
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
    and grant_row.grantee = 'anon';

  if v_count <> 0 then
    raise exception
      'STOP: Anonymous Media command grants exist: %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'media'
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE'
    );

  if v_count <> 0 then
    raise exception
      'STOP: Authenticated direct canonical writes exist: %',
      v_count;
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.usage_links)
  ) <> 0 then
    raise exception
      'STOP: Migration 3 changed canonical production rows';
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
      'STOP: Compatibility asset fingerprint changed: %',
      v_text;
  end if;
end;
$phase_4a_m3_assertions$;

commit;
