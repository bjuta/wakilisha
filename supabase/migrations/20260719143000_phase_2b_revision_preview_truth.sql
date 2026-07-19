drop function if exists public.list_article_versions(uuid, integer);

create or replace function public.list_article_versions(
  p_article_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  revision_number bigint,
  version_kind text,
  created_at timestamptz,
  created_by text,
  title text,
  slug text,
  content_html text,
  excerpt text,
  author text,
  categories jsonb,
  tags jsonb,
  hero_image_url text,
  seo jsonb,
  lifecycle_state text,
  wp_status text,
  published_at timestamptz,
  content_fingerprint text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_resource_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_article_id is null then
    raise exception 'Article id is required';
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.article_resources binding
  where binding.article_id = p_article_id;

  if v_resource_id is null then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(v_resource_id) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    version.id::uuid,
    version.version_number::bigint,
    version.version_kind::text,
    version.created_at::timestamptz,
    case
      when version.version_kind = 'autosave'
        then 'autosave'
      when version.created_by is null
        then 'System'
      else version.created_by::text
    end::text as created_by,
    version.title::text,
    version.slug::text,
    version.content_html::text,
    version.excerpt::text,
    version.author_display::text,
    coalesce(version.category_snapshot, '[]'::jsonb)::jsonb,
    coalesce(version.tag_snapshot, '[]'::jsonb)::jsonb,
    version.hero_image_url::text,
    coalesce(version.seo, '{}'::jsonb)::jsonb,
    version.lifecycle_state::text,
    version.wp_status::text,
    version.published_at::timestamptz,
    version.content_fingerprint::text
  from editorial.article_versions version
  where version.resource_id = v_resource_id
  order by version.version_number desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$function$;

revoke execute on function public.list_article_versions(uuid, integer) from public;
grant execute on function public.list_article_versions(uuid, integer) to authenticated;

comment on function public.list_article_versions(uuid, integer)
  is 'Lists immutable Article versions for admin revision history, including metadata fields needed for truthful comparison.';

create or replace function editorial.clear_article_preview_nonce_after_version_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
begin
  update public.wk_articles article
     set preview_nonce = null,
         preview_nonce_expires_at = null,
         updated_at = now()
   where article.id = new.article_id;

  return new;
end;
$function$;

drop trigger if exists clear_article_preview_nonce_after_version_change
  on editorial.article_versions;

create trigger clear_article_preview_nonce_after_version_change
after insert on editorial.article_versions
for each row
execute function editorial.clear_article_preview_nonce_after_version_change();

update public.wk_articles article
   set preview_nonce = null,
       preview_nonce_expires_at = null,
       updated_at = now()
 where article.preview_nonce is not null
   and exists (
     select 1
     from public.wk_article_preview_links link
     join lateral (
       select latest.id
       from editorial.article_versions latest
       where latest.article_id = article.id
       order by latest.version_number desc
       limit 1
     ) latest_version
       on true
     where link.nonce = article.preview_nonce
       and link.article_id = article.id
       and link.version_id <> latest_version.id
   );

comment on function editorial.clear_article_preview_nonce_after_version_change()
  is 'Clears the editor preview pointer whenever a newer immutable Article version is saved.';
