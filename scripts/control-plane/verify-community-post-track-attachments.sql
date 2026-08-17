\set ON_ERROR_STOP on

begin read only;

select
  case when exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='registry_track_id'
      and data_type='uuid'
  ) then 'PASS' else 'FAIL' end as registry_track_column,
  case when exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_posts'
      and constraint_row.conname='community_posts_registry_track_id_fkey'
  ) then 'PASS' else 'FAIL' end as canonical_track_fk,
  case when exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_posts'
      and constraint_row.conname='community_posts_content_required'
  ) then 'PASS' else 'FAIL' end as content_required,
  case when not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_posts'
      and constraint_row.conname='artist_updates_body_length'
  ) then 'PASS' else 'FAIL' end as legacy_caption_gate_removed;

select
  to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text,uuid)') is not null as publish_track_signature,
  to_regprocedure('public.community_edit_post(uuid,text,text,text,text,uuid)') is not null as edit_track_signature,
  to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)') is not null as quote_track_signature,
  to_regprocedure('private.community_present_post_track(uuid)') is not null as track_presenter,
  to_regprocedure('public.community_get_social_feed(integer,timestamp with time zone,text)') is not null as social_feed_signature,
  to_regprocedure('public.community_get_social_feed_legacy_m8c2(integer,timestamp with time zone,text)') is not null as social_feed_legacy_wrapper,
  to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text)') is null as old_publish_retired,
  to_regprocedure('public.community_edit_post(uuid,text,text,text,text)') is null as old_edit_retired,
  to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text)') is null as old_quote_retired;

select
  function_signature,
  access_class
from private.phase_0a_rpc_classification
where function_signature in (
  'community_publish_post(text,uuid,text,text,text,text,uuid)',
  'community_edit_post(uuid,text,text,text,text,uuid)',
  'community_quote_post(text,uuid,uuid,text,text,text,text,uuid)',
  'community_get_social_feed(integer,timestamp with time zone,text)'
)
order by function_signature;

rollback;
