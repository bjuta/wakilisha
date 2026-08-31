-- Registry Steward V1: atomic deterministic canonical repairs.
--
-- This migration adds no new review queue. Proven structural repair stays
-- service-owned, collision-safe, redirect-preserving, and receipt-backed.

create or replace function public.registry_steward_apply_track_identity_repair(
  p_track_id uuid,
  p_expected_slug text,
  p_expected_title text,
  p_new_slug text,
  p_new_title text,
  p_new_normalized_title text,
  p_rule_key text,
  p_rule_version text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_track public.registry_tracks%rowtype;
  v_primary_artist_slugs text[];
  v_conflicting_paths bigint;
  v_relationship_rows bigint := 0;
  v_entity_index_rows bigint := 0;
  v_follow_rows bigint := 0;
  v_block_rows bigint := 0;
  v_chart_rows bigint := 0;
  v_row_count bigint := 0;
begin
  if p_track_id is null then
    raise exception 'Track id is required.';
  end if;

  if nullif(btrim(coalesce(p_expected_slug, '')), '') is null
     or nullif(btrim(coalesce(p_new_slug, '')), '') is null
     or nullif(btrim(coalesce(p_expected_title, '')), '') is null
     or nullif(btrim(coalesce(p_new_title, '')), '') is null
     or nullif(btrim(coalesce(p_new_normalized_title, '')), '') is null
  then
    raise exception 'Track identity values must be non-empty.';
  end if;

  if p_new_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Proposed Track slug is malformed: %', p_new_slug;
  end if;

  if nullif(btrim(coalesce(p_rule_key, '')), '') is null
     or nullif(btrim(coalesce(p_rule_version, '')), '') is null
  then
    raise exception 'Registry Steward rule identity is required.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_track_id
  for update;

  if not found then
    raise exception 'Track % does not exist.', p_track_id;
  end if;

  if v_track.status <> 'active' then
    raise exception 'Track % is not active.', p_track_id;
  end if;

  if v_track.slug is distinct from p_expected_slug
     or v_track.title is distinct from p_expected_title
  then
    raise exception
      'Track % changed after Registry Steward audit. Expected slug/title %, %, found %, %.',
      p_track_id,
      p_expected_slug,
      p_expected_title,
      v_track.slug,
      v_track.title;
  end if;

  select array_agg(distinct credit.artist_slug order by credit.artist_slug)
  into v_primary_artist_slugs
  from public.registry_track_artists credit
  where credit.track_id = p_track_id
    and credit.status = 'active'
    and coalesce(credit.is_primary, false)
    and nullif(btrim(credit.artist_slug), '') is not null;

  if coalesce(cardinality(v_primary_artist_slugs), 0) = 0 then
    raise exception
      'Track % has no active primary Artist scope. Automatic repair is not allowed.',
      p_track_id;
  end if;

  if exists (
    select 1
    from public.registry_tracks other_track
    join public.registry_track_artists other_credit
      on other_credit.track_id = other_track.id
     and other_credit.status = 'active'
     and coalesce(other_credit.is_primary, false)
    where other_track.id <> p_track_id
      and other_track.status in ('active', 'draft', 'needs_review')
      and other_track.slug = p_new_slug
      and other_credit.artist_slug = any(v_primary_artist_slugs)
  ) then
    raise exception
      'Automatic repair blocked: proposed Track slug % collides inside a primary Artist scope.',
      p_new_slug;
  end if;

  if p_expected_slug <> p_new_slug then
    select count(*)
    into v_conflicting_paths
    from unnest(v_primary_artist_slugs) primary_artist_slug
    join public.wk_slug_redirects redirect
      on redirect.old_path =
        '/tracks/' || primary_artist_slug || '/' || p_expected_slug
    where redirect.new_path is distinct from
      '/tracks/' || primary_artist_slug || '/' || p_new_slug;

    if v_conflicting_paths <> 0 then
      raise exception
        'Automatic repair blocked: % existing redirect path(s) disagree with the proposed Track route.',
        v_conflicting_paths;
    end if;

    insert into public.wk_slug_redirects (
      old_slug,
      new_slug,
      entity_type,
      created_by,
      scope_slug,
      old_path,
      new_path,
      redirect_status,
      updated_at
    )
    select
      p_expected_slug,
      p_new_slug,
      'track',
      'registry-steward',
      primary_artist_slug,
      '/tracks/' || primary_artist_slug || '/' || p_expected_slug,
      '/tracks/' || primary_artist_slug || '/' || p_new_slug,
      308,
      now()
    from unnest(v_primary_artist_slugs) primary_artist_slug
    on conflict (old_path)
      where old_path is not null
    do nothing;
  end if;

  update public.registry_tracks
  set
    slug = p_new_slug,
    title = p_new_title,
    normalized_title = p_new_normalized_title,
    updated_at = now()
  where id = p_track_id;

  update public.registry_entity_index
  set
    slug = p_new_slug,
    name = p_new_title
  where entity_type = 'track'
    and (
      canonical_source_id = p_track_id
      or entity_id = p_track_id
    );
  get diagnostics v_entity_index_rows = row_count;

  update public.registry_entity_relationships
  set
    source_slug = p_new_slug,
    updated_at = now()
  where source_entity_type = 'track'
    and source_entity_id = p_track_id;
  get diagnostics v_relationship_rows = row_count;

  update public.registry_entity_relationships
  set
    target_slug = p_new_slug,
    updated_at = now()
  where target_entity_type = 'track'
    and (
      target_entity_id = p_track_id
      or (
        target_entity_id is null
        and target_slug = p_expected_slug
        and source_entity_type = 'artist'
        and source_slug = any(v_primary_artist_slugs)
      )
    );
  get diagnostics v_row_count = row_count;
  v_relationship_rows := v_relationship_rows + v_row_count;

  update public.community_follows
  set target_slug = p_new_slug
  where target_type = 'track'
    and target_id = p_track_id::text;
  get diagnostics v_follow_rows = row_count;

  update public.community_blocks
  set
    target_slug = p_new_slug,
    updated_at = now()
  where target_type = 'track'
    and target_id = p_track_id::text;
  get diagnostics v_block_rows = row_count;

  update public.wk_chart_entries_v2
  set
    track_slug = p_new_slug,
    track_title = p_new_title,
    updated_at = now()
  where canonical_track_id = p_track_id::text
    and (
      track_slug is distinct from p_new_slug
      or track_title is distinct from p_new_title
    );
  get diagnostics v_chart_rows = row_count;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    error_message,
    actor,
    created_at
  )
  values (
    'track',
    p_track_id::text,
    null,
    'registry_tracks',
    'identity_presentation',
    'registry_tracks.slug,title,normalized_title',
    jsonb_build_object(
      'slug', p_expected_slug,
      'title', p_expected_title
    ),
    jsonb_build_object(
      'slug', p_new_slug,
      'title', p_new_title,
      'normalized_title', p_new_normalized_title,
      'rule_key', p_rule_key,
      'rule_version', p_rule_version,
      'evidence', coalesce(p_evidence, '{}'::jsonb),
      'redirect_scopes', to_jsonb(v_primary_artist_slugs),
      'synced_rows', jsonb_build_object(
        'registry_entity_index', v_entity_index_rows,
        'registry_entity_relationships', v_relationship_rows,
        'community_follows', v_follow_rows,
        'community_blocks', v_block_rows,
        'wk_chart_entries_v2', v_chart_rows
      )
    ),
    'auto_repair',
    'applied',
    null,
    'registry-steward',
    now()
  );

  return jsonb_build_object(
    'track_id', p_track_id,
    'old_slug', p_expected_slug,
    'new_slug', p_new_slug,
    'old_title', p_expected_title,
    'new_title', p_new_title,
    'primary_artist_slugs', to_jsonb(v_primary_artist_slugs),
    'rule_key', p_rule_key,
    'rule_version', p_rule_version,
    'synced_rows', jsonb_build_object(
      'registry_entity_index', v_entity_index_rows,
      'registry_entity_relationships', v_relationship_rows,
      'community_follows', v_follow_rows,
      'community_blocks', v_block_rows,
      'wk_chart_entries_v2', v_chart_rows
    )
  );
