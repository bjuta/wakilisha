revoke all on function public.review_registry_cultural_entity(uuid,text,text,boolean,text) from public,anon;
grant execute on function public.review_registry_cultural_entity(uuid,text,text,boolean,text) to authenticated,service_role;
comment on function public.review_registry_cultural_entity(uuid,text,text,boolean,text) is 'Reviews a broader cultural entity, controls publication state, and records the shared review decision.';;
