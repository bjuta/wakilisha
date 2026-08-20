-- Phase 6A M2: exact Audio master attachment and full-length delivery authority.
--
-- M2 reuses Phase 4 Media storage, revisions, processing jobs, variants, and CDN.
-- It intentionally preserves the accepted audio-v1 preview/waveform profile.
-- It does not add Review, publication, RSS, public Audio routes, the Audio Editor,
-- transcripts, Chapters, Citations, Credits, or global-player behavior.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6a-audio-authority',
    0
  )
);

do $phase_6a_m2_preflight$
declare
  v_audio_v1_submit text;
  v_audio_v1_register text;
  v_fingerprint_definition text;
begin
  if to_regclass('audio.publications') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('editorial.audio_publication_resources') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('media.variant_roles') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.usage_roles') is null
     or to_regclass('media.events') is null
     or to_regclass('editorial.media_asset_resources') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: Phase 6A M1 or Phase 4 Media authority is incomplete';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_edit_audio(uuid)'
     ) is null
     or to_regprocedure(
       'audio.publication_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.command_actor_context()'
     ) is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.register_media_processing_outputs_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.complete_media_processing_job_v1(uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'media.insert_verified_file_object_v2(jsonb,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: required Audio, command, or Media processing helper is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'audio'
      and table_name = 'publication_versions'
      and column_name in (
        'master_media_asset_id',
        'master_media_revision_id',
        'audio_delivery_variant_id'
      )
  ) then
    raise exception
      'STOP: one or more Audio M2 version Media columns already exist';
  end if;

  if exists (
    select 1
    from media.variant_roles
    where variant_role = 'audio_delivery'
  ) then
    raise exception
      'STOP: audio_delivery Media variant role already exists';
  end if;

  if exists (
    select 1
    from media.usage_roles
    where usage_role = 'audio_master'
  ) then
    raise exception
      'STOP: audio_master Media usage role already exists';
  end if;

  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'media.process_revision'
      and enabled
  ) then
    raise exception
      'STOP: accepted Media processing command type is missing or disabled';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type = 'audio.publication.master.set'
  ) then
    raise exception
      'STOP: Audio master command type already exists';
  end if;

  if to_regclass(
       'platform_private.audio_master_mutation_authorizations'
     ) is not null
     or to_regprocedure(
       'platform_private.guard_audio_master_usage_mutation()'
     ) is not null
     or to_regprocedure(
       'public.set_audio_publication_master(uuid,bigint,uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.submit_audio_delivery_processing_v1(uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.register_audio_delivery_processing_outputs_v1(uuid,text,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: one or more Phase 6A M2 authorities already exist';
  end if;

  v_audio_v1_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_audio_v1_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );
  v_fingerprint_definition := pg_get_functiondef(
    'audio.publication_content_fingerprint(uuid)'::regprocedure
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
      'STOP: accepted Phase 4 v1 processing functions already changed semantics';
  end if;

  if position(
       'master_media_asset_id'
       in v_fingerprint_definition
     ) > 0
  then
    raise exception
      'STOP: Audio content fingerprint already contains M2 Media identity';
  end if;
end;
$phase_6a_m2_preflight$;

-- ---------------------------------------------------------------------------
-- Media vocabularies for exact Audio publication use.
-- ---------------------------------------------------------------------------

insert into media.variant_roles (
  variant_role,
  label,
  description,
  enabled,
  sort_order
)
values (
  'audio_delivery',
  'Audio Delivery',
  'Full-length immutable Audio derivative for publication playback and future enclosure use.',
  true,
  65
);

insert into media.usage_roles (
  usage_role,
  label,
  description,
  enabled,
  sort_order
)
values (
  'audio_master',
  'Audio Master',
  'Exact protected Media master revision attached to an Audio publication.',
  true,
  65
);

-- One playable Audio publication has at most one active current master.
create unique index audio_publication_one_active_master_idx
  on media.usage_links(target_id)
  where target_authority = 'editorial'
    and target_kind = 'audio_publication'
    and target_version_id is null
    and usage_role = 'audio_master'
    and usage_state = 'active';

-- ---------------------------------------------------------------------------
-- Immutable Audio version Media identity.
-- ---------------------------------------------------------------------------

alter table audio.publication_versions
  add column master_media_asset_id uuid,
  add column master_media_revision_id uuid,
  add column audio_delivery_variant_id uuid;

alter table audio.publication_versions
  add constraint audio_publication_versions_master_asset_fkey
    foreign key (master_media_asset_id)
    references media.assets(id)
    on delete restrict,
  add constraint audio_publication_versions_master_revision_fkey
    foreign key (master_media_revision_id)
    references media.asset_revisions(id)
    on delete restrict,
  add constraint audio_publication_versions_delivery_variant_fkey
    foreign key (audio_delivery_variant_id)
    references media.variants(id)
    on delete restrict,
  add constraint audio_publication_versions_master_shape_check
    check (
      (master_media_asset_id is null)
      =
      (master_media_revision_id is null)
    ),
  add constraint audio_publication_versions_delivery_shape_check
    check (
      audio_delivery_variant_id is null
      or master_media_revision_id is not null
    );

create index audio_publication_versions_master_revision_idx
  on audio.publication_versions(master_media_revision_id)
  where master_media_revision_id is not null;

create index audio_publication_versions_delivery_variant_idx
  on audio.publication_versions(audio_delivery_variant_id)
  where audio_delivery_variant_id is not null;

create or replace function
  audio.enforce_publication_version_media_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'audio', 'media'
as $function$
declare
  v_master_valid boolean;
  v_delivery_valid boolean;
begin
  if new.master_media_asset_id is null then
    if new.master_media_revision_id is not null
       or new.audio_delivery_variant_id is not null
    then
      raise exception
        'Audio version Media identity is incomplete.';
    end if;
    return new;
  end if;

  select true
  into v_master_valid
  from media.assets asset
  join media.asset_revisions revision
    on revision.id = new.master_media_revision_id
   and revision.asset_id = asset.id
  join media.file_objects original_file
    on original_file.id = revision.original_file_object_id
  where asset.id = new.master_media_asset_id
    and asset.asset_kind = 'audio'
    and original_file.verification_state = 'verified'
    and original_file.storage_provider = 'lightsail_media'
    and original_file.storage_path ~ '^masters/audio/';

  if not coalesce(v_master_valid, false) then
    raise exception
      'Audio version master must reference one exact verified protected Audio Media revision.';
  end if;

  if new.audio_delivery_variant_id is not null then
    select true
    into v_delivery_valid
    from media.variants variant
    join media.file_objects derived_file
      on derived_file.id = variant.derived_file_object_id
    join media.variant_selections selection
      on selection.asset_revision_id = variant.asset_revision_id
     and selection.variant_role = 'audio_delivery'
     and selection.variant_id = variant.id
    where variant.id = new.audio_delivery_variant_id
      and variant.asset_id = new.master_media_asset_id
      and variant.asset_revision_id = new.master_media_revision_id
      and variant.variant_role = 'audio_delivery'
      and derived_file.verification_state = 'verified';

    if not coalesce(v_delivery_valid, false) then
      raise exception
        'Audio version delivery variant must be the selected full-length derivative for its exact master revision.';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute
on function audio.enforce_publication_version_media_integrity()
from public, anon, authenticated, service_role;

create trigger audio_publication_versions_media_integrity
before insert or update
on audio.publication_versions
for each row
execute function
  audio.enforce_publication_version_media_integrity();

create or replace function
  audio.current_publication_master(
    p_publication_id uuid
  )
returns table(
  usage_link_id uuid,
  asset_id uuid,
  asset_revision_id uuid,
  audio_delivery_variant_id uuid
)
language sql
stable
set search_path to 'pg_catalog', 'audio', 'media'
as $function$
  select
    usage.id,
    usage.asset_id,
    usage.asset_revision_id,
    selection.variant_id
  from media.usage_links usage
  left join media.variant_selections selection
    on selection.asset_revision_id = usage.asset_revision_id
   and selection.variant_role = 'audio_delivery'
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'audio_publication'
    and usage.target_id = p_publication_id
    and usage.target_version_id is null
    and usage.usage_role = 'audio_master'
    and usage.resolution_mode = 'exact_revision'
    and usage.usage_state = 'active';
$function$;

revoke execute
on function audio.current_publication_master(uuid)
from public, anon, authenticated, service_role;

create or replace function
  audio.publication_content_fingerprint(
    p_publication_id uuid
  )
returns text
language sql
stable
set search_path to
  'pg_catalog',
  'audio',
  'media',
  'extensions'
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'publication_kind',
            publication.publication_kind,
          'show_id',
            publication.show_id,
          'season_id',
            publication.season_id,
          'episode_number',
            publication.episode_number,
          'slug',
            publication.slug,
          'title',
            publication.title,
          'summary',
            publication.summary,
          'status',
            publication.status,
          'metadata',
            publication.metadata,
          'master_media_asset_id',
            master.asset_id,
          'master_media_revision_id',
            master.asset_revision_id,
          'audio_delivery_variant_id',
            master.audio_delivery_variant_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from audio.publications publication
  left join lateral
    audio.current_publication_master(
      publication.id
    ) master
    on true
  where publication.id = p_publication_id;
$function$;

create or replace function
  audio.insert_current_publication_snapshot(
    p_publication_id uuid,
    p_expected_authority_revision bigint,
    p_version_kind text,
    p_actor_id uuid
  )
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'audio',
  'editorial',
  'media',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_master record;
  v_version_number bigint;
  v_fingerprint text;
  v_version_id uuid;
begin
  if p_version_kind not in (
    'working',
    'submitted',
    'approved',
    'published'
  ) then
    raise exception
      'Unsupported Audio version kind.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception
      'Audio publication does not exist.';
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    raise exception
      'Audio publication revision changed.';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist.';
  end if;

  select *
  into v_master
  from audio.current_publication_master(
    p_publication_id
  );

  v_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  if v_fingerprint is null then
    raise exception
      'Audio publication fingerprint could not be created.';
  end if;

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from audio.publication_versions version
  where version.publication_id = p_publication_id;

  v_version_id :=
    extensions.gen_random_uuid();

  insert into audio.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_id,
    season_id,
    episode_number,
    title,
    slug,
    summary,
    status,
    metadata,
    master_media_asset_id,
    master_media_revision_id,
    audio_delivery_variant_id,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_binding.resource_id,
    v_publication.id,
    v_version_number,
    p_version_kind,
    v_publication.authority_revision,
    v_publication.publication_kind,
    v_publication.show_id,
    v_publication.season_id,
    v_publication.episode_number,
    v_publication.title,
    v_publication.slug,
    v_publication.summary,
    v_publication.status,
    v_publication.metadata,
    v_master.asset_id,
    v_master.asset_revision_id,
    v_master.audio_delivery_variant_id,
    v_fingerprint,
    p_actor_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  return next;
end;
$function$;

revoke execute
on function
  audio.insert_current_publication_snapshot(
    uuid,
    bigint,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audio-owned current-master command.
-- ---------------------------------------------------------------------------

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values (
  'audio.publication.master.set',
  'audio.publication.master.set.sync',
  'audio.publication.master.set.accepted',
  'audio.publication.master.set.succeeded',
  'audio.publication.master.set.failed',
  'audio.publication.master.set.retry_scheduled',
  true
);

create table
  platform_private.audio_master_mutation_authorizations (
    token uuid primary key,
    actor_id uuid not null,
    publication_id uuid not null,
    command_receipt_id uuid not null,
    created_at timestamptz not null
      default clock_timestamp(),

    constraint audio_master_mutation_authorizations_actor_fkey
      foreign key (actor_id)
      references auth.users(id)
      on delete cascade,

    constraint audio_master_mutation_authorizations_publication_fkey
      foreign key (publication_id)
      references audio.publications(id)
      on delete cascade,

    constraint audio_master_mutation_authorizations_receipt_fkey
      foreign key (command_receipt_id)
      references platform_private.command_receipts(id)
      on delete cascade
  );

revoke all
on platform_private.audio_master_mutation_authorizations
from public, anon, authenticated, service_role;

create or replace function
  platform_private.guard_audio_master_usage_mutation()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'platform_private'
as $function$
declare
  v_token uuid;
  v_target_id uuid;
  v_actor_id uuid;
  v_is_audio_master boolean;
begin
  v_is_audio_master :=
    (
      tg_op <> 'DELETE'
      and new.target_authority = 'editorial'
      and new.target_kind = 'audio_publication'
      and new.usage_role = 'audio_master'
    )
    or
    (
      tg_op <> 'INSERT'
      and old.target_authority = 'editorial'
      and old.target_kind = 'audio_publication'
      and old.usage_role = 'audio_master'
    );

  if not v_is_audio_master then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_target_id :=
    case
      when tg_op = 'DELETE' then old.target_id
      else new.target_id
    end;

  begin
    v_token := nullif(
      current_setting(
        'wakilisha.audio_master_mutation_token',
        true
      ),
      ''
    )::uuid;
  exception
    when others then
      v_token := null;
  end;

  v_actor_id := auth.uid();

  if v_token is null
     or v_actor_id is null
     or not exists (
       select 1
       from platform_private.audio_master_mutation_authorizations authorization_row
       where authorization_row.token = v_token
         and authorization_row.actor_id = v_actor_id
         and authorization_row.publication_id = v_target_id
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'Audio master usage must be changed through the governed Audio master command.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

revoke execute
on function
  platform_private.guard_audio_master_usage_mutation()
from public, anon, authenticated, service_role;

create trigger audio_master_usage_governed_mutation
before insert or update or delete
on media.usage_links
for each row
execute function
  platform_private.guard_audio_master_usage_mutation();

create or replace function
  public.set_audio_publication_master(
    p_publication_id uuid,
    p_expected_authority_revision bigint,
    p_asset_id uuid,
    p_asset_revision_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  master_usage_link_id uuid,
  master_media_asset_id uuid,
  master_media_revision_id uuid,
  audio_delivery_variant_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'audio',
  'media',
  'platform_private',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_asset media.assets%rowtype;
  v_current_usage media.usage_links%rowtype;
  v_current_count bigint;
  v_master record;
  v_begin record;
  v_read record;
  v_actor record;
  v_request jsonb;
  v_result jsonb;
  v_usage_id uuid;
  v_token uuid := extensions.gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_same boolean := false;
begin
  if p_publication_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or (
       (p_asset_id is null)
       <>
       (p_asset_revision_id is null)
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio master request is invalid.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio publication does not exist.';
  end if;

  if v_publication.status not in (
    'draft',
    'changes_requested'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'Audio master can be changed only while the publication is editable.';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding is missing.';
  end if;

  if not editorial.current_user_can_edit_audio(
    v_binding.resource_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  if p_asset_id is not null then
    select asset.*
    into v_asset
    from media.assets asset
    where asset.id = p_asset_id;

    if not found
       or v_asset.asset_kind <> 'audio'
       or v_asset.lifecycle_state <> 'active'
       or not exists (
         select 1
         from media.asset_revisions revision
         join media.file_objects original_file
           on original_file.id = revision.original_file_object_id
         where revision.id = p_asset_revision_id
           and revision.asset_id = p_asset_id
           and original_file.verification_state = 'verified'
           and original_file.storage_provider = 'lightsail_media'
           and original_file.storage_path ~ '^masters/audio/'
           and original_file.mime_type like 'audio/%'
       )
    then
      raise exception
        using
          errcode = '55000',
          message =
            'Audio master requires one exact verified protected Audio Media revision.';
    end if;
  end if;

  v_request := jsonb_build_object(
    'publication_id', p_publication_id,
    'expected_authority_revision',
      p_expected_authority_revision,
    'asset_id', p_asset_id,
    'asset_revision_id', p_asset_revision_id,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.master.set',
    v_binding.resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_binding.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    master_usage_link_id := nullif(
      v_read.result_payload ->> 'master_usage_link_id',
      ''
    )::uuid;
    master_media_asset_id := nullif(
      v_read.result_payload ->> 'master_media_asset_id',
      ''
    )::uuid;
    master_media_revision_id := nullif(
      v_read.result_payload ->> 'master_media_revision_id',
      ''
    )::uuid;
    audio_delivery_variant_id := nullif(
      v_read.result_payload ->> 'audio_delivery_variant_id',
      ''
    )::uuid;
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before its master could be updated.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision
      )
    );
  else
    select count(*)
    into v_current_count
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'audio_publication'
      and usage.target_id = p_publication_id
      and usage.target_version_id is null
      and usage.usage_role = 'audio_master'
      and usage.usage_state = 'active';

    if v_current_count > 1 then
      raise exception
        'Audio publication has more than one active master.';
    end if;

    if v_current_count = 1 then
      select usage.*
      into v_current_usage
      from media.usage_links usage
      where usage.target_authority = 'editorial'
        and usage.target_kind = 'audio_publication'
        and usage.target_id = p_publication_id
        and usage.target_version_id is null
        and usage.usage_role = 'audio_master'
        and usage.usage_state = 'active'
      for update;

      v_same :=
        p_asset_id is not null
        and v_current_usage.asset_id = p_asset_id
        and v_current_usage.asset_revision_id = p_asset_revision_id
        and v_current_usage.resolution_mode = 'exact_revision';
      v_usage_id := v_current_usage.id;
    else
      v_same := p_asset_id is null;
    end if;

    if not v_same then
      select *
      into v_actor
      from platform_private.command_actor_context();

      insert into
        platform_private.audio_master_mutation_authorizations (
          token,
          actor_id,
          publication_id,
          command_receipt_id
        )
      values (
        v_token,
        v_actor.actor_user_id,
        p_publication_id,
        v_begin.command_receipt_id
      );

      perform set_config(
        'wakilisha.audio_master_mutation_token',
        v_token::text,
        true
      );

      if v_current_count = 1 then
        update media.usage_links
        set
          usage_state = 'archived',
          usage_revision = usage_revision + 1,
          state_reason =
            'Replaced by governed Audio master command',
          state_changed_by = v_actor.actor_user_id,
          state_changed_at = now(),
          updated_at = now()
        where id = v_current_usage.id;

        insert into media.events (
          asset_id,
          asset_revision_id,
          usage_link_id,
          event_type,
          actor_id,
          reason,
          prior_state,
          resulting_state,
          correlation_id
        )
        values (
          v_current_usage.asset_id,
          v_current_usage.asset_revision_id,
          v_current_usage.id,
          'usage_archived',
          v_actor.actor_user_id,
          'Audio master replaced or cleared',
          jsonb_build_object(
            'usage_state', 'active',
            'usage_revision',
              v_current_usage.usage_revision
          ),
          jsonb_build_object(
            'usage_state', 'archived',
            'usage_revision',
              v_current_usage.usage_revision + 1
          ),
          v_correlation_id
        );
      end if;

      if p_asset_id is not null then
        v_usage_id := extensions.gen_random_uuid();

        insert into media.usage_links (
          id,
          asset_id,
          asset_revision_id,
          resolution_mode,
          target_authority,
          target_kind,
          target_id,
          target_version_kind,
          target_version_id,
          usage_role,
          placement_data,
          display_order,
          usage_state,
          usage_revision,
          created_by
        )
        values (
          v_usage_id,
          p_asset_id,
          p_asset_revision_id,
          'exact_revision',
          'editorial',
          'audio_publication',
          p_publication_id,
          null,
          null,
          'audio_master',
          '{}'::jsonb,
          0,
          'active',
          1,
          v_actor.actor_user_id
        );

        insert into media.events (
          asset_id,
          asset_revision_id,
          usage_link_id,
          event_type,
          actor_id,
          reason,
          resulting_state,
          correlation_id
        )
        values (
          p_asset_id,
          p_asset_revision_id,
          v_usage_id,
          'usage_attached',
          v_actor.actor_user_id,
          'Governed Audio master attached',
          jsonb_build_object(
            'usage_state', 'active',
            'usage_revision', 1,
            'target_authority', 'editorial',
            'target_kind', 'audio_publication',
            'target_id', p_publication_id,
            'usage_role', 'audio_master',
            'resolution_mode', 'exact_revision'
          ),
          v_correlation_id
        );
      else
        v_usage_id := null;
      end if;

      delete from
        platform_private.audio_master_mutation_authorizations
      where token = v_token;

      perform set_config(
        'wakilisha.audio_master_mutation_token',
        '',
        true
      );

      update audio.publications publication
      set
        authority_revision =
          publication.authority_revision + 1,
        updated_by = v_actor.actor_user_id,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;
    end if;

    select *
    into v_master
    from audio.current_publication_master(
      p_publication_id
    );

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', v_binding.resource_id,
      'authority_revision',
        v_publication.authority_revision,
      'master_usage_link_id',
        v_master.usage_link_id,
      'master_media_asset_id',
        v_master.asset_id,
      'master_media_revision_id',
        v_master.asset_revision_id,
      'audio_delivery_variant_id',
        v_master.audio_delivery_variant_id,
      'master_changed', not v_same,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_binding.resource_id;
  authority_revision := coalesce(
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint,
    v_publication.authority_revision
  );
  master_usage_link_id := nullif(
    v_read.result_payload ->> 'master_usage_link_id',
    ''
  )::uuid;
  master_media_asset_id := nullif(
    v_read.result_payload ->> 'master_media_asset_id',
    ''
  )::uuid;
  master_media_revision_id := nullif(
    v_read.result_payload ->> 'master_media_revision_id',
    ''
  )::uuid;
  audio_delivery_variant_id := nullif(
    v_read.result_payload ->> 'audio_delivery_variant_id',
    ''
  )::uuid;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function
  public.set_audio_publication_master(
    uuid,
    bigint,
    uuid,
    uuid,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.set_audio_publication_master(
    uuid,
    bigint,
    uuid,
    uuid,
    text,
    uuid
  )
to authenticated;

-- ---------------------------------------------------------------------------
-- Additive full-length Media processing submission.
-- ---------------------------------------------------------------------------

create or replace function
  public.submit_audio_delivery_processing_v1(
    p_asset_id uuid,
    p_asset_revision_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  job_id uuid,
  accepted_event_id uuid,
  receipt_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'media',
  'platform_private',
  'extensions'
as $function$
declare
  v_command_type constant text := 'media.process_revision';
  v_profile_version constant text := 'audio-publication-v1';
  v_actor record;
  v_asset media.assets%rowtype;
  v_revision media.asset_revisions%rowtype;
  v_source media.file_objects%rowtype;
  v_request_payload jsonb;
  v_request_fingerprint text;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_receipt_status text;
  v_job_id uuid;
  v_event_id uuid;
  v_created boolean;
  v_resource_kind text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if auth.role() <> 'authenticated'
     or auth.uid() is null
  then
    raise exception
      using
        errcode = '42501',
        message = 'Authenticated Media processing actor is required.';
  end if;

  if not (
    public.current_user_has_capability('manage_media_assets')
    or public.current_user_is_administrator()
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'manage_media_assets capability is required.';
  end if;

  if p_asset_id is null
     or p_asset_revision_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio delivery processing request is invalid.';
  end if;

  select *
  into v_asset
  from media.assets
  where id = p_asset_id;

  if not found
     or v_asset.lifecycle_state <> 'active'
     or v_asset.asset_kind <> 'audio'
  then
    raise exception
      using
        errcode = '55000',
        message = 'Audio delivery processing requires an active Audio Media asset.';
  end if;

  select *
  into v_revision
  from media.asset_revisions
  where id = p_asset_revision_id
    and asset_id = p_asset_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Media revision does not belong to the requested Audio asset.';
  end if;

  select *
  into v_source
  from media.file_objects
  where id = v_revision.original_file_object_id;

  if not found
     or v_source.verification_state <> 'verified'
     or v_source.storage_provider <> 'lightsail_media'
     or v_source.storage_path is null
     or v_source.storage_path !~ '^masters/audio/'
     or v_source.sha256 is null
     or v_source.byte_size is null
     or v_source.mime_type not like 'audio/%'
  then
    raise exception
      using
        errcode = '55000',
        message = 'Audio delivery processing requires a verified protected Audio master.';
  end if;

  if not exists (
    select 1
    from media.usage_links usage
    where usage.asset_id = p_asset_id
      and usage.asset_revision_id = p_asset_revision_id
      and usage.resolution_mode = 'exact_revision'
      and usage.target_authority = 'editorial'
      and usage.target_kind = 'audio_publication'
      and usage.target_version_id is null
      and usage.usage_role = 'audio_master'
      and usage.usage_state = 'active'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'Audio delivery processing requires an active Audio publication master attachment.';
  end if;

  select resource_kind
  into v_resource_kind
  from editorial.resources
  where id = p_asset_id;

  if not found then
    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by
    )
    values (
      p_asset_id,
      'media_asset',
      auth.uid(),
      'internal',
      'active',
      auth.uid()
    );

    insert into editorial.media_asset_resources (
      resource_id,
      asset_id
    )
    values (
      p_asset_id,
      p_asset_id
    );
  else
    if v_resource_kind <> 'media_asset'
       or not exists (
         select 1
         from editorial.media_asset_resources binding
         where binding.resource_id = p_asset_id
           and binding.asset_id = p_asset_id
       )
    then
      raise exception
        'Audio Media Resource binding is invalid.';
    end if;
  end if;

  select *
  into v_actor
  from platform_private.command_actor_context();

  v_request_payload := jsonb_build_object(
    'asset_id', p_asset_id,
    'asset_revision_id', p_asset_revision_id,
    'source_file_object_id', v_source.id,
    'source_storage_path', v_source.storage_path,
    'source_sha256', v_source.sha256,
    'source_byte_size', v_source.byte_size,
    'source_mime_type', v_source.mime_type,
    'asset_kind', v_asset.asset_kind,
    'profile_version', v_profile_version,
    'correlation_id', v_correlation_id
  );

  v_request_fingerprint :=
    platform_private.command_request_fingerprint(
      v_command_type,
      p_asset_id,
      v_request_payload - 'correlation_id'
    );

  insert into platform_private.command_receipts (
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload
  )
  values (
    v_command_type,
    p_asset_id,
    v_actor.principal_key,
    v_actor.actor_user_id,
    p_idempotency_key,
    v_request_fingerprint,
    v_request_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning id, status
  into v_receipt_id, v_receipt_status;

  v_created := found;

  if not v_created then
    select
      receipt.id,
      receipt.request_fingerprint,
      receipt.status
    into
      v_receipt_id,
      v_existing_fingerprint,
      v_receipt_status
    from platform_private.command_receipts receipt
    where receipt.principal_key = v_actor.principal_key
      and receipt.command_type = v_command_type
      and receipt.idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception
        'Audio delivery processing idempotency receipt disappeared.';
    end if;

    if v_existing_fingerprint <> v_request_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different processing request.';
    end if;

    select job.id
    into v_job_id
    from platform_private.jobs job
    where job.command_receipt_id = v_receipt_id
      and job.job_key = 'primary';

    select event.id
    into v_event_id
    from platform_private.outbox_events event
    where event.event_key =
      'command:' || v_receipt_id::text || ':accepted';

    if v_job_id is null
       or v_event_id is null
    then
      raise exception
        'Accepted Audio delivery processing command is missing its durable job or event.';
    end if;

    return query
    select
      v_receipt_id,
      v_job_id,
      v_event_id,
      v_receipt_status,
      true;
    return;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,
    resource_id,
    command_type,
    job_key,
    job_type,
    max_attempts,
    input_payload
  )
  values (
    v_receipt_id,
    p_asset_id,
    v_command_type,
    'primary',
    'media.process_revision',
    4,
    v_request_payload
  )
  returning id
  into v_job_id;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  values (
    'command:' || v_receipt_id::text || ':accepted',
    v_receipt_id,
    v_job_id,
    v_command_type,
    p_asset_id,
    'media.processing.accepted',
    jsonb_build_object(
      'command_receipt_id', v_receipt_id,
      'job_id', v_job_id,
      'resource_id', p_asset_id,
      'asset_id', p_asset_id,
      'asset_revision_id', p_asset_revision_id,
      'source_file_object_id', v_source.id,
      'profile_version', v_profile_version,
      'principal_key', v_actor.principal_key,
      'correlation_id', v_correlation_id,
      'accepted_at', now()
    )
  )
  returning id
  into v_event_id;

  return query
  select
    v_receipt_id,
    v_job_id,
    v_event_id,
    'accepted'::text,
    false;
end;
$function$;

revoke all
on function
  public.submit_audio_delivery_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.submit_audio_delivery_processing_v1(
    uuid,
    uuid,
    text,
    uuid
  )
to authenticated;

-- ---------------------------------------------------------------------------
-- Service-role registration for exactly one full-length derivative.
-- ---------------------------------------------------------------------------

create or replace function
  public.register_audio_delivery_processing_outputs_v1(
    p_job_id uuid,
    p_worker_id text,
    p_outputs jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'media',
  'platform_private',
  'extensions'
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_receipt platform_private.command_receipts%rowtype;
  v_actor_id uuid;
  v_asset_id uuid;
  v_revision_id uuid;
  v_source_file_id uuid;
  v_correlation_id uuid;
  v_output jsonb;
  v_file jsonb;
  v_storage_path text;
  v_delivery_url text;
  v_expected_storage_path text;
  v_expected_delivery_url text;
  v_sha256 text;
  v_byte_size bigint;
  v_file_object_id uuid;
  v_existing_file media.file_objects%rowtype;
  v_variant_id uuid;
  v_selection_variant_id uuid;
  v_selection_revision bigint;
  v_new_variant boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_job_id is null
     or p_worker_id is null
     or p_worker_id !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     or p_outputs is null
     or jsonb_typeof(p_outputs) <> 'array'
     or jsonb_array_length(p_outputs) <> 1
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Audio delivery registration requires one leased job and exactly one output.';
  end if;

  select job.*
  into v_job
  from platform_private.jobs job
  where job.id = p_job_id
  for update;

  if not found
     or v_job.command_type <> 'media.process_revision'
     or v_job.job_type <> 'media.process_revision'
     or v_job.status <> 'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at <= now()
     or v_job.input_payload ->> 'profile_version'
          <> 'audio-publication-v1'
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The Audio delivery processing job is not actively leased to this worker.';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = v_job.command_receipt_id;

  if not found
     or v_receipt.actor_user_id is null
     or v_receipt.status <> 'accepted'
  then
    raise exception
      using
        errcode = '55000',
        message =
          'Audio delivery processing receipt actor or state is invalid.';
  end if;

  v_actor_id := v_receipt.actor_user_id;
  v_asset_id := nullif(
    v_job.input_payload ->> 'asset_id',
    ''
  )::uuid;
  v_revision_id := nullif(
    v_job.input_payload ->> 'asset_revision_id',
    ''
  )::uuid;
  v_source_file_id := nullif(
    v_job.input_payload ->> 'source_file_object_id',
    ''
  )::uuid;
  v_correlation_id := nullif(
    v_job.input_payload ->> 'correlation_id',
    ''
  )::uuid;

  if v_asset_id is null
     or v_revision_id is null
     or v_source_file_id is null
     or v_correlation_id is null
     or not exists (
       select 1
       from media.asset_revisions revision
       join media.assets asset
         on asset.id = revision.asset_id
       join media.file_objects source_file
         on source_file.id = revision.original_file_object_id
       where revision.id = v_revision_id
         and revision.asset_id = v_asset_id
         and revision.original_file_object_id = v_source_file_id
         and asset.asset_kind = 'audio'
         and source_file.verification_state = 'verified'
     )
  then
    raise exception
      'Audio delivery processing source authority changed or is invalid.';
  end if;

  v_output := p_outputs -> 0;
  v_file := v_output -> 'file';

  if jsonb_typeof(v_output) <> 'object'
     or jsonb_typeof(v_file) <> 'object'
     or v_output ->> 'variant_role' <> 'audio_delivery'
     or jsonb_typeof(v_output -> 'transformation_spec') <> 'object'
     or jsonb_typeof(v_output -> 'technical_metadata') <> 'object'
     or v_output -> 'transformation_spec' ->> 'profile'
          <> 'audio-publication-v1'
     or coalesce(
          (v_output -> 'transformation_spec'
            ->> 'full_length')::boolean,
          false
        ) is not true
     or v_output -> 'transformation_spec' ->> 'codec'
          <> 'mp3'
     or nullif(
          v_output -> 'transformation_spec'
            ->> 'bitrate_kbps',
          ''
        )::integer <> 128
     or v_output ->> 'generator_name'
          <> 'wakilisha-media-processor'
     or v_output ->> 'generator_version'
          <> 'phase6a-m2-v1'
     or v_file ->> 'storage_provider'
          <> 'lightsail_media'
     or coalesce(
          v_file ->> 'storage_namespace',
          ''
        ) <> 'lightsail-media'
     or v_file ->> 'mime_type' <> 'audio/mpeg'
  then
    raise exception
      'Audio delivery processing output contract is invalid.';
  end if;

  v_storage_path := nullif(
    btrim(v_file ->> 'storage_path'),
    ''
  );
  v_delivery_url := nullif(
    btrim(v_file ->> 'delivery_url'),
    ''
  );
  v_sha256 := lower(
    nullif(
      btrim(v_file ->> 'sha256'),
      ''
    )
  );
  v_byte_size := nullif(
    v_file ->> 'byte_size',
    ''
  )::bigint;

  v_expected_storage_path :=
    'derived-objects/' ||
    v_asset_id::text || '/' ||
    v_revision_id::text || '/' ||
    'audio-publication-v1/' ||
    v_source_file_id::text || '/' ||
    'audio_delivery.mp3';

  v_expected_delivery_url :=
    'https://media.wakilisha.africa/derivatives/' ||
    v_asset_id::text || '/' ||
    v_revision_id::text || '/' ||
    'audio-publication-v1/' ||
    v_source_file_id::text || '/' ||
    'audio_delivery.mp3';

  if v_storage_path is distinct from
       v_expected_storage_path
     or v_delivery_url is distinct from
          v_expected_delivery_url
     or v_sha256 is null
     or v_sha256 !~ '^[0-9a-f]{64}$'
     or v_byte_size is null
     or v_byte_size < 1
  then
    raise exception
      'Audio delivery immutable file identity is invalid.';
  end if;

  select file_object.*
  into v_existing_file
  from media.file_objects file_object
  where file_object.storage_provider = 'lightsail_media'
    and coalesce(file_object.storage_namespace, '') =
      'lightsail-media'
    and file_object.storage_path = v_storage_path;

  if found then
    if v_existing_file.verification_state <> 'verified'
       or v_existing_file.sha256 <> v_sha256
       or v_existing_file.byte_size <> v_byte_size
       or v_existing_file.mime_type <> 'audio/mpeg'
       or v_existing_file.delivery_url <> v_delivery_url
    then
      raise exception
        'Immutable Audio delivery storage collision does not match registered bytes.';
    end if;

    v_file_object_id := v_existing_file.id;
  else
    v_file_object_id :=
      media.insert_verified_file_object_v2(
        v_file,
        v_actor_id,
        v_correlation_id
      );
  end if;

  select variant.id
  into v_variant_id
  from media.variants variant
  where variant.asset_revision_id = v_revision_id
    and variant.source_file_object_id = v_source_file_id
    and variant.derived_file_object_id = v_file_object_id
    and variant.variant_role = 'audio_delivery';

  v_new_variant := not found;

  if v_new_variant then
    v_variant_id := extensions.gen_random_uuid();

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
      v_asset_id,
      v_revision_id,
      v_source_file_id,
      v_file_object_id,
      'audio_delivery',
      v_output -> 'transformation_spec',
      v_output -> 'technical_metadata',
      'wakilisha-media-processor',
      'phase6a-m2-v1',
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
      v_asset_id,
      v_revision_id,
      v_variant_id,
      v_file_object_id,
      'variant_registered',
      v_actor_id,
      'Immutable full-length Audio delivery derivative registered',
      jsonb_build_object(
        'variant_role', 'audio_delivery',
        'source_file_object_id', v_source_file_id,
        'derived_file_object_id', v_file_object_id,
        'processing_profile', 'audio-publication-v1'
      ),
      v_correlation_id
    );
  end if;

  select
    selection.variant_id,
    selection.selection_revision
  into
    v_selection_variant_id,
    v_selection_revision
  from media.variant_selections selection
  where selection.asset_revision_id = v_revision_id
    and selection.variant_role = 'audio_delivery'
  for update;

  if not found then
    v_selection_revision := 1;

    insert into media.variant_selections (
      asset_revision_id,
      variant_role,
      variant_id,
      selection_revision,
      selected_by
    )
    values (
      v_revision_id,
      'audio_delivery',
      v_variant_id,
      v_selection_revision,
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
      v_asset_id,
      v_revision_id,
      v_variant_id,
      v_file_object_id,
      'variant_activated',
      v_actor_id,
      'Full-length Audio delivery derivative activated',
      jsonb_build_object(
        'variant_role', 'audio_delivery',
        'selection_revision', v_selection_revision
      ),
      v_correlation_id
    );
  elsif v_selection_variant_id <> v_variant_id then
    v_selection_revision :=
      v_selection_revision + 1;

    update media.variant_selections
    set
      variant_id = v_variant_id,
      selection_revision = v_selection_revision,
      selected_by = v_actor_id,
      selected_at = now(),
      updated_at = now()
    where asset_revision_id = v_revision_id
      and variant_role = 'audio_delivery';

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
      v_asset_id,
      v_revision_id,
      v_variant_id,
      v_file_object_id,
      'variant_activated',
      v_actor_id,
      'Full-length Audio delivery derivative activation advanced',
      jsonb_build_object(
        'variant_role', 'audio_delivery',
        'selection_revision', v_selection_revision
      ),
      v_correlation_id
    );
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'asset_id', v_asset_id,
    'asset_revision_id', v_revision_id,
    'source_file_object_id', v_source_file_id,
    'profile_version', 'audio-publication-v1',
    'correlation_id', v_correlation_id,
    'outputs', jsonb_build_array(
      jsonb_build_object(
        'variant_role', 'audio_delivery',
        'file_object_id', v_file_object_id,
        'variant_id', v_variant_id,
        'selection_revision', v_selection_revision,
        'storage_path', v_storage_path,
        'delivery_url', v_delivery_url
      )
    )
  );
end;
$function$;

revoke all
on function
  public.register_audio_delivery_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.register_audio_delivery_processing_outputs_v1(
    uuid,
    text,
    jsonb
  )
to service_role;

commit;
