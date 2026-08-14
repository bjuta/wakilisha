-- PR12: Correct duplicate detection and add a controlled, non-destructive merge workflow.

create or replace view public.registry_relationship_consolidation_queue
with (security_invoker = true)
as
with prepared as (
  select
    r.*,
    coalesce(r.source_entity_id::text, 'slug:' || r.source_slug) as source_comparison_key,
    coalesce(r.target_entity_id::text, 'slug:' || r.target_slug) as target_comparison_key,
    count(re.evidence_id)::integer as evidence_count
  from public.registry_entity_relationships r
  left join public.registry_relationship_evidence re on re.relationship_id = r.id
  group by r.id
), classified as (
  select
    p.*,
    count(*) over (
      partition by source_entity_type, source_comparison_key,
                   target_entity_type, target_comparison_key,
                   relationship_type, coalesce(relationship_role, '')
    )::integer as duplicate_group_size
  from prepared p
  where relationship_status <> 'archived'
)
select
  relationship_id,
  source_entity_type,
  source_entity_id,
  source_slug,
  source_comparison_key,
  target_entity_type,
  target_entity_id,
  target_slug,
  target_comparison_key,
  relationship_type,
  relationship_role,
  relationship_status,
  review_status,
  public_safe,
  plain_reason,
  evidence_count,
  case
    when source_entity_id is null or target_entity_id is null then 'resolve_endpoints'
    when evidence_count = 0 then 'attach_evidence'
    when nullif(btrim(plain_reason), '') is null then 'add_plain_reason'
    when review_status in ('unreviewed','pending_review','disputed') then 'review_required'
    when review_status = 'approved' and public_safe = false then 'publication_review'
    else 'ready'
  end as consolidation_state,
  relationship_type in ('features','featured_on','collaboration','popular_track') as vocabulary_supported,
  duplicate_group_size,
  duplicate_group_size > 1 as duplicate_candidate
from classified;

create or replace function public.merge_registry_relationship_duplicate(
  p_survivor_relationship_id uuid,
  p_duplicate_relationship_id uuid,
  p_reason text
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_survivor public.registry_entity_relationships;
  v_duplicate public.registry_entity_relationships;
  v_result public.registry_entity_relationships;
  v_survivor_source_key text;
  v_survivor_target_key text;
  v_duplicate_source_key text;
  v_duplicate_target_key text;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to merge Registry relationships.';
  end if;

  if p_survivor_relationship_id = p_duplicate_relationship_id then
    raise exception 'Survivor and duplicate relationships must be different.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A merge reason is required.';
  end if;

  select * into v_survivor
  from public.registry_entity_relationships
  where id = p_survivor_relationship_id
  for update;

  if not found then raise exception 'Survivor relationship not found.'; end if;

  select * into v_duplicate
  from public.registry_entity_relationships
  where id = p_duplicate_relationship_id
  for update;

  if not found then raise exception 'Duplicate relationship not found.'; end if;

  if v_survivor.relationship_status = 'archived' or v_duplicate.relationship_status = 'archived' then
    raise exception 'Archived relationships cannot be merged.';
  end if;

  v_survivor_source_key := coalesce(v_survivor.source_entity_id::text, 'slug:' || v_survivor.source_slug);
  v_survivor_target_key := coalesce(v_survivor.target_entity_id::text, 'slug:' || v_survivor.target_slug);
  v_duplicate_source_key := coalesce(v_duplicate.source_entity_id::text, 'slug:' || v_duplicate.source_slug);
  v_duplicate_target_key := coalesce(v_duplicate.target_entity_id::text, 'slug:' || v_duplicate.target_slug);

  if v_survivor.source_entity_type <> v_duplicate.source_entity_type
     or v_survivor.target_entity_type <> v_duplicate.target_entity_type
     or v_survivor_source_key <> v_duplicate_source_key
     or v_survivor_target_key <> v_duplicate_target_key
     or v_survivor.relationship_type <> v_duplicate.relationship_type
     or v_survivor.relationship_role is distinct from v_duplicate.relationship_role then
    raise exception 'Relationships do not have matching canonical or legacy comparison keys.';
  end if;

  insert into public.registry_relationship_evidence (
    relationship_id, evidence_id, support_type, note, created_by, created_at
  )
  select p_survivor_relationship_id, evidence_id, support_type, note, created_by, created_at
  from public.registry_relationship_evidence
  where relationship_id = p_duplicate_relationship_id
  on conflict (relationship_id, evidence_id, support_type) do nothing;

  delete from public.registry_relationship_evidence
  where relationship_id = p_duplicate_relationship_id;

  update public.registry_entity_relationships
  set public_safe = false,
      review_status = case when review_status = 'approved' then 'pending_review' else review_status end,
      status_reason = btrim(p_reason),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_survivor_relationship_id
  returning * into v_result;

  update public.registry_entity_relationships
  set relationship_status = 'archived',
      review_status = 'superseded',
      public_safe = false,
      superseded_by_relationship_id = p_survivor_relationship_id,
      status_reason = btrim(p_reason),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_duplicate_relationship_id;

  insert into public.review_decisions(subject_type, subject_id, decision, reason, reviewer_id)
  values
    ('relationship', p_duplicate_relationship_id, 'duplicate', btrim(p_reason), auth.uid()),
    ('relationship', p_survivor_relationship_id, 'needs_more_evidence', btrim(p_reason), auth.uid());

  return v_result;
end;
$$;

revoke all on function public.merge_registry_relationship_duplicate(uuid, uuid, text) from public, anon;
grant execute on function public.merge_registry_relationship_duplicate(uuid, uuid, text) to authenticated, service_role;

comment on function public.merge_registry_relationship_duplicate(uuid, uuid, text) is
  'Archives an explicitly identified duplicate relationship, preserves its evidence on the survivor, and records both review decisions.';
