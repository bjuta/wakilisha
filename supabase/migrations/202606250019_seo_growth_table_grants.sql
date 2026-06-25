grant usage on schema public to anon, authenticated;

grant select, insert, update on public.seo_growth_tasks to authenticated;
grant select, insert, update on public.seo_growth_drafts to authenticated;
grant select, insert, update on public.seo_artist_trend_signals to authenticated;

grant select on public.seo_artist_trend_signals to anon;
