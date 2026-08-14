create or replace function public.chart_get_run_candidate_origin_report(
  p_run_id text
)
returns table (
  candidate_id text,
  normalized_key text,
  title text,
  artist_display text,
  final_score numeric,
  resolved_artist_count integer,
  unresolved_artist_count integer,
  matching_origin_count integer,
  is_country_eligible boolean,
  reason_code text,
  reason_label text,
  artists jsonb
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
  eligible_candidates as (
    select
      c.id,
      c.run_id,
      c.normalized_key,
      c.title,
      c.artist_display
    from public.chart_ingest_candidates c
    join run_row rr on rr.id::text = c.run_id::text
    where c.status = 'eligible'
  ),
  scored as (
    select
      ec.id,
      ec.run_id,
      ec.normalized_key,
      ec.title,
      ec.artist_display,
      coalesce(cs.final_score, 0)::numeric as final_score
    from eligible_candidates ec
    left join public.chart_ingest_candidate_scores cs
      on cs.run_id::text = ec.run_id::text
     and cs.candidate_id::text = ec.id::text
  ),
  tokens as (
    select
      s.id as candidate_id,
      t.token_slug
    from scored s
    cross join lateral public.chart_entry_artist_token_slugs(null, s.artist_display) t
  ),
  resolved as (
    select
      t.candidate_id,
      t.token_slug,
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
  row_state as (
    select
      s.id,
      s.normalized_key,
      s.title,
      s.artist_display,
      s.final_score,
      coalesce(count(r.artist_id) filter (where r.artist_id is not null), 0)::integer as resolved_artist_count,
      coalesce(count(*) filter (where r.artist_id is null), 0)::integer as unresolved_artist_count,
      coalesce(count(*) filter (
        where upper(coalesce(r.origin_iso2, '')) = rr.target_iso2
      ), 0)::integer as matching_origin_count,
      coalesce(jsonb_agg(
        distinct jsonb_build_object(
          'sourceSlug', r.token_slug,
          'canonicalSlug', r.canonical_slug,
          'canonicalName', r.canonical_name,
          'originIso2', r.origin_iso2,
          'resolvedVia', r.resolved_via
        )
      ) filter (where r.token_slug is not null), '[]'::jsonb) as artists
    from scored s
    cross join run_row rr
    left join resolved r on r.candidate_id = s.id
    group by s.id, s.normalized_key, s.title, s.artist_display, s.final_score
  )
  select
    rs.id as candidate_id,
    rs.normalized_key,
    rs.title,
    rs.artist_display,
    rs.final_score,
    rs.resolved_artist_count,
    rs.unresolved_artist_count,
    rs.matching_origin_count,
    rs.matching_origin_count > 0 as is_country_eligible,
    case
      when rs.matching_origin_count > 0 then null
      when rs.resolved_artist_count = 0 then 'missing_artist_country'
      else 'country_mismatch'
    end as reason_code,
    case
      when rs.matching_origin_count > 0 then null
      when rs.resolved_artist_count = 0 then 'No resolved chart artist has a known matching origin.'
      else 'Resolved artists do not match the chart target country.'
    end as reason_label,
    rs.artists
  from row_state rs
  order by rs.final_score desc, rs.normalized_key;
$$;

grant execute on function public.chart_get_run_candidate_origin_report(text) to authenticated, service_role;
