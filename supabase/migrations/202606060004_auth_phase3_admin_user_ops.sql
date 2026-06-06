-- WAKILISHA Auth Phase 3: user operations, invites, scoped access management, and audit support.

create extension if not exists pgcrypto;

create table if not exists public.admin_user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_key text not null references public.role_definitions(role_key) on delete restrict,
  display_name text,
  invite_status text not null default 'pending' check (invite_status in ('pending', 'sent', 'accepted', 'revoked', 'failed')),
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  invite_redirect_to text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(email, role_key, invite_status)
);

create index if not exists admin_user_invites_email_status_idx on public.admin_user_invites(lower(email), invite_status);
create index if not exists admin_user_invites_invited_by_idx on public.admin_user_invites(invited_by, created_at desc);

alter table public.admin_user_invites enable row level security;

drop policy if exists admin_user_invites_admin_read on public.admin_user_invites;
create policy admin_user_invites_admin_read on public.admin_user_invites for select using (public.current_user_is_administrator());

drop policy if exists admin_user_invites_admin_write on public.admin_user_invites;
create policy admin_user_invites_admin_write on public.admin_user_invites for all using (public.current_user_is_administrator()) with check (public.current_user_is_administrator());

create or replace function public.record_admin_audit(
  event_type text,
  target_table text default null,
  target_record_id text default null,
  target_user_id uuid default null,
  message text default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  insert into public.admin_audit_events (actor_user_id, target_user_id, event_type, target_table, target_record_id, message, metadata, created_at)
  values (auth.uid(), target_user_id, event_type, target_table, target_record_id, message, coalesce(metadata, '{}'::jsonb), now())
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.assign_user_role_admin(
  target_user_id uuid,
  target_role_key text,
  target_display_name text default null,
  target_bio text default null,
  assignment_notes text default null
)
returns public.user_role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned public.user_role_assignments;
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can assign roles.' using errcode = '42501';
  end if;

  insert into public.user_profiles (user_id, display_name, bio, status, created_at, updated_at)
  values (target_user_id, target_display_name, target_bio, 'active', now(), now())
  on conflict (user_id) do update set
    display_name = coalesce(excluded.display_name, user_profiles.display_name),
    bio = coalesce(excluded.bio, user_profiles.bio),
    status = 'active',
    updated_at = now();

  insert into public.user_role_assignments (user_id, role_key, status, assigned_by, assigned_at, notes, created_at, updated_at)
  values (target_user_id, target_role_key, 'active', auth.uid(), now(), assignment_notes, now(), now())
  on conflict (user_id, role_key) do update set
    status = 'active',
    assigned_by = auth.uid(),
    assigned_at = now(),
    notes = excluded.notes,
    updated_at = now()
  returning * into assigned;

  perform public.record_admin_audit('role_assigned', 'user_role_assignments', assigned.id::text, target_user_id, 'Role assigned from admin users console.', jsonb_build_object('role_key', target_role_key));
  return assigned;
end;
$$;

create or replace function public.revoke_user_role_admin(target_user_id uuid, target_role_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can revoke roles.' using errcode = '42501';
  end if;

  update public.user_role_assignments
  set status = 'revoked', updated_at = now()
  where user_id = target_user_id and role_key = target_role_key;

  perform public.record_admin_audit('role_revoked', 'user_role_assignments', target_user_id::text || ':' || target_role_key, target_user_id, 'Role revoked from admin users console.', jsonb_build_object('role_key', target_role_key));
  return true;
end;
$$;

create or replace function public.upsert_user_scope_admin(
  target_user_id uuid,
  target_role_key text,
  target_scope_type text,
  target_scope_value text,
  target_can_view boolean default true,
  target_can_edit boolean default false,
  target_can_publish boolean default false
)
returns public.user_access_scopes
language plpgsql
security definer
set search_path = public
as $$
declare
  scoped public.user_access_scopes;
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can manage user scopes.' using errcode = '42501';
  end if;

  insert into public.user_access_scopes (user_id, role_key, scope_type, scope_value, can_view, can_edit, can_publish, status, assigned_by, assigned_at, created_at, updated_at)
  values (target_user_id, target_role_key, target_scope_type, target_scope_value, target_can_view, target_can_edit, target_can_publish, 'active', auth.uid(), now(), now(), now())
  on conflict (user_id, role_key, scope_type, scope_value) do update set
    can_view = excluded.can_view,
    can_edit = excluded.can_edit,
    can_publish = excluded.can_publish,
    status = 'active',
    assigned_by = auth.uid(),
    assigned_at = now(),
    updated_at = now()
  returning * into scoped;

  perform public.record_admin_audit('scope_assigned', 'user_access_scopes', scoped.id::text, target_user_id, 'Scope assigned from admin users console.', jsonb_build_object('role_key', target_role_key, 'scope_type', target_scope_type, 'scope_value', target_scope_value, 'can_view', target_can_view, 'can_edit', target_can_edit, 'can_publish', target_can_publish));
  return scoped;
end;
$$;

create or replace function public.revoke_user_scope_admin(scope_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  payload jsonb;
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can revoke user scopes.' using errcode = '42501';
  end if;

  select user_id, jsonb_build_object('role_key', role_key, 'scope_type', scope_type, 'scope_value', scope_value)
  into target_user, payload
  from public.user_access_scopes
  where id = scope_id;

  update public.user_access_scopes set status = 'revoked', updated_at = now() where id = scope_id;
  perform public.record_admin_audit('scope_revoked', 'user_access_scopes', scope_id::text, target_user, 'Scope revoked from admin users console.', payload);
  return true;
end;
$$;

create or replace function public.suspend_user_access_admin(target_user_id uuid, reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can suspend users.' using errcode = '42501';
  end if;

  update public.user_profiles set status = 'suspended', updated_at = now() where user_id = target_user_id;
  update public.user_role_assignments set status = 'suspended', updated_at = now() where user_id = target_user_id and status = 'active';
  update public.user_access_scopes set status = 'suspended', updated_at = now() where user_id = target_user_id and status = 'active';
  perform public.record_admin_audit('user_suspended', 'user_profiles', target_user_id::text, target_user_id, coalesce(reason, 'User suspended from admin users console.'), jsonb_build_object('reason', reason));
  return true;
end;
$$;
