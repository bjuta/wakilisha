-- WAKILISHA Auth Phase 1c: public users default to subscriber.
-- Subscriber is the unified public account role for lyrics contribution, follows, saves, profile, notifications, and lightweight future account actions.
-- Customer remains only as a backward-compatible role alias if legacy data ever contains it.

update public.role_definitions
set
  label = 'Customer / Subscriber Legacy Alias',
  description = 'Backward-compatible alias for older customer assignments. New public accounts should use subscriber.',
  priority = 135,
  updated_at = now()
where role_key = 'customer';

insert into public.capability_definitions (capability_key, label, domain, description) values
  ('contribute_lyrics', 'Contribute lyrics', 'community', 'Submit lyric contributions and corrections for review.'),
  ('follow_charts', 'Follow charts', 'audience', 'Follow chart programs and receive updates.'),
  ('follow_artists', 'Follow artists', 'audience', 'Follow artists and receive updates.'),
  ('manage_public_profile', 'Manage public profile', 'account', 'Manage public-facing contributor/member profile details.'),
  ('receive_notifications', 'Receive notifications', 'account', 'Receive account, chart, artist, and content notifications.')
on conflict (capability_key) do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

with role_caps(role_key, capability_key) as (
  values
    ('subscriber', 'view_public_account'),
    ('subscriber', 'manage_own_profile'),
    ('subscriber', 'manage_public_profile'),
    ('subscriber', 'manage_own_preferences'),
    ('subscriber', 'receive_notifications'),
    ('subscriber', 'save_content'),
    ('subscriber', 'follow_entities'),
    ('subscriber', 'follow_artists'),
    ('subscriber', 'follow_charts'),
    ('subscriber', 'contribute_lyrics'),
    ('subscriber', 'view_gated_content'),
    ('customer', 'view_public_account'),
    ('customer', 'manage_own_profile'),
    ('customer', 'manage_public_profile'),
    ('customer', 'manage_own_preferences'),
    ('customer', 'receive_notifications'),
    ('customer', 'save_content'),
    ('customer', 'follow_entities'),
    ('customer', 'follow_artists'),
    ('customer', 'follow_charts'),
    ('customer', 'contribute_lyrics'),
    ('customer', 'view_gated_content')
)
insert into public.role_capabilities (role_key, capability_key)
select role_key, capability_key from role_caps
on conflict (role_key, capability_key) do nothing;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, display_name, status, metadata, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    'active',
    jsonb_build_object('created_by', 'auth_signup_trigger'),
    now(),
    now()
  )
  on conflict (user_id) do update set
    email = coalesce(excluded.email, user_profiles.email),
    display_name = coalesce(user_profiles.display_name, excluded.display_name),
    status = coalesce(user_profiles.status, 'active'),
    updated_at = now();

  insert into public.user_role_assignments (user_id, role_key, status, assigned_by, assigned_at, notes, created_at, updated_at)
  values (new.id, 'subscriber', 'active', null, now(), 'Default role assigned on public signup.', now(), now())
  on conflict (user_id, role_key) do update set
    status = case when user_role_assignments.status = 'revoked' then 'active' else user_role_assignments.status end,
    updated_at = now();

  insert into public.admin_audit_events (actor_user_id, target_user_id, event_type, target_table, target_record_id, message, metadata, created_at)
  values (null, new.id, 'public_user_created', 'user_role_assignments', new.id::text, 'Default subscriber role assigned on signup.', jsonb_build_object('role_key', 'subscriber'), now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_wakilisha_profile on auth.users;
create trigger on_auth_user_created_wakilisha_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- Backfill existing auth users that have no durable role yet.
insert into public.user_profiles (user_id, email, display_name, status, metadata, created_at, updated_at)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(coalesce(au.email, ''), '@', 1)),
  'active',
  jsonb_build_object('created_by', 'subscriber_backfill'),
  now(),
  now()
from auth.users au
where not exists (select 1 from public.user_profiles up where up.user_id = au.id)
on conflict (user_id) do nothing;

insert into public.user_role_assignments (user_id, role_key, status, assigned_by, assigned_at, notes, created_at, updated_at)
select au.id, 'subscriber', 'active', null, now(), 'Backfilled default subscriber role.', now(), now()
from auth.users au
where not exists (
  select 1 from public.user_role_assignments ura
  where ura.user_id = au.id and ura.status = 'active'
)
on conflict (user_id, role_key) do nothing;
