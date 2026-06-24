create or replace function public.chart_entry_artist_token_slugs(
  p_artist_slug text,
  p_artist_name text
)
returns table(token_slug text)
language sql
stable
as $$
  with raw_tokens as (
    select unnest(string_to_array(coalesce(p_artist_slug, ''), ',')) as token
    union all
    select regexp_split_to_table(
      coalesce(p_artist_name, ''),
      '\s*(,|&|\bx\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b)\s*'
    ) as token
  ),
  normalized as (
    select public.wk_slugify_text(token) as token_slug
    from raw_tokens
  )
  select distinct token_slug
  from normalized
  where token_slug <> '';
$$;

create or replace function public.chart_get_edition_integrity_report(
  p_edition_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with edition as (
    select
      e.id,
      e.program_id,
      e.edition_slug,
      e.status,
      e.entry_count,
      upper(coalesce(nullif(p.market_slug, ''), '')) as target_iso2,
      p.public_slug,
      p.source_family_slug,
      p.market_slug
    from public.wk_chart_editions_v2 e
    join public.wk_chart_programs_v2 p on p.id = e.program_id
    where e.id = p_edition_id
    limit 1
  ),
  entries as (
    select
      ce.id,
      ce.rank,
      ce.track_title,
      ce.artist_name,
      ce.artist_slug,
      ce.track_slug,
      coalesce(ce.total_score, 0)::numeric as total_score
    from public.wk_chart_entries_v2 ce
    join edition e on e.id = ce.edition_id
  ),
  entry_tokens as (
    select
      en.id as entry_id,
      t.token_slug
    from entries en
    cross join lateral public.chart_entry_artist_token_slugs(en.artist_slug, en.artist_name) t
  ),
  token_resolution as (
    select
      et.entry_id,
      et.token_slug,
      coalesce(alias_artist.id, direct_artist.id) as artist_id,
      coalesce(alias_artist.slug, direct_artist.slug) as canonical_slug,
      coalesce(alias_artist.display_name, direct_artist.display_name) as canonical_name,
      coalesce(alias_artist.origin_iso2, direct_artist.origin_iso2) as origin_iso2,
      case
        when alias_artist.id is not null then 'alias'
        when direct_artist.id is not null then 'direct'
        else 'unresolved'
      end as resolved_via
    from entry_tokens et
    left join public.registry_artist_aliases a
      on lower(a.alias_slug) = et.token_slug
     and coalesce(a.status, 'active') = 'active'
    left join public.registry_artists alias_artist
      on alias_artist.id = a.canonical_artist_id
     and alias_artist.status = 'active'
    left join public.registry_artists direct_artist
      on lower(direct_artist.slug) = et.token_slug
     and direct_artist.status = 'active'
  ),
  entry_origin_state as (
    select
      en.id,
      en.rank,
      en.track_title,
      en.artist_name,
      en.artist_slug,
      en.track_slug,
      en.total_score,
      coalesce(count(tr.artist_id) filter (where tr.artist_id is not null), 0) as resolved_artist_count,
      coalesce(count(*) filter (where tr.artist_id is null), 0) as unresolved_artist_count,
      coalesce(count(*) filter (where upper(coalesce(tr.origin_iso2, '')) = ed.target_iso2), 0) as matching_origin_count,
      coalesce(jsonb_agg(
        distinct jsonb_build_object(
          'sourceSlug', tr.token_slug,
          'canonicalSlug', tr.canonical_slug,
          'canonicalName', tr.canonical_name,
          'originIso2', tr.origin_iso2,
          'resolvedVia', tr.resolved_via
        )
      ) filter (where tr.token_slug is not null), '[]'::jsonb) as artists
    from entries en
    cross join edition ed
    left join token_resolution tr on tr.entry_id = en.id
    group by en.id, en.rank, en.track_title, en.artist_name, en.artist_slug, en.track_slug, en.total_score
  ),
  summary as (
    select
      ed.*,
      count(eos.id)::integer as total_entries,
      count(eos.id) filter (where eos.total_score > 0)::integer as scored_entries,
      coalesce(max(eos.total_score), 0)::numeric as max_score,
      count(eos.id) filter (where eos.resolved_artist_count = 0)::integer as unresolved_origin_entries,
      count(eos.id) filter (
        where eos.resolved_artist_count > 0
          and eos.matching_origin_count = 0
      )::integer as country_ineligible_entries
    from edition ed
    left join entry_origin_state eos on true
    group by ed.id, ed.program_id, ed.edition_slug, ed.status, ed.entry_count, ed.target_iso2, ed.public_slug, ed.source_family_slug, ed.market_slug
  ),
  blockers as (
    select
      s.*,
      array_remove(array[
        case when s.total_entries = 0 then 'empty_edition' end,
        case when s.scored_entries = 0 or s.max_score = 0 then 'unscored_edition' end,
        case when s.unresolved_origin_entries > 0 then 'unresolved_artist_origins' end,
        case when s.country_ineligible_entries > 0 then 'country_ineligible_entries' end
      ], null) as blocker_codes
    from summary s
  ),
  invalid_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', eos.id,
        'rank', eos.rank,
        'trackTitle', eos.track_title,
        'artistName', eos.artist_name,
        'artistSlug', eos.artist_slug,
        'trackSlug', eos.track_slug,
        'totalScore', eos.total_score,
        'resolvedArtistCount', eos.resolved_artist_count,
        'matchingOriginCount', eos.matching_origin_count,
        'artists', eos.artists,
        'reason',
          case
            when eos.total_score <= 0 then 'unscored'
            when eos.resolved_artist_count = 0 then 'unresolved_artist_origin'
            when eos.matching_origin_count = 0 then 'no_artist_matches_target_country'
            else 'ok'
          end
      )
      order by eos.rank
    ) filter (
      where eos.total_score <= 0
         or eos.resolved_artist_count = 0
         or eos.matching_origin_count = 0
    ), '[]'::jsonb) as rows
    from entry_origin_state eos
  )
  select jsonb_build_object(
    'editionId', p_edition_id,
    'programSlug', b.public_slug,
    'familySlug', coalesce(b.source_family_slug, b.public_slug),
    'marketSlug', b.market_slug,
    'targetIso2', b.target_iso2,
    'totalEntries', coalesce(b.total_entries, 0),
    'entryCount', coalesce(b.entry_count, 0),
    'scoredEntries', coalesce(b.scored_entries, 0),
    'maxScore', coalesce(b.max_score, 0),
    'unresolvedOriginEntries', coalesce(b.unresolved_origin_entries, 0),
    'countryIneligibleEntries', coalesce(b.country_ineligible_entries, 0),
    'blockers', to_jsonb(coalesce(b.blocker_codes, array[]::text[])),
    'publishable', coalesce(array_length(b.blocker_codes, 1), 0) = 0,
    'invalidRows', invalid_rows.rows
  )
  from blockers b, invalid_rows;
$$;

create or replace function public.chart_assert_publishable_edition(
  p_edition_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_report jsonb;
  v_publishable boolean;
  v_blockers text;
begin
  select public.chart_get_edition_integrity_report(p_edition_id)
  into v_report;

  v_publishable := coalesce((v_report->>'publishable')::boolean, false);

  if not v_publishable then
    v_blockers := coalesce(v_report->>'blockers', '[]');
    raise exception 'publish_blocked_chart_integrity: %', v_report->'blockers'
      using detail = v_report::text;
  end if;

  return v_report;
end;
$$;

create or replace function public.wk_chart_editions_publish_integrity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and old.status is distinct from new.status then
    perform public.chart_assert_publishable_edition(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists wk_chart_editions_publish_integrity_guard_bu on public.wk_chart_editions_v2;

create trigger wk_chart_editions_publish_integrity_guard_bu
before update of status
on public.wk_chart_editions_v2
for each row
execute function public.wk_chart_editions_publish_integrity_guard();

grant execute on function public.chart_get_edition_integrity_report(text) to authenticated;
grant execute on function public.chart_assert_publishable_edition(text) to authenticated;
