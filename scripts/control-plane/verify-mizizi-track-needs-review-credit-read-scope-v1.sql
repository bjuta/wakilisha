do $verify$
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
    raise exception
      'MIZIZI Track-Artist read policy does not expose the bounded active plus needs_review credit corpus';
  end if;

  if not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','track_id','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','artist_slug','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','status','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','is_primary','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','credit_order','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','created_at','SELECT'
     )
     or not has_column_privilege(
       'mizizi_executor','public.registry_track_artists','id','SELECT'
     )
     or has_column_privilege(
       'mizizi_executor','public.registry_track_artists','artist_id','SELECT'
     )
  then
    raise exception
      'MIZIZI Track-Artist bounded read columns drifted';
  end if;

  if has_table_privilege(
       'mizizi_executor','public.registry_track_artists','INSERT'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_track_artists','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_track_artists','DELETE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','INSERT'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor','public.registry_review_items','DELETE'
     )
  then
    raise exception
      'MIZIZI needs-review credit discovery widened write authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) then
    raise exception
      'MIZIZI needs-review credit discovery created standing capability';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception
      'MIZIZI needs-review credit discovery created active exact authority';
  end if;

  raise notice
    'MIZIZI_TRACK_NEEDS_REVIEW_CREDIT_READ_SCOPE_V1_PASS';
end
$verify$;
