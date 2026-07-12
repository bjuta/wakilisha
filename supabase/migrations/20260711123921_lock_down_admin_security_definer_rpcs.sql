-- Remove anonymous and PUBLIC execution from SECURITY DEFINER admin RPCs.
-- Authenticated admin clients retain access, and every RPC keeps its existing
-- internal administrator or capability checks. service_role access is preserved.

revoke execute on function public.admin_apply_artist_decouple_decision(uuid) from public, anon;
revoke execute on function public.admin_apply_chart_artist_resolution_decision(uuid) from public, anon;
revoke execute on function public.admin_apply_registry_track_duplicate_repair(uuid, uuid[], text, boolean) from public, anon;
