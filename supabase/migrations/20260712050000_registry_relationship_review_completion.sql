-- PR17: Complete one Registry relationship review from evidence to publication.

create or replace function public.get_registry_relationship_review_context(p_relationship_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_relationship jsonb;
  v_evidence jsonb;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_has_capability('view_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to review Registry relationships.';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'sourceEntityId', r.source_entity_id,
    'sourceEntityType', r.source_entity_type,
    'sourceSlug', r.source_slug,
    'sourceName', coalesce(sa.display_name, st.title, r.source_slug),
    'targetEntityId', r.target_entity_id,
    'targetEntityType', r.target_entity_type,
    'targetSlug', r.target_slug,
    'targetName', coalesce(ta.display_name, tt.title, r.target_slug),
    'relationshipType', r.relationship_type,
    'relationshipRole', r.relationship_role,
    'relationshipStatus', r.relationship_status,
    'reviewStatus', r.review_status,
    'publicSafe', r.public_safe,
    'plainReason', r.plain_reason,
    'reviewNote', r.review_note
  )
  into v_relationship
  from public.registry_entity_relationships r
  left join public.registry_artists sa on r.source_entity_type = 'artist' and sa.id = r.source_entity_id
  left join public.registry_tracks st on r.source_entity_type = 'track' and st.id = r.source_entity_id
  left join public.registry_artists ta on r.target_entity_type = 'artist' and ta.id = r.target_entity_id
  left join public.registry_tracks tt on r.target_entity_type = 'track' and tt.id = r.target_entity_id
  where r.id = p_relationship_id;

  if v_relationship is null then
    raise exception 'Registry relationship not found.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'evidenceType', e.evidence_type,
    'sourceUrl', e.source_url,
    'summary', e.summary,
    'mainClaim', e.main_claim,
    'whyItMatters', e.why_it_matters,
    'reviewStatus', e.review_status,
    'retrievalStatus', e.retrieval_status,
    'reliability', e.reliability,
    'confidence', e.confidence,
    'attached', exists (
      select 1 from public.registry_relationship_evidence re
      where re.relationship_id = p_relationship_id
        and re.evidence_id = e.id
        and re.support_type = 'supports'
    )
  ) order by e.review_status desc, e.updated_at desc), '[]'::jsonb)
  into v_evidence
  from public.evidence_items e
  where e.review_status in ('reviewed', 'approved');

  return jsonb_build_object('relationship', v_relationship, 'evidence', v_evidence);
end;
$$;

create or replace function public.complete_registry_relationship_review(
  p_relationship_id uuid,
  p_evidence_id uuid,
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
  v_evidence public.evidence_items;
  v_updated public.registry_entity_relationships;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to complete Registry relationship reviews.';
  end if;

  if p_next_review_status not in ('pending_review', 'approved', 'rejected', 'disputed') then
    raise exception 'Unsupported relationship review status.';
  end if;

  if nullif(btrim(p_review_reason), '') is null then
    raise exception 'A review reason is required.';
  end if;

  if p_next_review_status = 'approved' and nullif(btrim(p_plain_reason), '') is null then
    raise exception 'Approved relationships require a plain-language explanation.';
  end if;

  if p_next_review_status = 'approved' and p_evidence_id is null then
    raise exception 'Approved relationships require supporting evidence.';
  end if;

  if p_evidence_id is not null then
    select * into v_evidence from public.evidence_items where id = p_evidence_id for share;
    if not found then
      raise exception 'Evidence item not found.';
    end if;

    if p_next_review_status = 'approved' and v_evidence.review_status not in ('reviewed', 'approved') then
      raise exception 'Approved relationships require reviewed supporting evidence.';
    end if;

    if p_public_safe and not (
      v_evidence.review_status = 'approved'
      and v_evidence.retrieval_status = 'default_retrieval'
    ) then
      raise exception 'Public relationships require approved evidence enabled for public retrieval.';
    end if;

    insert into public.registry_relationship_evidence (
      relationship_id, evidence_id, support_type, note, created_by
    ) values (
      p_relationship_id, p_evidence_id, 'supports', btrim(p_review_reason), auth.uid()
    ) on conflict (relationship_id, evidence_id, support_type)
      do update set note = excluded.note;
  end if;

  update public.registry_entity_relationships
  set plain_reason = nullif(btrim(p_plain_reason), ''),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_relationship_id;

  if not found then
    raise exception 'Registry relationship not found.';
  end if;

  select public.review_registry_relationship(
    p_relationship_id,
    p_next_review_status,
    p_public_safe,
    p_review_reason
  ) into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.get_registry_relationship_review_context(uuid) from public, anon;
revoke all on function public.complete_registry_relationship_review(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.get_registry_relationship_review_context(uuid) to authenticated, service_role;
grant execute on function public.complete_registry_relationship_review(uuid, uuid, text, text, text, boolean) to authenticated, service_role;

comment on function public.get_registry_relationship_review_context(uuid) is
  'Returns one relationship and the reviewed evidence available for human review.';
comment on function public.complete_registry_relationship_review(uuid, uuid, text, text, text, boolean) is
  'Attaches evidence, saves the final explanation, records the review decision, and applies the explicit public-safe choice in one transaction.';