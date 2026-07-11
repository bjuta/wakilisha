-- PR5: Registry relationship promotion rules.
-- Adds one controlled review path and database-level evidence requirements.

create or replace function public.enforce_registry_relationship_promotion_rules()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.review_status = 'approved' then
    if not exists (
      select 1
      from public.registry_relationship_evidence rre
      join public.evidence_items e on e.id = rre.evidence_id
      where rre.relationship_id = new.id
        and rre.support_type = 'supports'
        and e.review_status in ('reviewed', 'approved')
    ) then
      raise exception 'Approved relationships require at least one reviewed supporting evidence item.';
    end if;
  end if;

  if new.public_safe then
    if new.review_status <> 'approved'
       or new.relationship_status <> 'active'
       or nullif(btrim(new.plain_reason), '') is null then
      raise exception 'Public-safe relationships must be active, approved, and include a plain-language reason.';
    end if;

    if not exists (
      select 1
      from public.registry_relationship_evidence rre
      join public.evidence_items e on e.id = rre.evidence_id
      where rre.relationship_id = new.id
        and rre.support_type = 'supports'
        and e.review_status = 'approved'
        and e.retrieval_status = 'default_retrieval'
    ) then
      raise exception 'Public-safe relationships require approved supporting evidence enabled for default retrieval.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registry_relationship_promotion_rules
  on public.registry_entity_relationships;

create trigger trg_registry_relationship_promotion_rules
before insert or update of review_status, relationship_status, public_safe, plain_reason
on public.registry_entity_relationships
for each row
execute function public.enforce_registry_relationship_promotion_rules();

create or replace function public.review_registry_relationship(
  p_relationship_id uuid,
  p_next_review_status text,
  p_public_safe boolean,
  p_reason text
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.registry_entity_relationships;
  v_updated public.registry_entity_relationships;
  v_decision text;
begin
  if not public.institute_can_review() then
    raise exception 'You do not have permission to review Registry relationships.';
  end if;

  if p_next_review_status not in (
    'unreviewed',
    'pending_review',
    'approved',
    'rejected',
    'disputed'
  ) then
    raise exception 'Unsupported relationship review status.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A review reason is required.';
  end if;

  if p_public_safe and p_next_review_status <> 'approved' then
    raise exception 'Only approved relationships can be marked public-safe.';
  end if;

  select *
  into v_current
  from public.registry_entity_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'Registry relationship not found.';
  end if;

  v_decision := case
    when p_next_review_status = 'approved' then 'approved'
    when p_next_review_status = 'rejected' then 'rejected'
    else 'needs_more_evidence'
  end;

  update public.registry_entity_relationships
  set review_status = p_next_review_status,
      public_safe = p_public_safe,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = btrim(p_reason),
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
    v_decision,
    btrim(p_reason),
    auth.uid()
  );

  return v_updated;
end;
$$;

revoke all on function public.review_registry_relationship(uuid, text, boolean, text) from public;
revoke all on function public.review_registry_relationship(uuid, text, boolean, text) from anon;
grant execute on function public.review_registry_relationship(uuid, text, boolean, text) to authenticated, service_role;

revoke all on function public.enforce_registry_relationship_promotion_rules() from public;
revoke all on function public.enforce_registry_relationship_promotion_rules() from anon;
revoke all on function public.enforce_registry_relationship_promotion_rules() from authenticated;

comment on function public.review_registry_relationship(uuid, text, boolean, text) is
  'Atomically reviews a Registry relationship, enforces evidence requirements, and records the shared review decision.';
