-- Phase 7A K4B: governed Video lifecycle commands.
--
-- Adds the first public governed Video lifecycle command surface on top of:
-- - K0 Resource Version identity
-- - K1 canonical Resource lifecycle pointers
-- - K2 typed Video authority
-- - K4A shared Resource lifecycle/review event history
--
-- Video does not gain a mutable domain status column or typed event ledgers.

-- ---------------------------------------------------------------------------
-- Preflight: require the accepted kernel.
-- ---------------------------------------------------------------------------

do $phase_7a_k4b_preflight$
begin
  if to_regclass('video.publications') is null
     or to_regclass('video.publication_versions') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
  then
    raise exception
      'STOP: Phase 7A K4B requires K0/K1/K2/K4A authority.';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: Video must not acquire typed review/lifecycle event authority.';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type =
      'video.publication.version.snapshot_working'
      and command_type.enabled
  ) then
    raise exception
      'STOP: K2 Video working-snapshot command vocabulary is missing.';
  end if;

  if (
    select count(*)
    from editorial.resource_lifecycle_actions action_row
    where action_row.action in (
      'submitted',
      'changes_requested',
      'approved',
      'published'
    )
      and action_row.enabled
  ) <> 4 then
    raise exception
      'STOP: K4A lifecycle action vocabulary is incomplete for Video.';
  end if;

  if (
    select count(*)
    from editorial.resource_review_actions action_row
    where action_row.action in (
      'submitted',
      'review_started',
      'changes_requested',
      'approved'
    )
      and action_row.enabled
  ) <> 4 then
    raise exception
      'STOP: K4A review action vocabulary is incomplete for Video.';
  end if;
end;
$phase_7a_k4b_preflight$;

-- ---------------------------------------------------------------------------
-- Review participation authority.
-- ---------------------------------------------------------------------------

create or replace function editorial.current_user_can_participate_video_review(
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
      coalesce(
        editorial.current_user_can_edit_video(p_resource_id),
        false
      )
      or coalesce(public.current_user_is_administrator(), false)
      or coalesce(
        public.current_user_has_capability('view_review_queue'),
        false
      )
      or coalesce(
        public.current_user_has_capability('manage_review_queue'),
        false
      )
    );
$function$;

revoke execute
  on function editorial.current_user_can_participate_video_review(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical current Video content snapshot and fingerprint.
-- ---------------------------------------------------------------------------

create or replace function video.publication_content_snapshot_json(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'video',
  'editorial',
  'media'
as $function$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_source video.sources%rowtype;
  v_show_resource_id uuid;
  v_show_episode_resource_id uuid;
  v_slug text;
  v_title text;
  v_summary text;
  v_episode_authority_revision bigint;
  v_show_authority_revision bigint;
  v_caption_tracks jsonb;
  v_chapters jsonb;
  v_media_usages jsonb;
begin
  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'Video publication does not exist.';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Video publication Resource binding does not exist.';
  end if;

  if v_publication.selected_source_id is null then
    raise exception
      'Video publication requires one selected source before snapshot.';
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_publication.selected_source_id;

  if not found then
    raise exception 'Selected Video source does not exist.';
  end if;

  if v_publication.publication_kind = 'standalone' then
    v_show_resource_id := null;
    v_show_episode_resource_id := null;
    v_slug := v_publication.standalone_slug;
    v_title := v_publication.standalone_title;
    v_summary := v_publication.standalone_summary;
    v_episode_authority_revision := null;
    v_show_authority_revision := null;
  else
    select
      episode.show_resource_id,
      episode.resource_id,
      episode.slug,
      episode.title,
      episode.summary,
      episode.authority_revision,
      show_row.authority_revision
    into
      v_show_resource_id,
      v_show_episode_resource_id,
      v_slug,
      v_title,
      v_summary,
      v_episode_authority_revision,
      v_show_authority_revision
    from editorial.video_episode_shared_links link
    join editorial.show_episodes episode
      on episode.resource_id = link.show_episode_resource_id
    join editorial.shows show_row
      on show_row.resource_id = episode.show_resource_id
    where link.video_publication_id = p_publication_id;

    if not found then
      raise exception
        'Video Episode requires its exact shared Show Episode binding.';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', track.id,
        'media_asset_id', track.media_asset_id,
        'media_asset_revision_id', track.media_asset_revision_id,
        'language_tag', track.language_tag,
        'track_kind', track.track_kind,
        'label', track.label,
        'is_default', track.is_default,
        'display_order', track.display_order,
        'authority_revision', track.authority_revision
      )
      order by track.display_order, track.id
    ),
    '[]'::jsonb
  )
  into v_caption_tracks
  from video.caption_tracks track
  where track.publication_id = p_publication_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', chapter.id,
        'chapter_number', chapter.chapter_number,
        'start_seconds', chapter.start_seconds,
        'title', chapter.title,
        'description', chapter.description
      )
      order by chapter.chapter_number, chapter.id
    ),
    '[]'::jsonb
  )
  into v_chapters
  from video.publication_chapters chapter
  where chapter.publication_id = p_publication_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'usage_role', usage.usage_role,
        'asset_id', usage.asset_id,
        'asset_revision_id', usage.asset_revision_id,
        'resolution_mode', usage.resolution_mode,
        'placement_data', usage.placement_data,
        'display_order', usage.display_order,
        'alt_text_snapshot', usage.alt_text_snapshot,
        'caption_snapshot', usage.caption_snapshot,
        'credit_snapshot', usage.credit_snapshot
      )
      order by usage.usage_role, usage.display_order, usage.id
    ),
    '[]'::jsonb
  )
  into v_media_usages
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = p_publication_id
    and usage.target_version_id is null
    and usage.usage_state = 'active';

  return jsonb_build_object(
    'resource_id', v_binding.resource_id,
    'resource_kind', v_binding.resource_kind,
    'publication_id', v_publication.id,
    'publication_kind', v_publication.publication_kind,
    'show_resource_id', v_show_resource_id,
    'show_episode_resource_id', v_show_episode_resource_id,
    'show_authority_revision', v_show_authority_revision,
    'show_episode_authority_revision', v_episode_authority_revision,
    'slug', v_slug,
    'title', v_title,
    'summary', v_summary,
    'classification', v_publication.classification,
    'source', jsonb_build_object(
      'id', v_source.id,
      'source_kind', v_source.source_kind,
      'provider_key', v_source.provider_key,
      'provider_object_id', v_source.provider_object_id,
      'canonical_url', v_source.canonical_url,
      'media_asset_id', v_source.media_asset_id,
      'media_asset_revision_id', v_source.media_asset_revision_id,
      'source_metadata', v_source.source_metadata
    ),
    'metadata', v_publication.metadata,
    'caption_tracks', v_caption_tracks,
    'chapters', v_chapters,
    'media_usages', v_media_usages
  );
