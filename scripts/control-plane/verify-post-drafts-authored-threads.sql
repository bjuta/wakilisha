\set ON_ERROR_STOP on

begin read only;

select
  case when to_regclass('private.community_post_drafts') is not null
    then 'PASS' else 'FAIL' end as private_draft_store,
  case when to_regclass('public.community_post_threads') is not null
    then 'PASS' else 'FAIL' end as thread_store,
  case when exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='thread_id'
      and data_type='uuid'
  ) then 'PASS' else 'FAIL' end as thread_id_column,
  case when exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='thread_position'
      and data_type='integer'
  ) then 'PASS' else 'FAIL' end as thread_position_column,
  case when exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_threads'
      and relation.relrowsecurity
  ) then 'PASS' else 'FAIL' end as thread_store_rls;

select
  has_table_privilege('anon','private.community_post_drafts','select') as anon_can_read_drafts,
  has_table_privilege('authenticated','private.community_post_drafts','select') as authenticated_can_read_drafts,
  has_table_privilege('anon','public.community_post_threads','select') as anon_can_read_thread_table,
  has_table_privilege('authenticated','public.community_post_threads','select') as authenticated_can_read_thread_table,
  exists (
    select 1
    from pg_policy policy
    where policy.schemaname='public'
      and policy.tablename='community_post_threads'
  ) as thread_table_has_browser_policy;

select
  to_regprocedure('public.community_save_post_draft(uuid,uuid,integer,text,uuid,text,text,text,text,uuid,uuid)') is not null as save_draft_rpc,
  to_regprocedure('public.community_get_post_drafts(text,uuid)') is not null as read_drafts_rpc,
  to_regprocedure('public.community_delete_post_draft(uuid)') is not null as delete_draft_rpc,
  to_regprocedure('public.community_reorder_post_draft_group(uuid,uuid[])') is not null as reorder_draft_rpc,
  to_regprocedure('public.community_publish_post_draft_group(uuid)') is not null as publish_draft_group_rpc,
  to_regprocedure('public.community_get_thread(uuid)') is not null as thread_reader_rpc,
  to_regprocedure('public.community_get_post_thread_context(uuid)') is not null as thread_context_rpc;

select
  constraint_row.conname,
  pg_get_constraintdef(constraint_row.oid) as definition
from pg_constraint constraint_row
join pg_class relation on relation.oid=constraint_row.conrelid
join pg_namespace namespace on namespace.oid=relation.relnamespace
where namespace.nspname='public'
  and relation.relname='community_posts'
  and constraint_row.conname in (
    'community_posts_thread_id_fkey',
    'community_posts_thread_pair_check',
    'community_posts_thread_position_key'
  )
order by constraint_row.conname;

select
  constraint_row.conname,
  constraint_row.condeferrable,
  constraint_row.condeferred,
  pg_get_constraintdef(constraint_row.oid) as definition
from pg_constraint constraint_row
join pg_class relation on relation.oid=constraint_row.conrelid
join pg_namespace namespace on namespace.oid=relation.relnamespace
where namespace.nspname='private'
  and relation.relname='community_post_drafts'
  and constraint_row.conname in (
    'community_post_drafts_position_check',
    'community_post_drafts_owner_group_position_key'
  )
order by constraint_row.conname;

select
  function_signature,
  access_class
from private.phase_0a_rpc_classification
where function_signature in (
  'community_save_post_draft(uuid,uuid,integer,text,uuid,text,text,text,text,uuid,uuid)',
  'community_get_post_drafts(text,uuid)',
  'community_delete_post_draft(uuid)',
  'community_reorder_post_draft_group(uuid,uuid[])',
  'community_publish_post_draft_group(uuid)',
  'community_get_thread(uuid)',
  'community_get_post_thread_context(uuid)'
)
order by function_signature;

rollback;
