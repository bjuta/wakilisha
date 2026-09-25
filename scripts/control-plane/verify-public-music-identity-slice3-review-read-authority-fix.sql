-- Permanent verifier: Public Music Identity Slice 3 review read authority fix.

do $verify$
declare
  v_columns text[];
  v_policy_count integer;
  v_policy_qual text;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260925110250'
      and name='public_music_identity_slice3_review_read_authority_fix'
  ) then
    raise exception
      'Slice 3 review read-authority migration is missing';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='active'
  ) then
    raise exception
      'mizizi_executor is not the active MIZIZI executor binding';
  end if;

  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='registry_review_items'
      and relation.relrowsecurity
  ) then
    raise exception
      'registry_review_items RLS is not enabled';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'SELECT'
     )
  then
    raise exception
      'mizizi_executor has forbidden whole-table review SELECT';
  end if;

  select array_agg(
           column_row.column_name
           order by column_row.column_name
         )
  into v_columns
  from information_schema.columns column_row
  where column_row.table_schema='public'
    and column_row.table_name='registry_review_items'
    and has_column_privilege(
      'mizizi_executor',
      'public.registry_review_items',
      column_row.column_name,
      'SELECT'
    );

  if v_columns is distinct from
       array[
         'entity_type',
         'review_type',
         'source_id',
         'source_payload'
       ]::text[]
  then
    raise exception
      'Release Single identity review read columns drifted: %',
      v_columns;
  end if;

  select
    count(*)::integer,
    max(policy.qual)
  into
    v_policy_count,
    v_policy_qual
  from pg_policies policy
  where policy.schemaname='public'
    and policy.tablename='registry_review_items'
    and policy.cmd='SELECT'
    and 'mizizi_executor'=any(policy.roles);

  if v_policy_count<>1
     or v_policy_qual is null
     or position('mizizi_data_hygiene' in v_policy_qual)=0
     or position('release_single_identity_conflict' in v_policy_qual)=0
     or position('1.4.0' in v_policy_qual)=0
     or position('entity_type' in v_policy_qual)=0
     or position('release' in v_policy_qual)=0
  then
    raise exception
      'Release Single identity review RLS authority drifted';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'DELETE'
     )
  then
    raise exception
      'Release Single identity review authority gained direct mutation rights';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_SLICE3_REVIEW_READ_AUTHORITY_FIX_PASS'
  as result;
