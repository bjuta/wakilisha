create or replace function public.create_institute_article_draft(
  p_title text,
  p_slug_base text,
  p_excerpt text default '',
  p_author text default 'WAKILISHA Contributor',
  p_seo jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  article_id uuid,
  article_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_base text;
  candidate_slug text;
  suffix integer := 2;
  new_article_id uuid;
begin
  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('institute_write')
    or public.current_user_has_capability('institute_admin')
  ) then
    raise exception 'Permission denied: institute_write required';
  end if;

  clean_base := lower(trim(coalesce(p_slug_base, p_title, 'institute-article-draft')));
  clean_base := regexp_replace(clean_base, '[^a-z0-9\s-]', '', 'g');
  clean_base := regexp_replace(clean_base, '[\s_]+', '-', 'g');
  clean_base := regexp_replace(clean_base, '-+', '-', 'g');
  clean_base := regexp_replace(clean_base, '(^-|-$)', '', 'g');
  clean_base := left(nullif(clean_base, ''), 76);

  if clean_base is null then
    clean_base := 'institute-article-draft';
  end if;

  candidate_slug := clean_base;

  while exists (select 1 from public.wk_articles where slug = candidate_slug) loop
    candidate_slug := clean_base || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.wk_articles (
    slug,
    title,
    excerpt,
    content_html,
    author,
    published_at,
    categories,
    tags,
    seo,
    wp_status,
    hero_image_url,
    raw_meta
  )
  values (
    candidate_slug,
    nullif(trim(coalesce(p_title, 'Untitled Institute article draft')), ''),
    coalesce(p_excerpt, ''),
    '',
    coalesce(nullif(trim(p_author), ''), 'WAKILISHA Contributor'),
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    coalesce(p_seo, '{}'::jsonb),
    'draft',
    null,
    jsonb_build_object(
      'source', 'institute',
      'created_from', 'institute_article_bridge'
    ) || coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_article_id;

  article_id := new_article_id;
  article_slug := candidate_slug;
  return next;
end;
$$;

grant execute on function public.create_institute_article_draft(text, text, text, text, jsonb, jsonb) to authenticated;
