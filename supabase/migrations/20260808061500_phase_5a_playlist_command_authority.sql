-- Phase 5A Migration 209: canonical Playlist command authority.
--
-- This migration makes Playlist creation and mutable editorial work independent
-- of Institute and routes authenticated writes through governed RPC commands.
--
-- It establishes:
-- - reusable authenticated resource-command receipt primitives
-- - Playlist owner-aware read/edit authority helpers
-- - idempotent Playlist creation
-- - metadata update authority
-- - Registry/provider/external Playlist-item intake
-- - advisory duplicate detection
-- - item presentation updates
-- - per-track note save authority
-- - explicit match-resolution authority
-- - soft removal with safe position compaction
-- - atomic full-list reorder with stale-write rejection
-- - authenticated write cutover away from direct table mutation
--
-- It intentionally does not establish Playlist Review submission/decision.
-- Review remains a later Phase 5A migration because the current shipped Review
-- implementation is Article-specific and must not be reused as fake generic
-- authority.

begin;

do $phase_5a_m209_preflight$
declare
  v_playlist_count bigint;
  v_item_count bigint;
  v_existing_command_count bigint;
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('public.wk_playlist_items') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_item_resources') is null
  then
    raise exception 'STOP: Phase 5A Migration 208 Playlist authority is incomplete';
  end if;

  if to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception 'STOP: Shared command receipt/outbox authority is missing';
  end if;

  if to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
  then
    raise exception 'STOP: Shared resource-command completion authority is missing';
  end if;

  if to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('public.current_user_is_administrator()') is null
  then
    raise exception 'STOP: Capability helpers are missing';
  end if;

  if not exists (
    select 1
    from pg_extension
    where extname = 'pgcrypto'
  ) then
    raise exception 'STOP: pgcrypto extension is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('view_playlists'),
        ('edit_own_playlists'),
        ('edit_others_playlists'),
        ('publish_playlists'),
        ('delete_playlists')
    ) required(capability_key)
    where not exists (
      select 1
      from public.capability_definitions definition
      where definition.capability_key = required.capability_key
    )
  ) then
    raise exception 'STOP: One or more Phase 5A Playlist capabilities are missing';
  end if;

  select count(*)
  into v_playlist_count
  from public.wk_playlists;

  select count(*)
  into v_item_count
  from public.wk_playlist_items;

  if v_playlist_count <> 0 or v_item_count <> 0 then
    raise exception
      'STOP: Migration 209 expects the accepted empty canonical Playlist starting state. Found % Playlist(s) and % item(s)',
      v_playlist_count,
      v_item_count;
  end if;

  select count(*)
  into v_existing_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.create',
    'playlist.metadata.update',
    'playlist.item.add',
    'playlist.item.update',
    'playlist.item.remove',
    'playlist.items.reorder',
    'playlist.item.note.save',
    'playlist.item.match.resolve'
  );

  if v_existing_command_count <> 0 then
    raise exception
      'STOP: One or more Playlist command types already exist';
  end if;

  if to_regprocedure(
       'public.create_playlist(text,text,text,text,text,jsonb,uuid)'
     ) is not null
     or to_regprocedure(
       'public.update_playlist_metadata(uuid,bigint,jsonb,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)'
     ) is not null
  then
    raise exception 'STOP: One or more Migration 209 Playlist RPCs already exist';
  end if;
end;
$phase_5a_m209_preflight$;

