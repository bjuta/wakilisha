-- Public Music Identity Slice 3: narrow Release-review read authority fix.
-- Generated migration identity:
-- 20260925110250_public_music_identity_slice3_review_read_authority_fix.sql
--
-- The Release Single production control plane reconstructs the frozen review
-- programme from registry_review_items while connected as mizizi_executor.
-- Stage C intentionally granted no read path to that table, so preflight
-- stopped before any Registry mutation. This migration grants only the four
-- columns required by that reconstruction and constrains visible rows through
-- RLS to this programme's Release-review rule.

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260925082706'
      and name='public_music_identity_slice3_release_single_alignment_v1'
  ) then
    raise exception
      'STOP: Slice 3 Release Single alignment migration must be applied first';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
  ) then
    raise exception
      'STOP: review read-authority repair requires MIZIZI zero at rest';
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
      'STOP: mizizi_executor must be the active MIZIZI executor binding';
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
      'STOP: registry_review_items RLS must be enabled';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'SELECT'
     )
     or exists (
       select 1
       from information_schema.columns column_row
       where column_row.table_schema='public'
         and column_row.table_name='registry_review_items'
         and has_column_privilege(
           'mizizi_executor',
           'public.registry_review_items',
           column_row.column_name,
           'SELECT'
         )
     )
  then
    raise exception
      'STOP: unexpected pre-existing mizizi_executor review read authority';
  end if;
end
$preflight$;

grant select (
  review_type,
  entity_type,
  source_id,
  source_payload
)
on public.registry_review_items
to mizizi_executor;

drop policy if exists
  mizizi_executor_release_single_review_read
on public.registry_review_items;

create policy
  mizizi_executor_release_single_review_read
on public.registry_review_items
for select
to mizizi_executor
using (
  review_type='mizizi_data_hygiene'
  and entity_type='release'
  and source_payload->>'ruleId'=
    'release_single_identity_conflict'
  and source_payload->>'ruleVersion'='1.4.0'
);

do $postflight$
declare
  v_columns text[];
  v_policy_qual text;
begin
  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'SELECT'
     )
  then
    raise exception
      'STOP: mizizi_executor received whole-table registry_review_items SELECT';
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
      'STOP: mizizi_executor registry_review_items column authority is not exact: %',
      v_columns;
  end if;

  select policy.qual
  into v_policy_qual
  from pg_policies policy
  where policy.schemaname='public'
    and policy.tablename='registry_review_items'
    and policy.policyname=
      'mizizi_executor_release_single_review_read'
    and policy.cmd='SELECT'
    and 'mizizi_executor'=any(policy.roles);

  if v_policy_qual is null
     or position('mizizi_data_hygiene' in v_policy_qual)=0
     or position('release_single_identity_conflict' in v_policy_qual)=0
     or position('1.4.0' in v_policy_qual)=0
     or position('entity_type' in v_policy_qual)=0
     or position('release' in v_policy_qual)=0
  then
    raise exception
      'STOP: Release Single review RLS policy is missing or drifted';
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
      'STOP: review read-authority repair granted mutation authority';
  end if;
end
$postflight$;