end;
$function$;

create or replace function video.publication_content_fingerprint(
  p_publication_id uuid
)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'video', 'extensions'
as $function$
  select encode(
    extensions.digest(
      convert_to(
        video.publication_content_snapshot_json(
          p_publication_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

revoke execute
  on function video.publication_content_snapshot_json(uuid),
     video.publication_content_fingerprint(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Media/version snapshot integrity.
-- ---------------------------------------------------------------------------

create or replace function video.assert_current_publication_snapshot_integrity(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_publication video.publications%rowtype;
  v_source video.sources%rowtype;
  v_master_count bigint;
  v_matching_master_count bigint;
begin
  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'Video publication does not exist.';
  end if;

  if v_publication.selected_source_id is null then
    raise exception
      'Video publication requires one selected source before snapshot.';
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_publication.selected_source_id;

  if not found then
    raise exception 'Selected Video source does not exist.';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_id = p_publication_id
      and usage.target_version_id is null
      and usage.usage_state = 'active'
      and (
        usage.resolution_mode <> 'exact_revision'
        or usage.asset_revision_id is null
      )
  ) then
    raise exception
      'Video working Media usage must resolve to exact revisions before snapshot.';
  end if;

  select count(*)
  into v_master_count
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = p_publication_id
    and usage.target_version_id is null
    and usage.usage_role = 'video_master'
    and usage.usage_state = 'active';

  if v_source.source_kind = 'native_media' then
    select count(*)
    into v_matching_master_count
    from media.usage_links usage
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_id = p_publication_id
      and usage.target_version_id is null
      and usage.usage_role = 'video_master'
      and usage.usage_state = 'active'
      and usage.resolution_mode = 'exact_revision'
      and usage.asset_id = v_source.media_asset_id
      and usage.asset_revision_id = v_source.media_asset_revision_id;

    if v_master_count <> 1
       or v_matching_master_count <> 1
    then
      raise exception
        'Selected native Video source must match one exact working video_master usage.';
    end if;
  elsif v_master_count <> 0 then
    raise exception
      'Provider-backed Video cannot snapshot a native video_master usage.';
  end if;

  if exists (
    select 1
    from video.caption_tracks track
    where track.publication_id = p_publication_id
      and not exists (
        select 1
        from media.usage_links usage
        where usage.target_authority = 'video'
          and usage.target_kind = 'video_publication'
          and usage.target_id = p_publication_id
          and usage.target_version_id is null
          and usage.usage_role = 'video_caption'
          and usage.usage_state = 'active'
          and usage.resolution_mode = 'exact_revision'
          and usage.asset_id = track.media_asset_id
          and usage.asset_revision_id = track.media_asset_revision_id
      )
  ) then
    raise exception
      'Every Video caption track requires matching active video_caption Media usage.';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_id = p_publication_id
      and usage.target_version_id is null
      and usage.usage_role = 'video_caption'
      and usage.usage_state = 'active'
      and not exists (
        select 1
        from video.caption_tracks track
        where track.publication_id = p_publication_id
          and track.media_asset_id = usage.asset_id
          and track.media_asset_revision_id = usage.asset_revision_id
      )
  ) then
    raise exception
      'Active video_caption Media usage must resolve to Video caption semantics.';
  end if;
end;
$function$;

create or replace function video.copy_current_media_usage_to_version(
  p_publication_id uuid,
  p_version_id uuid,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_count integer;
begin
  perform video.assert_current_publication_snapshot_integrity(
    p_publication_id
  );

  insert into media.usage_links (
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
  select
    usage.asset_id,
    usage.asset_revision_id,
    'exact_revision',
    'video',
    'video_publication',
    p_publication_id,
    'video_publication_version',
    p_version_id,
    usage.usage_role,
    usage.placement_data,
    usage.display_order,
    usage.alt_text_snapshot,
    usage.caption_snapshot,
    usage.credit_snapshot,
    'active',
    1,
    p_actor_id
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = p_publication_id
    and usage.target_version_id is null
    and usage.usage_state = 'active'
  order by usage.usage_role, usage.display_order, usage.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function video.copy_version_media_usage(
  p_source_version_id uuid,
  p_target_version_id uuid,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_source video.publication_versions%rowtype;
  v_target video.publication_versions%rowtype;
  v_count integer;
begin
  select version_row.*
  into v_source
  from video.publication_versions version_row
  where version_row.id = p_source_version_id;

  select version_row.*
  into v_target
  from video.publication_versions version_row
  where version_row.id = p_target_version_id;

  if v_source.id is null
     or v_target.id is null
     or v_source.publication_id <> v_target.publication_id
     or v_source.resource_id <> v_target.resource_id
  then
    raise exception
      'Video version Media usage copy requires versions of the same publication.';
  end if;

  insert into media.usage_links (
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
  select
    usage.asset_id,
    usage.asset_revision_id,
    'exact_revision',
    'video',
    'video_publication',
    v_target.publication_id,
    'video_publication_version',
    v_target.id,
    usage.usage_role,
    usage.placement_data,
    usage.display_order,
    usage.alt_text_snapshot,
    usage.caption_snapshot,
    usage.credit_snapshot,
    'active',
    1,
    p_actor_id
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = v_source.publication_id
    and usage.target_version_kind = 'video_publication_version'
    and usage.target_version_id = v_source.id
    and usage.usage_state = 'active'
  order by usage.usage_role, usage.display_order, usage.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute
  on function video.assert_current_publication_snapshot_integrity(uuid),
     video.copy_current_media_usage_to_version(uuid, uuid, uuid),
     video.copy_version_media_usage(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Immutable Video version materialization.
-- ---------------------------------------------------------------------------

create or replace function video.insert_current_publication_snapshot(
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
  'video',
  'editorial',
  'media',
  'extensions'
as $function$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_source video.sources%rowtype;
  v_show_resource_id uuid;
  v_show_episode_resource_id uuid;
  v_slug text;
  v_title text;
  v_summary text;
  v_fingerprint text;
  v_version_number bigint;
  v_version_id uuid;
begin
  if p_version_kind not in (
    'working',
    'submitted',
    'approved',
    'published'
  ) then
    raise exception 'Unsupported Video version kind.';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'Video publication does not exist.';
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    raise exception 'Video publication revision changed.';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Video publication Resource binding does not exist.';
  end if;

  if v_publication.selected_source_id is null then
    raise exception
      'Video publication requires one selected source before snapshot.';
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_publication.selected_source_id;

  if not found then
    raise exception 'Selected Video source does not exist.';
  end if;

  perform video.assert_current_publication_snapshot_integrity(
    p_publication_id
  );

  if v_publication.publication_kind = 'standalone' then
    v_show_resource_id := null;
    v_show_episode_resource_id := null;
    v_slug := v_publication.standalone_slug;
    v_title := v_publication.standalone_title;
    v_summary := v_publication.standalone_summary;
  else
    select
      episode.show_resource_id,
      episode.resource_id,
      episode.slug,
      episode.title,
      episode.summary
    into
      v_show_resource_id,
      v_show_episode_resource_id,
      v_slug,
      v_title,
      v_summary
    from editorial.video_episode_shared_links link
    join editorial.show_episodes episode
      on episode.resource_id = link.show_episode_resource_id
    where link.video_publication_id = p_publication_id;

    if not found then
      raise exception
        'Video Episode requires its exact shared Show Episode binding.';
    end if;
  end if;

  v_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  if v_fingerprint is null then
    raise exception 'Video publication fingerprint could not be created.';
  end if;

  select coalesce(max(version_row.version_number), 0) + 1
  into v_version_number
  from video.publication_versions version_row
  where version_row.publication_id = p_publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into video.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_resource_id,
    show_episode_resource_id,
    slug_snapshot,
    title_snapshot,
    summary_snapshot,
    classification,
    source_id,
    metadata,
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
    v_show_resource_id,
    v_show_episode_resource_id,
    v_slug,
    v_title,
    v_summary,
    v_publication.classification,
    v_source.id,
    v_publication.metadata,
    v_fingerprint,
    p_actor_id
  );

  insert into video.publication_version_caption_tracks (
    publication_version_id,
    track_number,
    media_asset_id,
    media_asset_revision_id,
    language_tag,
    track_kind,
    label,
    is_default
  )
  select
    v_version_id,
    row_number() over (
      order by track.display_order, track.id
    )::integer,
    track.media_asset_id,
    track.media_asset_revision_id,
    track.language_tag,
    track.track_kind,
    track.label,
    track.is_default
  from video.caption_tracks track
  where track.publication_id = p_publication_id
  order by track.display_order, track.id;

  insert into video.publication_version_chapters (
    publication_version_id,
    chapter_number,
    start_seconds,
    title,
    description
  )
  select
    v_version_id,
    chapter.chapter_number,
    chapter.start_seconds,
    chapter.title,
    chapter.description
  from video.publication_chapters chapter
  where chapter.publication_id = p_publication_id
  order by chapter.chapter_number;

  perform video.copy_current_media_usage_to_version(
    p_publication_id,
    v_version_id,
    p_actor_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  return next;
end;
$function$;

create or replace function video.copy_publication_version_snapshot(
  p_source_version_id uuid,
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
  'video',
  'media',
  'extensions'
as $function$
declare
  v_source video.publication_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  if p_version_kind not in (
    'submitted',
    'approved',
    'published'
  ) then
    raise exception 'Unsupported copied Video version kind.';
  end if;

  select version_row.*
  into v_source
  from video.publication_versions version_row
  where version_row.id = p_source_version_id;

  if not found then
    raise exception 'Source Video publication version does not exist.';
  end if;

  select coalesce(max(version_row.version_number), 0) + 1
  into v_version_number
  from video.publication_versions version_row
  where version_row.publication_id = v_source.publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into video.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_resource_id,
    show_episode_resource_id,
    slug_snapshot,
    title_snapshot,
    summary_snapshot,
    classification,
    source_id,
    metadata,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.publication_id,
    v_version_number,
    p_version_kind,
    v_source.source_authority_revision,
    v_source.publication_kind,
    v_source.show_resource_id,
    v_source.show_episode_resource_id,
    v_source.slug_snapshot,
    v_source.title_snapshot,
    v_source.summary_snapshot,
    v_source.classification,
    v_source.source_id,
    v_source.metadata,
    v_source.content_fingerprint,
    p_actor_id
  );

  insert into video.publication_version_caption_tracks (
    publication_version_id,
    track_number,
    media_asset_id,
    media_asset_revision_id,
    language_tag,
    track_kind,
    label,
    is_default
  )
  select
    v_version_id,
    track.track_number,
    track.media_asset_id,
    track.media_asset_revision_id,
    track.language_tag,
    track.track_kind,
    track.label,
    track.is_default
  from video.publication_version_caption_tracks track
  where track.publication_version_id = v_source.id
  order by track.track_number;

  insert into video.publication_version_chapters (
    publication_version_id,
    chapter_number,
    start_seconds,
    title,
    description
  )
  select
    v_version_id,
    chapter.chapter_number,
    chapter.start_seconds,
    chapter.title,
    chapter.description
  from video.publication_version_chapters chapter
  where chapter.publication_version_id = v_source.id
  order by chapter.chapter_number;

  perform video.copy_version_media_usage(
    v_source.id,
    v_version_id,
    p_actor_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_source.content_fingerprint;
  return next;
end;
$function$;

revoke execute
  on function video.insert_current_publication_snapshot(
       uuid, bigint, text, uuid
     ),
     video.copy_publication_version_snapshot(uuid, text, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Publishability recheck against immutable version identity and current Media
-- governance/provider availability.
-- ---------------------------------------------------------------------------

create or replace function video.assert_publishable_media_revision(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_expected_asset_kind text
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'media'
as $function$
declare
  v_asset_kind text;
  v_asset_state text;
  v_revision_asset_id uuid;
  v_verification_state text;
  v_rights_status text;
  v_consent_status text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_retention_state text;
  v_public_safety_state text;
begin
  select
    asset.asset_kind,
    asset.lifecycle_state,
    governance.rights_status,
    governance.consent_status,
    governance.embargo_state,
    governance.embargo_until,
    governance.source_protection_class,
    governance.retention_state,
    governance.public_safety_state
  into
    v_asset_kind,
    v_asset_state,
    v_rights_status,
    v_consent_status,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_retention_state,
    v_public_safety_state
  from media.assets asset
  join media.asset_governance_versions governance
    on governance.id = asset.current_governance_version_id
   and governance.asset_id = asset.id
  where asset.id = p_asset_id;

  select
    revision.asset_id,
    file_row.verification_state
  into
    v_revision_asset_id,
    v_verification_state
  from media.asset_revisions revision
  join media.file_objects file_row
    on file_row.id = revision.original_file_object_id
  where revision.id = p_asset_revision_id;

  if v_asset_kind is distinct from p_expected_asset_kind
     or v_asset_state <> 'active'
     or v_revision_asset_id is distinct from p_asset_id
     or v_verification_state <> 'verified'
     or v_public_safety_state not in (
       'approved_public',
       'approved_redacted'
     )
     or v_rights_status not in (
       'owned',
       'licensed',
       'public_domain',
       'fair_use'
     )
     or v_consent_status not in (
       'granted',
       'not_required'
     )
     or v_source_protection_class not in (
       'public',
       'public_redacted'
     )
     or v_retention_state not in (
       'retain',
       'review_required'
     )
     or v_embargo_state = 'active'
     or (
       v_embargo_state = 'scheduled'
       and v_embargo_until is not null
       and v_embargo_until > now()
     )
  then
    raise exception
      'Current Media governance does not permit this Video version Media revision.';
  end if;
end;
$function$;

create or replace function video.assert_publishable_publication_version(
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_source video.sources%rowtype;
  v_master_count bigint;
begin
  select version_row.*
  into v_version
  from video.publication_versions version_row
  where version_row.id = p_version_id;

  if not found then
    raise exception 'Video publication version does not exist.';
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_version.source_id;

  if not found then
    raise exception 'Video publication version source does not exist.';
  end if;

  if v_source.source_kind = 'native_media' then
    perform video.assert_publishable_media_revision(
      v_source.media_asset_id,
      v_source.media_asset_revision_id,
      'video'
    );

    select count(*)
    into v_master_count
    from media.usage_links usage
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_id = v_version.publication_id
      and usage.target_version_kind = 'video_publication_version'
      and usage.target_version_id = v_version.id
      and usage.usage_role = 'video_master'
      and usage.usage_state = 'active'
      and usage.resolution_mode = 'exact_revision'
      and usage.asset_id = v_source.media_asset_id
      and usage.asset_revision_id = v_source.media_asset_revision_id;

    if v_master_count <> 1 then
      raise exception
        'Publishable native Video version requires one exact version-bound video_master usage.';
    end if;
  else
    if not exists (
      select 1
      from video.source_providers provider
      where provider.provider_key = v_source.provider_key
        and provider.enabled
    ) then
      raise exception
        'Video provider is disabled or unavailable for publication.';
    end if;

    if exists (
      select 1
      from media.usage_links usage
      where usage.target_authority = 'video'
        and usage.target_kind = 'video_publication'
        and usage.target_id = v_version.publication_id
        and usage.target_version_kind = 'video_publication_version'
        and usage.target_version_id = v_version.id
        and usage.usage_role = 'video_master'
        and usage.usage_state = 'active'
    ) then
      raise exception
        'Provider-backed Video version cannot carry native video_master usage.';
    end if;
  end if;

  if exists (
    select 1
    from media.usage_links usage
    join media.assets asset
      on asset.id = usage.asset_id
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.target_id = v_version.publication_id
      and usage.target_version_kind = 'video_publication_version'
      and usage.target_version_id = v_version.id
      and usage.usage_state = 'active'
      and (
        usage.resolution_mode <> 'exact_revision'
        or usage.asset_revision_id is null
        or (
          usage.usage_role = 'video_poster'
          and asset.asset_kind <> 'image'
        )
        or (
          usage.usage_role = 'video_caption'
          and asset.asset_kind <> 'caption'
        )
        or (
          usage.usage_role = 'video_transcript'
          and asset.asset_kind <> 'transcript'
        )
        or (
          usage.usage_role = 'video_master'
          and asset.asset_kind <> 'video'
        )
      )
  ) then
    raise exception
      'Video version Media usage is not publishable exact-revision authority.';
  end if;

  perform video.assert_publishable_media_revision(
    usage.asset_id,
    usage.asset_revision_id,
    asset.asset_kind
  )
  from media.usage_links usage
  join media.assets asset
    on asset.id = usage.asset_id
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = v_version.publication_id
    and usage.target_version_kind = 'video_publication_version'
    and usage.target_version_id = v_version.id
    and usage.usage_state = 'active';
end;
$function$;

revoke execute
  on function video.assert_publishable_media_revision(uuid, uuid, text),
     video.assert_publishable_publication_version(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Governed Video lifecycle command vocabulary.
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
    'video.publication.review.submit',
    'video.publication.review.submit.sync',
    'video.publication.review.submit.accepted',
    'video.publication.review.submit.succeeded',
    'video.publication.review.submit.failed',
    'video.publication.review.submit.retry_scheduled',
    true
  ),
  (
    'video.publication.review.decide',
    'video.publication.review.decide.sync',
    'video.publication.review.decide.accepted',
    'video.publication.review.decide.succeeded',
    'video.publication.review.decide.failed',
    'video.publication.review.decide.retry_scheduled',
    true
  ),
  (
    'video.publication.publish',
    'video.publication.publish.sync',
    'video.publication.publish.accepted',
    'video.publication.publish.succeeded',
    'video.publication.publish.failed',
    'video.publication.publish.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Snapshot working Video version.
-- ---------------------------------------------------------------------------

create or replace function public.snapshot_video_publication_working_version(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  resource_kind text,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
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
  'platform_private',
  'video',
  'extensions'
as $function$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_current video.publication_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_reused boolean := false;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, extensions.gen_random_uuid());
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Not authenticated.';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Video publication does not exist.';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Video publication Resource binding does not exist.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if v_resource.lifecycle_state = 'archived' then
    raise exception 'Archived Video publication cannot be snapshotted.';
  end if;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using
      errcode = '42501',
      message = 'Video edit permission is required.';
  end if;

  v_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.version.snapshot_working',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint', v_fingerprint,
      'correlation_id', v_correlation_id
    )
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
    resource_id := v_read.resource_id;
    resource_kind := v_binding.resource_kind;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_publication_revision_changed',
      'The Video publication changed before the working snapshot could be created.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision
      )
    );
  else
    if v_resource.current_working_version_id is not null then
      select version_row.*
      into v_current
      from video.publication_versions version_row
      where version_row.id = v_resource.current_working_version_id
        and version_row.resource_id = v_binding.resource_id
        and version_row.publication_id = p_publication_id
        and version_row.version_kind = 'working';

      if found
         and v_current.content_fingerprint = v_fingerprint
         and v_current.source_authority_revision =
               v_publication.authority_revision
      then
        v_snapshot.version_id := v_current.id;
        v_snapshot.version_number := v_current.version_number;
        v_snapshot.content_fingerprint := v_current.content_fingerprint;
        v_reused := true;
      end if;
    end if;

    if not v_reused then
      select *
      into v_snapshot
      from video.insert_current_publication_snapshot(
        p_publication_id,
        v_publication.authority_revision,
        'working',
        auth.uid()
      );

      update editorial.resources resource_row
      set
        current_working_version_id = v_snapshot.version_id,
        updated_at = now()
      where resource_row.id = v_binding.resource_id;
    end if;

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', v_binding.resource_id,
      'resource_kind', v_binding.resource_kind,
      'authority_revision', v_publication.authority_revision,
      'version_id', v_snapshot.version_id,
      'version_number', v_snapshot.version_number,
      'content_fingerprint', v_snapshot.content_fingerprint,
      'reused_existing_snapshot', v_reused,
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
  resource_id := v_read.resource_id;
  resource_kind := v_binding.resource_kind;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Submit exact current working Video version into governed review.
-- ---------------------------------------------------------------------------

create or replace function public.submit_video_publication_for_review(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
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
  'platform_private',
  'video',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_working video.publication_versions%rowtype;
  v_submitted record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_current_fingerprint text;
  v_lifecycle_event_number bigint;
  v_review_event_number bigint;
  v_prior_lifecycle_status text;
  v_prior_review_status text;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, extensions.gen_random_uuid());
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Video publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Video publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if v_resource.lifecycle_state = 'archived' then
    raise exception 'Archived Video publication cannot be submitted';
  end if;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception 'Video edit permission is required';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.review.submit',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'working_version_id',
        v_resource.current_working_version_id,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
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
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  v_current_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  select version_row.*
  into v_working
  from video.publication_versions version_row
  where version_row.id = v_resource.current_working_version_id
    and version_row.resource_id = v_binding.resource_id
    and version_row.publication_id = p_publication_id
    and version_row.version_kind = 'working';

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_publication_revision_changed',
      'The Video publication changed before it could be submitted.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision
      )
    );
  elsif v_working.id is null
        or v_working.source_authority_revision
             <> v_publication.authority_revision
        or v_working.content_fingerprint
             is distinct from v_current_fingerprint
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_working_version_stale',
      'Snapshot the exact current Video working state before submitting it.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'current_working_version_id',
          v_resource.current_working_version_id,
        'authority_revision', v_publication.authority_revision
      )
    );
  else
    select *
    into v_submitted
    from video.copy_publication_version_snapshot(
      v_working.id,
      'submitted',
      v_actor
    );

    select coalesce(max(event_row.event_number), 0) + 1
    into v_lifecycle_event_number
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id = v_binding.resource_id;

    select coalesce(max(event_row.event_number), 0) + 1
    into v_review_event_number
    from editorial.resource_review_events event_row
    where event_row.resource_id = v_binding.resource_id;

    select event_row.resulting_status
    into v_prior_lifecycle_status
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id = v_binding.resource_id
    order by event_row.event_number desc
    limit 1;

    select event_row.resulting_status
    into v_prior_review_status
    from editorial.resource_review_events event_row
    where event_row.resource_id = v_binding.resource_id
    order by event_row.event_number desc
    limit 1;

    v_prior_lifecycle_status := coalesce(
      v_prior_lifecycle_status,
      case
        when v_resource.current_published_version_id is not null
          then 'published'
        else 'draft'
      end
    );

    v_prior_review_status := coalesce(
      v_prior_review_status,
      v_prior_lifecycle_status
    );

    update editorial.resources resource_row
    set
      current_submitted_version_id = v_submitted.version_id,
      current_approved_version_id = null,
      updated_at = now()
    where resource_row.id = v_binding.resource_id;

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
      v_binding.resource_id,
      v_lifecycle_event_number,
      'submitted',
      v_submitted.version_id,
      v_prior_lifecycle_status,
      'ready_for_review',
      nullif(btrim(p_note), ''),
      jsonb_build_object(
        'publication_id', p_publication_id,
        'working_version_id', v_working.id
      ),
      v_actor,
      v_begin.command_receipt_id,
      v_correlation_id
    );

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
      v_binding.resource_id,
      v_review_event_number,
      v_submitted.version_id,
      null,
      'submitted',
      v_prior_review_status,
      'ready_for_review',
      nullif(btrim(p_note), ''),
      v_actor,
      v_begin.command_receipt_id,
      v_correlation_id
    );

    update video.publications publication
    set
      authority_revision = publication.authority_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where publication.id = p_publication_id
    returning publication.*
    into v_publication;

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', v_binding.resource_id,
      'authority_revision', v_publication.authority_revision,
      'working_version_id', v_working.id,
      'version_id', v_submitted.version_id,
      'version_number', v_submitted.version_number,
      'content_fingerprint', v_submitted.content_fingerprint,
      'lifecycle_status', 'ready_for_review',
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
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Governed review decision against exact submitted Resource Version.
-- ---------------------------------------------------------------------------

create or replace function public.review_video_publication(
  p_publication_id uuid,
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
  publication_id uuid,
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
  'platform_private',
  'video',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_submitted video.publication_versions%rowtype;
  v_approved record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_review_event_number bigint;
  v_lifecycle_event_number bigint;
  v_review_status text;
  v_lifecycle_status text;
  v_action text;
  v_result_status text;
  v_result_version_id uuid;
  v_result_version_number bigint;
  v_current_fingerprint text;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, extensions.gen_random_uuid());
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_decision not in (
    'start_review',
    'request_changes',
    'approve'
  ) then
    raise exception 'Choose a supported Video review decision';
  end if;

  if p_decision = 'request_changes'
     and nullif(btrim(p_note), '') is null
  then
    raise exception
      'Requested changes require a review note';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(
      public.current_user_has_capability('manage_review_queue'),
      false
    )
  ) then
    raise exception
      'Review queue management permission is required';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Video publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Video publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if v_resource.lifecycle_state = 'archived' then
    raise exception 'Archived Video publication cannot be reviewed';
  end if;

  select submitted.*
  into v_submitted
  from video.publication_versions submitted
  where submitted.id = p_submitted_version_id
    and submitted.resource_id = v_binding.resource_id
    and submitted.publication_id = p_publication_id
    and submitted.version_kind = 'submitted';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.review.decide',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'submitted_version_id', p_submitted_version_id,
      'decision', p_decision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
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
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  v_current_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  select event_row.resulting_status
  into v_review_status
  from editorial.resource_review_events event_row
  where event_row.resource_id = v_binding.resource_id
  order by event_row.event_number desc
  limit 1;

  select event_row.resulting_status
  into v_lifecycle_status
  from editorial.resource_lifecycle_events event_row
  where event_row.resource_id = v_binding.resource_id
  order by event_row.event_number desc
  limit 1;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_publication_revision_changed',
      'The Video publication changed before the Review decision could be applied.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision
      )
    );
  elsif v_resource.current_submitted_version_id
          is distinct from p_submitted_version_id
        or v_submitted.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_submitted_version_changed',
      'Review must target the exact current submitted Video version.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'current_submitted_version_id',
          v_resource.current_submitted_version_id
      )
    );
  elsif v_submitted.content_fingerprint
          is distinct from v_current_fingerprint
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_submitted_version_stale',
      'The Video publication changed after submission and must be snapshotted and submitted again.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'submitted_content_fingerprint',
          v_submitted.content_fingerprint,
        'current_content_fingerprint',
          v_current_fingerprint
      )
    );
  else
    if p_decision = 'start_review' then
      if v_review_status <> 'ready_for_review' then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'video_invalid_review_transition',
          'Only ready Video can enter Review.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'review_status', v_review_status
          )
        );
      else
        v_action := 'review_started';
        v_result_status := 'in_review';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;
    elsif p_decision = 'request_changes' then
      if v_review_status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'video_invalid_review_transition',
          'The Video publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'review_status', v_review_status
          )
        );
      else
        v_action := 'changes_requested';
        v_result_status := 'changes_requested';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;
    else
      if v_review_status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'video_invalid_review_transition',
          'The Video publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'review_status', v_review_status
          )
        );
      else
        select *
        into v_approved
        from video.copy_publication_version_snapshot(
          v_submitted.id,
          'approved',
          v_actor
        );

        v_action := 'approved';
        v_result_status := 'approved';
        v_result_version_id := v_approved.version_id;
        v_result_version_number := v_approved.version_number;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      select coalesce(max(event_row.event_number), 0) + 1
      into v_review_event_number
      from editorial.resource_review_events event_row
      where event_row.resource_id = v_binding.resource_id;

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
        v_binding.resource_id,
        v_review_event_number,
        v_submitted.id,
        case
          when p_decision = 'approve'
            then v_result_version_id
          else null
        end,
        v_action,
        v_review_status,
        v_result_status,
        nullif(btrim(p_note), ''),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      if p_decision in (
        'request_changes',
        'approve'
      ) then
        select coalesce(max(event_row.event_number), 0) + 1
        into v_lifecycle_event_number
        from editorial.resource_lifecycle_events event_row
        where event_row.resource_id = v_binding.resource_id;

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
          v_binding.resource_id,
          v_lifecycle_event_number,
          v_action,
          case
            when p_decision = 'approve'
              then v_result_version_id
            else v_submitted.id
          end,
          coalesce(v_lifecycle_status, 'ready_for_review'),
          v_result_status,
          nullif(btrim(p_note), ''),
          jsonb_build_object(
            'publication_id', p_publication_id,
            'submitted_version_id', v_submitted.id
          ),
          v_actor,
          v_begin.command_receipt_id,
          v_correlation_id
        );
      end if;

      if p_decision = 'approve' then
        update editorial.resources resource_row
        set
          current_approved_version_id = v_result_version_id,
          updated_at = now()
        where resource_row.id = v_binding.resource_id;
      elsif p_decision = 'request_changes' then
        update editorial.resources resource_row
        set
          current_approved_version_id = null,
          updated_at = now()
        where resource_row.id = v_binding.resource_id;
      end if;

      update video.publications publication
      set
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision', v_publication.authority_revision,
        'submitted_version_id', v_submitted.id,
        'version_id', v_result_version_id,
        'version_number', v_result_version_number,
        'lifecycle_status', v_result_status,
        'decision', p_decision,
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
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Publish exact approved Video version.
-- ---------------------------------------------------------------------------

