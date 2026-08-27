-- Phase 7A K4C-P1: Playlist shared-event convergence.
--
-- Retire Playlist typed event tables as new-write authority while retaining
-- them as immutable historical compatibility stores. Rewritten Playlist
-- review paths consume canonical Resource lifecycle pointers directly.

begin;

create temporary table phase_7a_k4c_p1_baseline
on commit drop
as
select
  (select count(*) from editorial.playlist_lifecycle_events)
    as playlist_lifecycle_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.playlist_lifecycle_events e
  ) as playlist_lifecycle_fingerprint,
  (select count(*) from editorial.playlist_review_events)
    as playlist_review_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.playlist_review_events e
  ) as playlist_review_fingerprint;

do $phase_7a_k4c_p1_preflight$
declare
  v_count bigint;
begin
  if to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
     or to_regprocedure(
       'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_review_workspace(uuid)'
     ) is null
  then
    raise exception
      'STOP: Phase 7A K4C-P1 requires accepted K4A/K4B and Playlist authority';
  end if;

  if to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: K4C-P1 shared event append helpers already exist';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Playlist lifecycle pointer mirror(s) diverge before K4C-P1',
      v_count;
  end if;

  if exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resources resource_row
      on resource_row.id = source.resource_id
    left join editorial.resource_versions version_row
      on version_row.id = source.version_id
     and version_row.resource_id = source.resource_id
    where resource_row.id is null
       or (source.version_id is not null and version_row.id is null)
  ) then
    raise exception
      'STOP: Playlist lifecycle compatibility history has invalid Resource identity';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resources resource_row
      on resource_row.id = source.resource_id
    left join editorial.resource_versions target
      on target.id = source.target_version_id
     and target.resource_id = source.resource_id
    left join editorial.resource_versions result
      on result.id = source.result_version_id
     and result.resource_id = source.resource_id
    where resource_row.id is null
       or target.id is null
       or (source.result_version_id is not null and result.id is null)
  ) then
    raise exception
      'STOP: Playlist review compatibility history has invalid Resource Version identity';
  end if;

  if exists (
    select 1
    from (
      select
        source.id,
        source.resource_id,
        source.actor_id,
        source.command_receipt_id
      from editorial.playlist_lifecycle_events source
      where not exists (
        select 1
        from editorial.resource_lifecycle_events shared
        where shared.legacy_source_authority = 'playlist_lifecycle'
          and shared.legacy_source_event_id = source.id
      )
      union all
      select
        source.id,
        source.resource_id,
        source.actor_id,
        source.command_receipt_id
      from editorial.playlist_review_events source
      where not exists (
        select 1
        from editorial.resource_review_events shared
        where shared.legacy_source_authority = 'playlist_review'
          and shared.legacy_source_event_id = source.id
      )
    ) source
    left join platform_private.command_receipts receipt
      on receipt.id = source.command_receipt_id
     and receipt.resource_id = source.resource_id
     and receipt.actor_user_id is not distinct from source.actor_id
    where receipt.id is null
  ) then
    raise exception
      'STOP: Playlist compatibility catch-up command receipt identity is invalid';
  end if;

  if exists (
    select 1
    from editorial.playlist_lifecycle_events source
    join editorial.resource_lifecycle_events shared
      on shared.id = source.id
    where not (
      shared.legacy_source_authority = 'playlist_lifecycle'
      and shared.legacy_source_event_id = source.id
    )
  ) or exists (
    select 1
    from editorial.playlist_review_events source
    join editorial.resource_review_events shared
      on shared.id = source.id
    where not (
      shared.legacy_source_authority = 'playlist_review'
      and shared.legacy_source_event_id = source.id
    )
  ) then
    raise exception
      'STOP: Playlist compatibility event UUID collides with unrelated shared history';
  end if;

  if exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_actions action_row
      on action_row.action = source.action
     and action_row.enabled
    where action_row.action is null
  ) or exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_actions action_row
      on action_row.action = source.action
     and action_row.enabled
    where action_row.action is null
  ) then
    raise exception
      'STOP: Playlist compatibility history contains an action outside shared vocabulary';
  end if;
end;
$phase_7a_k4c_p1_preflight$;


