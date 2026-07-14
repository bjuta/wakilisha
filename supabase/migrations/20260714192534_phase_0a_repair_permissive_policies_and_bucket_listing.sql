begin;

drop policy if exists "Service role can manage secrets" on public.admin_settings_secrets;
drop policy if exists "Service role manage briefing_catalog" on public.briefing_catalog;
drop policy if exists "Service role manage briefing_issue_recipients" on public.briefing_issue_recipients;
drop policy if exists "Service role manage briefing_issues" on public.briefing_issues;
drop policy if exists "Service role manage briefing_opt_ins" on public.briefing_opt_ins;
drop policy if exists "Service role manage briefing_subscribers" on public.briefing_subscribers;
drop policy if exists "Service role manage briefing_tokens" on public.briefing_tokens;

drop policy if exists auth_all_gsc_connections on public.gsc_connections;
create policy gsc_connections_admin_all
on public.gsc_connections
for all
to authenticated
using (public.current_user_is_administrator())
with check (public.current_user_is_administrator());

drop policy if exists auth_all_gsc_entity_matches on public.gsc_entity_matches;
create policy gsc_entity_matches_admin_all
on public.gsc_entity_matches
for all
to authenticated
using (public.current_user_is_administrator())
with check (public.current_user_is_administrator());

drop policy if exists auth_all_gsc_import_runs on public.gsc_import_runs;
create policy gsc_import_runs_admin_all
on public.gsc_import_runs
for all
to authenticated
using (public.current_user_is_administrator())
with check (public.current_user_is_administrator());

drop policy if exists auth_insert_gsc_metrics on public.gsc_query_page_metrics;
create policy gsc_query_page_metrics_admin_insert
on public.gsc_query_page_metrics
for insert
to authenticated
with check (public.current_user_is_administrator());

drop policy if exists "Authenticated users can insert registry canonicalization decisi" on public.registry_canonicalization_decisions;
create policy registry_canonicalization_decisions_review_insert
on public.registry_canonicalization_decisions
for insert
to authenticated
with check (
  public.current_user_has_capability('manage_review_queue')
  or public.current_user_is_administrator()
);

drop policy if exists authenticated_update_registry_media_assets on public.registry_media_assets;

drop policy if exists "Admin manage featured guides" on public.wk_magazine_featured_guides;
create policy featured_guides_admin_manage
on public.wk_magazine_featured_guides
for all
to authenticated
using (public.current_user_is_administrator())
with check (public.current_user_is_administrator());

drop policy if exists allow_public_insert on public.share_counts;
drop policy if exists allow_public_update on public.share_counts;

drop policy if exists "article-media public read" on storage.objects;
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists "cms-media public read" on storage.objects;
drop policy if exists profile_covers_public_read on storage.objects;

commit;
