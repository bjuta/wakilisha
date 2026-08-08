-- Phase 5A Migration 212: governed Playlist cover command authority.
--
-- Playlist covers are Media placements, but changing a cover is also a Playlist
-- content mutation. This migration closes that cross-domain boundary so cover
-- changes participate in Playlist optimistic concurrency and Review invalidation.
--
-- It intentionally does not broaden Media capabilities or change Media ownership.

begin;

do $phase_5a_m212_preflight$
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.events') is null
  then
    raise exception
      'STOP: Playlist or Media authority required by Migration 212 is incomplete';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_edit_playlist(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_view_playlist(uuid)'
     ) is null
     or to_regprocedure(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
  then
    raise exception
      'STOP: Playlist command or Media target validation authority is incomplete';
  end if;

  if not exists (
    select 1
    from media.usage_roles
    where usage_role = 'playlist_cover'
      and enabled
  ) then
    raise exception
      'STOP: playlist_cover Media usage role is missing';
  end if;

  if exists (
    select 1
    from media.usage_links
    where usage_role = 'playlist_cover'
      and usage_state = 'active'
  ) then
    raise exception
      'STOP: Migration 212 expects no pre-existing active Playlist cover usage';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type = 'playlist.cover.set'
  ) then
    raise exception
      'STOP: playlist.cover.set command type already exists';
  end if;

  if to_regprocedure(
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.get_playlist_current_cover(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Migration 212 Playlist cover RPC already exists';
  end if;
end;
$phase_5a_m212_preflight$;

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
  'playlist.cover.set',
  'playlist.cover.set.sync',
  'playlist.cover.set.accepted',
  'playlist.cover.set.succeeded',
  'playlist.cover.set.failed',
  'playlist.cover.set.retry_scheduled',
  true
);

create table platform_private.playlist_cover_mutation_authorizations (
  token uuid primary key,
  actor_id uuid not null,
  playlist_id uuid not null,
  command_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),

  constraint playlist_cover_mutation_authorizations_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete cascade,

  constraint playlist_cover_mutation_authorizations_playlist_fkey
    foreign key (playlist_id)
    references public.wk_playlists(id)
    on delete cascade,

  constraint playlist_cover_mutation_authorizations_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete cascade
);

revoke all
on platform_private.playlist_cover_mutation_authorizations
from public, anon, authenticated, service_role;

create or replace function
  platform_private.guard_playlist_cover_usage_mutation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'platform_private'
as $function$
declare
  v_token uuid;
  v_target_id uuid;
  v_actor_id uuid;
  v_is_playlist_cover boolean;
