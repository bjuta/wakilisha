with targets(signature) as (
  values
    ('create_article(text,text,text,text,text,text,text,jsonb,jsonb,jsonb,timestamp with time zone)'),
    ('create_magazine_issue(text,text,text,text,text,text,text,text)'),
    ('update_article(uuid,jsonb,timestamp with time zone)'),
    ('update_article(uuid,jsonb)'),
    ('update_article_hero_image(uuid,text)')
), audited as (
  select
    p.oid::regprocedure::text as function_signature,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join targets t on t.signature = p.oid::regprocedure::text
  where n.nspname = 'public'
)
select *
from audited
where anon_execute
   or not authenticated_execute
   or not service_role_execute;