create or replace function public.publish_video_publication_version(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_approved_version_id uuid,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
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
  'platform_private',
  'video',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_approved video.publication_versions%rowtype;
  v_published record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_current_fingerprint text;
  v_event_number bigint;
  v_prior_status text;
  v_correlation_id uuid :=
    coalesce(p_correlation_id, extensions.gen_random_uuid());
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Video publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Video publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if v_resource.lifecycle_state = 'archived' then
    raise exception 'Archived Video publication cannot be published';
  end if;

  if not editorial.current_user_can_publish_video(
    v_binding.resource_id
  ) then
    raise exception 'Video publication permission is required';
  end if;

  select approved.*
  into v_approved
  from video.publication_versions approved
  where approved.id = p_approved_version_id
    and approved.resource_id = v_binding.resource_id
    and approved.publication_id = p_publication_id
    and approved.version_kind = 'approved';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.publish',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'approved_version_id', p_approved_version_id,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
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
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  v_current_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_publication_revision_changed',
      'The Video publication changed before it could be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision
      )
    );
  elsif v_resource.current_approved_version_id
          is distinct from p_approved_version_id
        or v_approved.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_publication_not_publishable',
      'Only the exact current approved Video version can be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'current_approved_version_id',
          v_resource.current_approved_version_id
      )
    );
  elsif v_approved.content_fingerprint
          is distinct from v_current_fingerprint
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_approved_version_stale',
      'The Video publication changed after approval and must be reviewed again.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'approved_content_fingerprint',
          v_approved.content_fingerprint,
        'current_content_fingerprint',
          v_current_fingerprint
      )
    );
  else
    begin
      perform video.assert_publishable_publication_version(
        v_approved.id
      );
    exception
      when raise_exception then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'video_publication_media_not_publishable',
          'The approved Video source or Media is no longer cleared for public delivery.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'approved_version_id', v_approved.id
          )
        );
    end;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      select *
      into v_published
      from video.copy_publication_version_snapshot(
        v_approved.id,
        'published',
        v_actor
      );

      select coalesce(max(event_row.event_number), 0) + 1
      into v_event_number
      from editorial.resource_lifecycle_events event_row
      where event_row.resource_id = v_binding.resource_id;

      select event_row.resulting_status
      into v_prior_status
      from editorial.resource_lifecycle_events event_row
      where event_row.resource_id = v_binding.resource_id
      order by event_row.event_number desc
      limit 1;

      update editorial.resources resource_row
      set
        current_published_version_id = v_published.version_id,
        lifecycle_state = 'published',
        visibility = 'public',
        updated_at = now()
      where resource_row.id = v_binding.resource_id;

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
        v_binding.resource_id,
        v_event_number,
        'published',
        v_published.version_id,
        coalesce(v_prior_status, 'approved'),
        'published',
        nullif(btrim(p_note), ''),
        jsonb_build_object(
          'publication_id', p_publication_id,
          'approved_version_id', v_approved.id,
          'prior_published_version_id',
            v_resource.current_published_version_id
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      update video.publications publication
      set
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision', v_publication.authority_revision,
        'approved_version_id', v_approved.id,
        'version_id', v_published.version_id,
        'version_number', v_published.version_number,
        'prior_published_version_id',
          v_resource.current_published_version_id,
        'lifecycle_status', 'published',
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
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Public RPC boundary.
-- ---------------------------------------------------------------------------

revoke execute
  on function public.snapshot_video_publication_working_version(
       uuid, bigint, text, uuid
     ),
     public.submit_video_publication_for_review(
       uuid, bigint, text, text, uuid
     ),
     public.review_video_publication(
       uuid, bigint, uuid, text, text, text, uuid
     ),
     public.publish_video_publication_version(
       uuid, bigint, uuid, text, text, uuid
     )
  from public, anon;

grant execute
  on function public.snapshot_video_publication_working_version(
       uuid, bigint, text, uuid
     ),
     public.submit_video_publication_for_review(
       uuid, bigint, text, text, uuid
     ),
     public.review_video_publication(
       uuid, bigint, uuid, text, text, text, uuid
     ),
     public.publish_video_publication_version(
       uuid, bigint, uuid, text, text, uuid
     )
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Migration-local structural proof.
-- ---------------------------------------------------------------------------

do $phase_7a_k4b_proof$
declare
  v_definition text;
begin
  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'video'
      and column_row.table_name = 'publications'
      and column_row.column_name in (
        'status',
        'lifecycle_status',
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4B renewed mutable Video lifecycle duplication.';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4B created forbidden typed Video event authority.';
  end if;

  if (
    select count(*)
    from platform_private.command_types command_type
    where command_type.command_type in (
      'video.publication.version.snapshot_working',
      'video.publication.review.submit',
      'video.publication.review.decide',
      'video.publication.publish'
    )
      and command_type.enabled
  ) <> 4 then
    raise exception
      'STOP: K4B Video lifecycle command vocabulary is incomplete.';
  end if;

  select pg_get_functiondef(
    'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.resource_review_events' in v_definition) = 0
     or position('current_submitted_version_id' in v_definition) = 0
  then
    raise exception
      'STOP: Video submit does not consume shared lifecycle/review authority.';
  end if;

  select pg_get_functiondef(
    'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('current_submitted_version_id' in v_definition) = 0
     or position('current_approved_version_id' in v_definition) = 0
     or position('editorial.resource_review_events' in v_definition) = 0
  then
    raise exception
      'STOP: Video review does not bind exact shared Resource lifecycle identity.';
  end if;

  select pg_get_functiondef(
    'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('current_approved_version_id' in v_definition) = 0
     or position('current_published_version_id' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
  then
    raise exception
      'STOP: Video publish does not consume canonical shared publication position/history.';
  end if;

  if has_function_privilege(
       'anon',
       'public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: anonymous Video lifecycle mutation authority leaked.';
  end if;
end;
$phase_7a_k4b_proof$;
