-- PR17: Complete one relationship review in a single controlled transaction.

create or replace function public.complete_registry_relationship_review(
  p_relationship_id uuid,
  p_evidence_title text,
  p_evidence_type text,
  p_source_url text,
  p_evidence_summary text,
  p_evidence_main_claim text,
  p_reliability text,
  p_confidence text,
  p_plain_reason text,
  p_review_reason text,
  p_next_review_status text,
  p_public_safe boolean
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_evidence_id uuid;
  v_relationship public.registry_entity_relationships;
  v_evidence_review_status text;
  v_retrieval_status text;
begin
  if not (
    auth.role() = 'service_role'
    or public.institute_can_review()
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to review Registry relationships.';
  end if;

  if p_next_review_status not in ('pending_review', 'approved', 'rejected', 'disputed') then
    raise exception 'Choose a supported review decision.';
  end if;

  if nullif(btrim(p_plain_reason), '') is null then
    raise exception 'A plain-language explanation is required.';
  end if;

  if nullif(btrim(p_review_reason), '') is null then
    raise exception 'A review reason is required.';
  end if;

  if p_public_safe and p_next_review_status <> 'approved' then
    raise exception 'Only approved relationships can be marked public-safe.';
  end if;

  select * into v_relationship
  from public.registry_entity_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'Registry relationship not found.';
  end if;

  if v_relationship.source_entity_id is null or v_relationship.target_entity_id is null then
    raise exception 'Resolve both relationship endpoints before review.';
  end if;

  if p_next_review_status in ('approved', 'pending_review') then
    if nullif(btrim(p_evidence_title), '') is null
       or nullif(btrim(p_evidence_summary), '') is null then
      raise exception 'Evidence title and summary are required.';
    end if;

    if p_evidence_type not in (
      'article', 'official_documentation', 'academic_paper', 'release_metadata',
      'track_metadata', 'artist_metadata', 'interview', 'video', 'screenshot',
      'field_note', 'book_reference', 'chart_record'
    ) then
      raise exception 'Choose a supported evidence type.';
    end if;

    if p_reliability not in ('low', 'medium', 'high')
       or p_confidence not in ('low', 'medium', 'high') then
      raise exception 'Choose a valid reliability and confidence level.';
    end if;

    v_evidence_review_status := case when p_next_review_status = 'approved' then 'approved' else 'reviewed' end;
    v_retrieval_status := case when p_public_safe then 'default_retrieval' else 'review_only' end;

    insert into public.evidence_items (
      title, evidence_type, source_url, summary, main_claim, why_it_matters,
      reliability, confidence, review_status, retrieval_status,
      created_by, reviewed_by, reviewed_at
    ) values (
      btrim(p_evidence_title), p_evidence_type, nullif(btrim(p_source_url), ''),
      btrim(p_evidence_summary), nullif(btrim(p_evidence_main_claim), ''),
      'Supports the reviewed Registry relationship ' || p_relationship_id::text || '.',
      p_reliability, p_confidence, v_evidence_review_status, v_retrieval_status,
      auth.uid(), auth.uid(), now()
    ) returning id into v_evidence_id;

    insert into public.registry_relationship_evidence (
      relationship_id, evidence_id, support_type, note, created_by
    ) values (
      p_relationship_id, v_evidence_id, 'supports', btrim(p_review_reason), auth.uid()
    );
  end if;

  update public.registry_entity_relationships
  set plain_reason = btrim(p_plain_reason),
      public_safe = false,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_relationship_id;

  select * into v_relationship
  from public.review_registry_relationship(
    p_relationship_id,
    p_next_review_status,
    p_public_safe,
    btrim(p_review_reason)
  );

  return v_relationship;
end;
$$;

revoke all on function public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean) to authenticated, service_role;

comment on function public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean) is
  'Creates reviewed supporting evidence, saves the final plain-language explanation, and records one explicit human relationship review decision.';
