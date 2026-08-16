\set ON_ERROR_STOP on

do $verify$
declare
  v_kind "char";
  v_constraint text;
begin
  select c.relkind
  into v_kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='community_post_reposts';

  if v_kind is distinct from 'r'::"char" then
    raise exception 'FAIL: community_post_reposts is not a table';
  end if;

  select c.relkind
  into v_kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='community_blocks';

  if v_kind is distinct from 'r'::"char" then
    raise exception 'FAIL: community_blocks is not a table';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='quoted_post_id'
  ) then
    raise exception 'FAIL: community_posts.quoted_post_id is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_reports'
      and column_name='post_id'
  ) then
    raise exception 'FAIL: community_reports.post_id is missing';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid='public.community_reports'::regclass
    and constraint_row.conname='community_reports_exactly_one_target_check';

  if position('num_nonnulls' in coalesce(v_constraint,''))=0
     or position('post_id' in coalesce(v_constraint,''))=0 then
    raise exception 'FAIL: Community Report target exclusivity is incomplete';
  end if;

  if to_regprocedure('public.community_set_block_state(text,text,text,boolean)') is null
     or to_regprocedure('public.community_get_block_state(text,text,text)') is null
     or to_regprocedure('public.community_set_post_repost_state(text,uuid,uuid,boolean)') is null
     or to_regprocedure('public.community_get_actor_repost_state(text,uuid,uuid[])') is null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_report_post(uuid,text,text)') is null then
    raise exception 'FAIL: M8B-M1 RPC surface is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid='public.community_follows'::regclass
      and trigger_row.tgname='trg_community_follows_block_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: Block Follow guard trigger is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_set_block_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_set_block_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_quote_post(text,uuid,uuid,text,text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_quote_post(text,uuid,uuid,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'FAIL: M8B-M1 RPC grants are incorrect';
  end if;

  if (
    select count(*)
    from private.phase_0a_rpc_classification classification
    where classification.function_signature in (
      'community_set_block_state(text,text,text,boolean)',
      'community_get_block_state(text,text,text)',
      'community_set_post_repost_state(text,uuid,uuid,boolean)',
      'community_get_actor_repost_state(text,uuid,uuid[])',
      'community_quote_post(text,uuid,uuid,text,text,text,text)',
      'community_report_post(uuid,text,text)'
    )
  )<>6 then
    raise exception 'FAIL: M8B-M1 RPC classifications are incomplete';
  end if;
end;
$verify$;

select jsonb_build_object(
  'posts',(
    select count(*)
    from public.community_posts
  ),
  'quote_posts',(
    select count(*)
    from public.community_posts
    where quoted_post_id is not null
  ),
  'active_reposts',(
    select count(*)
    from public.community_post_reposts
    where status='active'
  ),
  'active_blocks',(
    select count(*)
    from public.community_blocks
    where status='active'
  ),
  'post_reports',(
    select count(*)
    from public.community_reports
    where post_id is not null
  ),
  'm8b_m1_classifications',(
    select count(*)
    from private.phase_0a_rpc_classification classification
    where classification.function_signature in (
      'community_set_block_state(text,text,text,boolean)',
      'community_get_block_state(text,text,text)',
      'community_set_post_repost_state(text,uuid,uuid,boolean)',
      'community_get_actor_repost_state(text,uuid,uuid[])',
      'community_quote_post(text,uuid,uuid,text,text,text,text)',
      'community_report_post(uuid,text,text)'
    )
  )
) as wakilisha_m8b_m1_social_graph_verification;
