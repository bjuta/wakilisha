-- Artist credit decoupling tools for bad combined artist entities.
-- Example: split a single "Bien - Alikiba" registry artist into distinct Bien and Alikiba credits
-- while preserving the track/release/chart relationships that were attached to the bad source entity.

create or replace function public.admin_get_artist_decouple_preview(
  p_source_artist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source record;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_source
  from public.registry_artists
  where id = p_source_artist_id
    and status in ('active', 'draft', 'needs_review', 'archived')
  limit 1;

  if v_source.id is null then
    raise exception 'source_artist_not_found';
  end if;

  return jsonb_build_object(
    'sourceArtist', jsonb_build_object(
      'artist_id', v_source.id,
      'artist_slug', v_source.slug,
      'display_name', v_source.display_name,
      'status', v_source.status,
      'origin_iso2', v_source.origin_iso2,
      'public_image_url', v_source.public_image_url
    ),
    'trackCredits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'credit_id', rta.id,
          'track_id', rta.track_id,
          'track_slug', rt.slug,
          'track_title', rt.title,
          'release_title', rr.title,
          'role', rta.role,
          'is_primary', rta.is_primary,
          'is_featured', rta.is_featured,
          'credit_order', rta.credit_order,
          'display_credit', rta.display_credit,
          'status', rta.status
        )
        order by rt.title asc, rta.credit_order asc, rta.id asc
      )
      from public.registry_track_artists rta
      left join public.registry_tracks rt on rt.id = rta.track_id
      left join public.registry_releases rr on rr.id = rt.release_id
      where (
          rta.artist_id = v_source.id
          or lower(coalesce(rta.artist_slug, '')) = lower(v_source.slug)
        )
        and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
    ), '[]'::jsonb),
    'releaseCredits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'credit_id', rra.id,
          'release_id', rra.release_id,
          'release_slug', rr.slug,
          'release_title', rr.title,
          'role', rra.role,
          'is_primary', rra.is_primary,
          'is_featured', rra.is_featured,
          'credit_order', rra.credit_order,
          'display_credit', rra.display_credit,
          'status', rra.status
        )
        order by rr.title asc, rra.credit_order asc, rra.id asc
      )
      from public.registry_release_artists rra
      left join public.registry_releases rr on rr.id = rra.release_id
      where (
          rra.artist_id = v_source.id
          or lower(coalesce(rra.artist_slug, '')) = lower(v_source.slug)
        )
        and coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review')
    ), '[]'::jsonb),
    'chartEntries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entry_id', ce.id,
          'track_id', ce.track_id,
          'track_slug', ce.track_slug,
          'track_title', ce.track_title,
          'artist_name', ce.artist_name,
          'artist_slug', ce.artist_slug,
          'rank', ce.rank
        )
        order by ce.track_title asc, ce.rank asc, ce.id asc
      )
      from public.wk_chart_entries_v2 ce
      where public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.slug)
         or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_create_registry_artist_for_decouple(
  p_display_name text,
  p_slug text default null,
  p_status text default 'needs_review',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_slug text;
  v_status text;
  v_artist record;
  v_created boolean := false;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_display_name is null then
    raise exception 'display_name_required';
  end if;

  v_slug := public.wk_slugify_text(coalesce(nullif(trim(p_slug), ''), v_display_name));
  if v_slug = '' then
    raise exception 'artist_slug_required';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'needs_review');
  if v_status not in ('active', 'draft', 'needs_review') then
    raise exception 'invalid_artist_status';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url
  into v_artist
  from public.registry_artists
  where lower(slug) = lower(v_slug)
  limit 1;

  if v_artist.id is null then
    insert into public.registry_artists (
      slug,
      display_name,
      normalized_name,
      sort_name,
      status,
      metadata
    )
    values (
      v_slug,
      v_display_name,
      lower(regexp_replace(v_display_name, '\s+', ' ', 'g')),
      v_display_name,
      v_status,
      jsonb_build_object(
        'created_for', 'artist_decouple',
        'created_from_admin_decouple', true,
        'decouple_note', p_note,
        'created_at', now()
      )
    )
    returning id, slug, display_name, status, origin_iso2, public_image_url
    into v_artist;

    v_created := true;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'artist', jsonb_build_object(
      'artist_id', v_artist.id,
      'artist_slug', v_artist.slug,
      'display_name', v_artist.display_name,
      'status', v_artist.status,
      'origin_iso2', v_artist.origin_iso2,
      'public_image_url', v_artist.public_image_url,
      'track_credit_count', 0,
      'release_credit_count', 0
    )
  );
