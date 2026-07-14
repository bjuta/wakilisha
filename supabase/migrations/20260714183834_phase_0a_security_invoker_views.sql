begin;

drop policy if exists
  guides_public_field_guide_read
on public.guides;

create policy
  guides_public_field_guide_read
on public.guides
for select
to anon, authenticated
using (
  status = 'published'
  and metadata ->> 'post_type' = 'wk_field_guide'
);

alter view public.registry_release_tracklists
  set (security_invoker = true);

alter view public.wk_guides
  set (security_invoker = true);

commit;
