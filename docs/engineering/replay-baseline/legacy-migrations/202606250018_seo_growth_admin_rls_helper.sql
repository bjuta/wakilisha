create or replace function public.is_current_user_administrator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  );
$$;

grant execute on function public.is_current_user_administrator() to authenticated;

drop policy if exists "Admins can read SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can read SEO growth tasks"
on public.seo_growth_tasks
for select
to authenticated
using (public.is_current_user_administrator());

drop policy if exists "Admins can insert SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can insert SEO growth tasks"
on public.seo_growth_tasks
for insert
to authenticated
with check (public.is_current_user_administrator());

drop policy if exists "Admins can update SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can update SEO growth tasks"
on public.seo_growth_tasks
for update
to authenticated
using (public.is_current_user_administrator())
with check (public.is_current_user_administrator());

drop policy if exists "Admins can read SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can read SEO growth drafts"
on public.seo_growth_drafts
for select
to authenticated
using (public.is_current_user_administrator());

drop policy if exists "Admins can insert SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can insert SEO growth drafts"
on public.seo_growth_drafts
for insert
to authenticated
with check (public.is_current_user_administrator());

drop policy if exists "Admins can update SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can update SEO growth drafts"
on public.seo_growth_drafts
for update
to authenticated
using (public.is_current_user_administrator())
with check (public.is_current_user_administrator());

drop policy if exists "Admins can read SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can read SEO artist trend signals"
on public.seo_artist_trend_signals
for select
to authenticated
using (public.is_current_user_administrator());

drop policy if exists "Admins can insert SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can insert SEO artist trend signals"
on public.seo_artist_trend_signals
for insert
to authenticated
with check (public.is_current_user_administrator());

drop policy if exists "Admins can update SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can update SEO artist trend signals"
on public.seo_artist_trend_signals
for update
to authenticated
using (public.is_current_user_administrator())
with check (public.is_current_user_administrator());
