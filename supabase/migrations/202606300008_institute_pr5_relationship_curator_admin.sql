create or replace function public.institute_review_entity_relationship(
  p_relationship_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns public.entity_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relationship public.entity_relationships;
  v_review_decision text;
begin
  if not public.institute_can_review() then
    raise exception 'Not allowed to review Institute relationships.';
  end if;

  if p_decision not in (
    'approved',
    'rejected',
    'disputed',
    'needs_more_evidence',
    'public_safe_enabled',
    'public_safe_disabled'
  ) then
    raise exception 'Unsupported relationship review decision: %', p_decision;
  end if;

  select *
  into v_relationship
  from public.entity_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'Relationship not found.';
  end if;

  if p_decision in ('approved', 'public_safe_enabled') then
    if nullif(trim(coalesce(v_relationship.reason, '')), '') is null then
      raise exception 'Approved relationships require a reason.';
    end if;

    if v_relationship.confidence is null then
      raise exception 'Approved relationships require confidence.';
    end if;

    if not exists (
      select 1
      from public.relationship_evidence relationship_evidence_check
      where relationship_evidence_check.relationship_id = p_relationship_id
    ) then
      raise exception 'Approved relationships require at least one evidence link.';
    end if;
  end if;

  if p_decision = 'approved' then
    update public.entity_relationships
    set
      review_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'approved';

  elsif p_decision = 'rejected' then
    update public.entity_relationships
    set
      review_status = 'rejected',
      public_safe = false,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'rejected';

  elsif p_decision = 'disputed' then
    update public.entity_relationships
    set
      review_status = 'disputed',
      public_safe = false,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'needs_more_evidence';

  elsif p_decision = 'needs_more_evidence' then
    update public.entity_relationships
    set
      review_status = 'pending_review',
      public_safe = false,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'needs_more_evidence';

  elsif p_decision = 'public_safe_enabled' then
    if v_relationship.review_status <> 'approved' then
      raise exception 'Public-safe relationship publishing requires approved relationship review.';
    end if;

    update public.entity_relationships
    set
      public_safe = true,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'approved';

  elsif p_decision = 'public_safe_disabled' then
    update public.entity_relationships
    set
      public_safe = false,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_decision_note,
      updated_at = now()
    where id = p_relationship_id
    returning *
    into v_relationship;

    v_review_decision := 'internal_only';
  end if;

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  )
  values (
    'relationship',
    p_relationship_id,
    v_review_decision,
    coalesce(p_decision_note, 'Relationship Curator action: ' || replace(p_decision, '_', ' ')),
    auth.uid()
  );

  return v_relationship;
end;
$$;

revoke all on function public.institute_review_entity_relationship(uuid, text, text) from public;
grant execute on function public.institute_review_entity_relationship(uuid, text, text) to authenticated;
