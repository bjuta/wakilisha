revoke all on public.registry_missing_artist_intake_queue from public, anon, authenticated;
revoke all on public.registry_relationship_endpoint_work_queue from public, anon, authenticated;
revoke all on public.registry_relationship_evidence_readiness_queue from public, anon, authenticated;
revoke all on public.registry_relationship_consolidation_queue from public, anon, authenticated;
grant select on public.registry_missing_artist_intake_queue to authenticated, service_role;
grant select on public.registry_relationship_endpoint_work_queue to authenticated, service_role;
grant select on public.registry_relationship_evidence_readiness_queue to authenticated, service_role;
grant select on public.registry_relationship_consolidation_queue to authenticated, service_role;;
