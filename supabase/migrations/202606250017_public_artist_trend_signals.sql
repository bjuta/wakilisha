create index if not exists seo_artist_trend_signals_public_idx
  on public.seo_artist_trend_signals (status, trend_score desc);

drop policy if exists "Published SEO artist trend signals are publicly readable" on public.seo_artist_trend_signals;
create policy "Published SEO artist trend signals are publicly readable"
on public.seo_artist_trend_signals
for select
to anon, authenticated
using (status in ('approved', 'published'));
