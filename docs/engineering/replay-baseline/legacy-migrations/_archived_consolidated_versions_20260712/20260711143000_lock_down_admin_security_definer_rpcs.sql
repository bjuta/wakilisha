-- Remove anonymous and PUBLIC execution from SECURITY DEFINER admin RPCs.
-- Authenticated admin clients retain access, and every RPC keeps its existing
-- internal administrator or capability checks. service_role access is preserved.

revoke execute on function public.admin_apply_artist_decouple_decision(uuid) from public, anon;
revoke execute on function public.admin_apply_chart_artist_resolution_decision(uuid) from public, anon;
revoke execute on function public.admin_apply_registry_track_duplicate_repair(uuid, uuid[], text, boolean) from public, anon;
revoke execute on function public.admin_create_registry_artist_for_decouple(text, text, text, text) from public, anon;
revoke execute on function public.admin_decouple_registry_artist(uuid, jsonb, text, boolean, uuid) from public, anon;
revoke execute on function public.admin_get_artist_decouple_decisions(text) from public, anon;
revoke execute on function public.admin_get_artist_decouple_preview(uuid) from public, anon;
revoke execute on function public.admin_get_artist_resolution_history(integer) from public, anon;
revoke execute on function public.admin_get_chart_artist_resolution_decisions(text) from public, anon;
revoke execute on function public.admin_get_registry_artist_merge_preview(uuid, uuid) from public, anon;
revoke execute on function public.admin_get_registry_track_duplicate_audit(integer, boolean) from public, anon;
revoke execute on function public.admin_log_artist_resolution_event(text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb) from public, anon;
revoke execute on function public.admin_merge_registry_artists(uuid, uuid, text, boolean) from public, anon;
revoke execute on function public.admin_preview_registry_track_duplicate_repair(uuid, uuid[]) from public, anon;
revoke execute on function public.admin_refresh_signal_os_rollups(date, date) from public, anon;
revoke execute on function public.admin_resolve_chart_artist_alias(text, uuid, text, boolean) from public, anon;
revoke execute on function public.admin_safe_merge_registry_artists(uuid, uuid, text, boolean, text) from public, anon;
revoke execute on function public.admin_search_registry_artists(text, integer) from public, anon;
revoke execute on function public.admin_upsert_artist_decouple_decision(text, text, text, text, uuid, text, jsonb, jsonb, jsonb, uuid, text, text, text) from public, anon;
revoke execute on function public.admin_upsert_chart_artist_resolution_decision(text, text, text, jsonb, jsonb, text) from public, anon;

-- State the intended grants explicitly so later function recreation does not make
-- the desired application boundary ambiguous in migration history.
grant execute on function public.admin_apply_artist_decouple_decision(uuid) to authenticated, service_role;
grant execute on function public.admin_apply_chart_artist_resolution_decision(uuid) to authenticated, service_role;
grant execute on function public.admin_apply_registry_track_duplicate_repair(uuid, uuid[], text, boolean) to authenticated, service_role;
grant execute on function public.admin_create_registry_artist_for_decouple(text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_decouple_registry_artist(uuid, jsonb, text, boolean, uuid) to authenticated, service_role;
grant execute on function public.admin_get_artist_decouple_decisions(text) to authenticated, service_role;
grant execute on function public.admin_get_artist_decouple_preview(uuid) to authenticated, service_role;
grant execute on function public.admin_get_artist_resolution_history(integer) to authenticated, service_role;
grant execute on function public.admin_get_chart_artist_resolution_decisions(text) to authenticated, service_role;
grant execute on function public.admin_get_registry_artist_merge_preview(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_get_registry_track_duplicate_audit(integer, boolean) to authenticated, service_role;
grant execute on function public.admin_log_artist_resolution_event(text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb) to authenticated, service_role;
grant execute on function public.admin_merge_registry_artists(uuid, uuid, text, boolean) to authenticated, service_role;
grant execute on function public.admin_preview_registry_track_duplicate_repair(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.admin_refresh_signal_os_rollups(date, date) to authenticated, service_role;
grant execute on function public.admin_resolve_chart_artist_alias(text, uuid, text, boolean) to authenticated, service_role;
grant execute on function public.admin_safe_merge_registry_artists(uuid, uuid, text, boolean, text) to authenticated, service_role;
grant execute on function public.admin_search_registry_artists(text, integer) to authenticated, service_role;
grant execute on function public.admin_upsert_artist_decouple_decision(text, text, text, text, uuid, text, jsonb, jsonb, jsonb, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.admin_upsert_chart_artist_resolution_decision(text, text, text, jsonb, jsonb, text) to authenticated, service_role;
