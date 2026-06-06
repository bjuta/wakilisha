-- WAKILISHA Auth Phase 3b: admin-assisted password recovery support.
-- Actual reset email sending is handled by Supabase Auth from the app/API.
-- This migration records the admin action and keeps recovery auditable.

create table if not exists public.admin_account_recovery_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text not null,
  requested_by uuid references auth.users(id) on delete set null,
  recovery_type text not null default 'password_reset' check (recovery_type in ('password_reset', 'magic_link', 'account_reactivation')),
  delivery_status text not null default 'requested' check (delivery_status in ('requested', 'sent', 'failed')),
  redirect_to text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_account_recovery_events_email_idx on public.admin_account_recovery_events(lower(target_email), created_at desc);
create index if not exists admin_account_recovery_events_requested_by_idx on public.admin_account_recovery_events(requested_by, created_at desc);

alter table public.admin_account_recovery_events enable row level security;

drop policy if exists admin_account_recovery_events_admin_read on public.admin_account_recovery_events;
create policy admin_account_recovery_events_admin_read on public.admin_account_recovery_events for select using (public.current_user_is_administrator());

drop policy if exists admin_account_recovery_events_admin_write on public.admin_account_recovery_events;
create policy admin_account_recovery_events_admin_write on public.admin_account_recovery_events for all using (public.current_user_is_administrator()) with check (public.current_user_is_administrator());

create or replace function public.record_password_reset_admin(
  target_user_id uuid,
  target_email text,
  redirect_to text default null,
  delivery_status text default 'requested',
  message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recovery_id uuid;
begin
  if not public.current_user_is_administrator() then
    raise exception 'Only administrators can record password reset actions.' using errcode = '42501';
  end if;

  insert into public.admin_account_recovery_events (target_user_id, target_email, requested_by, recovery_type, delivery_status, redirect_to, message, metadata, created_at, updated_at)
  values (target_user_id, target_email, auth.uid(), 'password_reset', delivery_status, redirect_to, message, jsonb_build_object('source', 'admin_users_console'), now(), now())
  returning id into recovery_id;

  perform public.record_admin_audit('password_reset_requested', 'admin_account_recovery_events', recovery_id::text, target_user_id, coalesce(message, 'Password reset requested from admin users console.'), jsonb_build_object('target_email', target_email, 'redirect_to', redirect_to, 'delivery_status', delivery_status));
  return recovery_id;
end;
$$;
