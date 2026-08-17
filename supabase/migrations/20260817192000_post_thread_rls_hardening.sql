-- WAKILISHA M8C.3-M4: authored Thread backing-table RLS hardening.
-- Public Thread reads remain RPC-only. The backing table keeps author ownership
-- metadata private even if a future grant is added accidentally.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_thread_rls_preflight$
begin
  if to_regclass('public.community_post_threads') is null
     or to_regprocedure('public.community_get_thread(uuid)') is null
     or to_regprocedure('public.community_get_post_thread_context(uuid)') is null then
    raise exception 'STOP: M8C.3 Thread authority must exist before RLS hardening';
  end if;

  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_threads'
      and relation.relrowsecurity
  ) then
    raise exception 'STOP: community_post_threads RLS is already enabled';
  end if;
end;
$m8c3_thread_rls_preflight$;

alter table public.community_post_threads enable row level security;

revoke all on table public.community_post_threads from public,anon,authenticated;
grant select on table public.community_post_threads to service_role;

comment on table public.community_post_threads is
  'Published authored Thread grouping authority. Browser reads are RPC-only; the backing table is RLS-protected and has no anon or authenticated policies.';

do $m8c3_thread_rls_postcondition$
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_threads'
      and relation.relrowsecurity
  ) then
    raise exception 'STOP: community_post_threads RLS hardening did not land';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname='public'
      and policy.tablename='community_post_threads'
  ) then
    raise exception 'STOP: community_post_threads must not expose direct browser policies';
  end if;
end;
$m8c3_thread_rls_postcondition$;

commit;
