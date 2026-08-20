-- Phase 6A closure: close Article identity provisioning and administrator read grants.
--
-- This migration:
-- 1. restores authenticated table SELECT required by administrator-only RLS
-- 2. repairs any Article missing canonical Resource/version identity
-- 3. makes Article Resource/version provisioning invariant for future inserts
--
-- It deliberately does not alter Audio authority, public routes, or Phase 6B delivery.

grant select on table public.admin_user_invites to authenticated;
grant select on table public.admin_audit_events to authenticated;
grant select on table public.admin_account_recovery_events to authenticated;

revoke select on table public.admin_user_invites from anon;
revoke select on table public.admin_audit_events from anon;
revoke select on table public.admin_account_recovery_events from anon;

create or replace function editorial.ensure_article_resource_identity(
  p_article_id uuid,
  p_owner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  article_row public.wk_articles%rowtype;
  existing_resource_id uuid;
  new_resource_id uuid;
  baseline_version_id uuid;
begin
  select article.*
  into article_row
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception
      'Article not found: %',
      p_article_id;
  end if;

  select binding.resource_id
  into existing_resource_id
  from editorial.article_resources binding
  where binding.article_id = p_article_id;

  if existing_resource_id is not null then
    return existing_resource_id;
  end if;

  insert into editorial.resources (
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by,
    created_at,
    updated_at
  )
  values (
    'article',
    p_owner_id,
    case
      when article_row.wp_status = 'publish' then 'public'
      when article_row.wp_status = 'future' then 'internal'
      else 'private'
    end,
    case
      when article_row.wp_status = 'publish' then 'published'
      when article_row.wp_status = 'trash' then 'archived'
      when article_row.wp_status = 'future' then 'active'
      else 'draft'
    end,
    p_owner_id,
    coalesce(article_row.created_at, now()),
    coalesce(
      article_row.updated_at,
      article_row.created_at,
      now()
    )
  )
  returning id
  into new_resource_id;

  insert into editorial.article_resources (
    resource_id,
    resource_kind,
    article_id
  )
  values (
    new_resource_id,
    'article',
    article_row.id
  );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    created_at,
    content_fingerprint
  )
  values (
    new_resource_id,
    article_row.id,
    1,
    'baseline',
    article_row.draft_version,
    article_row.title,
    article_row.slug,
    article_row.excerpt,
    article_row.content_html,
    article_row.author,
    p_owner_id,
    article_row.hero_image_id,
    article_row.hero_image_url,
    coalesce(
      article_row.seo,
      '{}'::jsonb
    ),
    case
      when article_row.wp_status = 'publish' then 'published'
      when article_row.wp_status = 'trash' then 'archived'
      when article_row.wp_status = 'future' then 'active'
      else 'draft'
    end,
    article_row.wp_status,
    article_row.published_at,
    coalesce(
      article_row.categories,
      '[]'::jsonb
    ),
    coalesce(
      article_row.tags,
      '[]'::jsonb
    ),
    p_owner_id,
    coalesce(
      article_row.updated_at,
      article_row.created_at,
      now()
    ),
    editorial.article_snapshot_fingerprint(
      article_row.title,
      article_row.slug,
      article_row.excerpt,
      article_row.content_html,
      article_row.author,
      article_row.hero_image_id,
      article_row.hero_image_url,
      coalesce(
        article_row.seo,
        '{}'::jsonb
      ),
      article_row.wp_status,
      article_row.published_at,
      coalesce(
        article_row.categories,
        '[]'::jsonb
      ),
      coalesce(
        article_row.tags,
        '[]'::jsonb
      )
    )
  )
  returning id
  into baseline_version_id;

  update editorial.resources
  set current_working_version_id =
    baseline_version_id
  where id = new_resource_id;

  return new_resource_id;
end;
$function$;

revoke all on function
  editorial.ensure_article_resource_identity(uuid, uuid)
from public;

create or replace function
  editorial.provision_article_resource_identity_after_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
begin
  perform editorial.ensure_article_resource_identity(
    new.id,
    auth.uid()
  );

  return new;
end;
$function$;

revoke all on function
  editorial.provision_article_resource_identity_after_insert()
from public;

drop trigger if exists
  wk_articles_provision_resource_identity
on public.wk_articles;

create trigger
  wk_articles_provision_resource_identity
after insert
on public.wk_articles
for each row
execute function
  editorial.provision_article_resource_identity_after_insert();

select editorial.ensure_article_resource_identity(
  article.id,
  null
)
from public.wk_articles article
where not exists (
  select 1
  from editorial.article_resources binding
  where binding.article_id = article.id
);