begin
  v_is_playlist_cover :=
    (
      tg_op <> 'DELETE'
      and new.target_authority = 'editorial'
      and new.target_kind = 'playlist'
      and new.usage_role = 'playlist_cover'
    )
    or
    (
      tg_op <> 'INSERT'
      and old.target_authority = 'editorial'
      and old.target_kind = 'playlist'
      and old.usage_role = 'playlist_cover'
    );

  if not v_is_playlist_cover then
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
    v_token :=
      nullif(
        current_setting(
          'wakilisha.playlist_cover_mutation_token',
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
       from platform_private.playlist_cover_mutation_authorizations authorization_row
       where authorization_row.token = v_token
         and authorization_row.actor_id = v_actor_id
         and authorization_row.playlist_id = v_target_id
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'Playlist cover usage must be changed through the governed Playlist cover command.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

revoke execute
on function
  platform_private.guard_playlist_cover_usage_mutation()
from public, anon, authenticated, service_role;

create trigger playlist_cover_usage_governed_mutation
before insert or update or delete
on media.usage_links
for each row
execute function
  platform_private.guard_playlist_cover_usage_mutation();

create or replace function public.set_playlist_cover(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_asset_id uuid,
  p_idempotency_key text,
  p_placement_data jsonb default '{}'::jsonb,
  p_alt_text_snapshot text default null,
  p_caption_snapshot text default null,
  p_credit_snapshot text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  cover_usage_link_id uuid,
  cover_asset_id uuid,
  cover_asset_revision_id uuid,
  cover_url text,
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
  'media',
  'platform_private'
as $function$
declare
  v_actor record;
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_begin record;
  v_read record;
  v_current_usage media.usage_links%rowtype;
  v_current_count bigint;
  v_asset media.assets%rowtype;
  v_governance media.asset_governance_versions%rowtype;
  v_file media.file_objects%rowtype;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, gen_random_uuid());
  v_token uuid := gen_random_uuid();
  v_usage_id uuid;
  v_cover_url text;
  v_request jsonb;
  v_result jsonb;
  v_same boolean := false;
begin
  if p_playlist_id is null then
    raise exception
      using errcode = '22023', message = 'playlist_id is required.';
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
  then
    raise exception
      using
        errcode = '22023',
        message = 'expected Playlist revision must be positive.';
  end if;

  if p_placement_data is null
     or jsonb_typeof(p_placement_data) <> 'object'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist cover placement data must be a JSON object.';
  end if;

  if length(coalesce(p_alt_text_snapshot, '')) > 2000
     or length(coalesce(p_caption_snapshot, '')) > 4000
     or length(coalesce(p_credit_snapshot, '')) > 2000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Playlist cover presentation text is too long.';
  end if;

  select *
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist was not found.';
  end if;

  select *
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      'Playlist Resource binding is missing';
  end if;

  if not coalesce(
    editorial.current_user_can_edit_playlist(
      v_binding.resource_id
    ),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'You do not have permission to edit this Playlist.';
  end if;

  select *
  into v_actor
  from platform_private.command_actor_context();

  if p_asset_id is not null then
    perform media.validate_usage_target(
      v_actor.actor_user_id,
      'editorial',
      'playlist',
      p_playlist_id,
      null,
      null,
      true,
      true
    );

    select asset.*
    into v_asset
    from media.assets asset
    where asset.id = p_asset_id;

    if not found then
      raise exception
        using
          errcode = 'P0002',
          message = 'Selected Media asset was not found.';
    end if;

    if v_asset.lifecycle_state <> 'active'
       or v_asset.current_revision_id is null
       or v_asset.current_governance_version_id is null
    then
      raise exception
        'Selected Media asset is not ready for Playlist cover use';
    end if;

    select governance.*
    into v_governance
    from media.asset_governance_versions governance
    where governance.id =
      v_asset.current_governance_version_id
      and governance.asset_id = p_asset_id;

    if not found then
      raise exception
        'Selected Media asset current governance is invalid';
    end if;

    if v_governance.public_safety_state not in (
         'approved_public',
         'approved_redacted'
       )
       or v_governance.rights_status not in (
         'owned',
         'licensed',
         'public_domain',
         'fair_use'
       )
       or v_governance.consent_status not in (
         'granted',
         'not_required'
       )
       or v_governance.source_protection_class not in (
         'public',
         'public_redacted'
       )
       or v_governance.retention_state not in (
         'retain',
         'review_required'
       )
       or v_governance.embargo_state = 'active'
       or (
         v_governance.embargo_state = 'scheduled'
         and v_governance.embargo_until is not null
         and v_governance.embargo_until > now()
       )
    then
      raise exception
        'Current Media governance does not permit Playlist cover use';
    end if;

    select file_object.*
    into v_file
    from media.asset_revisions revision
    join media.file_objects file_object
      on file_object.id =
        revision.original_file_object_id
    where revision.id = v_asset.current_revision_id
      and revision.asset_id = p_asset_id
      and file_object.verification_state = 'verified';

    if not found then
      raise exception
        'Playlist cover requires the verified current Media revision';
    end if;

    v_cover_url := v_file.delivery_url;
  end if;

  v_request := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'expected_authority_revision',
      p_expected_authority_revision,
    'asset_id', p_asset_id,
    'placement_data', p_placement_data,
    'alt_text_snapshot',
      nullif(btrim(p_alt_text_snapshot), ''),
    'caption_snapshot',
      nullif(btrim(p_caption_snapshot), ''),
    'credit_snapshot',
      nullif(btrim(p_credit_snapshot), ''),
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.cover.set',
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
    playlist_id := p_playlist_id;
    resource_id := v_binding.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    cover_usage_link_id :=
      nullif(
        v_read.result_payload ->> 'cover_usage_link_id',
        ''
      )::uuid;
    cover_asset_id :=
      nullif(
        v_read.result_payload ->> 'cover_asset_id',
        ''
      )::uuid;
    cover_asset_revision_id :=
      nullif(
        v_read.result_payload
          ->> 'cover_asset_revision_id',
        ''
      )::uuid;
    cover_url :=
      v_read.result_payload ->> 'cover_url';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_playlist.authority_revision <>
       p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before its cover could be updated.',
      jsonb_build_object(
        'playlist_id', p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status', v_playlist.status
      )
    );

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      false
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_binding.resource_id;
    authority_revision := v_playlist.authority_revision;
    cover_usage_link_id := null;
    cover_asset_id := null;
    cover_asset_revision_id := null;
    cover_url := v_playlist.cover_image_url;
    result_payload := v_read.result_payload;
    idempotent_replay := false;
    return next;
    return;
  end if;

  select count(*)
  into v_current_count
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if v_current_count > 1 then
    raise exception
      'Playlist has more than one active canonical cover';
  end if;

  if v_current_count = 1 then
    select usage.*
    into v_current_usage
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'playlist'
      and usage.target_id = p_playlist_id
      and usage.target_version_id is null
      and usage.usage_role = 'playlist_cover'
      and usage.usage_state = 'active'
    for update;

    v_same :=
      p_asset_id is not null
      and v_current_usage.asset_id = p_asset_id
      and v_current_usage.asset_revision_id =
            v_asset.current_revision_id
      and v_current_usage.resolution_mode =
            'exact_revision'
      and v_current_usage.placement_data =
            p_placement_data
      and coalesce(
            v_current_usage.alt_text_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_alt_text_snapshot), ''),
            ''
          )
      and coalesce(
            v_current_usage.caption_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_caption_snapshot), ''),
            ''
          )
      and coalesce(
            v_current_usage.credit_snapshot,
            ''
          ) =
          coalesce(
            nullif(btrim(p_credit_snapshot), ''),
            ''
          );

    v_usage_id := v_current_usage.id;
  else
    v_same := p_asset_id is null;
  end if;

  if not v_same then
    insert into
      platform_private.playlist_cover_mutation_authorizations (
        token,
        actor_id,
        playlist_id,
        command_receipt_id
      )
    values (
      v_token,
      v_actor.actor_user_id,
      p_playlist_id,
      v_begin.command_receipt_id
    );

    perform set_config(
      'wakilisha.playlist_cover_mutation_token',
      v_token::text,
      true
    );

    if v_current_count = 1 then
      update media.usage_links
      set
        usage_state = 'archived',
        usage_revision = usage_revision + 1,
        state_reason = 'Replaced by Playlist cover command',
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
        'Playlist cover replaced or cleared',
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
      v_usage_id := gen_random_uuid();

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
        alt_text_snapshot,
        caption_snapshot,
        credit_snapshot,
        usage_state,
        usage_revision,
        created_by
      )
      values (
        v_usage_id,
        p_asset_id,
        v_asset.current_revision_id,
        'exact_revision',
        'editorial',
        'playlist',
        p_playlist_id,
        null,
        null,
        'playlist_cover',
        p_placement_data,
        0,
        nullif(btrim(p_alt_text_snapshot), ''),
        nullif(btrim(p_caption_snapshot), ''),
        nullif(btrim(p_credit_snapshot), ''),
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
        v_asset.current_revision_id,
        v_usage_id,
        'usage_attached',
        v_actor.actor_user_id,
        'Governed Playlist cover attached',
        jsonb_build_object(
          'usage_state', 'active',
          'usage_revision', 1,
          'target_authority', 'editorial',
          'target_kind', 'playlist',
          'target_id', p_playlist_id,
          'usage_role', 'playlist_cover'
        ),
        v_correlation_id
      );
    else
      v_usage_id := null;
      v_cover_url := null;
    end if;

    delete from
      platform_private.playlist_cover_mutation_authorizations
    where token = v_token;

    perform set_config(
      'wakilisha.playlist_cover_mutation_token',
      '',
      true
    );

    update public.wk_playlists playlist
    set
      authority_revision =
        playlist.authority_revision + 1,
      cover_image_url = v_cover_url
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;
  end if;

  v_result := jsonb_build_object(
    'playlist_id', p_playlist_id,
    'resource_id', v_binding.resource_id,
    'authority_revision',
      v_playlist.authority_revision,
    'lifecycle_status', v_playlist.status,
    'cover_usage_link_id', v_usage_id,
    'cover_asset_id', p_asset_id,
    'cover_asset_revision_id',
      case
        when p_asset_id is null
          then null
        else v_asset.current_revision_id
      end,
    'cover_url', v_cover_url,
    'cover_changed', not v_same,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_binding.resource_id;
  authority_revision := v_playlist.authority_revision;
  cover_usage_link_id := v_usage_id;
  cover_asset_id := p_asset_id;
  cover_asset_revision_id :=
    case
      when p_asset_id is null
        then null
      else v_asset.current_revision_id
    end;
  cover_url := v_cover_url;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.set_playlist_cover(
  uuid,
  bigint,
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.set_playlist_cover(
  uuid,
  bigint,
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  uuid
)
to authenticated, service_role;

create or replace function public.get_playlist_current_cover(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'media'
as $function$
declare
  v_binding editorial.playlist_resources%rowtype;
  v_playlist public.wk_playlists%rowtype;
  v_usage media.usage_links%rowtype;
begin
  select *
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'Playlist was not found.';
  end if;

  if not coalesce(
    editorial.current_user_can_view_playlist(
      v_binding.resource_id
    ),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'You do not have permission to view this Playlist.';
  end if;

  select *
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  select usage.*
  into v_usage
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if not found then
    return jsonb_build_object(
      'playlist_id', p_playlist_id,
      'resource_id', v_binding.resource_id,
      'cover', null
    );
  end if;

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'resource_id', v_binding.resource_id,
    'cover',
      jsonb_build_object(
        'usage_link_id', v_usage.id,
        'usage_revision',
          v_usage.usage_revision,
        'asset_id', v_usage.asset_id,
        'asset_revision_id',
          v_usage.asset_revision_id,
        'resolution_mode',
          v_usage.resolution_mode,
        'url', v_playlist.cover_image_url,
        'placement_data',
          v_usage.placement_data,
        'alt_text',
          v_usage.alt_text_snapshot,
        'caption',
          v_usage.caption_snapshot,
        'credit',
          v_usage.credit_snapshot
      )
  );
end;
$function$;

revoke all
on function public.get_playlist_current_cover(uuid)
from public, anon;

grant execute
on function public.get_playlist_current_cover(uuid)
to authenticated, service_role;

do $phase_5a_m212_postflight$
begin
  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'playlist.cover.set'
      and enabled
  ) then
    raise exception
      'STOP: playlist.cover.set command was not registered';
  end if;

  if to_regprocedure(
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_current_cover(uuid)'
     ) is null
  then
    raise exception
      'STOP: Migration 212 Playlist cover RPC is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'media.usage_links'::regclass
      and trigger_row.tgname =
            'playlist_cover_usage_governed_mutation'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Playlist cover usage guard trigger is missing';
  end if;
end;
$phase_5a_m212_postflight$;

commit;
