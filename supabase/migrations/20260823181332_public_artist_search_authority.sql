create or replace function public.get_public_registry_artists_for_search(
  p_limit integer default 500
)
returns table (
  id uuid,
  slug text,
  display_name text,
  public_image_url text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.slug,
    a.display_name,
    a.public_image_url,
    a.metadata
  from public.registry_artists a
  where a.status = 'active'
  order by a.display_name asc
  limit greatest(
    1,
    least(coalesce(p_limit, 500), 500)
  );
$$;

revoke all on function public.get_public_registry_artists_for_search(integer)
from public;

grant execute on function public.get_public_registry_artists_for_search(integer)
to anon, authenticated;