-- ---------------------------------------------------------------------------
-- Controlled synchronous Playlist command vocabulary.
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
values
  (
    'playlist.create',
    'playlist.create.sync',
    'playlist.create.accepted',
    'playlist.create.succeeded',
    'playlist.create.failed',
    'playlist.create.retry_scheduled',
    true
  ),
  (
    'playlist.metadata.update',
    'playlist.metadata.update.sync',
    'playlist.metadata.update.accepted',
    'playlist.metadata.update.succeeded',
    'playlist.metadata.update.failed',
    'playlist.metadata.update.retry_scheduled',
    true
  ),
  (
    'playlist.item.add',
    'playlist.item.add.sync',
    'playlist.item.add.accepted',
    'playlist.item.add.succeeded',
    'playlist.item.add.failed',
    'playlist.item.add.retry_scheduled',
    true
  ),
  (
    'playlist.item.update',
    'playlist.item.update.sync',
    'playlist.item.update.accepted',
    'playlist.item.update.succeeded',
    'playlist.item.update.failed',
    'playlist.item.update.retry_scheduled',
    true
  ),
  (
    'playlist.item.remove',
    'playlist.item.remove.sync',
    'playlist.item.remove.accepted',
    'playlist.item.remove.succeeded',
    'playlist.item.remove.failed',
    'playlist.item.remove.retry_scheduled',
    true
  ),
  (
    'playlist.items.reorder',
    'playlist.items.reorder.sync',
    'playlist.items.reorder.accepted',
    'playlist.items.reorder.succeeded',
    'playlist.items.reorder.failed',
    'playlist.items.reorder.retry_scheduled',
    true
  ),
  (
    'playlist.item.note.save',
    'playlist.item.note.save.sync',
    'playlist.item.note.save.accepted',
    'playlist.item.note.save.succeeded',
    'playlist.item.note.save.failed',
    'playlist.item.note.save.retry_scheduled',
    true
  ),
  (
    'playlist.item.match.resolve',
    'playlist.item.match.resolve.sync',
    'playlist.item.match.resolve.accepted',
    'playlist.item.match.resolve.succeeded',
    'playlist.item.match.resolve.failed',
    'playlist.item.match.resolve.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Reusable authenticated synchronous command primitives.
--
-- Existing Correction helpers remain untouched. This adds the smallest generic
-- primitive needed by canonical editor commands without changing shipped
-- Correction or Media behaviour.
-- ---------------------------------------------------------------------------

create or replace function platform_private.command_actor_context()
returns table(
  actor_user_id uuid,
  principal_key text
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth'
as $function$
declare
  v_actor uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    raise exception
      using
        errcode = '42501',
        message = 'An authenticated editor is required.';
  end if;

  v_actor := auth.uid();

  if v_actor is null then
    raise exception
      using
        errcode = '42501',
        message = 'An authenticated editor identity is required.';
  end if;

  return query
  select
    v_actor,
    'user:' || v_actor::text;
end;
$function$;

revoke execute
  on function platform_private.command_actor_context()
  from public, anon, authenticated, service_role;

create or replace function platform_private.command_request_fingerprint(
  p_command_type text,
  p_resource_id uuid,
  p_request_payload jsonb
)
returns text
language sql
immutable
set search_path to 'pg_catalog', 'extensions'
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'command_type', p_command_type,
          'resource_id', p_resource_id,
          'request_payload',
          p_request_payload - 'correlation_id'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

revoke execute
  on function platform_private.command_request_fingerprint(
    text,
    uuid,
    jsonb
  )
  from public, anon, authenticated, service_role;

create or replace function platform_private.begin_authenticated_resource_command(
  p_command_type text,
  p_resource_id uuid,
  p_idempotency_key text,
  p_request_payload jsonb
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_context record;
  v_fingerprint text;
  v_receipt platform_private.command_receipts%rowtype;
  v_created boolean;
begin
  if p_resource_id is null then
    raise exception
      using errcode = '22023', message = 'resource_id is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'idempotency_key must contain 8 to 128 permitted characters.';
  end if;

  if p_request_payload is null
     or jsonb_typeof(p_request_payload) <> 'object'
     or octet_length(p_request_payload::text) > 32768
  then
    raise exception
      using
        errcode = '22023',
        message = 'request_payload must be a JSON object no larger than 32 KB.';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = p_command_type
      and command_type.enabled
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'The command type is missing or disabled.';
  end if;

  if not exists (
    select 1
    from editorial.resources resource_row
    where resource_row.id = p_resource_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message = 'The command resource does not exist.';
  end if;

  select *
  into v_context
  from platform_private.command_actor_context();

  v_fingerprint :=
    platform_private.command_request_fingerprint(
      p_command_type,
      p_resource_id,
      p_request_payload
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
    p_command_type,
    p_resource_id,
    v_context.principal_key,
    v_context.actor_user_id,
    p_idempotency_key,
    v_fingerprint,
    p_request_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning *
  into v_receipt;

  v_created := found;

  if not v_created then
    select receipt.*
    into v_receipt
    from platform_private.command_receipts receipt
    where receipt.principal_key = v_context.principal_key
      and receipt.command_type = p_command_type
      and receipt.idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception 'The idempotency receipt disappeared.';
    end if;

    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different request.';
    end if;

    return query
    select
      v_receipt.id,
      v_receipt.status,
      v_receipt.result_payload,
      true;
    return;
  end if;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' || v_receipt.id::text || ':accepted',
    v_receipt.id,
    command_type.command_type,
    p_resource_id,
    command_type.accepted_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', p_command_type,
      'resource_id', p_resource_id,
      'principal_key', v_context.principal_key,
      'correlation_id', p_request_payload ->> 'correlation_id',
      'accepted_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type = p_command_type;

  return query
  select
    v_receipt.id,
    v_receipt.status,
    v_receipt.result_payload,
    false;
end;
$function$;

revoke execute
  on function platform_private.begin_authenticated_resource_command(
    text,
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated, service_role;

create or replace function platform_private.read_authenticated_resource_command_result(
  p_command_receipt_id uuid,
  p_idempotent_replay boolean
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  resource_id uuid,
  result_payload jsonb,
  error_code text,
  error_message text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'platform_private'
as $function$
declare
  v_context record;
  v_receipt platform_private.command_receipts%rowtype;
begin
  select *
  into v_context
  from platform_private.command_actor_context();

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = p_command_receipt_id
    and receipt.principal_key = v_context.principal_key;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The command receipt does not exist for this editor.';
  end if;

  return query
  select
    v_receipt.id,
    v_receipt.status,
    v_receipt.resource_id,
    v_receipt.result_payload,
    v_receipt.error_code,
    v_receipt.error_message,
    p_idempotent_replay;
end;
$function$;

revoke execute
  on function platform_private.read_authenticated_resource_command_result(
    uuid,
    boolean
  )
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Playlist ownership and editor authority.
-- ---------------------------------------------------------------------------

create or replace function editorial.current_user_can_view_playlist(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and (
      public.current_user_is_administrator()
      or public.current_user_has_capability('view_playlists')
      or public.current_user_has_capability('edit_others_playlists')
      or public.current_user_has_capability('publish_playlists')
      or (
        public.current_user_has_capability('edit_own_playlists')
        and exists (
          select 1
          from editorial.resources resource_row
          where resource_row.id = p_resource_id
            and resource_row.resource_kind = 'playlist'
            and resource_row.owner_id = auth.uid()
        )
      )
    );
$function$;

create or replace function editorial.current_user_can_edit_playlist(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and (
      public.current_user_is_administrator()
      or public.current_user_has_capability('edit_others_playlists')
      or (
        public.current_user_has_capability('edit_own_playlists')
        and exists (
          select 1
          from editorial.resources resource_row
          where resource_row.id = p_resource_id
            and resource_row.resource_kind = 'playlist'
            and resource_row.owner_id = auth.uid()
        )
      )
    );
$function$;

revoke execute
  on function editorial.current_user_can_view_playlist(uuid)
  from public, anon;

grant execute
  on function editorial.current_user_can_view_playlist(uuid)
  to authenticated, service_role;

revoke execute
  on function editorial.current_user_can_edit_playlist(uuid)
  from public, anon;

grant execute
  on function editorial.current_user_can_edit_playlist(uuid)
  to authenticated, service_role;

create or replace function editorial.playlist_duplicate_item_ids(
  p_playlist_id uuid,
  p_exclude_item_id uuid,
  p_registry_track_id uuid,
  p_provider_key text,
  p_provider_track_id text,
  p_title text,
  p_artist_names text[]
)
returns uuid[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    array_agg(item.id order by item.position),
    '{}'::uuid[]
  )
  from public.wk_playlist_items item
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active'
    and (
      p_exclude_item_id is null
      or item.id <> p_exclude_item_id
    )
    and (
      (
        p_registry_track_id is not null
        and item.registry_track_id = p_registry_track_id
      )
      or (
        p_provider_key is not null
        and p_provider_track_id is not null
        and item.provider_key = p_provider_key
        and item.provider_track_id = p_provider_track_id
      )
      or (
        nullif(btrim(p_title), '') is not null
        and lower(btrim(coalesce(item.title, ''))) =
          lower(btrim(p_title))
        and lower(btrim(coalesce(item.artist_names[1], ''))) =
          lower(btrim(coalesce(p_artist_names[1], '')))
        and nullif(
          btrim(coalesce(p_artist_names[1], '')),
          ''
        ) is not null
      )
    );
$function$;

revoke execute
  on function editorial.playlist_duplicate_item_ids(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text[]
  )
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical Playlist creation.
-- ---------------------------------------------------------------------------

create or replace function public.create_playlist(
  p_title text,
  p_slug text,
  p_idempotency_key text,
  p_description text default null,
  p_curator_label text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_actor uuid;
  v_principal_key text;
  v_title text;
  v_slug text;
  v_description text;
  v_curator_label text;
  v_metadata jsonb;
  v_correlation_id uuid;
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
begin
  select context.actor_user_id, context.principal_key
  into v_actor, v_principal_key
  from platform_private.command_actor_context() context;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('edit_own_playlists')
    or public.current_user_has_capability('edit_others_playlists')
  ) then
    raise exception
      using errcode = '42501', message = 'Playlist creation permission is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023', message = 'idempotency_key is invalid.';
  end if;

  v_title := nullif(btrim(p_title), '');
  v_slug := nullif(btrim(lower(p_slug)), '');
  v_description := nullif(btrim(p_description), '');
  v_curator_label := nullif(btrim(p_curator_label), '');
  v_metadata := coalesce(p_metadata, '{}'::jsonb);
  v_correlation_id := coalesce(p_correlation_id, gen_random_uuid());

  if v_title is null or length(v_title) > 300 then
    raise exception
      using errcode = '22023', message = 'Playlist title is required and must not exceed 300 characters.';
  end if;

  if v_slug is null
     or length(v_slug) > 200
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception
      using errcode = '22023', message = 'Playlist slug is invalid.';
  end if;

  if length(coalesce(v_description, '')) > 10000
     or length(coalesce(v_curator_label, '')) > 500
  then
    raise exception
      using errcode = '22023', message = 'Playlist description or curator label is too long.';
  end if;

  if jsonb_typeof(v_metadata) <> 'object'
     or octet_length(v_metadata::text) > 16384
  then
    raise exception
      using errcode = '22023', message = 'Playlist metadata must be an object no larger than 16 KB.';
  end if;

  v_request := jsonb_build_object(
    'title', v_title,
    'slug', v_slug,
    'description', v_description,
    'curator_label', v_curator_label,
    'metadata', v_metadata,
    'correlation_id', v_correlation_id
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_principal_key || ':playlist.create:' || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key = v_principal_key
    and receipt.command_type = 'playlist.create'
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'playlist.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint <> v_expected_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different Playlist create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := nullif(v_read.result_payload ->> 'playlist_id', '')::uuid;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.wk_playlists playlist
    where playlist.slug = v_slug
  ) then
    raise exception
      using errcode = '23505', message = 'Playlist slug already exists.';
  end if;

  v_resource_id := gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'playlist',
    v_actor,
    'internal',
    'active',
    v_actor
  );

  insert into public.wk_playlists (
    id,
    title,
    slug,
    description,
    curator_label,
    status,
    cover_image_url,
    canonical_url,
    source_inquiry_id,
    source_work_product_link_id,
    metadata,
    created_by,
    authority_revision
  )
  values (
    v_resource_id,
    v_title,
    v_slug,
    v_description,
    v_curator_label,
    'draft',
    null,
    null,
    null,
    null,
    v_metadata,
    v_actor,
    1
  );

  insert into editorial.playlist_resources (
    resource_id,
    resource_kind,
    playlist_id
  )
  values (
    v_resource_id,
    'playlist',
    v_resource_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception 'Unexpected Playlist create replay after serialized preflight.';
  end if;

  v_result := jsonb_build_object(
    'playlist_id', v_resource_id,
    'resource_id', v_resource_id,
    'slug', v_slug,
    'authority_revision', 1,
    'status', 'draft',
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  playlist_id := v_resource_id;
  resource_id := v_resource_id;
  authority_revision := 1;
  result_payload := v_result;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Playlist metadata update.
-- ---------------------------------------------------------------------------

create or replace function public.update_playlist_metadata(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_new_title text;
  v_new_slug text;
  v_new_description text;
  v_new_curator_label text;
  v_new_metadata jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using errcode = '22023', message = 'Playlist and expected authority revision are required.';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'title',
       'slug',
       'description',
       'curator_label',
       'metadata'
     ] <> '{}'::jsonb
  then
    raise exception
      using errcode = '22023', message = 'Playlist metadata payload is invalid.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'payload', p_payload,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.metadata.update',
    v_resource_id,
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
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_playlist.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this metadata update could be applied.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );
  else
    v_new_title := case
      when p_payload ? 'title'
        then nullif(btrim(p_payload ->> 'title'), '')
      else v_playlist.title
    end;

    v_new_slug := case
      when p_payload ? 'slug'
        then nullif(btrim(lower(p_payload ->> 'slug')), '')
      else v_playlist.slug
    end;

    v_new_description := case
      when p_payload ? 'description'
        then nullif(btrim(p_payload ->> 'description'), '')
      else v_playlist.description
    end;

    v_new_curator_label := case
      when p_payload ? 'curator_label'
        then nullif(btrim(p_payload ->> 'curator_label'), '')
      else v_playlist.curator_label
    end;

    v_new_metadata := case
      when p_payload ? 'metadata'
        then coalesce(p_payload -> 'metadata', '{}'::jsonb)
      else v_playlist.metadata
    end;

    if v_new_title is null or length(v_new_title) > 300 then
      raise exception
        using errcode = '22023', message = 'Playlist title is invalid.';
    end if;

    if v_new_slug is null
       or length(v_new_slug) > 200
       or v_new_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    then
      raise exception
        using errcode = '22023', message = 'Playlist slug is invalid.';
    end if;

    if length(coalesce(v_new_description, '')) > 10000
       or length(coalesce(v_new_curator_label, '')) > 500
       or jsonb_typeof(v_new_metadata) <> 'object'
       or octet_length(v_new_metadata::text) > 16384
    then
      raise exception
        using errcode = '22023', message = 'Playlist metadata values are invalid.';
    end if;

    if v_new_slug <> v_playlist.slug
       and exists (
         select 1
         from public.wk_playlists other_playlist
         where other_playlist.slug = v_new_slug
           and other_playlist.id <> p_playlist_id
       )
    then
      raise exception
        using errcode = '23505', message = 'Playlist slug already exists.';
    end if;

    update public.wk_playlists playlist
    set
      title = v_new_title,
      slug = v_new_slug,
      description = v_new_description,
      curator_label = v_new_curator_label,
      metadata = v_new_metadata,
      authority_revision = playlist.authority_revision + 1
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;

    v_result := jsonb_build_object(
      'playlist_id', p_playlist_id,
      'resource_id', v_resource_id,
      'slug', v_playlist.slug,
      'authority_revision', v_playlist.authority_revision,
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
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Playlist item intake.
-- ---------------------------------------------------------------------------

create or replace function public.add_playlist_item(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_registry_track_id uuid default null,
  p_provider_key text default null,
  p_provider_track_id text default null,
  p_provider_url text default null,
  p_title text default null,
  p_artist_names text[] default '{}'::text[],
  p_release_title text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_playlist_resource editorial.resources%rowtype;
  v_resource_id uuid;
  v_item_id uuid;
  v_position integer;
  v_provider_key text := nullif(btrim(lower(p_provider_key)), '');
  v_provider_track_id text := nullif(btrim(p_provider_track_id), '');
  v_provider_url text := nullif(btrim(p_provider_url), '');
  v_registry_track_id uuid := p_registry_track_id;
  v_registry_release_id uuid;
  v_title text := nullif(btrim(p_title), '');
  v_artist_names text[] := coalesce(p_artist_names, '{}'::text[]);
  v_release_title text := nullif(btrim(p_release_title), '');
  v_artwork_url text;
  v_preview_url text;
  v_duration_ms integer;
  v_isrc text;
  v_match_status text;
  v_match_confidence numeric(5,4);
  v_normalization jsonb := '{}'::jsonb;
  v_provider_link public.registry_track_provider_links%rowtype;
  v_duplicate_ids uuid[];
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using errcode = '22023', message = 'Playlist and expected authority revision are required.';
  end if;

  if (v_provider_key is null) <> (v_provider_track_id is null) then
    raise exception
      using errcode = '22023', message = 'Provider key and provider track identity must be supplied together.';
  end if;

  if v_provider_key is not null
     and v_provider_key !~ '^[a-z0-9_]+$'
  then
    raise exception
      using errcode = '22023', message = 'Provider key is invalid.';
  end if;

  if v_registry_track_id is null
     and v_provider_key is null
     and (
       v_title is null
       or cardinality(v_artist_names) = 0
       or nullif(btrim(coalesce(v_artist_names[1], '')), '') is null
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'A Registry track, provider identity, or external title and artist are required.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  select resource_row.*
  into v_playlist_resource
  from editorial.resources resource_row
  where resource_row.id = v_resource_id;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception
      using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'registry_track_id', p_registry_track_id,
    'provider_key', v_provider_key,
    'provider_track_id', v_provider_track_id,
    'provider_url', v_provider_url,
    'title', v_title,
    'artist_names', to_jsonb(v_artist_names),
    'release_title', v_release_title,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.add',
    v_resource_id,
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
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    playlist_item_id := nullif(
      v_read.result_payload ->> 'playlist_item_id',
      ''
    )::uuid;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_playlist.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before this track could be added.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision', v_playlist.authority_revision
      )
    );
  else
    if v_provider_key is not null then
      select provider_link.*
      into v_provider_link
      from public.registry_track_provider_links provider_link
      where provider_link.provider_key = v_provider_key
        and provider_link.provider_track_id = v_provider_track_id;

      if found then
        if p_registry_track_id is not null
           and v_provider_link.match_status = 'matched'
           and v_provider_link.track_id <> p_registry_track_id
        then
          raise exception
            using
              errcode = '22023',
              message = 'Provider identity is matched to a different Registry track.';
        end if;

        if p_registry_track_id is null
           and v_provider_link.match_status = 'matched'
        then
          v_registry_track_id := v_provider_link.track_id;
        elsif p_registry_track_id is null
              and v_provider_link.match_status = 'needs_review'
        then
          v_normalization := jsonb_build_object(
            'suggested_registry_track_id', v_provider_link.track_id,
            'provider_match_status', v_provider_link.match_status,
            'provider_match_method', v_provider_link.match_method
          );
        end if;

        v_match_confidence := v_provider_link.match_confidence;
        v_preview_url := v_provider_link.preview_url;
        v_artwork_url := v_provider_link.artwork_url;
        v_duration_ms := v_provider_link.duration_ms;
        v_isrc := v_provider_link.isrc;
      end if;
    end if;

    if v_registry_track_id is not null then
      select
        track.title,
        track.release_id,
        release.title,
        coalesce(track.artwork_url, v_artwork_url),
        coalesce(track.preview_url, v_preview_url),
        coalesce(track.duration_ms, v_duration_ms),
        coalesce(track.isrc, v_isrc),
        coalesce(
          array_agg(
            coalesce(artist.display_name, link.artist_name_text)
            order by link.credit_order, link.id
          ) filter (
            where coalesce(artist.display_name, link.artist_name_text) is not null
          ),
          '{}'::text[]
        )
      into
        v_title,
        v_registry_release_id,
        v_release_title,
        v_artwork_url,
        v_preview_url,
        v_duration_ms,
        v_isrc,
        v_artist_names
      from public.registry_tracks track
      left join public.registry_releases release
        on release.id = track.release_id
      left join public.registry_track_artists link
        on link.track_id = track.id
        and link.status = 'active'
      left join public.registry_artists artist
        on artist.id = link.artist_id
      where track.id = v_registry_track_id
        and track.status = 'active'
      group by
        track.id,
        track.title,
        track.release_id,
        release.title,
        track.artwork_url,
        track.preview_url,
        track.duration_ms,
        track.isrc;

      if not found then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'registry_track_unavailable',
          'The selected Registry track is not active.',
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'authority_revision', v_playlist.authority_revision
          )
        );
      else
        v_match_status := 'matched';
        v_match_confidence := coalesce(v_match_confidence, 1.0000);
      end if;
    elsif v_provider_key is not null then
      if v_normalization ? 'suggested_registry_track_id' then
        v_match_status := 'needs_review';
      else
        v_match_status := 'pending';
      end if;
    else
      v_match_status := 'external_only';
    end if;

    if v_begin.command_receipt_id is not null
       and exists (
         select 1
         from platform_private.command_receipts receipt
         where receipt.id = v_begin.command_receipt_id
           and receipt.status = 'accepted'
       )
    then
      select coalesce(max(item.position), 0) + 1
      into v_position
      from public.wk_playlist_items item
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active';

      v_item_id := gen_random_uuid();

      insert into editorial.resources (
        id,
        resource_kind,
        owner_id,
        visibility,
        lifecycle_state,
        created_by
      )
      values (
        v_item_id,
        'playlist_item',
        v_playlist_resource.owner_id,
        'internal',
        'active',
        auth.uid()
      );

      insert into public.wk_playlist_items (
        id,
        playlist_id,
        position,
        registry_track_id,
        registry_release_id,
        provider_key,
        provider_track_id,
        provider_url,
        title,
        artist_names,
        release_title,
        artwork_url,
        preview_url,
        duration_ms,
        isrc,
        match_status,
        match_confidence,
        normalization_payload,
        notes,
        created_by,
        lifecycle_state
      )
      values (
        v_item_id,
        p_playlist_id,
        v_position,
        v_registry_track_id,
        v_registry_release_id,
        v_provider_key,
        v_provider_track_id,
        v_provider_url,
        v_title,
        v_artist_names,
        v_release_title,
        v_artwork_url,
        v_preview_url,
        v_duration_ms,
        v_isrc,
        v_match_status,
        v_match_confidence,
        v_normalization,
        null,
        auth.uid(),
        'active'
      );

      insert into editorial.playlist_item_resources (
        resource_id,
        resource_kind,
        playlist_item_id
      )
      values (
        v_item_id,
        'playlist_item',
        v_item_id
      );

      v_duplicate_ids := editorial.playlist_duplicate_item_ids(
        p_playlist_id,
        v_item_id,
        v_registry_track_id,
        v_provider_key,
        v_provider_track_id,
        v_title,
        v_artist_names
      );

      update public.wk_playlists playlist
      set authority_revision = playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.authority_revision
      into v_playlist.authority_revision;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'resource_id', v_resource_id,
        'playlist_item_id', v_item_id,
        'playlist_item_resource_id', v_item_id,
        'position', v_position,
        'match_status', v_match_status,
        'registry_track_id', v_registry_track_id,
        'duplicate_warning', cardinality(v_duplicate_ids) > 0,
        'duplicate_item_ids', to_jsonb(v_duplicate_ids),
        'authority_revision', v_playlist.authority_revision,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  playlist_item_id := nullif(
    v_read.result_payload ->> 'playlist_item_id',
    ''
  )::uuid;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Lightweight item presentation update. Match identity has a separate command.
-- ---------------------------------------------------------------------------

create or replace function public.update_playlist_item(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_item public.wk_playlist_items%rowtype;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_artist_names text[];
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_playlist_item_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist, item, and expected authority revision are required.';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'title',
       'artist_names',
       'release_title',
       'provider_url'
     ] <> '{}'::jsonb
  then
    raise exception
      using errcode = '22023', message = 'Playlist-item update payload is invalid.';
  end if;

  if p_payload ? 'artist_names'
     and jsonb_typeof(p_payload -> 'artist_names') <> 'array'
  then
    raise exception
      using errcode = '22023', message = 'artist_names must be an array.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision', p_expected_authority_revision,
    'payload', p_payload,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.update',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if not v_begin.idempotent_replay then
    if v_playlist.authority_revision <> p_expected_authority_revision then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_revision_changed',
        'The Playlist changed before this item update could be applied.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      select item.*
      into v_item
      from public.wk_playlist_items item
      where item.id = p_playlist_item_id
        and item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'
      for update;

      if not found then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'playlist_item_not_active',
          'The Playlist item is missing or no longer active.',
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'authority_revision', v_playlist.authority_revision
          )
        );
      else
        if v_item.registry_track_id is not null
           and (
             p_payload ? 'title'
             or p_payload ? 'artist_names'
             or p_payload ? 'release_title'
           )
        then
          raise exception
            using
              errcode = '22023',
              message = 'Matched Playlist track presentation is owned by Registry.';
        end if;

        if p_payload ? 'artist_names' then
          select coalesce(array_agg(value), '{}'::text[])
          into v_artist_names
          from jsonb_array_elements_text(
            p_payload -> 'artist_names'
          ) value;
        else
          v_artist_names := v_item.artist_names;
        end if;

        update public.wk_playlist_items item
        set
          title = case
            when p_payload ? 'title'
              then nullif(btrim(p_payload ->> 'title'), '')
            else item.title
          end,
          artist_names = v_artist_names,
          release_title = case
            when p_payload ? 'release_title'
              then nullif(btrim(p_payload ->> 'release_title'), '')
            else item.release_title
          end,
          provider_url = case
            when p_payload ? 'provider_url'
              then nullif(btrim(p_payload ->> 'provider_url'), '')
            else item.provider_url
          end
        where item.id = p_playlist_item_id
        returning item.*
        into v_item;

        if v_item.registry_track_id is null
           and v_item.provider_key is null
           and (
             nullif(btrim(coalesce(v_item.title, '')), '') is null
             or cardinality(v_item.artist_names) = 0
           )
        then
          raise exception
            using
              errcode = '22023',
              message = 'External Playlist items must retain a title and artist.';
        end if;

        update public.wk_playlists playlist
        set authority_revision = playlist.authority_revision + 1
        where playlist.id = p_playlist_id
        returning playlist.authority_revision
        into v_playlist.authority_revision;

        v_result := jsonb_build_object(
          'playlist_id', p_playlist_id,
          'playlist_item_id', p_playlist_item_id,
          'authority_revision', v_playlist.authority_revision,
          'correlation_id', v_correlation_id
        );

        perform platform_private.complete_resource_command(
          v_begin.command_receipt_id,
          v_result
        );
      end if;
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    v_begin.idempotent_replay
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  playlist_item_id := p_playlist_item_id;
  authority_revision := nullif(v_read.result_payload ->> 'authority_revision', '')::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := v_read.idempotent_replay;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Optional per-track note save.
-- ---------------------------------------------------------------------------

create or replace function public.save_playlist_item_note(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
  p_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_note text := nullif(btrim(p_note), '');
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_playlist_item_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist, item, and expected authority revision are required.';
  end if;

  if length(coalesce(v_note, '')) > 12000 then
    raise exception
      using errcode = '22023', message = 'Playlist-item note must not exceed 12000 characters.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision', p_expected_authority_revision,
    'note', v_note,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.note.save',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if not v_begin.idempotent_replay then
    if v_playlist.authority_revision <> p_expected_authority_revision then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_revision_changed',
        'The Playlist changed before this note could be saved.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    elsif not exists (
      select 1
      from public.wk_playlist_items item
      where item.id = p_playlist_item_id
        and item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'
    ) then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_item_not_active',
        'The Playlist item is missing or no longer active.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      update public.wk_playlist_items item
      set notes = v_note
      where item.id = p_playlist_item_id;

      update public.wk_playlists playlist
      set authority_revision = playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.authority_revision
      into v_playlist.authority_revision;

      v_result := jsonb_build_object(
        'playlist_id', p_playlist_id,
        'playlist_item_id', p_playlist_item_id,
        'has_note', v_note is not null,
        'authority_revision', v_playlist.authority_revision,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    v_begin.idempotent_replay
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  playlist_item_id := p_playlist_item_id;
  authority_revision := nullif(v_read.result_payload ->> 'authority_revision', '')::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := v_read.idempotent_replay;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Explicit Registry match resolution.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_playlist_item_match(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
  p_match_status text,
  p_idempotency_key text,
  p_registry_track_id uuid default null,
  p_match_confidence numeric default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_item public.wk_playlist_items%rowtype;
  v_resource_id uuid;
  v_registry_release_id uuid;
  v_title text;
  v_artist_names text[];
  v_release_title text;
  v_artwork_url text;
  v_preview_url text;
  v_duration_ms integer;
  v_isrc text;
  v_duplicate_ids uuid[];
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_playlist_item_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist, item, and expected authority revision are required.';
  end if;

  if p_match_status not in (
    'matched',
    'external_only',
    'missing_registry_track',
    'needs_review',
    'rejected',
    'pending'
  ) then
    raise exception using errcode = '22023', message = 'Playlist-item match status is invalid.';
  end if;

  if p_match_confidence is not null
     and (p_match_confidence < 0 or p_match_confidence > 1)
  then
    raise exception using errcode = '22023', message = 'Match confidence must be between 0 and 1.';
  end if;

  if p_match_status = 'matched' and p_registry_track_id is null then
    raise exception using errcode = '22023', message = 'A matched Playlist item requires a Registry track.';
  end if;

  if p_match_status <> 'matched' and p_registry_track_id is not null then
    raise exception using errcode = '22023', message = 'Only matched Playlist items may bind canonical Registry track identity.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision', p_expected_authority_revision,
    'match_status', p_match_status,
    'registry_track_id', p_registry_track_id,
    'match_confidence', p_match_confidence,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.match.resolve',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if not v_begin.idempotent_replay then
    if v_playlist.authority_revision <> p_expected_authority_revision then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_revision_changed',
        'The Playlist changed before this match could be resolved.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      select item.*
      into v_item
      from public.wk_playlist_items item
      where item.id = p_playlist_item_id
        and item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'
      for update;

      if not found then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'playlist_item_not_active',
          'The Playlist item is missing or no longer active.',
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'authority_revision', v_playlist.authority_revision
          )
        );
      else
        if p_match_status = 'matched' then
          select
            track.title,
            track.release_id,
            release.title,
            track.artwork_url,
            track.preview_url,
            track.duration_ms,
            track.isrc,
            coalesce(
              array_agg(
                coalesce(artist.display_name, link.artist_name_text)
                order by link.credit_order, link.id
              ) filter (
                where coalesce(artist.display_name, link.artist_name_text) is not null
              ),
              '{}'::text[]
            )
          into
            v_title,
            v_registry_release_id,
            v_release_title,
            v_artwork_url,
            v_preview_url,
            v_duration_ms,
            v_isrc,
            v_artist_names
          from public.registry_tracks track
          left join public.registry_releases release
            on release.id = track.release_id
          left join public.registry_track_artists link
            on link.track_id = track.id
            and link.status = 'active'
          left join public.registry_artists artist
            on artist.id = link.artist_id
          where track.id = p_registry_track_id
            and track.status = 'active'
          group by
            track.id,
            track.title,
            track.release_id,
            release.title,
            track.artwork_url,
            track.preview_url,
            track.duration_ms,
            track.isrc;

          if not found then
            perform platform_private.reject_resource_command(
              v_begin.command_receipt_id,
              'registry_track_unavailable',
              'The selected Registry track is not active.',
              jsonb_build_object(
                'playlist_id', p_playlist_id,
                'authority_revision', v_playlist.authority_revision
              )
            );
          end if;
        end if;

        if exists (
          select 1
          from platform_private.command_receipts receipt
          where receipt.id = v_begin.command_receipt_id
            and receipt.status = 'accepted'
        ) then
          update public.wk_playlist_items item
          set
            registry_track_id = case
              when p_match_status = 'matched' then p_registry_track_id
              else null
            end,
            registry_release_id = case
              when p_match_status = 'matched' then v_registry_release_id
              else null
            end,
            title = case
              when p_match_status = 'matched' then v_title
              else item.title
            end,
            artist_names = case
              when p_match_status = 'matched' then v_artist_names
              else item.artist_names
            end,
            release_title = case
              when p_match_status = 'matched' then v_release_title
              else item.release_title
            end,
            artwork_url = case
              when p_match_status = 'matched' then coalesce(v_artwork_url, item.artwork_url)
              else item.artwork_url
            end,
            preview_url = case
              when p_match_status = 'matched' then coalesce(v_preview_url, item.preview_url)
              else item.preview_url
            end,
            duration_ms = case
              when p_match_status = 'matched' then coalesce(v_duration_ms, item.duration_ms)
              else item.duration_ms
            end,
            isrc = case
              when p_match_status = 'matched' then coalesce(v_isrc, item.isrc)
              else item.isrc
            end,
            match_status = p_match_status,
            match_confidence = case
              when p_match_status in ('matched', 'needs_review')
                then p_match_confidence
              else null
            end,
            normalization_payload = case
              when p_match_status = 'matched'
                then jsonb_build_object('resolved_by', auth.uid())
              else item.normalization_payload
            end
          where item.id = p_playlist_item_id
          returning item.*
          into v_item;

          v_duplicate_ids := editorial.playlist_duplicate_item_ids(
            p_playlist_id,
            p_playlist_item_id,
            v_item.registry_track_id,
            v_item.provider_key,
            v_item.provider_track_id,
            v_item.title,
            v_item.artist_names
          );

          update public.wk_playlists playlist
          set authority_revision = playlist.authority_revision + 1
          where playlist.id = p_playlist_id
          returning playlist.authority_revision
          into v_playlist.authority_revision;

          v_result := jsonb_build_object(
            'playlist_id', p_playlist_id,
            'playlist_item_id', p_playlist_item_id,
            'match_status', p_match_status,
            'registry_track_id', v_item.registry_track_id,
            'duplicate_warning', cardinality(v_duplicate_ids) > 0,
            'duplicate_item_ids', to_jsonb(v_duplicate_ids),
            'authority_revision', v_playlist.authority_revision,
            'correlation_id', v_correlation_id
          );

          perform platform_private.complete_resource_command(
            v_begin.command_receipt_id,
            v_result
          );
        end if;
      end if;
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    v_begin.idempotent_replay
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  playlist_item_id := p_playlist_item_id;
  authority_revision := nullif(v_read.result_payload ->> 'authority_revision', '')::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := v_read.idempotent_replay;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Soft item removal and safe compaction.
-- ---------------------------------------------------------------------------

create or replace function public.remove_playlist_item(
  p_playlist_id uuid,
  p_playlist_item_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  playlist_item_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_item public.wk_playlist_items%rowtype;
  v_resource_id uuid;
  v_offset integer;
  v_count integer;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_playlist_item_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist, item, and expected authority revision are required.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'playlist_item_id', p_playlist_item_id,
    'expected_authority_revision', p_expected_authority_revision,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.item.remove',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if not v_begin.idempotent_replay then
    if v_playlist.authority_revision <> p_expected_authority_revision then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_revision_changed',
        'The Playlist changed before this item could be removed.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      select item.*
      into v_item
      from public.wk_playlist_items item
      where item.id = p_playlist_item_id
        and item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active'
      for update;

      if not found then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'playlist_item_not_active',
          'The Playlist item is missing or no longer active.',
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'authority_revision', v_playlist.authority_revision
          )
        );
      else
        update public.wk_playlist_items item
        set
          lifecycle_state = 'removed',
          position = null,
          removed_at = now(),
          removed_by = auth.uid()
        where item.id = p_playlist_item_id;

        select count(*), coalesce(max(item.position), 0)
        into v_count, v_offset
        from public.wk_playlist_items item
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active';

        v_offset := v_offset + v_count + 1;

        if v_count > 0 then
          update public.wk_playlist_items item
          set position = item.position + v_offset
          where item.playlist_id = p_playlist_id
            and item.lifecycle_state = 'active';

          with ordered as (
            select
              item.id,
              row_number() over (
                order by item.position, item.id
              )::integer as new_position
            from public.wk_playlist_items item
            where item.playlist_id = p_playlist_id
              and item.lifecycle_state = 'active'
          )
          update public.wk_playlist_items item
          set position = ordered.new_position
          from ordered
          where item.id = ordered.id;
        end if;

        update public.wk_playlists playlist
        set authority_revision = playlist.authority_revision + 1
        where playlist.id = p_playlist_id
        returning playlist.authority_revision
        into v_playlist.authority_revision;

        v_result := jsonb_build_object(
          'playlist_id', p_playlist_id,
          'playlist_item_id', p_playlist_item_id,
          'active_item_count', v_count,
          'authority_revision', v_playlist.authority_revision,
          'correlation_id', v_correlation_id
        );

        perform platform_private.complete_resource_command(
          v_begin.command_receipt_id,
          v_result
        );
      end if;
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    v_begin.idempotent_replay
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  playlist_item_id := p_playlist_item_id;
  authority_revision := nullif(v_read.result_payload ->> 'authority_revision', '')::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := v_read.idempotent_replay;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Atomic full-list reorder.
-- ---------------------------------------------------------------------------

create or replace function public.reorder_playlist_items(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_ordered_item_ids uuid[],
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_active_count integer;
  v_distinct_count integer;
  v_offset integer;
  v_current_order uuid[];
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_playlist_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist and expected authority revision are required.';
  end if;

  if p_ordered_item_ids is null then
    raise exception
      using errcode = '22023', message = 'Complete ordered Playlist item identity is required.';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update of playlist;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Playlist does not exist.';
  end if;

  if not editorial.current_user_can_edit_playlist(v_resource_id) then
    raise exception using errcode = '42501', message = 'Playlist edit permission is required.';
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision', p_expected_authority_revision,
    'ordered_item_ids', to_jsonb(p_ordered_item_ids),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.items.reorder',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if not v_begin.idempotent_replay then
    if v_playlist.authority_revision <> p_expected_authority_revision then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_revision_changed',
        'The Playlist changed before this order could be applied.',
        jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision
        )
      );
    else
      select
        count(*),
        coalesce(max(item.position), 0),
        coalesce(array_agg(item.id order by item.position), '{}'::uuid[])
      into
        v_active_count,
        v_offset,
        v_current_order
      from public.wk_playlist_items item
      where item.playlist_id = p_playlist_id
        and item.lifecycle_state = 'active';

      select count(distinct item_id)
      into v_distinct_count
      from unnest(p_ordered_item_ids) item_id;

      if cardinality(p_ordered_item_ids) <> v_active_count
         or v_distinct_count <> v_active_count
         or exists (
           select 1
           from unnest(p_ordered_item_ids) requested(item_id)
           where not exists (
             select 1
             from public.wk_playlist_items item
             where item.id = requested.item_id
               and item.playlist_id = p_playlist_id
               and item.lifecycle_state = 'active'
           )
         )
      then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_playlist_order',
          'Reorder must contain every active Playlist item exactly once.',
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'authority_revision', v_playlist.authority_revision,
            'active_item_count', v_active_count
          )
        );
      elsif v_current_order = p_ordered_item_ids then
        v_result := jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision,
          'active_item_count', v_active_count,
          'changed', false,
          'correlation_id', v_correlation_id
        );

        perform platform_private.complete_resource_command(
          v_begin.command_receipt_id,
          v_result
        );
      else
        v_offset := v_offset + v_active_count + 1;

        update public.wk_playlist_items item
        set position = item.position + v_offset
        where item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active';

        with requested as (
          select
            requested.item_id,
            requested.ordinality::integer as new_position
          from unnest(p_ordered_item_ids)
            with ordinality as requested(item_id, ordinality)
        )
        update public.wk_playlist_items item
        set position = requested.new_position
        from requested
        where item.id = requested.item_id
          and item.playlist_id = p_playlist_id
          and item.lifecycle_state = 'active';

        if exists (
          select 1
          from (
            select
              item.position,
              row_number() over (
                order by item.position
              )::integer as expected_position
            from public.wk_playlist_items item
            where item.playlist_id = p_playlist_id
              and item.lifecycle_state = 'active'
          ) ordered
          where ordered.position <> ordered.expected_position
        ) then
          raise exception 'Playlist reorder did not converge to a continuous position sequence.';
        end if;

        update public.wk_playlists playlist
        set authority_revision = playlist.authority_revision + 1
        where playlist.id = p_playlist_id
        returning playlist.authority_revision
        into v_playlist.authority_revision;

        v_result := jsonb_build_object(
          'playlist_id', p_playlist_id,
          'authority_revision', v_playlist.authority_revision,
          'active_item_count', v_active_count,
          'changed', true,
          'correlation_id', v_correlation_id
        );

        perform platform_private.complete_resource_command(
          v_begin.command_receipt_id,
          v_result
        );
      end if;
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    v_begin.idempotent_replay
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(v_read.result_payload ->> 'authority_revision', '')::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := v_read.idempotent_replay;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Retire the legacy Institute Playlist writer.
--
-- Keep the historical function definition for frozen compatibility evidence,
-- but make it unreachable to application roles. Canonical Playlist mutation
-- authority now lives in the Phase 5A RPCs above.
-- ---------------------------------------------------------------------------

revoke execute
  on function public.create_institute_playlist_draft(
    uuid,
    text,
    text,
    text,
    jsonb
  )
  from public, anon, authenticated, service_role;

comment on function public.create_institute_playlist_draft(
  uuid,
  text,
  text,
  text,
  jsonb
) is
  'Retired Phase 5A legacy Institute Playlist writer. Canonical Playlist writes use governed Playlist RPC commands.';

-- ---------------------------------------------------------------------------
-- Authenticated direct-write cutover.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on public.wk_playlists
  from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.wk_playlist_items
  from anon, authenticated;

grant select
  on public.wk_playlists,
     public.wk_playlist_items
  to anon, authenticated;

drop policy if exists wk_playlists_institute_insert
  on public.wk_playlists;
drop policy if exists wk_playlists_institute_update
  on public.wk_playlists;
drop policy if exists wk_playlists_institute_delete
  on public.wk_playlists;
drop policy if exists wk_playlists_institute_read
  on public.wk_playlists;

drop policy if exists wk_playlist_items_institute_insert
  on public.wk_playlist_items;
drop policy if exists wk_playlist_items_institute_update
  on public.wk_playlist_items;
drop policy if exists wk_playlist_items_institute_delete
  on public.wk_playlist_items;
drop policy if exists wk_playlist_items_institute_read
  on public.wk_playlist_items;

create policy wk_playlists_authenticated_read
on public.wk_playlists
for select
to authenticated
using (
  exists (
    select 1
    from editorial.playlist_resources binding
    where binding.playlist_id = wk_playlists.id
      and editorial.current_user_can_view_playlist(binding.resource_id)
  )
);

create policy wk_playlist_items_authenticated_read
on public.wk_playlist_items
for select
to authenticated
using (
  exists (
    select 1
    from editorial.playlist_resources binding
    where binding.playlist_id = wk_playlist_items.playlist_id
      and editorial.current_user_can_view_playlist(binding.resource_id)
  )
);

-- Explicit RPC execution perimeter.

revoke execute on function public.create_playlist(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
) from public, anon;

grant execute on function public.create_playlist(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
) to authenticated;

revoke execute on function public.update_playlist_metadata(
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) from public, anon;

grant execute on function public.update_playlist_metadata(
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) to authenticated;

revoke execute on function public.add_playlist_item(
  uuid,
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  text,
  uuid
) from public, anon;

grant execute on function public.add_playlist_item(
  uuid,
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  text,
  uuid
) to authenticated;

revoke execute on function public.update_playlist_item(
  uuid,
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) from public, anon;

grant execute on function public.update_playlist_item(
  uuid,
  uuid,
  bigint,
  jsonb,
  text,
  uuid
) to authenticated;

revoke execute on function public.save_playlist_item_note(
  uuid,
  uuid,
  bigint,
  text,
  text,
  uuid
) from public, anon;

grant execute on function public.save_playlist_item_note(
  uuid,
  uuid,
  bigint,
  text,
  text,
  uuid
) to authenticated;

revoke execute on function public.resolve_playlist_item_match(
  uuid,
  uuid,
  bigint,
  text,
  text,
  uuid,
  numeric,
  uuid
) from public, anon;

grant execute on function public.resolve_playlist_item_match(
  uuid,
  uuid,
  bigint,
  text,
  text,
  uuid,
  numeric,
  uuid
) to authenticated;

revoke execute on function public.remove_playlist_item(
  uuid,
  uuid,
  bigint,
  text,
  uuid
) from public, anon;

grant execute on function public.remove_playlist_item(
  uuid,
  uuid,
  bigint,
  text,
  uuid
) to authenticated;

revoke execute on function public.reorder_playlist_items(
  uuid,
  bigint,
  uuid[],
  text,
  uuid
) from public, anon;

grant execute on function public.reorder_playlist_items(
  uuid,
  bigint,
  uuid[],
  text,
  uuid
) to authenticated;

do $phase_5a_m209_postconditions$
declare
  v_command_count bigint;
  v_authenticated_write_grants bigint;
  v_institute_policy_count bigint;
begin
  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.create',
    'playlist.metadata.update',
    'playlist.item.add',
    'playlist.item.update',
    'playlist.item.remove',
    'playlist.items.reorder',
    'playlist.item.note.save',
    'playlist.item.match.resolve'
  )
    and enabled;

  if v_command_count <> 8 then
    raise exception
      'STOP: Expected 8 enabled Playlist command types, found %',
      v_command_count;
  end if;

  select count(*)
  into v_authenticated_write_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name in (
      'wk_playlists',
      'wk_playlist_items'
    )
    and grant_row.grantee = 'authenticated'
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE'
    );

  if v_authenticated_write_grants <> 0 then
    raise exception
      'STOP: Authenticated direct Playlist write grants remain';
  end if;

  select count(*)
  into v_institute_policy_count
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename in (
      'wk_playlists',
      'wk_playlist_items'
    )
    and policy_row.policyname like '%institute%';

  if v_institute_policy_count <> 0 then
    raise exception
      'STOP: Institute Playlist RLS policies remain';
  end if;

  if to_regprocedure(
       'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)'
     ) is null
     or to_regprocedure(
       'public.add_playlist_item(uuid,bigint,text,uuid,text,text,text,text,text[],text,uuid)'
     ) is null
  then
    raise exception 'STOP: One or more canonical Playlist item commands are missing';
  end if;
end;
$phase_5a_m209_postconditions$;

commit;
