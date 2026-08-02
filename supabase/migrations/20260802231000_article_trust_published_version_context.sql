begin;

create or replace function public.get_article_working_version_identity(
  p_article_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_resource editorial.resources%rowtype;
  v_working_version editorial.article_versions%rowtype;
  v_published_version editorial.article_versions%rowtype;
  v_article_draft_version bigint;
begin
  if p_article_id is null then
    raise exception
      'Article id is required';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is null then
    raise exception
      'Not authenticated';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id;

  if not found then
    raise exception
      'Article resource identity not found';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(
       editorial.current_user_can_edit_article(
         v_resource.id
       ),
       false
     ) then
    raise exception
      'You do not have permission to read this Article working version';
  end if;

  if v_resource.current_working_version_id is null then
    raise exception
      'Article working version identity is unavailable';
  end if;

  select version.*
  into v_working_version
  from editorial.article_versions version
  where version.id =
      v_resource.current_working_version_id
    and version.resource_id = v_resource.id
    and version.article_id = p_article_id;

  if not found then
    raise exception
      'Article working version pointer is invalid';
  end if;

  if v_resource.current_published_version_id is not null then
    select version.*
    into v_published_version
    from editorial.article_versions version
    where version.id =
        v_resource.current_published_version_id
      and version.resource_id = v_resource.id
      and version.article_id = p_article_id;

    if not found then
      raise exception
        'Article published version pointer is invalid';
    end if;
  end if;

  select article.draft_version
  into v_article_draft_version
  from public.wk_articles article
  where article.id = p_article_id;

  if not found then
    raise exception
      'Article not found';
  end if;

  return jsonb_build_object(
    'article_id',
      p_article_id,
    'resource_id',
      v_resource.id,
    'working_version_id',
      v_working_version.id,
    'working_version_number',
      v_working_version.version_number,
    'working_version_kind',
      v_working_version.version_kind,
    'published_version_id',
      v_published_version.id,
    'published_version_number',
      v_published_version.version_number,
    'published_version_kind',
      v_published_version.version_kind,
    'source_draft_version',
      v_working_version.source_draft_version,
    'article_draft_version',
      v_article_draft_version
  );
end;
$function$;

revoke all
on function public.get_article_working_version_identity(uuid)
from public, anon;

grant execute
on function public.get_article_working_version_identity(uuid)
to authenticated, service_role;

comment on function
  public.get_article_working_version_identity(uuid)
is
  'Returns authoritative working and published Article version identities after Article edit authorization.';

notify pgrst, 'reload schema';

commit;
