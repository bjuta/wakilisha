-- PR8: Connect canonical Registry entities to the reviewed relationship and evidence system.
-- Existing relationships are preserved. New client-created relationships must use this RPC.

-- Remove the authenticated direct-write route. Service-role maintenance remains available.
drop policy if exists registry_entity_relationships_admin_write
  on public.registry_entity_relationships;

revoke insert, update, delete
  on table public.registry_entity_relationships
  from authenticated;

grant select
  on table public.registry_entity_relationships
  to authenticated;

create or replace function public.create_registry_entity_relationship(
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_target_entity_type text,
  p_target_entity_id uuid,
  p_relationship_type text,
  p_relationship_role text default null,
  p_plain_reason text default null,
  p_valid_from date default null,
  p_valid_to date default null,
  p_evidence_id uuid default null,
  p_evidence_support_type text default 'supports',
  p_evidence_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_source public.registry_entity_index;
  v_target public.registry_entity_index;
  v_created public.registry_entity_relationships;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to create Registry relationships.';
  end if;

  if nullif(btrim(p_source_entity_type), '') is null
     or nullif(btrim(p_target_entity_type), '') is null then
    raise exception 'Source and target entity types are required.';
  end if;

  if nullif(btrim(p_relationship_type), '') is null then
    raise exception 'A relationship type is required.';
  end if;

  if p_source_entity_type = p_target_entity_type
     and p_source_entity_id = p_target_entity_id then
    raise exception 'A Registry entity cannot be related to itself.';
  end if;

  if p_valid_from is not null and p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'Relationship end date cannot be earlier than its start date.';
  end if;

  if p_evidence_support_type not in ('supports', 'challenges', 'contextualizes') then
    raise exception 'Unsupported evidence relationship type.';
  end if;

  select *
  into v_source
  from public.registry_entity_index
  where entity_type = btrim(p_source_entity_type)
    and entity_id = p_source_entity_id
  limit 1;

  if not found then
    raise exception 'Source Registry entity was not found in the canonical entity index.';
  end if;

  select *
  into v_target
  from public.registry_entity_index
  where entity_type = btrim(p_target_entity_type)
    and entity_id = p_target_entity_id
  limit 1;

  if not found then
    raise exception 'Target Registry entity was not found in the canonical entity index.';
  end if;

  if exists (
    select 1
    from public.registry_entity_relationships r
    where r.source_entity_id = p_source_entity_id
      and r.target_entity_id = p_target_entity_id
      and r.source_entity_type = v_source.entity_type
      and r.target_entity_type = v_target.entity_type
      and r.relationship_type = btrim(p_relationship_type)
      and r.relationship_role is not distinct from nullif(btrim(p_relationship_role), '')
      and r.relationship_status <> 'archived'
  ) then
    raise exception 'An active Registry relationship with the same endpoints, type, and role already exists.';
  end if;

  if p_evidence_id is not null
     and not exists (
       select 1 from public.evidence_items where id = p_evidence_id
     ) then
    raise exception 'Evidence item not found.';
  end if;

  insert into public.registry_entity_relationships (
    source_entity_type,
    source_slug,
    target_entity_type,
    target_slug,
    relationship_type,
    relationship_role,
    relationship_status,
    source_kind,
    source_entity,
    source_record_id,
    confidence,
    metadata,
    source_entity_id,
    target_entity_id,
    plain_reason,
    review_status,
    public_safe,
    valid_from,
    valid_to,
    created_by,
    updated_by
  ) values (
    v_source.entity_type,
    coalesce(nullif(btrim(v_source.slug), ''), v_source.entity_id::text),
    v_target.entity_type,
    coalesce(nullif(btrim(v_target.slug), ''), v_target.entity_id::text),
    btrim(p_relationship_type),
    nullif(btrim(p_relationship_role), ''),
    'draft',
    'registry_workflow',
    v_source.canonical_source_table,
    v_source.canonical_source_id::text,
    null,
    coalesce(p_metadata, '{}'::jsonb),
    p_source_entity_id,
    p_target_entity_id,
    nullif(btrim(p_plain_reason), ''),
    'unreviewed',
    false,
    p_valid_from,
    p_valid_to,
    auth.uid(),
    auth.uid()
  )
  returning * into v_created;

  if p_evidence_id is not null then
    insert into public.registry_relationship_evidence (
      relationship_id,
      evidence_id,
      support_type,
      note,
      created_by
    ) values (
      v_created.id,
      p_evidence_id,
      p_evidence_support_type,
      nullif(btrim(p_evidence_note), ''),
      auth.uid()
    );
  end if;

  return v_created;
end;
$$;

revoke all on function public.create_registry_entity_relationship(
  text, uuid, text, uuid, text, text, text, date, date, uuid, text, text, jsonb
) from public, anon;

grant execute on function public.create_registry_entity_relationship(
  text, uuid, text, uuid, text, text, text, date, date, uuid, text, text, jsonb
) to authenticated, service_role;

comment on function public.create_registry_entity_relationship(
  text, uuid, text, uuid, text, text, text, date, date, uuid, text, text, jsonb
) is 'Creates a draft relationship between canonical Registry entities and optionally attaches evidence atomically.';
