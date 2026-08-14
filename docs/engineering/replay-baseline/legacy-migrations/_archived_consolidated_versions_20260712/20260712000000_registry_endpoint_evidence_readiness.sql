-- PR13: Structured endpoint resolution and evidence-readiness workflow.
-- No entity, endpoint, evidence, relationship, or review state is changed automatically.

create or replace view public.registry_relationship_endpoint_work_queue
with (security_invoker = true)
as
with unresolved as (
  select
    r.id as relationship_id,
    case when r.source_entity_id is null then 'source' else 'target' end as missing_side,
    case when r.source_entity_id is null then r.source_entity_type else r.target_entity_type end as missing_entity_type,
    case when r.source_entity_id is null then r.source_slug else r.target_slug end as legacy_slug,
    r.relationship_type,
    r.relationship_role,
    r.source_entity_id,
    r.target_entity_id
  from public.registry_entity_relationships r
  where r.relationship_status <> 'archived'
    and (r.source_entity_id is null or r.target_entity_id is null)
), alias_candidates as (
  select
    u.*,
    count(a.canonical_artist_id)::integer as alias_match_count,
    min(a.canonical_artist_id::text)::uuid as alias_candidate_id
  from unresolved u
  left join public.registry_artist_aliases a
    on u.missing_entity_type = 'artist'
   and a.alias_slug = u.legacy_slug
   and coalesce(a.status, 'active') <> 'rejected'
  group by u.relationship_id, u.missing_side, u.missing_entity_type,
           u.legacy_slug, u.relationship_type, u.relationship_role,
           u.source_entity_id, u.target_entity_id
)
select
  relationship_id,
  missing_side,
  missing_entity_type,
  legacy_slug,
  relationship_type,
  relationship_role,
  source_entity_id,
  target_entity_id,
  alias_match_count,
  alias_candidate_id,
  case
    when alias_match_count = 1 then 'ready_to_resolve'
    when alias_match_count > 1 then 'ambiguous_alias'
    else 'missing_entity'
  end as endpoint_work_state
from alias_candidates;

create or replace view public.registry_relationship_evidence_readiness_queue
with (security_invoker = true)
as
select
  r.id as relationship_id,
  r.source_entity_type,
  r.source_entity_id,
  r.source_slug,
  r.target_entity_type,
  r.target_entity_id,
  r.target_slug,
  r.relationship_type,
  r.relationship_role,
  count(re.evidence_id)::integer as evidence_count,
  nullif(btrim(r.plain_reason), '') is not null as has_plain_reason,
  case
    when r.source_entity_id is null or r.target_entity_id is null then 'resolve_endpoints'
    when count(re.evidence_id) = 0 then 'attach_evidence'
    when nullif(btrim(r.plain_reason), '') is null then 'add_plain_reason'
    else 'ready_for_review'
  end as evidence_work_state
from public.registry_entity_relationships r
left join public.registry_relationship_evidence re on re.relationship_id = r.id
where r.relationship_status <> 'archived'
group by r.id;

create or replace function public.resolve_registry_relationship_endpoint_from_alias(
  p_relationship_id uuid,
  p_endpoint_side text,
  p_reason text
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_relationship public.registry_entity_relationships;
  v_slug text;
  v_candidate_id uuid;
  v_match_count integer;
  v_result public.registry_entity_relationships;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to resolve Registry relationship endpoints.';
  end if;

  if p_endpoint_side not in ('source', 'target') then
    raise exception 'Endpoint side must be source or target.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A resolution reason is required.';
  end if;

  select * into v_relationship
  from public.registry_entity_relationships
  where id = p_relationship_id
  for update;

  if not found then raise exception 'Registry relationship not found.'; end if;

  v_slug := case when p_endpoint_side = 'source' then v_relationship.source_slug else v_relationship.target_slug end;

  select count(*)::integer, min(a.canonical_artist_id::text)::uuid
  into v_match_count, v_candidate_id
  from public.registry_artist_aliases a
  where a.alias_slug = v_slug
    and coalesce(a.status, 'active') <> 'rejected';

  if v_match_count = 0 then raise exception 'No active canonical artist alias match was found.'; end if;
  if v_match_count > 1 then raise exception 'The artist alias is ambiguous and requires manual review.'; end if;

  select public.resolve_registry_relationship_endpoint(
    p_relationship_id,
    p_endpoint_side,
    'artist',
    v_candidate_id,
    p_reason
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.resolve_registry_relationship_endpoint_from_alias(uuid, text, text) from public, anon;
grant execute on function public.resolve_registry_relationship_endpoint_from_alias(uuid, text, text) to authenticated, service_role;

comment on view public.registry_relationship_endpoint_work_queue is
  'Classifies unresolved relationship endpoints as missing entities, unique alias candidates, or ambiguous aliases.';
comment on view public.registry_relationship_evidence_readiness_queue is
  'Classifies canonical relationships by endpoint, evidence, reason, and review readiness.';
comment on function public.resolve_registry_relationship_endpoint_from_alias(uuid, text, text) is
  'Resolves one artist endpoint only when an active alias maps to exactly one canonical Registry artist.';