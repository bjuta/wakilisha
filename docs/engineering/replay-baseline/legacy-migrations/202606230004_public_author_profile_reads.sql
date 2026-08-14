-- Public author profiles need to be readable by the frontend.
-- Keep sensitive fields such as email out of browser-side SELECT grants.

grant usage on schema public to anon, authenticated;

grant select (
  id,
  slug,
  name,
  url,
  source_kind,
  bio,
  avatar_url,
  cover_url,
  role,
  location,
  social_links,
  joined_date
) on table public.registry_authors to anon, authenticated;

drop policy if exists registry_authors_public_profile_read on public.registry_authors;

create policy registry_authors_public_profile_read
on public.registry_authors
for select
to anon, authenticated
using (true);
