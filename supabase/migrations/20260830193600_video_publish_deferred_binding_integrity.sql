begin;

-- Real Video publication exposed that the deferred cross-resource binding
-- integrity trigger can fire after a SECURITY DEFINER command has returned to
-- the authenticated caller. The trigger function then ran as invoker and could
-- not read private typed binding tables such as
-- editorial.video_publication_resources.
--
-- Binding integrity is an internal cross-schema invariant. Execute it under its
-- owning postgres role, keep a fixed search_path, and remove all direct client
-- EXECUTE privileges.

alter function editorial.assert_resource_binding_integrity()
  security definer;

alter function editorial.assert_resource_binding_integrity()
  set search_path = pg_catalog, editorial, audio;

revoke all
  on function editorial.assert_resource_binding_integrity()
  from public, anon, authenticated, service_role;

commit;
