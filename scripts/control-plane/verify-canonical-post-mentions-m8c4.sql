\set ON_ERROR_STOP on

begin;

select case
  when to_regclass('public.community_post_mentions') is not null
    then 'PASS: canonical Post mention table exists.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_mentions'
      and relation.relrowsecurity
  ) then 'PASS: Post mention table has RLS enabled.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when not has_table_privilege('anon','public.community_post_mentions','SELECT')
   and not has_table_privilege('anon','public.community_post_mentions','INSERT')
   and not has_table_privilege('authenticated','public.community_post_mentions','SELECT')
   and not has_table_privilege('authenticated','public.community_post_mentions','INSERT')
   and not has_table_privilege('authenticated','public.community_post_mentions','UPDATE')
   and not has_table_privilege('authenticated','public.community_post_mentions','DELETE')
    then 'PASS: browser roles have no direct mention-table CRUD.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_mentions'
      and constraint_row.conname='community_post_mentions_post_person_key'
  ) then 'PASS: one canonical Person mention per Post is enforced.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid=constraint_row.conrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_post_mentions'
      and constraint_row.conname='community_post_mentions_post_handle_key'
  ) then 'PASS: each authored handle token has one durable binding per Post.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%mention.handle_at_mention=any(v_handles)%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%retain that original binding%'
   and pg_get_functiondef(
    'private.community_extract_post_mention_handles(text)'::regprocedure
  ) ilike '%https?://%'
    then 'PASS: handle reuse and URL-contained tokens cannot silently retarget Mentions.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when to_regprocedure('private.community_notification_preference_enabled(uuid,text)') is not null
   and to_regprocedure('private.community_extract_post_mention_handles(text)') is not null
   and to_regprocedure('private.community_resolve_post_mentions(text)') is not null
   and to_regprocedure('private.community_reconcile_post_mentions(uuid)') is not null
   and to_regprocedure('public.community_get_post_mentions(uuid)') is not null
   and to_regprocedure('public.community_get_post(uuid)') is not null
   and to_regprocedure('public.community_get_post_legacy_m8c4(uuid)') is not null
    then 'PASS: M8C.4 mention reader and reconciliation functions exist.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_posts'
      and trigger_row.tgname='trg_community_posts_mentions'
      and not trigger_row.tgisinternal
  ) then 'PASS: canonical Posts own mention reconciliation.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'private.community_notification_preference_enabled(uuid,text)'::regprocedure
  ) ilike '%mention_notifications%'
   and pg_get_functiondef(
    'private.community_notification_preference_enabled(uuid,text)'::regprocedure
  ) ilike '%reply_notifications%'
    then 'PASS: stored Mention and Reply preferences are consulted.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%community_is_blocked_target%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%post_mention%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%mentioned_user_id<>v_post.author_user_id%'
    then 'PASS: Mention alerts enforce Block and self-mention suppression.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%delete from public.community_notifications%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%notification.entity_id=p_post_id::text%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%using public.community_post_mentions mention%'
   and pg_get_functiondef(
    'private.community_reconcile_post_mentions(uuid)'::regprocedure
  ) ilike '%v_post.status<>''published''%'
    then 'PASS: removed or withdrawn Mentions cannot leave stale Post notifications.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'public.community_get_post(uuid)'::regprocedure
  ) ilike '%community_get_post_legacy_m8c4%'
   and pg_get_functiondef(
    'public.community_get_post(uuid)'::regprocedure
  ) ilike '%community_get_post_mentions%'
    then 'PASS: canonical Post presentation includes resolved mentions.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when pg_get_functiondef(
    'public.community_distribute_notifications(uuid,uuid,uuid,uuid)'::regprocedure
  ) ilike '%community_notification_preference_enabled%'
   and pg_get_functiondef(
    'public.community_distribute_notifications(uuid,uuid,uuid,uuid)'::regprocedure
  ) ilike '%''reply''%'
    then 'PASS: Reply notification delivery honors the stored preference.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='community_notifications'
      and indexname='community_notifications_post_mention_once'
  ) then 'PASS: one Mention alert per recipient/Post is enforced.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

select case
  when exists (
    select 1
    from private.phase_0a_rpc_classification classification
    where classification.function_signature='community_get_post_mentions(uuid)'
      and classification.access_class='public_read'
  ) then 'PASS: mention reader RPC is classified as public read.'
  else pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')
end;

rollback;
