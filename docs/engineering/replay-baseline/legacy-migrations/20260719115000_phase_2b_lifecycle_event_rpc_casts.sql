create or replace function public.list_article_lifecycle_events(
  p_article_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  article_id uuid,
  version_id uuid,
  version_number bigint,
  action text,
  prior_status text,
  resulting_status text,
  note text,
  metadata jsonb,
  actor_id uuid,
  actor_label text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_article_id is null then
    raise exception 'Article id is required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = p_article_id
  ) then
    raise exception 'Article not found';
  end if;

  return query
  select
    event.id::uuid,
    event.article_id::uuid,
    event.version_id::uuid,
    version.version_number::bigint,
    event.action::text,
    event.prior_status::text,
    event.resulting_status::text,
    event.note::text,
    coalesce(event.metadata, '{}'::jsonb)::jsonb,
    event.actor_id::uuid,
    coalesce(actor.email, event.actor_id::text, 'system')::text as actor_label,
    event.created_at::timestamptz
  from editorial.article_lifecycle_events event
  left join editorial.article_versions version
    on version.id = event.version_id
  left join auth.users actor
    on actor.id = event.actor_id
  where event.article_id = p_article_id
  order by event.created_at desc, event.id desc
  limit v_limit;
end;
$function$;

revoke execute on function public.list_article_lifecycle_events(uuid, integer) from public;
grant execute on function public.list_article_lifecycle_events(uuid, integer) to authenticated;

comment on function public.list_article_lifecycle_events(uuid, integer)
  is 'Lists article lifecycle events for admin review history using exact result type casts.';
