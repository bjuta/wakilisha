-- Phase 6A post-closure UI repair:
-- let authenticated Article-admin readers resolve canonical Resource identity
-- for private draft Articles without broadening public/editorial table RLS.

create or replace function public.get_admin_article_resource_identities(
  p_article_ids uuid[]
)
returns table (
  canonical_record_id uuid,
  resource_id uuid,
  owner_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if not (
    public.current_user_has_capability('view_dashboard')
    or public.current_user_is_administrator()
  ) then
    raise exception 'administrator Article read access required'
      using errcode = '42501';
  end if;

  if p_article_ids is null
     or cardinality(p_article_ids) = 0 then
    return;
  end if;

  return query
  select
    binding.article_id as canonical_record_id,
    binding.resource_id,
    resource.owner_id
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = any(p_article_ids);
end;
$function$;

revoke all on function
  public.get_admin_article_resource_identities(uuid[])
from public;

revoke all on function
  public.get_admin_article_resource_identities(uuid[])
from anon;

grant execute on function
  public.get_admin_article_resource_identities(uuid[])
to authenticated;
