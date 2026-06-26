-- Public cutover read grants
-- Fixes public React pages receiving 401 / permission denied from Supabase REST.
-- RLS remains enabled; these grants only allow the anon role to reach existing SELECT policies.

grant usage on schema public to anon;

grant select on table public.registry_genres to anon;
grant select on table public.registry_labels to anon;
grant select on table public.registry_releases to anon;
grant select on table public.wk_chart_editions_v2 to anon;

-- Keep authenticated reads explicit too, because public pages may run while logged in.
grant select on table public.registry_genres to authenticated;
grant select on table public.registry_labels to authenticated;
grant select on table public.registry_releases to authenticated;
grant select on table public.wk_chart_editions_v2 to authenticated;
