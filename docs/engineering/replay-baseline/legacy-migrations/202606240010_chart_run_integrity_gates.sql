create or replace function public.chart_get_run_integrity_report(
  p_run_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with run_row as (
    select
      r.id,
      r.status,
      r.chart_size,
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
  stage_state as (
    select
      rr.id,
      coalesce(bool_or(se.stage = 'eligibility_execution' and se.status = 'done'), false) as eligibility_done,
      coalesce(bool_or(se.stage = 'methodology_scoring' and se.status = 'done'), false) as scoring_done,
      coalesce(bool_or(se.stage = 'shortlist' and se.status = 'done'), false) as shortlist_done
    from run_row rr
    left join public.chart_ingest_stage_events se
      on se.run_id::text = rr.id::text
    group by rr.id
  ),
  candidates as (
    select
      c.id,
      c.run_id,
      c.normalized_key,
      c.title,
      c.artist_display,
      c.status
    from public.chart_ingest_candidates c
    join run_row rr on c.run_id::text = rr.id::text
  ),
  shortlisted as (
    select *
    from candidates
    where status = 'eligible'
  ),
  scored_shortlist as (
    select
      s.id,
      s.normalized_key,
      s.title,
      s.artist_display,
      coalesce(cs.final_score, 0)::numeric as final_score
    from shortlisted s
    left join public.chart_ingest_candidate_scores cs
      on cs.candidate_id::text = s.id::text
     and cs.run_id::text = s.run_id::text
  ),
  tokens as (
    select
      ss.id as candidate_id,
      t.token_slug
    from scored_shortlist ss
    cross join lateral public.chart_entry_artist_token_slugs(null, ss.artist_display) t
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
      ss.id,
      ss.normalized_key,
      ss.title,
      ss.artist_display,
      ss.final_score,
      coalesce(count(r.artist_id) filter (where r.artist_id is not null), 0) as resolved_artist_count,
      coalesce(count(*) filter (where r.artist_id is null), 0) as unresolved_artist_count,
      coalesce(count(*) filter (
        where upper(coalesce(r.origin_iso2, '')) = rr.target_iso2
      ), 0) as matching_origin_count,
      coalesce(jsonb_agg(
        distinct jsonb_build_object(
          'sourceSlug', r.token_slug,
          'canonicalSlug', r.canonical_slug,
          'canonicalName', r.canonical_name,
          'originIso2', r.origin_iso2,
          'resolvedVia', r.resolved_via
        )
      ) filter (where r.token_slug is not null), '[]'::jsonb) as artists
    from scored_shortlist ss
    cross join run_row rr
    left join resolved r on r.candidate_id = ss.id
    group by ss.id, ss.normalized_key, ss.title, ss.artist_display, ss.final_score
  ),
  summary as (
    select
      rr.id,
      rr.status,
      rr.chart_size,
      rr.target_iso2,
      ss.eligibility_done,
      ss.scoring_done,
      ss.shortlist_done,
      (select count(*) from candidates)::integer as total_candidates,
      (select count(*) from shortlisted)::integer as shortlisted_count,
      (select count(*) from scored_shortlist where final_score > 0)::integer as nonzero_score_count,
      coalesce((select max(final_score) from scored_shortlist), 0)::numeric as max_score,
      (select count(*) from row_state where matching_origin_count = 0 and resolved_artist_count > 0)::integer as country_ineligible_count,
      (select count(*) from row_state where matching_origin_count = 0 and resolved_artist_count = 0)::integer as unresolved_origin_count
    from run_row rr
    join stage_state ss on ss.id = rr.id
  ),
  blockers as (
    select
      s.*,
      array_remove(array[
        case when not s.eligibility_done then 'eligibility_not_done' end,
        case when not s.scoring_done then 'scoring_not_done' end,
        case when not s.shortlist_done then 'shortlist_not_done' end,
        case when s.total_candidates = 0 then 'no_candidates' end,
        case when s.shortlisted_count < coalesce(s.chart_size, 0) then 'shortlist_incomplete' end,
        case when s.nonzero_score_count < s.shortlisted_count then 'missing_or_zero_scores' end,
        case when s.max_score <= 0 then 'zero_score_shortlist' end,
        case when s.unresolved_origin_count > 0 then 'unresolved_artist_origins' end,
        case when s.country_ineligible_count > 0 then 'country_ineligible_candidates' end
      ], null) as blocker_codes
    from summary s
  ),
  invalid_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'candidateId', rs.id,
        'normalizedKey', rs.normalized_key,
        'title', rs.title,
        'artistDisplay', rs.artist_display,
        'finalScore', rs.final_score,
        'resolvedArtistCount', rs.resolved_artist_count,
        'matchingOriginCount', rs.matching_origin_count,
        'artists', rs.artists,
        'reason',
          case
            when rs.final_score <= 0 then 'missing_or_zero_score'
            when rs.matching_origin_count = 0 and rs.resolved_artist_count = 0 then 'unresolved_artist_origin'
            when rs.matching_origin_count = 0 then 'no_artist_matches_target_country'
            else 'ok'
          end
      )
      order by rs.final_score desc, rs.normalized_key
    ) filter (
      where rs.final_score <= 0
         or rs.matching_origin_count = 0
    ), '[]'::jsonb) as rows
    from row_state rs
  )
  select jsonb_build_object(
    'runId', b.id,
    'status', b.status,
    'chartSize', b.chart_size,
    'targetIso2', b.target_iso2,
    'totalCandidates', b.total_candidates,
    'shortlistedCount', b.shortlisted_count,
    'nonzeroScoreCount', b.nonzero_score_count,
    'maxScore', b.max_score,
    'eligibilityDone', b.eligibility_done,
    'scoringDone', b.scoring_done,
    'shortlistDone', b.shortlist_done,
    'countryIneligibleCount', b.country_ineligible_count,
    'unresolvedOriginCount', b.unresolved_origin_count,
    'blockers', to_jsonb(coalesce(b.blocker_codes, array[]::text[])),
    'committable', coalesce(array_length(b.blocker_codes, 1), 0) = 0,
    'invalidRows', invalid_rows.rows
  )
  from blockers b, invalid_rows;
$$;

create or replace function public.chart_assert_committable_run(
  p_run_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_report jsonb;
  v_committable boolean;
begin
  select public.chart_get_run_integrity_report(p_run_id)
  into v_report;

  if v_report is null then
    raise exception 'commit_blocked_run_not_found';
  end if;

  v_committable := coalesce((v_report->>'committable')::boolean, false);

  if not v_committable then
    raise exception 'commit_blocked_chart_run_integrity: %', v_report->'blockers'
      using detail = v_report::text;
  end if;

  return v_report;
end;
$$;

grant execute on function public.chart_get_run_integrity_report(text) to authenticated;
grant execute on function public.chart_assert_committable_run(text) to authenticated;
