-- PR11: Audit and controlled consolidation workflow for canonical Registry relationships.
-- No relationship is automatically approved, merged, deleted, or rewritten.

create or replace view public.registry_relationship_consolidation_queue
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
  r.relationship_status,
  r.review_status,
  r.public_safe,
  r.plain_reason,
  count(re.evidence_id)::integer as evidence_count,
  case
    when r.source_entity_id is null or r.target_entity_id is null then 'resolve_endpoints'
    when count(re.evidence_id) = 0 then 'attach_evidence'
    when nullif(btrim(r.plain_reason), '') is null then 'add_plain_reason'
    when r.review_status in ('unreviewed','pending_review','disputed') then 'review_required'
    when r.review_status = 'approved' and r.public_safe = false then 'publication_review'
    else 'ready'
  end as consolidation_state,
  case
    when r.relationship_type in ('features','featured_on','collaboration','popular_track') then true
    else false
  end as vocabulary_supported,
  exists (
    select 1
    from public.registry_entity_relationships d
    where d.id <> r.id
      and d.source_entity_type = r.source_entity_type
      and d.target_entity_type = r.target_entity_type
      and d.source_entity_id is not distinct from r.source_entity_id
      and d.target_entity_id is not distinct from r.target_entity_id
      and d.relationship_type = r.relationship_type
      and d.relationship_role is not distinct from r.relationship_role
      and d.relationship_status <> 'archived'
  ) as duplicate_candidate
from public.registry_entity_relationships r
left join public.registry_relationship_evidence re
  on re.relationship_id = r.id
group by r.id;

create or replace function public.normalize_registry_relationship_vocabulary(
  p_relationship_id uuid,
  p_relationship_type text,
  p_relationship_role text default null,
  p_reason text default null
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.registry_entity_relationships;
  v_updated public.registry_entity_relationships;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to normalize Registry relationships.';
  end if;

  if nullif(btrim(p_relationship_type), '') is null then
    raise exception 'A relationship type is required.';
  end if;

  if btrim(p_relationship_type) not in ('features','featured_on','collaboration','popular_track') then
    raise exception 'Unsupported canonical relationship type.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A normalization reason is required.';
  end if;

  select * into v_current
  from public.registry_entity_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'Registry relationship not found.';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships d
    where d.id <> p_relationship_id
      and d.source_entity_type = v_current.source_entity_type
      and d.target_entity_type = v_current.target_entity_type
      and d.source_entity_id is not distinct from v_current.source_entity_id
      and d.target_entity_id is not distinct from v_current.target_entity_id
      and d.relationship_type = btrim(p_relationship_type)
      and d.relationship_role is not distinct from nullif(btrim(p_relationship_role), '')
      and d.relationship_status <> 'archived'
  ) then
    raise exception 'Normalization would create a duplicate active Registry relationship.';
  end if;

  update public.registry_entity_relationships
  set relationship_type = btrim(p_relationship_type),
      relationship_role = nullif(btrim(p_relationship_role), ''),
      review_status = case when review_status = 'approved' then 'pending_review' else review_status end,
      public_safe = false,
      status_reason = btrim(p_reason),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_relationship_id
  returning * into v_updated;

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  ) values (
    'relationship',
    p_relationship_id,
    'needs_more_evidence',
    btrim(p_reason),
    auth.uid()
  );

  return v_updated;
end;
$$;

revoke all on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) from public, anon;
grant execute on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) to authenticated, service_role;

comment on view public.registry_relationship_consolidation_queue is
  'Read-only audit queue for endpoint, evidence, reason, duplicate, vocabulary, review, and publication readiness of canonical Registry relationships.';

comment on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) is
  'Normalizes one Registry relationship type and role, reopens review where needed, and records the decision.';