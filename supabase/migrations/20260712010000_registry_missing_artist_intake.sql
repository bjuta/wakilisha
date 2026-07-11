-- PR14: Controlled intake for artists missing from canonical Registry relationships.
-- Creates reviewable submissions only. It does not create artists, aliases, or endpoints.

create or replace view public.registry_missing_artist_intake_queue
with (security_invoker = true)
as
with missing as (
  select
    legacy_slug,
    count(distinct relationship_id)::integer as affected_relationship_count,
    count(*) filter (where missing_side = 'source')::integer as missing_source_count,
    count(*) filter (where missing_side = 'target')::integer as missing_target_count,
    array_agg(distinct relationship_type order by relationship_type) as relationship_types
  from public.registry_relationship_endpoint_work_queue
  where endpoint_work_state = 'missing_entity'
    and missing_entity_type = 'artist'
  group by legacy_slug
), latest_submission as (
  select distinct on (substring(source_note from '^missing_artist_slug:([^[:space:]]+)'))
    substring(source_note from '^missing_artist_slug:([^[:space:]]+)') as legacy_slug,
    id as submission_id,
    review_status as submission_review_status,
    created_at as submission_created_at,
    reviewed_at as submission_reviewed_at
  from public.contributor_submissions
  where source_note ~ '^missing_artist_slug:[^[:space:]]+'
  order by substring(source_note from '^missing_artist_slug:([^[:space:]]+)'), created_at desc
)
select
  m.legacy_slug,
  initcap(replace(m.legacy_slug, '-', ' ')) as suggested_display_name,
  m.affected_relationship_count,
  m.missing_source_count,
  m.missing_target_count,
  m.relationship_types,
  s.submission_id,
  s.submission_review_status,
  s.submission_created_at,
  s.submission_reviewed_at,
  case
    when s.submission_id is null then 'needs_intake'
    when s.submission_review_status in ('rejected','archived','merged') then 'needs_reassessment'
    when s.submission_review_status in ('accepted_as_memory','accepted_as_evidence','accepted_as_relationship_context') then 'review_completed'
    else 'intake_in_progress'
  end as intake_state
from missing m
left join latest_submission s using (legacy_slug);

create or replace function public.create_registry_missing_artist_intake(
  p_legacy_slug text,
  p_display_name text,
  p_reason text,
  p_source_url text default null
)
returns public.contributor_submissions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_slug text := lower(btrim(p_legacy_slug));
  v_result public.contributor_submissions;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to create Registry artist intake submissions.';
  end if;

  if nullif(v_slug, '') is null or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid missing artist slug is required.';
  end if;

  if nullif(btrim(p_display_name), '') is null then
    raise exception 'A proposed artist display name is required.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'An intake reason is required.';
  end if;

  if not exists (
    select 1
    from public.registry_relationship_endpoint_work_queue q
    where q.endpoint_work_state = 'missing_entity'
      and q.missing_entity_type = 'artist'
      and q.legacy_slug = v_slug
  ) then
    raise exception 'This slug is not currently required by the missing-artist endpoint queue.';
  end if;

  if exists (
    select 1
    from public.registry_artists a
    where a.slug = v_slug
  ) then
    raise exception 'A canonical Registry artist already exists for this slug.';
  end if;

  if exists (
    select 1
    from public.contributor_submissions s
    where s.source_note like 'missing_artist_slug:' || v_slug || '%'
      and s.review_status not in ('rejected','archived','merged')
  ) then
    raise exception 'An active intake submission already exists for this missing artist.';
  end if;

  insert into public.contributor_submissions (
    contributor_id,
    submission_type,
    title,
    body,
    source_url,
    source_note,
    consent_status,
    review_status
  ) values (
    auth.uid(),
    'context_note',
    btrim(p_display_name),
    btrim(p_reason),
    nullif(btrim(p_source_url), ''),
    'missing_artist_slug:' || v_slug || ' source:registry_relationship_endpoint_work_queue',
    'internal_use',
    'submitted'
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_registry_missing_artist_intake(text, text, text, text) from public, anon;
grant execute on function public.create_registry_missing_artist_intake(text, text, text, text) to authenticated, service_role;

comment on view public.registry_missing_artist_intake_queue is
  'Groups missing artist endpoints and shows whether a reviewable contributor submission exists for each absent artist.';
comment on function public.create_registry_missing_artist_intake(text, text, text, text) is
  'Creates one internal review submission for a missing artist without creating a canonical artist, alias, or relationship endpoint.';