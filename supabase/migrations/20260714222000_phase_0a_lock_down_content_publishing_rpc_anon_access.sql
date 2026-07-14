begin;

revoke execute on function public.create_article(text, text, text, text, text, text, text, jsonb, jsonb, jsonb, timestamp with time zone)
  from public, anon;
revoke execute on function public.create_magazine_issue(text, text, text, text, text, text, text, text)
  from public, anon;
revoke execute on function public.update_article(uuid, jsonb, timestamp with time zone)
  from public, anon;
revoke execute on function public.update_article(uuid, jsonb)
  from public, anon;
revoke execute on function public.update_article_hero_image(uuid, text)
  from public, anon;

grant execute on function public.create_article(text, text, text, text, text, text, text, jsonb, jsonb, jsonb, timestamp with time zone)
  to authenticated, service_role;
grant execute on function public.create_magazine_issue(text, text, text, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.update_article(uuid, jsonb, timestamp with time zone)
  to authenticated, service_role;
grant execute on function public.update_article(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.update_article_hero_image(uuid, text)
  to authenticated, service_role;

commit;
