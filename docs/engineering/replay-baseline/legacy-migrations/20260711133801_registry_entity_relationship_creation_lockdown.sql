drop policy if exists registry_entity_relationships_admin_write on public.registry_entity_relationships;
revoke insert, update, delete on table public.registry_entity_relationships from authenticated;
grant select on table public.registry_entity_relationships to authenticated;;
