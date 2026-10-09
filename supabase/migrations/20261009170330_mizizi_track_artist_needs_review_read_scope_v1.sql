begin;

do $preflight$
declare
  v_policy text;
begin
  if not exists (
    select 1
    from pg_roles
    where rolname='mizizi_executor'
      and rolcanlogin
      and not rolsuper
      and not rolbypassrls
  ) then
    raise exception 'STOP: narrow mizizi_executor role is missing or unsafe';
  end if;

  select lower(pg_get_expr(policy.polqual,policy.polrelid))
  into v_policy
  from pg_policy policy
  where policy.polrelid='public.registry_track_artists'::regclass
    and policy.polname='mizizi_executor_registry_track_artists_read';

  if v_policy is null
     or position('active' in v_policy)=0
     or position('needs_review' in v_policy)>0
  then
    raise exception 'STOP: expected active-only MIZIZI Track-Artist read policy is missing';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_track_artists','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_track_artists','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_track_artists','DELETE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_review_items','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','DELETE')
  then
    raise exception 'STOP: mizizi_executor has ambient Track-Artist or review-row write authority';
  end if;
end
$preflight$;

drop policy if exists mizizi_executor_registry_track_artists_read
  on public.registry_track_artists;

create policy mizizi_executor_registry_track_artists_read
on public.registry_track_artists
for select
to mizizi_executor
using (status in ('active','needs_review'));

do $postflight$
declare
  v_policy text;
begin
  select lower(pg_get_expr(policy.polqual,policy.polrelid))
  into v_policy
  from pg_policy policy
  where policy.polrelid='public.registry_track_artists'::regclass
    and policy.polname='mizizi_executor_registry_track_artists_read';

  if v_policy is null
     or position('active' in v_policy)=0
     or position('needs_review' in v_policy)=0
  then
    raise exception 'STOP: MIZIZI Track-Artist read scope did not converge to active plus needs_review';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_track_artists','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_track_artists','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_track_artists','DELETE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_review_items','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','DELETE')
  then
    raise exception 'STOP: #1094 credit read-scope convergence widened write authority';
  end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and status='active'
      and valid_from<=now() and expires_at>now() and revoked_at is null
  ) then
    raise exception 'STOP: #1094 credit read-scope convergence created standing MIZIZI capability';
  end if;

  if exists (
    select 1 from platform_private.registry_execution_grants
    where actor_key='mizizi' and status='active'
      and expires_at>now() and revoked_at is null and consumed_at is null
  ) then
    raise exception 'STOP: #1094 credit read-scope convergence created active exact authority';
  end if;

  raise notice 'MIZIZI_TRACK_NEEDS_REVIEW_CREDIT_READ_SCOPE_V1_PASS';
end
$postflight$;

commit;
