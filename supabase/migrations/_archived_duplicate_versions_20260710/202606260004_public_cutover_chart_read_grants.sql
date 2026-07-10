-- Public cutover chart read grants
-- Fixes public React pages receiving 401 / permission denied from Supabase REST for chart tables.
-- RLS remains enabled; these grants only allow anon/authenticated to reach existing public SELECT policies.

grant select on table public.wk_chart_entries_v2 to anon;
grant select on table public.wk_chart_markets_v2 to anon;
grant select on table public.wk_chart_programs_v2 to anon;
grant select on table public.wk_chart_series_v2 to anon;
grant select on table public.wk_chart_slug_aliases_v2 to anon;
grant select on table public.wk_chart_source_coverage_v2 to anon;
grant select on table public.wk_chart_methodologies_v2 to anon;

grant select on table public.wk_chart_entries_v2 to authenticated;
grant select on table public.wk_chart_markets_v2 to authenticated;
grant select on table public.wk_chart_programs_v2 to authenticated;
grant select on table public.wk_chart_series_v2 to authenticated;
grant select on table public.wk_chart_slug_aliases_v2 to authenticated;
grant select on table public.wk_chart_source_coverage_v2 to authenticated;
grant select on table public.wk_chart_methodologies_v2 to authenticated;
