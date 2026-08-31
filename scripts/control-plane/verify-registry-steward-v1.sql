-- Registry Steward V1 permanent read-only verifier.
--
-- Purpose:
--   1. prove the mutation boundary is service-owned;
--   2. measure deterministic Track identity debt without creating review work;
--   3. distinguish machine-actionable repair from route-deferred identity;
--   4. prove canonical Chart projection drift;
--   5. keep the Registry entity index derived from canonical tables.

with function_authority as (
  select
    to_regprocedure(
      'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)'
    ) as track_repair_function,
    to_regprocedure(
      'public.registry_steward_sync_chart_batch(text,integer)'
    ) as chart_sync_function
),
function_properties as (
  select
    p.oid,
    p.proname,
    p.prosecdef,
    p.proconfig
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'registry_steward_apply_track_identity_repair',
      'registry_steward_sync_chart_batch'
    )
),
track_base as (
  select
    track.id,
    track.title,
    track.slug,
    nullif(btrim(track.isrc), '') as isrc,
    array_remove(
      array_agg(distinct credit.artist_slug)
        filter (
          where credit.artist_slug is not null
            and btrim(credit.artist_slug) <> ''
            and credit.status = 'active'
            and coalesce(credit.is_primary, false)
        ),
      null
    ) as primary_artist_slugs,
    array_remove(
      array_agg(
        distinct lower(
          regexp_replace(
            coalesce(
              nullif(btrim(credit.artist_name_text), ''),
              credit.artist_slug
            ),
            '[^a-z0-9]+',
            ' ',
            'gi'
          )
        )
      )
        filter (
          where credit.status = 'active'
            and coalesce(credit.is_featured, false)
        ),
      null
    ) as featured_credit_keys
  from public.registry_tracks track
  left join public.registry_track_artists credit
    on credit.track_id = track.id
  where track.status = 'active'
  group by
    track.id,
    track.title,
    track.slug,
    track.isrc
),
track_structural as (
  select
    base.*,
    regexp_replace(
      base.title,
      '\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]',
      '',
      'gi'
    ) as clean_title,
    substring(
      base.title
      from '\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]'
    ) as structural_clause
  from track_base base
),
track_candidates as (
  select
    structural.*,
    btrim(
      regexp_replace(
        structural.clean_title,
        '\s+',
        ' ',
        'g'
      )
    ) as proposed_title,
    trim(
      both '-'
      from regexp_replace(
        lower(
          btrim(
            regexp_replace(
              structural.clean_title,
              '\s+',
              ' ',
              'g'
            )
          )
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ) as proposed_slug,
    lower(
      regexp_replace(
        coalesce(structural.structural_clause, ''),
        '.*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+).*',
        '\1',
        'gi'
      )
    ) as structural_credit_text
  from track_structural structural
),
classified_track_candidates as (
  select
    candidate.*,
    (
      candidate.structural_clause is not null
      and candidate.proposed_title <> ''
      and exists (
        select 1
        from unnest(
          coalesce(
            candidate.featured_credit_keys,
            array[]::text[]
          )
        ) featured_key
        where lower(
          regexp_replace(
            candidate.structural_credit_text,
            '[^a-z0-9]+',
            ' ',
            'g'
          )
        ) like '%' || featured_key || '%'
      )
    ) as structural_credit_proven,
    exists (
      select 1
      from public.registry_tracks other_track
      join public.registry_track_artists other_credit
        on other_credit.track_id = other_track.id
       and other_credit.status = 'active'
       and coalesce(other_credit.is_primary, false)
      where other_track.id <> candidate.id
        and other_track.status in (
          'active',
          'draft',
          'needs_review'
        )
        and other_track.slug = candidate.proposed_slug
        and other_credit.artist_slug = any(
          coalesce(
            candidate.primary_artist_slugs,
            array[]::text[]
          )
        )
    ) as same_artist_route_collision
  from track_candidates candidate
),
route_redirect_conflicts as (
  select distinct
    candidate.id
  from classified_track_candidates candidate
  cross join lateral unnest(
    coalesce(
      candidate.primary_artist_slugs,
      array[]::text[]
    )
  ) primary_artist_slug
  join public.wk_slug_redirects redirect
    on redirect.old_path =
      '/tracks/' ||
      primary_artist_slug ||
      '/' ||
      candidate.slug
  where candidate.proposed_slug <> candidate.slug
    and redirect.new_path is distinct from
      '/tracks/' ||
      primary_artist_slug ||
      '/' ||
      candidate.proposed_slug
),
track_debt as (
  select
    candidate.*,
    redirect_conflict.id is not null
      as has_redirect_conflict,
    (
      candidate.structural_credit_proven
      and candidate.title <> candidate.proposed_title
    ) as proven_title_repair,
    (
      candidate.proposed_slug <> ''
      and candidate.slug <> candidate.proposed_slug
      and coalesce(
        cardinality(candidate.primary_artist_slugs),
        0
      ) > 0
      and not candidate.same_artist_route_collision
      and redirect_conflict.id is null
    ) as safe_slug_repair,
    (
      candidate.proposed_slug <> ''
      and candidate.slug <> candidate.proposed_slug
      and (
        candidate.same_artist_route_collision
        or redirect_conflict.id is not null
      )
    ) as route_deferred
  from classified_track_candidates candidate
  left join route_redirect_conflicts redirect_conflict
    on redirect_conflict.id = candidate.id
),
chart_drift as (
  select
    count(*) filter (
      where entry.canonical_track_id is not null
        and track.id is not null
        and (
          entry.track_slug is distinct from track.slug
          or entry.track_title is distinct from track.title
        )
    ) as track_projection_drift,
    count(*) filter (
      where entry.canonical_artist_id is not null
        and artist.id is not null
        and (
          entry.artist_slug is distinct from artist.slug
          or entry.artist_name is distinct from artist.display_name
        )
    ) as artist_projection_drift
  from public.wk_chart_entries_v2 entry
  left join public.registry_tracks track
    on track.id::text = entry.canonical_track_id
   and track.status = 'active'
  left join public.registry_artists artist
    on artist.id::text = entry.canonical_artist_id
   and artist.status = 'active'
),
entity_index_definition as (
  select pg_get_viewdef(
    'public.registry_entity_index'::regclass,
    true
  ) as definition
),
steward_receipts as (
  select
    count(*) as receipt_count,
    max(created_at) as latest_receipt_at
  from public.registry_canonical_write_events
  where actor = 'registry-steward'
    and action = 'auto_repair'
    and status = 'applied'
)
select jsonb_build_object(
  'verification',
    case
      when (
        select track_repair_function is not null
          and chart_sync_function is not null
        from function_authority
      )
       and (
         select count(*)
         from function_properties
         where prosecdef
           and proconfig @> array[
             'search_path=pg_catalog, public'
           ]::text[]
       ) = 2
       and not has_function_privilege(
         'anon',
         'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
         'execute'
       )
       and not has_function_privilege(
         'authenticated',
         'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
         'execute'
       )
       and has_function_privilege(
         'service_role',
         'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
         'execute'
       )
       and not has_function_privilege(
         'anon',
         'public.registry_steward_sync_chart_batch(text,integer)',
         'execute'
       )
       and not has_function_privilege(
         'authenticated',
         'public.registry_steward_sync_chart_batch(text,integer)',
         'execute'
       )
       and has_function_privilege(
         'service_role',
         'public.registry_steward_sync_chart_batch(text,integer)',
         'execute'
       )
       and (
         select definition
         from entity_index_definition
       ) like '%FROM registry_tracks t%'
        then 'PASS'
      else 'FAIL'
    end,
  'function_authority',
    (
      select jsonb_build_object(
        'track_repair_exists',
          track_repair_function is not null,
        'chart_sync_exists',
          chart_sync_function is not null,
        'service_role_track_execute',
          has_function_privilege(
            'service_role',
            'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
            'execute'
          ),
        'service_role_chart_execute',
          has_function_privilege(
            'service_role',
            'public.registry_steward_sync_chart_batch(text,integer)',
            'execute'
          ),
        'anon_track_execute',
          has_function_privilege(
            'anon',
            'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
            'execute'
          ),
        'authenticated_track_execute',
          has_function_privilege(
            'authenticated',
            'public.registry_steward_apply_track_identity_repair(uuid,text,text,text,text,text,text,text,jsonb)',
            'execute'
          )
      )
      from function_authority
    ),
  'track_identity_debt',
    jsonb_build_object(
      'proven_title_repairs',
        (
          select count(*)
          from track_debt
          where proven_title_repair
        ),
      'safe_slug_repairs',
        (
          select count(*)
          from track_debt
          where safe_slug_repair
        ),
      'route_deferred',
        (
          select count(*)
          from track_debt
          where route_deferred
        ),
      'same_artist_route_collisions',
        (
          select count(*)
          from track_debt
          where same_artist_route_collision
        ),
      'redirect_conflicts',
        (
          select count(*)
          from track_debt
          where has_redirect_conflict
        ),
      'unproven_structural_credit_clauses',
        (
          select count(*)
          from track_debt
          where structural_clause is not null
            and not structural_credit_proven
        )
    ),
  'chart_projection_drift',
    (
      select to_jsonb(chart_drift)
      from chart_drift
    ),
  'registry_entity_index',
    jsonb_build_object(
      'relation_kind',
        (
          select relkind::text
          from pg_class
          where oid =
            'public.registry_entity_index'::regclass
        ),
      'derived_from_registry_tracks',
        (
          select definition
            like '%FROM registry_tracks t%'
          from entity_index_definition
        )
    ),
  'steward_receipts',
    (
      select to_jsonb(steward_receipts)
      from steward_receipts
    )
) as registry_steward_v1_verification;