-- Catch up any Playlist typed events written after the K4A backfill.
with missing as (
  select
    source.*,
    coalesce(
      (
        select max(shared.event_number)
        from editorial.resource_lifecycle_events shared
        where shared.resource_id = source.resource_id
      ),
      0
    ) as base_event_number,
    row_number() over (
      partition by source.resource_id
      order by source.event_number, source.created_at, source.id
    ) as catchup_offset
  from editorial.playlist_lifecycle_events source
  where not exists (
    select 1
    from editorial.resource_lifecycle_events shared
    where shared.legacy_source_authority = 'playlist_lifecycle'
      and shared.legacy_source_event_id = source.id
  )
)
insert into editorial.resource_lifecycle_events (
  id,
  resource_id,
  event_number,
  action,
  version_id,
  prior_status,
  resulting_status,
  note,
  metadata,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  missing.id,
  missing.resource_id,
  missing.base_event_number + missing.catchup_offset,
  missing.action,
  missing.version_id,
  missing.prior_status,
  missing.resulting_status,
  missing.note,
  missing.metadata,
  missing.actor_id,
  missing.command_receipt_id,
  null::uuid,
  'playlist_lifecycle',
  missing.id,
  missing.created_at
from missing
order by missing.resource_id, missing.catchup_offset;

with missing as (
  select
    source.*,
    coalesce(
      (
        select max(shared.event_number)
        from editorial.resource_review_events shared
        where shared.resource_id = source.resource_id
      ),
      0
    ) as base_event_number,
    row_number() over (
      partition by source.resource_id
      order by source.event_number, source.created_at, source.id
    ) as catchup_offset
  from editorial.playlist_review_events source
  where not exists (
    select 1
    from editorial.resource_review_events shared
    where shared.legacy_source_authority = 'playlist_review'
      and shared.legacy_source_event_id = source.id
  )
)
insert into editorial.resource_review_events (
  id,
  resource_id,
  event_number,
  target_version_id,
  result_version_id,
  action,
  prior_status,
  resulting_status,
  reason,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  missing.id,
  missing.resource_id,
  missing.base_event_number + missing.catchup_offset,
  missing.target_version_id,
  missing.result_version_id,
  missing.action,
  missing.prior_status,
  missing.resulting_status,
  missing.reason,
  missing.actor_id,
  missing.command_receipt_id,
  missing.correlation_id,
  'playlist_review',
  missing.id,
  missing.created_at
from missing
order by missing.resource_id, missing.catchup_offset;

set constraints all immediate;
set constraints all deferred;


create or replace function
  editorial.append_resource_lifecycle_event(
    p_resource_id uuid,
    p_version_id uuid,
    p_action text,
    p_prior_status text,
    p_resulting_status text,
    p_note text,
    p_metadata jsonb,
    p_actor_id uuid,
    p_command_receipt_id uuid,
    p_correlation_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_existing editorial.resource_lifecycle_events%rowtype;
  v_event_number bigint;
  v_event_id uuid;
begin
  if p_command_receipt_id is null
     or p_correlation_id is null
  then
    raise exception
      'New shared Resource lifecycle events require command receipt and correlation identity';
  end if;

  perform 1
  from editorial.resources resource_row
  where resource_row.id = p_resource_id
  for update;

  if not found then
    raise exception
      'Shared Resource lifecycle event targets a missing Resource';
  end if;

  select event_row.*
  into v_existing
  from editorial.resource_lifecycle_events event_row
  where event_row.command_receipt_id = p_command_receipt_id
    and event_row.action = p_action;

  if found then
    if v_existing.resource_id is distinct from p_resource_id
       or v_existing.version_id is distinct from p_version_id
       or v_existing.prior_status is distinct from p_prior_status
       or v_existing.resulting_status is distinct from p_resulting_status
       or v_existing.note is distinct from nullif(btrim(p_note), '')
       or v_existing.metadata is distinct from coalesce(p_metadata, '{}'::jsonb)
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.correlation_id is distinct from p_correlation_id
    then
      raise exception
        'Existing shared Resource lifecycle event disagrees with idempotent command identity';
    end if;

    return v_existing.id;
  end if;

  select coalesce(max(event_row.event_number), 0) + 1
  into v_event_number
  from editorial.resource_lifecycle_events event_row
  where event_row.resource_id = p_resource_id;

  insert into editorial.resource_lifecycle_events (
    resource_id,
    event_number,
    action,
    version_id,
    prior_status,
    resulting_status,
    note,
    metadata,
    actor_id,
    command_receipt_id,
    correlation_id
  )
  values (
    p_resource_id,
    v_event_number,
    p_action,
    p_version_id,
    p_prior_status,
    p_resulting_status,
    nullif(btrim(p_note), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_id,
    p_command_receipt_id,
    p_correlation_id
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

revoke execute
on function editorial.append_resource_lifecycle_event(
  uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid
)
from public, anon, authenticated, service_role;

create or replace function
  editorial.append_resource_review_event(
    p_resource_id uuid,
    p_target_version_id uuid,
    p_result_version_id uuid,
    p_action text,
    p_prior_status text,
    p_resulting_status text,
    p_reason text,
    p_actor_id uuid,
    p_command_receipt_id uuid,
    p_correlation_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_existing editorial.resource_review_events%rowtype;
  v_event_number bigint;
  v_event_id uuid;
begin
  if p_command_receipt_id is null
     or p_correlation_id is null
  then
    raise exception
      'New shared Resource review events require command receipt and correlation identity';
  end if;

  perform 1
  from editorial.resources resource_row
  where resource_row.id = p_resource_id
  for update;

  if not found then
    raise exception
      'Shared Resource review event targets a missing Resource';
  end if;

  select event_row.*
  into v_existing
  from editorial.resource_review_events event_row
  where event_row.command_receipt_id = p_command_receipt_id;

  if found then
    if v_existing.resource_id is distinct from p_resource_id
       or v_existing.target_version_id is distinct from p_target_version_id
       or v_existing.result_version_id is distinct from p_result_version_id
       or v_existing.action is distinct from p_action
       or v_existing.prior_status is distinct from p_prior_status
       or v_existing.resulting_status is distinct from p_resulting_status
       or v_existing.reason is distinct from nullif(btrim(p_reason), '')
       or v_existing.actor_id is distinct from p_actor_id
       or v_existing.correlation_id is distinct from p_correlation_id
    then
      raise exception
        'Existing shared Resource review event disagrees with idempotent command identity';
    end if;

    return v_existing.id;
  end if;

  select coalesce(max(event_row.event_number), 0) + 1
  into v_event_number
  from editorial.resource_review_events event_row
  where event_row.resource_id = p_resource_id;

  insert into editorial.resource_review_events (
    resource_id,
    event_number,
    target_version_id,
    result_version_id,
    action,
    prior_status,
    resulting_status,
    reason,
    actor_id,
    command_receipt_id,
    correlation_id
  )
  values (
    p_resource_id,
    v_event_number,
    p_target_version_id,
    p_result_version_id,
    p_action,
    p_prior_status,
    p_resulting_status,
    nullif(btrim(p_reason), ''),
    p_actor_id,
    p_command_receipt_id,
    p_correlation_id
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

revoke execute
on function editorial.append_resource_review_event(
  uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid
)
from public, anon, authenticated, service_role;


create or replace function editorial.playlist_current_content_fingerprint(p_playlist_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, media, extensions
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_working_version_id uuid;
  v_items jsonb;
  v_cover_count integer;
  v_cover jsonb := null;
begin
  select playlist.* into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then raise exception 'Playlist does not exist'; end if;

  select
    binding.resource_id,
    resource_row.current_working_version_id
  into
    v_resource_id,
    v_working_version_id
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where binding.playlist_id = p_playlist_id;

  if v_resource_id is null then
    raise exception 'Playlist Resource binding does not exist';
  end if;

  select count(*) into v_cover_count
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if v_cover_count > 1 then
    raise exception 'Playlist has more than one active canonical cover';
  end if;

  if v_cover_count = 1 then
    select jsonb_build_object(
      'asset_id', usage.asset_id,
      'asset_revision_id', usage.asset_revision_id,
      'resolution_mode', usage.resolution_mode,
      'placement_data', usage.placement_data,
      'alt_text_snapshot', usage.alt_text_snapshot,
      'caption_snapshot', usage.caption_snapshot,
      'credit_snapshot', usage.credit_snapshot
    )
    into v_cover
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'playlist'
      and usage.target_id = p_playlist_id
      and usage.target_version_id is null
      and usage.usage_role = 'playlist_cover'
      and usage.usage_state = 'active';

    if v_cover ->> 'resolution_mode' <> 'exact_revision'
       or nullif(v_cover ->> 'asset_revision_id', '') is null
    then
      raise exception 'Playlist cover must resolve to an exact Media revision before snapshotting';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playlist_item_resource_id', binding.resource_id,
        'playlist_item_id', item.id,
        'position', item.position,
        'registry_track_id', item.registry_track_id,
        'registry_release_id', item.registry_release_id,
        'provider_key', item.provider_key,
        'provider_track_id', item.provider_track_id,
        'provider_url', item.provider_url,
        'title', item.title,
        'artist_names', to_jsonb(item.artist_names),
        'release_title', item.release_title,
        'artwork_url', item.artwork_url,
        'preview_url', item.preview_url,
        'duration_ms', item.duration_ms,
        'isrc', item.isrc,
        'match_status', item.match_status,
        'match_confidence', item.match_confidence,
        'normalization_payload', item.normalization_payload,
        'notes', item.notes
      ) order by item.position
    ),
    '[]'::jsonb
  )
  into v_items
  from public.wk_playlist_items item
  join editorial.playlist_item_resources binding
    on binding.playlist_item_id = item.id
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active';

  return encode(
    extensions.digest(
      convert_to(
        (
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'title', v_playlist.title,
            'slug', v_playlist.slug,
            'description', v_playlist.description,
            'curator_label', v_playlist.curator_label,
            'metadata', v_playlist.metadata,
            'cover', v_cover,
            'items', v_items
          )
          || editorial.discovery_fingerprint_fragment(
            editorial.resource_version_discovery_content_json(
              'playlist_version',
              v_working_version_id
            )
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$function$;

create or replace function
  editorial.append_playlist_lifecycle_event(
    p_resource_id uuid,
    p_playlist_id uuid,
    p_version_id uuid,
    p_action text,
    p_prior_status text,
    p_resulting_status text,
    p_note text,
    p_actor_id uuid,
    p_command_receipt_id uuid,
    p_metadata jsonb default '{}'::jsonb
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_correlation_id uuid;
begin
  if not exists (
    select 1
    from editorial.playlist_resources binding
    where binding.resource_id = p_resource_id
      and binding.playlist_id = p_playlist_id
  ) then
    raise exception
      'Playlist lifecycle event Resource binding does not exist';
  end if;

  v_correlation_id :=
    nullif(
      coalesce(p_metadata, '{}'::jsonb)
        ->> 'correlation_id',
      ''
    )::uuid;

  if v_correlation_id is null then
    select coalesce(
      nullif(receipt.request_payload ->> 'correlation_id', '')::uuid,
      nullif(receipt.result_payload ->> 'correlation_id', '')::uuid
    )
    into v_correlation_id
    from platform_private.command_receipts receipt
    where receipt.id = p_command_receipt_id;
  end if;

  if v_correlation_id is null then
    raise exception
      'Playlist lifecycle event command correlation identity is missing';
  end if;

  return editorial.append_resource_lifecycle_event(
    p_resource_id,
    p_version_id,
    p_action,
    p_prior_status,
    p_resulting_status,
    p_note,
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_id,
    p_command_receipt_id,
    v_correlation_id
  );
end;
$function$;


create or replace function
  public.submit_playlist_for_review(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_working editorial.playlist_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior_status text;
  v_trust_count bigint := 0;
  v_copy_working_trust boolean := false;
  v_active_item_count bigint;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if not found then
    raise exception
      'Playlist Resource does not exist';
  end if;

  if not editorial.current_user_can_edit_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist edit permission is required';
  end if;

  v_fingerprint :=
    editorial.playlist_current_content_fingerprint(
      p_playlist_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.review.submit',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint',
        v_fingerprint,
      'note',
        nullif(
          btrim(p_note),
          ''
        ),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be submitted.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status not in (
    'draft',
    'changes_requested',
    'published'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_submittable',
      'Only a draft, changes-requested, or published Playlist can be submitted.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status = 'published'
        and v_resource.current_published_version_id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_version_missing',
      'The published Playlist does not have a current published version.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status = 'published'
        and exists (
          select 1
          from editorial.playlist_versions published
          where published.id =
                  v_resource.current_published_version_id
            and published.resource_id =
                  v_binding.resource_id
            and published.playlist_id =
                  p_playlist_id
            and published.version_kind =
                  'published'
            and published.content_fingerprint =
                  v_fingerprint
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_update_unchanged',
      'The published Playlist has no saved content change to submit.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status,
        'current_published_version_id',
          v_resource.current_published_version_id
      )
    );

  elsif v_playlist.status = 'published'
        and (
          v_resource.current_working_version_id is null
          or not exists (
            select 1
            from editorial.playlist_versions working
            where working.id =
                    v_resource.current_working_version_id
              and working.resource_id =
                    v_binding.resource_id
              and working.playlist_id =
                    p_playlist_id
              and working.version_kind =
                    'working'
              and working.content_fingerprint =
                    v_fingerprint
          )
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_published_update_not_saved',
      'Save the published Playlist update before submitting it for Review.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status,
        'current_working_version_id',
          v_resource.current_working_version_id,
        'current_published_version_id',
          v_resource.current_published_version_id
      )
    );

  else
    select count(*)
    into v_active_item_count
    from public.wk_playlist_items item
    where item.playlist_id = p_playlist_id
      and item.lifecycle_state = 'active';

    if v_active_item_count = 0 then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'playlist_empty',
        'A Playlist needs at least one track before Review.',
        jsonb_build_object(
          'playlist_id',
            p_playlist_id,
          'authority_revision',
            v_playlist.authority_revision
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
       and v_resource.current_working_version_id
             is not null
    then
      select version.*
      into v_working
      from editorial.playlist_versions version
      where version.id =
        v_resource.current_working_version_id;

      if found
         and v_working.content_fingerprint =
               v_fingerprint
      then
        v_copy_working_trust := true;
      elsif found then
        select
          (
            select count(*)
            from editorial.resource_citations citation
            where citation.target_version_type =
                    'playlist_version'
              and citation.target_version_id =
                    v_working.id
          )
          +
          (
            select count(*)
            from editorial.resource_credits credit
            where credit.target_version_type =
                    'playlist_version'
              and credit.target_version_id =
                    v_working.id
          )
        into v_trust_count;

        if v_trust_count > 0 then
          perform platform_private.reject_resource_command(
            v_begin.command_receipt_id,
            'playlist_working_trust_stale',
            'Version-bound Playlist Trust is attached to an older working snapshot.',
            jsonb_build_object(
              'playlist_id',
                p_playlist_id,
              'authority_revision',
                v_playlist.authority_revision,
              'working_version_id',
                v_working.id,
              'working_source_authority_revision',
                v_working.source_authority_revision,
              'trust_binding_count',
                v_trust_count
            )
          );
        end if;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
    then
      v_prior_status := v_playlist.status;

      select *
      into v_snapshot
      from editorial.insert_playlist_current_snapshot(
        p_playlist_id,
        v_playlist.authority_revision,
        'submitted',
        'ready_for_review',
        v_actor
      );

      if v_copy_working_trust then
        perform
          editorial.copy_playlist_working_trust_to_version(
            v_binding.resource_id,
            v_working.id,
            v_snapshot.version_id
          );
      end if;

      update editorial.resources resource_update
      set
        current_submitted_version_id =
          v_snapshot.version_id,
        current_approved_version_id = null,
        updated_at = now()
      where resource_update.id = v_binding.resource_id
      returning resource_update.*
      into v_resource;

      update public.wk_playlists playlist
      set
        status = 'ready_for_review',
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      perform editorial.append_resource_lifecycle_event(
        v_binding.resource_id,
        v_snapshot.version_id,
        'submitted',
        v_prior_status,
        'ready_for_review',
        p_note,
        jsonb_build_object(
          'playlist_id', p_playlist_id
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      perform editorial.append_resource_review_event(
        v_binding.resource_id,
        v_snapshot.version_id,
        null,
        'submitted',
        v_prior_status,
        'ready_for_review',
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'version_id',
          v_snapshot.version_id,
        'version_number',
          v_snapshot.version_number,
        'content_fingerprint',
          v_snapshot.content_fingerprint,
        'item_count',
          v_snapshot.item_count,
        'lifecycle_status',
          'ready_for_review',
        'correlation_id',
          v_correlation_id
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

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

create or replace function public.review_playlist(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_submitted_version_id uuid,
  p_decision text,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_submitted editorial.playlist_versions%rowtype;
  v_approved record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior_status text;
  v_prior_lifecycle_status text;
  v_result_status text;
  v_action text;
  v_result_version_id uuid;
  v_result_version_number bigint;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_review_queue'
      ),
      false
    )
  ) then
    raise exception
      'Review queue management permission is required';
  end if;

  if p_decision not in (
    'start_review',
    'request_changes',
    'approve'
  ) then
    raise exception
      'Choose a supported Playlist review decision';
  end if;

  if p_decision = 'request_changes'
     and nullif(
           btrim(p_note),
           ''
         ) is null
  then
    raise exception
      'Requested changes require a review note';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if not found then
    raise exception
      'Playlist Resource does not exist';
  end if;

  select submitted.*
  into v_submitted
  from editorial.playlist_versions submitted
  where submitted.id = p_submitted_version_id
    and submitted.resource_id =
          v_binding.resource_id
    and submitted.playlist_id =
          p_playlist_id
    and submitted.version_kind =
          'submitted';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.review.decide',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'submitted_version_id',
        p_submitted_version_id,
      'decision',
        p_decision,
      'note',
        nullif(
          btrim(p_note),
          ''
        ),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before the review decision could be applied.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_resource.current_submitted_version_id
          is distinct from p_submitted_version_id
        or v_submitted.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'submitted_version_changed',
      'Review must target the exact current submitted Playlist version.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'current_submitted_version_id',
          v_resource.current_submitted_version_id
      )
    );

  else
    v_prior_status := v_playlist.status;

    select event_row.resulting_status
    into v_prior_lifecycle_status
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id = v_binding.resource_id
    order by event_row.event_number desc
    limit 1;

    if p_decision = 'start_review' then
      if v_playlist.status <> 'ready_for_review' then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'Only a ready Playlist can enter Review.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        v_result_status := 'in_review';
        v_action := 'review_started';
        v_result_version_id :=
          v_submitted.id;
        v_result_version_number :=
          v_submitted.version_number;
      end if;

    elsif p_decision = 'request_changes' then
      if v_playlist.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'The Playlist is not currently reviewable.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        v_result_status :=
          'changes_requested';
        v_action :=
          'changes_requested';
        v_result_version_id :=
          v_submitted.id;
        v_result_version_number :=
          v_submitted.version_number;
      end if;

    else
      if v_playlist.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'invalid_review_transition',
          'The Playlist is not currently reviewable.',
          jsonb_build_object(
            'playlist_id',
              p_playlist_id,
            'authority_revision',
              v_playlist.authority_revision,
            'lifecycle_status',
              v_playlist.status
          )
        );
      else
        select *
        into v_approved
        from editorial.copy_playlist_version_snapshot(
          v_submitted.id,
          v_actor
        );

        v_result_status := 'approved';
        v_action := 'approved';
        v_result_version_id :=
          v_approved.version_id;
        v_result_version_number :=
          v_approved.version_number;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    )
    then
      update public.wk_playlists playlist
      set
        status = v_result_status,
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      perform editorial.append_resource_review_event(
        v_binding.resource_id,
        v_submitted.id,
        case
          when p_decision = 'approve'
            then v_result_version_id
          else null
        end,
        v_action,
        v_prior_status,
        v_result_status,
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      if p_decision in (
        'request_changes',
        'approve'
      ) then
        perform editorial.append_resource_lifecycle_event(
          v_binding.resource_id,
          case
            when p_decision = 'approve'
              then v_result_version_id
            else v_submitted.id
          end,
          v_action,
          coalesce(
            v_prior_lifecycle_status,
            v_prior_status
          ),
          v_result_status,
          p_note,
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'submitted_version_id', v_submitted.id
          ),
          v_actor,
          v_begin.command_receipt_id,
          v_correlation_id
        );
      end if;

      if p_decision = 'approve' then
        update editorial.resources resource_update
        set
          current_approved_version_id =
            v_result_version_id,
          updated_at = now()
        where resource_update.id = v_binding.resource_id
        returning resource_update.*
        into v_resource;

      elsif p_decision = 'request_changes' then
        update editorial.resources resource_update
        set
          current_approved_version_id = null,
          updated_at = now()
        where resource_update.id = v_binding.resource_id
        returning resource_update.*
        into v_resource;
      end if;

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'submitted_version_id',
          v_submitted.id,
        'version_id',
          v_result_version_id,
        'version_number',
          v_result_version_number,
        'lifecycle_status',
          v_result_status,
        'decision',
          p_decision,
        'correlation_id',
          v_correlation_id
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

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

create or replace function public.get_playlist_review_workspace(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_review_events jsonb;
  v_lifecycle_events jsonb;
  v_schedule jsonb;
  v_curator jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception
      'Playlist Resource does not exist';
  end if;

  if not editorial.current_user_can_participate_playlist_review(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist Review participation permission is required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'event_number', event.event_number,
        'target_version_id', event.target_version_id,
        'result_version_id', event.result_version_id,
        'action', event.action,
        'prior_status', event.prior_status,
        'resulting_status', event.resulting_status,
        'reason', event.reason,
        'actor_id', event.actor_id,
        'command_receipt_id', event.command_receipt_id,
        'correlation_id', event.correlation_id,
        'created_at', event.created_at
      )
      order by event.event_number
    ),
    '[]'::jsonb
  )
  into v_review_events
  from editorial.resource_review_events event
  where event.resource_id =
          v_binding.resource_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'event_number', event.event_number,
        'version_id', event.version_id,
        'action', event.action,
        'prior_status', event.prior_status,
        'resulting_status', event.resulting_status,
        'note', event.note,
        'metadata', event.metadata,
        'actor_id', event.actor_id,
        'command_receipt_id', event.command_receipt_id,
        'created_at', event.created_at
      )
      order by event.event_number
    ),
    '[]'::jsonb
  )
  into v_lifecycle_events
  from editorial.resource_lifecycle_events event
  where event.resource_id =
          v_binding.resource_id;

  select jsonb_build_object(
    'id', scheduled.id,
    'version_id', scheduled.version_id,
    'run_after', scheduled.run_after,
    'status', scheduled.status,
    'note', scheduled.note,
    'created_by', scheduled.created_by,
    'created_at', scheduled.created_at,
    'updated_at', scheduled.updated_at,
    'published_at', scheduled.published_at,
    'failure_reason', scheduled.failure_reason
  )
  into v_schedule
  from editorial.playlist_scheduled_publications scheduled
  where scheduled.playlist_id = p_playlist_id
  order by scheduled.created_at desc
  limit 1;

  if v_playlist.curator_credit_id is not null then
    select jsonb_build_object(
      'credit_id', credit.id,
      'role', credit.credit_role,
      'display_name', credit.display_name_snapshot,
      'author_slug', credit.registry_author_slug_snapshot,
      'username', credit.user_username_snapshot,
      'registry_author_id', credit.registry_author_id,
      'user_id', credit.user_id,
      'public_safe', governance.public_safe,
      'credit_state', governance.credit_state,
      'governance_revision',
        governance.governance_revision
    )
    into v_curator
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.id =
      v_playlist.curator_credit_id;
  end if;

  return jsonb_build_object(
    'playlist',
      jsonb_build_object(
        'id', v_playlist.id,
        'title', v_playlist.title,
        'slug', v_playlist.slug,
        'description', v_playlist.description,
        'curator_credit_id',
          v_playlist.curator_credit_id,
        'curator_label',
          v_playlist.curator_label,
        'status', v_playlist.status,
        'authority_revision',
          v_playlist.authority_revision,
        'metadata', v_playlist.metadata,
        'created_at', v_playlist.created_at,
        'updated_at', v_playlist.updated_at
      ),
    'resource_id',
      v_binding.resource_id,
    'current_working_version_id',
      v_resource.current_working_version_id,
    'current_submitted_version_id',
      v_resource.current_submitted_version_id,
    'current_approved_version_id',
      v_resource.current_approved_version_id,
    'current_published_version_id',
      v_resource.current_published_version_id,
    'working_version',
      editorial.playlist_version_snapshot_json(
        v_resource.current_working_version_id
      ),
    'submitted_version',
      editorial.playlist_version_snapshot_json(
        v_resource.current_submitted_version_id
      ),
    'approved_version',
      editorial.playlist_version_snapshot_json(
        v_resource.current_approved_version_id
      ),
    'published_version',
      editorial.playlist_version_snapshot_json(
        v_resource.current_published_version_id
      ),
    'curator', v_curator,
    'schedule', v_schedule,
    'review_events', v_review_events,
    'lifecycle_events', v_lifecycle_events,
    'can_edit',
      editorial.current_user_can_edit_playlist(
        v_binding.resource_id
      ),
    'can_manage_review',
      coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'manage_review_queue'
        ),
        false
      ),
    'can_publish',
      editorial.current_user_can_publish_playlist(
        v_binding.resource_id
      )
  );
end;
$function$;

do $phase_7a_k4c_p1_postconditions$
declare
  v_baseline record;
  v_definition text;
  v_count bigint;
begin
  select *
  into v_baseline
  from phase_7a_k4c_p1_baseline;

  if v_baseline.playlist_lifecycle_fingerprint is distinct from (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.playlist_lifecycle_events e
  ) or v_baseline.playlist_review_fingerprint is distinct from (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.playlist_review_events e
  ) then
    raise exception
      'STOP: K4C-P1 mutated Playlist typed event history';
  end if;

  if exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'playlist_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = source.metadata
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: K4C-P1 Playlist lifecycle compatibility history is not fully represented';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority = 'playlist_review'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.target_version_id = source.target_version_id
     and shared.result_version_id is not distinct from source.result_version_id
     and shared.action = source.action
     and shared.prior_status = source.prior_status
     and shared.resulting_status = source.resulting_status
     and shared.reason is not distinct from source.reason
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.correlation_id = source.correlation_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: K4C-P1 Playlist review compatibility history is not fully represented';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events';

  if v_count <> 0 then
    raise exception
      'STOP: % live function(s) still write Playlist typed event authority',
      v_count;
  end if;

  select pg_get_functiondef(
    'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%editorial.append_resource_lifecycle_event%'
     or v_definition not ilike '%editorial.append_resource_review_event%'
     or v_definition ilike '%update editorial.playlist_resources%current_submitted_version_id%'
  then
    raise exception
      'STOP: Playlist submit did not converge to shared event / Resource pointer authority';
  end if;

  select pg_get_functiondef(
    'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%editorial.append_resource_review_event%'
     or v_definition not ilike '%editorial.append_resource_lifecycle_event%'
     or v_definition ilike '%update editorial.playlist_resources%current_approved_version_id%'
  then
    raise exception
      'STOP: Playlist review did not converge to shared event / Resource pointer authority';
  end if;

  select pg_get_functiondef(
    'public.get_playlist_review_workspace(uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%editorial.resource_review_events%'
     or v_definition not ilike '%editorial.resource_lifecycle_events%'
     or v_definition ilike '%editorial.playlist_review_events%'
     or v_definition ilike '%editorial.playlist_lifecycle_events%'
  then
    raise exception
      'STOP: Playlist workspace still reads typed event authority';
  end if;

  select pg_get_functiondef(
    'editorial.append_playlist_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%editorial.append_resource_lifecycle_event%'
     or v_definition ilike '%insert into editorial.playlist_lifecycle_events%'
  then
    raise exception
      'STOP: Playlist lifecycle adapter still owns typed event writes';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P1 left % Playlist pointer mirror divergence(s)',
      v_count;
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: Video typed event authority reappeared during K4C-P1';
  end if;
end;
$phase_7a_k4c_p1_postconditions$;

commit;