end;
$$;

create or replace function public.admin_decouple_registry_artist(
  p_source_artist_id uuid,
  p_replacements jsonb,
  p_note text default null,
  p_archive_source boolean default true,
  p_chart_primary_artist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source record;
  v_chart_artist record;
  v_replacement_count integer := 0;
  v_track_inserted integer := 0;
  v_track_archived integer := 0;
  v_release_inserted integer := 0;
  v_release_archived integer := 0;
  v_chart_rows_v2 integer := 0;
  v_chart_rows_runtime integer := 0;
  v_track_meta_rows integer := 0;
  v_alias_blocked_rows integer := 0;
  v_source_archived boolean := false;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_source_artist_id is null then
    raise exception 'source_artist_required';
  end if;

  if jsonb_typeof(coalesce(p_replacements, 'null'::jsonb)) <> 'array' then
    raise exception 'replacement_artists_required';
  end if;

  select id, slug, display_name, status, origin_iso2, public_image_url, metadata
  into v_source
  from public.registry_artists
  where id = p_source_artist_id
    and status in ('active', 'draft', 'needs_review', 'archived')
  limit 1;

  if v_source.id is null then
    raise exception 'source_artist_not_found';
  end if;

  create temporary table if not exists pg_temp.admin_artist_decouple_replacements (
    artist_id uuid primary key,
    role text not null,
    is_primary boolean not null,
    is_featured boolean not null,
    credit_order integer not null,
    display_credit text
  ) on commit drop;

  truncate table pg_temp.admin_artist_decouple_replacements;

  insert into pg_temp.admin_artist_decouple_replacements (
    artist_id,
    role,
    is_primary,
    is_featured,
    credit_order,
    display_credit
  )
  select distinct on ((item.value->>'artist_id')::uuid)
    (item.value->>'artist_id')::uuid,
    coalesce(
      nullif(item.value->>'role', ''),
      case
        when lower(coalesce(item.value->>'is_featured', 'false')) in ('true', '1', 'yes') then 'featured_artist'
        else 'primary_artist'
      end
    ) as role,
    lower(coalesce(item.value->>'is_primary', 'false')) in ('true', '1', 'yes') as is_primary,
    lower(coalesce(item.value->>'is_featured', 'false')) in ('true', '1', 'yes') as is_featured,
    coalesce(nullif(item.value->>'credit_order', '')::integer, item.ordinality::integer) as credit_order,
    nullif(item.value->>'display_credit', '') as display_credit
  from jsonb_array_elements(p_replacements) with ordinality as item(value, ordinality)
  where nullif(item.value->>'artist_id', '') is not null
  order by (item.value->>'artist_id')::uuid, item.ordinality;

  select count(*) into v_replacement_count from pg_temp.admin_artist_decouple_replacements;

  if v_replacement_count < 2 then
    raise exception 'at_least_two_replacement_artists_required';
  end if;

  if exists (
    select 1
    from pg_temp.admin_artist_decouple_replacements r
    where r.artist_id = v_source.id
  ) then
    raise exception 'source_artist_cannot_be_a_replacement';
  end if;

  if exists (
    select 1
    from pg_temp.admin_artist_decouple_replacements r
    left join public.registry_artists a
      on a.id = r.artist_id
     and a.status in ('active', 'draft', 'needs_review')
    where a.id is null
  ) then
    raise exception 'replacement_artist_not_found';
  end if;

  if exists (
    select 1
    from pg_temp.admin_artist_decouple_replacements r
    where r.role not in ('primary_artist', 'featured_artist', 'collaborator', 'producer', 'composer', 'remixer', 'group_member', 'unknown')
  ) then
    raise exception 'invalid_replacement_artist_role';
  end if;

  if p_chart_primary_artist_id is not null and not exists (
    select 1
    from pg_temp.admin_artist_decouple_replacements r
    where r.artist_id = p_chart_primary_artist_id
  ) then
    raise exception 'chart_primary_artist_must_be_one_of_the_replacements';
  end if;

  select a.id, a.slug, a.display_name
  into v_chart_artist
  from pg_temp.admin_artist_decouple_replacements r
  join public.registry_artists a on a.id = r.artist_id
  where r.artist_id = coalesce(
    p_chart_primary_artist_id,
    (
      select r2.artist_id
      from pg_temp.admin_artist_decouple_replacements r2
      order by r2.is_primary desc, r2.credit_order asc, r2.artist_id asc
      limit 1
    )
  )
  limit 1;

  if v_chart_artist.id is null then
    raise exception 'chart_primary_artist_not_found';
  end if;

  with source_links as (
    select rta.*
    from public.registry_track_artists rta
    where (
        rta.artist_id = v_source.id
        or lower(coalesce(rta.artist_slug, '')) = lower(v_source.slug)
      )
      and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
  ), replacement_rows as (
    select
      r.artist_id,
      a.slug,
      a.display_name,
      r.role,
      r.is_primary,
      r.is_featured,
      r.credit_order,
      r.display_credit
    from pg_temp.admin_artist_decouple_replacements r
    join public.registry_artists a on a.id = r.artist_id
  ), inserted as (
    insert into public.registry_track_artists (
      track_id,
      artist_id,
      artist_slug,
      artist_name_text,
      role,
      is_primary,
      is_featured,
      credit_order,
      display_credit,
      source,
      confidence,
      status,
      metadata,
      created_at,
      updated_at
    )
    select
      sl.track_id,
      rr.artist_id,
      rr.slug,
      coalesce(rr.display_credit, rr.display_name),
      rr.role,
      rr.is_primary,
      rr.is_featured,
      rr.credit_order,
      coalesce(rr.display_credit, rr.display_name),
      'admin_artist_decouple',
      greatest(coalesce(sl.confidence, 0), 100),
      'active',
      coalesce(sl.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'decoupled_from_artist_id', v_source.id::text,
          'decoupled_from_artist_slug', v_source.slug,
          'decoupled_from_artist_name', v_source.display_name,
          'source_credit_id', sl.id::text,
          'decouple_note', p_note,
          'decoupled_at', now()
        ),
      now(),
      now()
    from source_links sl
    cross join replacement_rows rr
    where sl.track_id is not null
      and not exists (
        select 1
        from public.registry_track_artists existing
        where existing.track_id = sl.track_id
          and existing.artist_id = rr.artist_id
          and existing.role = rr.role
          and existing.credit_order = rr.credit_order
          and coalesce(existing.status, 'shadow') in ('shadow', 'active', 'needs_review')
      )
    returning 1
  )
  select count(*) into v_track_inserted from inserted;

  update public.registry_track_artists rta
  set
    status = 'archived',
    metadata = coalesce(rta.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_by_artist_decouple', true,
        'decoupled_to_artist_ids', (
          select jsonb_agg(r.artist_id::text order by r.credit_order, r.artist_id)
          from pg_temp.admin_artist_decouple_replacements r
        ),
        'decouple_note', p_note,
        'decoupled_at', now()
      ),
    updated_at = now()
  where (
      rta.artist_id = v_source.id
      or lower(coalesce(rta.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review');

  get diagnostics v_track_archived = row_count;

  with source_links as (
    select rra.*
    from public.registry_release_artists rra
    where (
        rra.artist_id = v_source.id
        or lower(coalesce(rra.artist_slug, '')) = lower(v_source.slug)
      )
      and coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review')
  ), replacement_rows as (
    select
      r.artist_id,
      a.slug,
      a.display_name,
      r.role,
      r.is_primary,
      r.is_featured,
      r.credit_order,
      r.display_credit
    from pg_temp.admin_artist_decouple_replacements r
    join public.registry_artists a on a.id = r.artist_id
  ), inserted as (
    insert into public.registry_release_artists (
      release_id,
      artist_id,
      artist_slug,
      artist_name_text,
      role,
      is_primary,
      is_featured,
      credit_order,
      display_credit,
      source,
      confidence,
      status,
      metadata,
      created_at,
      updated_at
    )
    select
      sl.release_id,
      rr.artist_id,
      rr.slug,
      coalesce(rr.display_credit, rr.display_name),
      rr.role,
      rr.is_primary,
      rr.is_featured,
      rr.credit_order,
      coalesce(rr.display_credit, rr.display_name),
      'admin_artist_decouple',
      greatest(coalesce(sl.confidence, 0), 100),
      'active',
      coalesce(sl.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'decoupled_from_artist_id', v_source.id::text,
          'decoupled_from_artist_slug', v_source.slug,
          'decoupled_from_artist_name', v_source.display_name,
          'source_credit_id', sl.id::text,
          'decouple_note', p_note,
          'decoupled_at', now()
        ),
      now(),
      now()
    from source_links sl
    cross join replacement_rows rr
    where sl.release_id is not null
      and not exists (
        select 1
        from public.registry_release_artists existing
        where existing.release_id = sl.release_id
          and existing.artist_id = rr.artist_id
          and existing.role = rr.role
          and existing.credit_order = rr.credit_order
          and coalesce(existing.status, 'shadow') in ('shadow', 'active', 'needs_review')
      )
    returning 1
  )
  select count(*) into v_release_inserted from inserted;

  update public.registry_release_artists rra
  set
    status = 'archived',
    metadata = coalesce(rra.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_by_artist_decouple', true,
        'decoupled_to_artist_ids', (
          select jsonb_agg(r.artist_id::text order by r.credit_order, r.artist_id)
          from pg_temp.admin_artist_decouple_replacements r
        ),
        'decouple_note', p_note,
        'decoupled_at', now()
      ),
    updated_at = now()
  where (
      rra.artist_id = v_source.id
      or lower(coalesce(rra.artist_slug, '')) = lower(v_source.slug)
    )
    and coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review');

  get diagnostics v_release_archived = row_count;

  update public.wk_chart_entries_v2 ce
  set
    artist_slug = v_chart_artist.slug,
    artist_name = v_chart_artist.display_name,
    updated_at = now()
  where public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name);

  get diagnostics v_chart_rows_v2 = row_count;

  update public.chart_entries ce
  set
    artist_slug = v_chart_artist.slug,
    artist_name = v_chart_artist.display_name
  where public.wk_slugify_text(coalesce(ce.artist_slug, '')) = public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(ce.artist_name, '')) = public.wk_slugify_text(v_source.display_name);

  get diagnostics v_chart_rows_runtime = row_count;

  update public.registry_tracks rt
  set
    metadata = jsonb_set(
      coalesce(rt.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'decoupled_artist_slugs', (
            select jsonb_agg(a.slug order by r.credit_order, a.slug)
            from pg_temp.admin_artist_decouple_replacements r
            join public.registry_artists a on a.id = r.artist_id
          ),
          'decoupled_from_artist_slug', v_source.slug,
          'decouple_note', p_note,
          'decoupled_at', now()
        ),
      '{primary_artist_slug}',
      to_jsonb(v_chart_artist.slug),
      true
    ),
    updated_at = now()
  where exists (
      select 1
      from public.registry_track_artists archived_source
      where archived_source.track_id = rt.id
        and (
          archived_source.artist_id = v_source.id
          or lower(coalesce(archived_source.artist_slug, '')) = lower(v_source.slug)
        )
        and coalesce(archived_source.metadata->>'archived_by_artist_decouple', 'false') = 'true'
    )
    and (
      public.wk_slugify_text(coalesce(rt.metadata->>'primary_artist_slug', '')) = public.wk_slugify_text(v_source.slug)
      or public.wk_slugify_text(coalesce(rt.metadata->>'artist_slug', '')) = public.wk_slugify_text(v_source.slug)
    );

  get diagnostics v_track_meta_rows = row_count;

  update public.registry_artist_aliases a
  set
    status = 'blocked',
    notes = coalesce(nullif(p_note, ''), notes, 'Blocked because this alias slug represents a split artist credit, not one canonical artist.')
  where lower(a.alias_slug) = lower(v_source.slug)
    and coalesce(a.status, 'active') = 'active';

  get diagnostics v_alias_blocked_rows = row_count;

  update public.registry_artists a
  set
    metadata = coalesce(a.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'decoupled_from_combined_artist_id', v_source.id::text,
        'decoupled_from_combined_artist_slug', v_source.slug,
        'decoupled_from_combined_artist_name', v_source.display_name,
        'decoupled_at', now(),
        'decouple_note', p_note
      ),
    updated_at = now()
  from pg_temp.admin_artist_decouple_replacements r
  where a.id = r.artist_id;

  if p_archive_source then
    update public.registry_artists
    set
      status = 'archived',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'archived_by_artist_decouple', true,
          'decoupled_to_artist_ids', (
            select jsonb_agg(r.artist_id::text order by r.credit_order, r.artist_id)
            from pg_temp.admin_artist_decouple_replacements r
          ),
          'chart_primary_artist_id', v_chart_artist.id::text,
          'chart_primary_artist_slug', v_chart_artist.slug,
          'decouple_note', p_note,
          'decoupled_at', now()
        ),
      updated_at = now()
    where id = v_source.id;

    v_source_archived := true;
  else
    update public.registry_artists
    set
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'decoupled_but_not_archived', true,
          'decoupled_to_artist_ids', (
            select jsonb_agg(r.artist_id::text order by r.credit_order, r.artist_id)
            from pg_temp.admin_artist_decouple_replacements r
          ),
          'chart_primary_artist_id', v_chart_artist.id::text,
          'chart_primary_artist_slug', v_chart_artist.slug,
          'decouple_note', p_note,
          'decoupled_at', now()
        ),
      updated_at = now()
    where id = v_source.id;
  end if;

  insert into public.registry_audit_log (
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  )
  values (
    'admin',
    'artist_credit_decoupled',
    'registry_artist',
    v_source.id,
    jsonb_build_object(
      'source_artist_id', v_source.id,
      'source_artist_slug', v_source.slug,
      'source_artist_name', v_source.display_name
    ),
    jsonb_build_object(
      'replacement_artist_ids', (
        select jsonb_agg(r.artist_id::text order by r.credit_order, r.artist_id)
        from pg_temp.admin_artist_decouple_replacements r
      ),
      'chart_primary_artist_id', v_chart_artist.id,
      'chart_primary_artist_slug', v_chart_artist.slug
    ),
    jsonb_build_object(
      'note', p_note,
      'trackCreditsInserted', v_track_inserted,
      'trackCreditsArchived', v_track_archived,
      'releaseCreditsInserted', v_release_inserted,
      'releaseCreditsArchived', v_release_archived,
      'chartEntriesV2Updated', v_chart_rows_v2,
      'chartEntriesRuntimeUpdated', v_chart_rows_runtime,
      'sourceArchived', v_source_archived
    )
  );

  return jsonb_build_object(
    'sourceArtistId', v_source.id,
    'sourceSlug', v_source.slug,
    'sourceName', v_source.display_name,
    'replacementCount', v_replacement_count,
    'chartPrimaryArtistId', v_chart_artist.id,
    'chartPrimarySlug', v_chart_artist.slug,
    'chartPrimaryName', v_chart_artist.display_name,
    'trackCreditsInserted', v_track_inserted,
    'trackCreditsArchived', v_track_archived,
    'releaseCreditsInserted', v_release_inserted,
    'releaseCreditsArchived', v_release_archived,
    'chartEntriesV2Updated', v_chart_rows_v2,
    'chartEntriesRuntimeUpdated', v_chart_rows_runtime,
    'trackMetadataRowsUpdated', v_track_meta_rows,
    'aliasRowsBlocked', v_alias_blocked_rows,
    'sourceArchived', v_source_archived
  );
end;
$$;

grant execute on function public.admin_get_artist_decouple_preview(uuid) to authenticated;
grant execute on function public.admin_create_registry_artist_for_decouple(text, text, text, text) to authenticated;
grant execute on function public.admin_decouple_registry_artist(uuid, jsonb, text, boolean, uuid) to authenticated;
