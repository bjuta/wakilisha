-- PR17 follow-up: create one reviewed evidence item from the relationship review drawer.

create or replace function public.create_registry_relationship_review_evidence(
  p_title text,
  p_evidence_type text,
  p_source_url text,
  p_summary text,
  p_main_claim text,
  p_review_reason text
)
returns public.evidence_items
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_created public.evidence_items;
begin
  if not (
    auth.role() = 'service_role'
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  ) then
    raise exception 'You do not have permission to create reviewed Registry evidence.';
  end if;

  if nullif(btrim(p_title), '') is null then raise exception 'Evidence title is required.'; end if;
  if nullif(btrim(p_source_url), '') is null then raise exception 'A source URL is required.'; end if;
  if nullif(btrim(p_summary), '') is null then raise exception 'Evidence summary is required.'; end if;
  if nullif(btrim(p_review_reason), '') is null then raise exception 'A review reason is required.'; end if;
  if p_evidence_type not in ('article', 'official_documentation', 'release_metadata', 'track_metadata', 'artist_metadata', 'interview', 'video') then
    raise exception 'Unsupported evidence type for this review flow.';
  end if;

  insert into public.evidence_items (
    title,
    evidence_type,
    source_url,
    source_note,
    summary,
    main_claim,
    why_it_matters,
    reliability,
    confidence,
    review_status,
    retrieval_status,
    created_by,
    reviewed_by,
    reviewed_at
  ) values (
    btrim(p_title),
    p_evidence_type,
    btrim(p_source_url),
    'Created during Registry relationship review. ' || btrim(p_review_reason),
    btrim(p_summary),
    nullif(btrim(p_main_claim), ''),
    'Supports a reviewed Registry relationship.',
    'high',
    'high',
    'approved',
    'default_retrieval',
    auth.uid(),
    auth.uid(),
    now()
  ) returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.create_registry_relationship_review_evidence(text, text, text, text, text, text) from public, anon;
grant execute on function public.create_registry_relationship_review_evidence(text, text, text, text, text, text) to authenticated, service_role;

comment on function public.create_registry_relationship_review_evidence(text, text, text, text, text, text) is
  'Creates one explicitly reviewed evidence item for use in the Registry relationship review drawer.';