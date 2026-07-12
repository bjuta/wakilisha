create or replace function public.resolve_registry_relationship_endpoint(
  p_relationship_id uuid,
  p_endpoint_side text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_entity public.registry_entity_index;
  v_updated public.registry_entity_relationships;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to resolve Registry relationship endpoints.';
  end if;

  if p_endpoint_side not in ('source','target') then
    raise exception 'Endpoint side must be source or target.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A resolution reason is required.';
  end if;

  select * into v_entity
  from public.registry_entity_index
  where entity_type = btrim(p_entity_type)
    and entity_id = p_entity_id
  limit 1;

  if not found then
    raise exception 'Canonical Registry entity not found.';
  end if;

  if p_endpoint_side = 'source' then
    update public.registry_entity_relationships
    set source_entity_type = v_entity.entity_type,
        source_entity_id = v_entity.entity_id,
        source_slug = coalesce(nullif(btrim(v_entity.slug), ''), v_entity.entity_id::text),
        updated_by = auth.uid(),
        updated_at = now(),
        review_status = case when review_status = 'approved' then 'pending_review' else review_status end,
        public_safe = false,
        status_reason = btrim(p_reason)
    where id = p_relationship_id
    returning * into v_updated;
  else
    update public.registry_entity_relationships
    set target_entity_type = v_entity.entity_type,
        target_entity_id = v_entity.entity_id,
        target_slug = coalesce(nullif(btrim(v_entity.slug), ''), v_entity.entity_id::text),
        updated_by = auth.uid(),
        updated_at = now(),
        review_status = case when review_status = 'approved' then 'pending_review' else review_status end,
        public_safe = false,
        status_reason = btrim(p_reason)
    where id = p_relationship_id
    returning * into v_updated;
  end if;

  if not found then
    raise exception 'Registry relationship not found.';
  end if;

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
$$;;