end;
$function$;

create or replace function public.registry_steward_sync_chart_batch(
  p_after_id text default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 5000));
  v_updated bigint := 0;
  v_last_id text := null;
begin
  with candidates as (
    select
      entry.id,
      coalesce(track.slug, entry.track_slug) as canonical_track_slug,
      coalesce(track.title, entry.track_title) as canonical_track_title,
      coalesce(artist.slug, entry.artist_slug) as canonical_artist_slug,
      coalesce(artist.display_name, entry.artist_name) as canonical_artist_name
    from public.wk_chart_entries_v2 entry
    left join public.registry_tracks track
      on track.id::text = entry.canonical_track_id
     and track.status = 'active'
    left join public.registry_artists artist
      on artist.id::text = entry.canonical_artist_id
     and artist.status = 'active'
    where (p_after_id is null or entry.id > p_after_id)
      and (
        (
          entry.canonical_track_id is not null
          and track.id is not null
          and (
            entry.track_slug is distinct from track.slug
            or entry.track_title is distinct from track.title
          )
        )
        or (
          entry.canonical_artist_id is not null
          and artist.id is not null
          and (
            entry.artist_slug is distinct from artist.slug
            or entry.artist_name is distinct from artist.display_name
          )
        )
      )
    order by entry.id
    limit v_limit
  ),
  updated as (
    update public.wk_chart_entries_v2 entry
    set
      track_slug = candidate.canonical_track_slug,
      track_title = candidate.canonical_track_title,
      artist_slug = candidate.canonical_artist_slug,
      artist_name = candidate.canonical_artist_name,
      updated_at = now()
    from candidates candidate
    where entry.id = candidate.id
    returning entry.id
  )
  select
    count(*),
    max(id)
  into
    v_updated,
    v_last_id
  from updated;

  if v_updated > 0 then
    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      error_message,
      actor,
      created_at
    )
    values (
      'chart_projection_batch',
      coalesce(v_last_id, 'none'),
      null,
      'wk_chart_entries_v2',
      'canonical_presentation',
      'wk_chart_entries_v2.track_slug,track_title,artist_slug,artist_name',
      jsonb_build_object(
        'after_id', p_after_id,
        'limit', v_limit
      ),
      jsonb_build_object(
        'updated_rows', v_updated,
        'last_id', v_last_id,
        'rule_key', 'chart.canonical_projection.v1',
        'rule_version', '1.0.0',
        'raw_source_preserved_in', 'source_payload'
      ),
      'auto_repair',
      'applied',
      null,
      'registry-steward',
      now()
    );
  end if;

  return jsonb_build_object(
    'updated', v_updated,
    'next_cursor', v_last_id,
    'rule_key', 'chart.canonical_projection.v1',
    'rule_version', '1.0.0'
  );
end;
$function$;

revoke all
  on function public.registry_steward_apply_track_identity_repair(
    uuid, text, text, text, text, text, text, text, jsonb
  )
  from public, anon, authenticated;

revoke all
  on function public.registry_steward_sync_chart_batch(text, integer)
  from public, anon, authenticated;

grant execute
  on function public.registry_steward_apply_track_identity_repair(
    uuid, text, text, text, text, text, text, text, jsonb
  )
  to service_role;

grant execute
  on function public.registry_steward_sync_chart_batch(text, integer)
  to service_role;

do $registry_steward_v1_proof$
begin
  if has_function_privilege(
       'anon',
       'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
       'execute'
     )
  then
    raise exception
      'STOP: Registry Steward Track repair privilege boundary is incorrect';
  end if;

  if has_function_privilege(
       'anon',
       'public.registry_steward_sync_chart_batch(text,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.registry_steward_sync_chart_batch(text,integer)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.registry_steward_sync_chart_batch(text,integer)',
       'execute'
     )
  then
    raise exception
      'STOP: Registry Steward Chart sync privilege boundary is incorrect';
  end if;
end;
$registry_steward_v1_proof$;
