begin;

create or replace function public.create_taxonomy_term(
  p_taxonomy text,
  p_slug text,
  p_name text,
  p_description text default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_seo_keywords text default null
)
returns table(
  id uuid,
  slug text,
  name text,
  description text,
  seo_title text,
  seo_description text,
  seo_keywords text,
  source_kind text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
  v_term_id uuid;
  v_metadata jsonb;
  v_required_capability text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_required_capability :=
    case p_taxonomy
      when 'category' then 'manage_categories'
      when 'post_tag' then 'manage_tags'
      else null
    end;

  if v_required_capability is null then
    raise exception
      'Unsupported taxonomy: %',
      p_taxonomy;
  end if;

  if not exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id = v_user_id
      and assignment.status = 'active'
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
      and (
        assignment.role_key = 'administrator'
        or exists (
          select 1
          from public.role_capabilities capability
          where capability.role_key = assignment.role_key
            and capability.capability_key =
              v_required_capability
        )
      )
  ) then
    raise exception
      'Permission denied: % capability required',
      v_required_capability;
  end if;

  if exists (
    select 1
    from public.registry_taxonomy_terms existing_term
    where existing_term.slug = p_slug
      and existing_term.taxonomy = p_taxonomy
  ) then
    raise exception
      'Term with slug "%" already exists in taxonomy "%"',
      p_slug,
      p_taxonomy;
  end if;

  v_metadata := jsonb_strip_nulls(
    jsonb_build_object(
      'seo_title', p_seo_title,
      'seo_description', p_seo_description,
      'seo_keywords', p_seo_keywords
    )
  );

  insert into public.registry_taxonomy_terms as inserted_term (
    taxonomy,
    slug,
    name,
    description,
    status,
    source_kind,
    metadata,
    created_at,
    updated_at
  ) values (
    p_taxonomy,
    p_slug,
    p_name,
    p_description,
    'active',
    'editor_ui',
    v_metadata,
    now(),
    now()
  )
  returning inserted_term.id
  into v_term_id;

  return query
  select
    created_term.id,
    created_term.slug,
    created_term.name,
    created_term.description,
    created_term.metadata ->> 'seo_title',
    created_term.metadata ->> 'seo_description',
    created_term.metadata ->> 'seo_keywords',
    created_term.source_kind,
    created_term.created_at,
    created_term.updated_at
  from public.registry_taxonomy_terms created_term
  where created_term.id = v_term_id;
end;
$function$;

revoke all on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  from public, anon;

grant execute on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  to authenticated, service_role;

comment on function
  public.create_taxonomy_term(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
  is
  'Creates one governed category or post tag with taxonomy-specific capability validation and fully qualified registry references.';

notify pgrst, 'reload schema';

commit;
