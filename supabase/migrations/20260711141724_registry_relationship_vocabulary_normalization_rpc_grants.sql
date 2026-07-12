revoke all on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) from public, anon;
grant execute on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) to authenticated, service_role;
comment on function public.normalize_registry_relationship_vocabulary(uuid, text, text, text) is
  'Normalizes one Registry relationship type and role, reopens review where needed, and records the decision.';;
