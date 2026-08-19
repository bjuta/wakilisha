begin;

do $preflight$
begin
  if to_regprocedure(
       'editorial.resolve_credit_person(uuid)'
     ) is null
     or to_regclass(
          'editorial.resource_credits'
        ) is null
     or to_regclass(
          'editorial.resource_aliases'
        ) is null
  then
    raise exception
      'STOP: governed Credit → Person authority is missing';
  end if;

  if to_regprocedure(
       'public.list_public_article_author_paths(text)'
     ) is not null
  then
    raise exception
      'STOP: public Article author Person path authority already exists';
  end if;
end;
$preflight$;

create function public.list_public_article_author_paths(
  p_article_slug text default null
)
returns table(
  article_id uuid,
  article_slug text,
  author_person_id uuid,
  author_person_path text
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with current_articles as (
    select
      article.id as article_id,
      article.slug as article_slug,
      resource.id as resource_id,
      resource.current_published_version_id
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'article'
     and resource.visibility = 'public'
     and resource.lifecycle_state = 'published'
     and resource.current_published_version_id is not null
    where p_article_slug is null
       or article.slug = p_article_slug
  ),
  primary_author_credit as (
    select distinct on (
      current_article.article_id
    )
      current_article.article_id,
      current_article.article_slug,
      attachment.credit_id
    from current_articles current_article
    join editorial.resource_credits attachment
      on attachment.resource_id =
         current_article.resource_id
     and attachment.resource_kind = 'article'
     and attachment.target_version_type =
         'article_version'
     and attachment.target_version_id =
         current_article.current_published_version_id
     and attachment.is_primary
     and attachment.public_safe
    join editorial.credits credit
      on credit.id = attachment.credit_id
     and credit.credit_role = 'author'
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
     and governance.credit_state = 'active'
     and governance.public_safe
    left join editorial.external_contributors contributor
      on contributor.id =
         credit.external_contributor_id
    where credit.external_contributor_id is null
       or (
         contributor.contributor_state = 'active'
         and contributor.public_safe
         and contributor.consent_status in (
           'granted',
           'not_required'
         )
       )
    order by
      current_article.article_id,
      attachment.display_order,
      attachment.created_at,
      attachment.id
  ),
  resolved as (
    select
      primary_credit.article_id,
      primary_credit.article_slug,
      editorial.resolve_credit_person(
        primary_credit.credit_id
      ) as author_person_id
    from primary_author_credit primary_credit
  )
  select
    resolved.article_id,
    resolved.article_slug,
    resolved.author_person_id,
    alias.path as author_person_path
  from resolved
  join editorial.resources person_resource
    on person_resource.id =
       resolved.author_person_id
   and person_resource.resource_kind = 'person'
   and person_resource.visibility = 'public'
   and person_resource.lifecycle_state = 'active'
  join editorial.resource_aliases alias
    on alias.resource_id =
       resolved.author_person_id
   and alias.is_canonical
   and alias.retired_at is null
  where resolved.author_person_id is not null
  order by
    resolved.article_slug,
    resolved.article_id;
$function$;

revoke all
on function
public.list_public_article_author_paths(text)
from public, anon, authenticated;

grant execute
on function
public.list_public_article_author_paths(text)
to service_role;

comment on function
public.list_public_article_author_paths(text)
is
  'Returns current public Article primary human Author Credit → canonical Person paths for server-owned public presentation. Institutional/unresolved bylines are omitted.';

commit;
