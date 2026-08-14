revoke all on function public.resolve_registry_relationship_endpoint(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.resolve_registry_relationship_endpoint(uuid, text, text, uuid, text) to authenticated, service_role;
comment on view public.registry_relationship_endpoint_resolution_queue is 'Read-only queue classifying canonical, provenance-only, unresolved, and ambiguous legacy relationship endpoints.';
comment on function public.resolve_registry_relationship_endpoint(uuid, text, text, uuid, text) is 'Resolves one legacy relationship endpoint to a reviewed canonical Registry entity and records the decision.';;
