create or replace function public.create_article_preview_link(
  p_article_id uuid,
  p_version_id uuid default null,
  p_expires_at timestamptz default null
)
returns table (
  nonce text,
  expires_at timestamptz,
  version_id uuid
)
language plpgsql
security definer
set search_path = public, editorial, pg_temp
as $$
declare
  v_version editorial.article_versions%rowtype;
  v_nonce uuid := gen_random_uuid();
  v_expires_at timestamptz := coalesce(
    p_expires_at,
    now() + interval '7 days'
  );
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_article_id is null then
    raise exception 'article id is required';
  end if;

  if v_expires_at <= now() then
    raise exception 'preview expiry must be in the future';
  end if;

  if p_version_id is null then
    select version.*
      into v_version
    from editorial.article_versions version
    where version.article_id = p_article_id
    order by version.version_number desc
    limit 1;
  else
    select version.*
      into v_version
    from editorial.article_versions version
    where version.id = p_version_id
      and version.article_id = p_article_id
    limit 1;
  end if;

  if v_version.id is null then
    raise exception 'article version not found';
  end if;

  insert into public.wk_article_preview_links (
    nonce,
    article_id,
    version_id,
    created_by,
    expires_at
  )
  values (
    v_nonce::text,
    p_article_id,
    v_version.id,
    auth.uid(),
    v_expires_at
  );

  update public.wk_articles article
     set preview_nonce = v_nonce,
         preview_nonce_expires_at = v_expires_at,
         updated_at = now()
   where article.id = p_article_id;

  return query
  select
    v_nonce::text,
    v_expires_at,
    v_version.id;
end;
$$;

revoke all on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
)
from public;

grant execute on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
)
to authenticated, service_role;

comment on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
) is
  'Creates a preview nonce for an immutable article version and stores the legacy article nonce as uuid.';
