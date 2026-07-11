-- PR7: Controlled creation and review workflows for broader cultural entities.

alter table public.review_decisions
  drop constraint if exists review_decisions_subject_type_check;

alter table public.review_decisions
  add constraint review_decisions_subject_type_check
  check (subject_type in (
    'relationship',
    'evidence',
    'surface_draft',
    'ai_run',
    'correction',
    'claim',
    'contributor_submission',
    'cultural_entity'
  ));

create or replace function public.create_registry_cultural_entity(
  p_entity_type text,
  p_name text,
  p_slug text,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_source_table text default null,
  p_source_id text default null
)
returns public.cultural_entities
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_created public.cultural_entities;
begin
  if not public.institute_can_manage() then
    raise exception 'You do not have permission to create Registry cultural entities.';
  end if;

  if p_entity_type not in (
    'person','scene','place','event','institution','work','concept',
    'language','movement','publication','organization',
    'article','inquiry','memory','source'
  ) then
    raise exception 'This workflow only creates broader cultural entities.';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'A cultural entity name is required.';
  end if;

  if nullif(btrim(p_slug), '') is null then
    raise exception 'A cultural entity slug is required.';
  end if;

  if (p_source_table is null) <> (p_source_id is null) then
    raise exception 'Source table and source ID must be provided together.';
  end if;

  insert into public.cultural_entities (
    entity_type,
    source_table,
    source_id,
    name,
    slug,
    description,
    status,
    review_status,
    public_safe,
    metadata
  ) values (
    p_entity_type,
    nullif(btrim(p_source_table), ''),
    nullif(btrim(p_source_id), ''),
    btrim(p_name),
    btrim(p_slug),
    nullif(btrim(p_description), ''),
    'draft',
    'unreviewed',
    false,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_created;

  return v_created;
end;
$$;

create or replace function public.review_registry_cultural_entity(
  p_entity_id uuid,
  p_next_review_status text,
  p_public_safe boolean,
  p_reason text
)
returns public.cultural_entities
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.cultural_entities;
  v_updated public.cultural_entities;
  v_decision text;
begin
  if not public.institute_can_review() then
    raise exception 'You do not have permission to review Registry cultural entities.';
  end if;

  if p_next_review_status not in ('pending_review','approved','rejected','disputed') then
    raise exception 'Unsupported cultural entity review status.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A review reason is required.';
  end if;

  if p_public_safe and p_next_review_status <> 'approved' then
    raise exception 'Only approved cultural entities can be marked public-safe.';
  end if;

  select *
  into v_current
  from public.cultural_entities
  where id = p_entity_id
  for update;

  if not found then
    raise exception 'Registry cultural entity not found.';
  end if;

  if v_current.entity_type in ('artist','track','release','label','genre') then
    raise exception 'Music Registry entities must be reviewed in their authoritative Registry tables.';
  end if;

  if p_public_safe and nullif(btrim(v_current.description), '') is null then
    raise exception 'Public-safe cultural entities require a description.';
  end if;

  v_decision := case
    when p_next_review_status = 'approved' then 'approved'
    when p_next_review_status = 'rejected' then 'rejected'
    else 'needs_more_evidence'
  end;

  update public.cultural_entities
  set review_status = p_next_review_status,
      public_safe = p_public_safe,
      status = case when p_next_review_status = 'approved' then 'active' else status end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = btrim(p_reason),
      updated_at = now()
  where id = p_entity_id
  returning * into v_updated;

  insert into public.review_decisions (
    subject_type,
    subject_id,
    decision,
    reason,
    reviewer_id
  ) values (
    'cultural_entity',
    p_entity_id,
    v_decision,
    btrim(p_reason),
    auth.uid()
  );

  return v_updated;
end;
$$;

revoke insert, update, delete on table public.cultural_entities from authenticated;

revoke all on function public.create_registry_cultural_entity(text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.create_registry_cultural_entity(text, text, text, text, jsonb, text, text) to authenticated, service_role;

revoke all on function public.review_registry_cultural_entity(uuid, text, boolean, text) from public, anon;
grant execute on function public.review_registry_cultural_entity(uuid, text, boolean, text) to authenticated, service_role;

comment on function public.create_registry_cultural_entity(text, text, text, text, jsonb, text, text) is
  'Creates a draft broader cultural entity through the controlled Registry workflow.';

comment on function public.review_registry_cultural_entity(uuid, text, boolean, text) is
  'Reviews a broader cultural entity, records the decision, and controls public-safe promotion.';