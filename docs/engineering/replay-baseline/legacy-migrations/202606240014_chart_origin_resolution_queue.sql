create table if not exists public.chart_origin_resolution_audit (
  id uuid primary key default gen_random_uuid(),
  run_id text,
  candidate_id text,
  artist_id uuid,
  source_slug text,
  previous_origin_iso2 text,
  new_origin_iso2 text,
  action text not null check (action in ('set_origin', 'create_artist_shell')),
  note text,
  actor_user_id text,
  created_at timestamptz not null default now()
);

create or replace function public.chart_get_run_origin_review_queue(
  p_run_id text
)
returns table (
  review_key text,
  issue_type text,
  source_slug text,
  source_name text,
  canonical_artist_id uuid,
  canonical_slug text,
  canonical_name text,
  current_origin_iso2 text,
  target_iso2 text,
  impacted_candidate_count integer,
  top_score numeric,
  examples jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with run_row as (
    select
      r.id,
      upper(coalesce(
        nullif((r.market_scope_snapshot_json->'artistOriginCountries'->>0), ''),
        nullif((r.market_scope_snapshot_json->'includedMarkets'->0->>'countryCode'), ''),
        nullif(r.market_slug, ''),
        'KE'
      )) as target_iso2
    from public.chart_ingest_runs r
    where r.id::text = p_run_id
    limit 1
  ),
  candidate_scope as (
    select
      c.id,
      c.run_id,
      c.title,
      c.artist_display,
      c.status,
      coalesce(cs.final_score, 0)::numeric as final_score,
      e.reason_code,
      e.reason_label
    from public.chart_ingest_candidates c
    join run_row rr on rr.id::text = c.run_id::text
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text = c.run_id::text
     and cs.candidate_id::text = c.id::text
    left join public.chart_ingest_exclusions e
      on e.candidate_id::text = c.id::text
     and e.run_id::text = c.run_id::text
     and e.reason_code in ('country_mismatch', 'missing_artist_country')
    where c.run_id::text = p_run_id
      and (
        c.status in ('eligible', 'excluded', 'needs_review')
        or e.id is not null
      )
  ),
  tokens as (
    select
      c.id as candidate_id,
      c.title,
      c.artist_display,
      c.status,
      c.final_score,
      c.reason_code,
      c.reason_label,
      t.token_slug
    from candidate_scope c
    cross join lateral public.chart_entry_artist_token_slugs(null, c.artist_display) t
  ),
  resolved as (
    select
      t.*,
      coalesce(alias_artist.id, direct_artist.id) as artist_id,
      coalesce(alias_artist.slug, direct_artist.slug) as canonical_slug,
      coalesce(alias_artist.display_name, direct_artist.display_name) as canonical_name,
      coalesce(alias_artist.origin_iso2, direct_artist.origin_iso2) as origin_iso2,
      case
        when alias_artist.id is not null then 'alias'
        when direct_artist.id is not null then 'direct'
        else 'unresolved'
      end as resolved_via
    from tokens t
    left join public.registry_artist_aliases a
      on lower(a.alias_slug) = t.token_slug
     and coalesce(a.status, 'active') = 'active'
    left join public.registry_artists alias_artist
      on alias_artist.id = a.canonical_artist_id
     and alias_artist.status = 'active'
    left join public.registry_artists direct_artist
      on lower(direct_artist.slug) = t.token_slug
     and direct_artist.status = 'active'
  ),
  candidate_country_state as (
    select
      r.candidate_id,
      count(*) filter (
        where upper(coalesce(r.origin_iso2, '')) = rr.target_iso2
      ) as matching_origin_count
    from resolved r
    cross join run_row rr
    group by r.candidate_id
  ),
  blocked_artists as (
    select
      r.*,
      rr.target_iso2,
      case
        when r.artist_id is null then 'unresolved_artist'
        when nullif(r.origin_iso2, '') is null then 'missing_origin'
        when upper(r.origin_iso2) <> rr.target_iso2 then 'country_mismatch'
        else 'unknown'
      end as issue_type
    from resolved r
    cross join run_row rr
    join candidate_country_state ccs
      on ccs.candidate_id = r.candidate_id
    where coalesce(ccs.matching_origin_count, 0) = 0
  ),
  grouped as (
    select
      case
        when artist_id is not null then 'artist:' || artist_id::text
        else 'token:' || token_slug
      end as review_key,
      issue_type,
      token_slug as source_slug,
      initcap(replace(token_slug, '-', ' ')) as source_name,
      artist_id as canonical_artist_id,
      canonical_slug,
      canonical_name,
      origin_iso2 as current_origin_iso2,
      target_iso2,
      count(distinct candidate_id)::integer as impacted_candidate_count,
      max(final_score) as top_score,
      jsonb_agg(
        distinct jsonb_build_object(
          'candidateId', candidate_id,
          'title', title,
          'artistDisplay', artist_display,
          'finalScore', final_score,
          'candidateStatus', status,
          'reasonCode', reason_code,
          'reasonLabel', reason_label,
          'resolvedVia', resolved_via
        )
      ) as examples
    from blocked_artists
    where issue_type in ('unresolved_artist', 'missing_origin', 'country_mismatch')
    group by
      review_key,
      issue_type,
      token_slug,
      artist_id,
      canonical_slug,
      canonical_name,
      origin_iso2,
      target_iso2
  )
  select *
  from grouped
  order by
    case issue_type
      when 'missing_origin' then 1
      when 'unresolved_artist' then 2
      when 'country_mismatch' then 3
      else 9
    end,
    top_score desc nulls last,
    impacted_candidate_count desc;
$$;

create or replace function public.chart_set_artist_origin_for_charts(
  p_artist_id uuid,
  p_origin_iso2 text,
  p_run_id text default null,
  p_candidate_id text default null,
  p_note text default null,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist record;
  v_origin text;
begin
  v_origin := upper(nullif(trim(p_origin_iso2), ''));

  if v_origin is null or length(v_origin) <> 2 then
    raise exception 'invalid_origin_iso2';
  end if;

  select id, slug, display_name, origin_iso2
  into v_artist
  from public.registry_artists
  where id = p_artist_id
  limit 1;

  if v_artist.id is null then
    raise exception 'artist_not_found';
  end if;

  update public.registry_artists
  set
    origin_iso2 = v_origin,
    origin_confidence = 1,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'origin_resolution_source', 'chart_origin_queue',
        'origin_resolution_run_id', p_run_id,
        'origin_resolution_note', p_note,
        'origin_resolution_at', now()
      ),
    updated_at = now()
  where id = p_artist_id;

  insert into public.chart_origin_resolution_audit (
    run_id,
    candidate_id,
    artist_id,
    source_slug,
    previous_origin_iso2,
    new_origin_iso2,
    action,
    note,
    actor_user_id
  )
  values (
    p_run_id,
    p_candidate_id,
    p_artist_id,
    v_artist.slug,
    v_artist.origin_iso2,
    v_origin,
    'set_origin',
    p_note,
    p_actor_user_id
  );

  return jsonb_build_object(
    'artistId', p_artist_id,
    'artistSlug', v_artist.slug,
    'artistName', v_artist.display_name,
    'previousOriginIso2', v_artist.origin_iso2,
    'newOriginIso2', v_origin
  );
end;
$$;

create or replace function public.chart_create_artist_origin_shell(
  p_artist_name text,
  p_origin_iso2 text,
  p_run_id text default null,
  p_candidate_id text default null,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  v_origin text;
  v_artist record;
begin
  v_name := nullif(trim(p_artist_name), '');
  v_origin := upper(nullif(trim(p_origin_iso2), ''));

  if v_name is null then
    raise exception 'artist_name_required';
  end if;

  if v_origin is null or length(v_origin) <> 2 then
    raise exception 'invalid_origin_iso2';
  end if;

  v_slug := public.wk_slugify_text(v_name);

  select id, slug, display_name, origin_iso2
  into v_artist
  from public.registry_artists
  where lower(slug) = v_slug
  limit 1;

  if v_artist.id is null then
    insert into public.registry_artists (
      slug,
      display_name,
      normalized_name,
      sort_name,
      artist_type,
      origin_iso2,
      origin_confidence,
      status,
      metadata
    )
    values (
      v_slug,
      v_name,
      lower(v_name),
      v_name,
      'unknown',
      v_origin,
      1,
      'active',
      jsonb_build_object(
        'created_from', 'chart_origin_queue',
        'origin_resolution_run_id', p_run_id,
        'origin_resolution_at', now()
      )
    )
    returning id, slug, display_name, origin_iso2
    into v_artist;
  else
    update public.registry_artists
    set
      origin_iso2 = coalesce(nullif(origin_iso2, ''), v_origin),
      origin_confidence = coalesce(origin_confidence, 1),
      status = case when status = 'archived' then 'active' else status end,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'origin_resolution_source', 'chart_origin_queue',
          'origin_resolution_run_id', p_run_id,
          'origin_resolution_at', now()
        ),
      updated_at = now()
    where id = v_artist.id
    returning id, slug, display_name, origin_iso2
    into v_artist;
  end if;

  insert into public.chart_origin_resolution_audit (
    run_id,
    candidate_id,
    artist_id,
    source_slug,
    previous_origin_iso2,
    new_origin_iso2,
    action,
    note,
    actor_user_id
  )
  values (
    p_run_id,
    p_candidate_id,
    v_artist.id,
    v_artist.slug,
    null,
    v_origin,
    'create_artist_shell',
    'Created or activated from chart origin queue.',
    p_actor_user_id
  );

  return jsonb_build_object(
    'artistId', v_artist.id,
    'artistSlug', v_artist.slug,
    'artistName', v_artist.display_name,
    'originIso2', v_artist.origin_iso2
  );
end;
$$;

grant select, insert on public.chart_origin_resolution_audit to service_role;
grant execute on function public.chart_get_run_origin_review_queue(text) to service_role;
grant execute on function public.chart_set_artist_origin_for_charts(uuid, text, text, text, text, text) to service_role;
grant execute on function public.chart_create_artist_origin_shell(text, text, text, text, text) to service_role;
