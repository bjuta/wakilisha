-- Allow authenticated Registry reviewers to read helper views used by the review workspace.
-- These remain security-invoker views, so underlying RLS stays authoritative.

revoke all on public.registry_missing_artist_latest_submission from public, anon, authenticated;
revoke all on public.registry_relationship_duplicate_keys from public, anon, authenticated;
revoke all on public.registry_unresolved_relationship_endpoints from public, anon, authenticated;

grant select on public.registry_missing_artist_latest_submission to authenticated, service_role;
grant select on public.registry_relationship_duplicate_keys to authenticated, service_role;
grant select on public.registry_unresolved_relationship_endpoints to authenticated, service_role;
